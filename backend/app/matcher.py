"""ReconAI — the matching engine (Stage 4, the heart).

Deterministic, rule-based matching — this is the "AI" of the MVP, and it is
rules, not ML. The plan:

1. Normalize first: amounts -> integer cents, references -> trimmed + case-
   insensitive, dates already stored as ISO `date` objects.
2. Pass 1 — reference match: exact reference number is a strong signal. Pairs
   are strictly 1-to-1: a reference shared by several transactions on either
   side is ambiguous -> left unmatched (never guess).
3. Pass 2 — amount + date match: on the rows left over, group by (amount,
   date). A group with exactly one bank + one internal transaction pairs;
   anything bigger is ambiguous -> left unmatched.
4. Mismatch detection: a pair found by reference whose amounts differ is still
   a pair (same transaction, wrong value somewhere) but flagged `amount_mismatch`.

Reconcile is idempotent for the auto engine: it clears the user's auto matches
and recomputes from the current transactions. MANUAL matches (made by an
accountant from a suggestion) are preserved across re-runs — a human decision is
never silently undone. The UNIQUE constraints on `matches` make it impossible to
double-pair a transaction anyway.

Stage 5: reconcile ALSO derives exceptions from the fresh matches — every
transaction left out of a match is `unmatched`, and every reference pair whose
amounts differ is `mismatch`. Only OPEN exceptions are refreshed; RESOLVED ones
are a human decision and are left untouched (resolved is never a hard delete).

Stage 8: for any open `unmatched` exception, `suggest_matches()` ranks the
opposite-list transactions it *could* be (amount / date / description signals)
so the UI can offer one-click resolution via `create_manual_match()`.
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models import ExceptionRecord, Match, Transaction, _utcnow


@dataclass
class MatchResult:
    bank_total: int
    internal_total: int
    matched: int
    method_counts: dict[str, int] = field(default_factory=dict)
    unmatched_bank: int = 0
    unmatched_internal: int = 0
    amount_mismatches: int = 0
    open_exceptions: int = 0


def _to_cents(amount: float) -> int:
    """Float amounts (e.g. -1249.0) become integer cents (-124900). Comparing
    integer cents avoids float rounding surprises like 0.1 + 0.2 != 0.3."""
    return int(round(amount * 100))


def _norm_ref(reference: str | None) -> str | None:
    if reference is None:
        return None
    ref = reference.strip().casefold()
    return ref or None


def reconcile(db: Session, user_id: int) -> MatchResult:
    all_bank = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.source == "bank")
        .all()
    )
    all_internal = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.source == "internal")
        .all()
    )

    # Manual matches are a human decision and are preserved across re-runs.
    # Their transactions are excluded from the auto engine so a re-run never
    # re-pairs or re-flags something already resolved by hand.
    manual_matches = (
        db.query(Match)
        .filter(Match.user_id == user_id, Match.method == "manual")
        .all()
    )
    manual_bank_ids = {m.bank_txn_id for m in manual_matches}
    manual_internal_ids = {m.internal_txn_id for m in manual_matches}

    # Idempotent for the auto engine: clear auto matches and OPEN exceptions,
    # then recompute. Manual matches (and their resolved exceptions) are kept.
    db.query(Match).filter(Match.user_id == user_id, Match.method != "manual").delete()
    db.query(ExceptionRecord).filter(
        ExceptionRecord.user_id == user_id,
        ExceptionRecord.status == "open",
    ).delete()
    db.commit()

    bank = [t for t in all_bank if t.id not in manual_bank_ids]
    internal = [t for t in all_internal if t.id not in manual_internal_ids]

    bank_by_id = {t.id: t for t in bank}
    internal_by_id = {t.id: t for t in internal}
    used_bank: set[int] = set()
    used_internal: set[int] = set()

    new_matches: list[Match] = []
    mismatches = 0

    # ── Pass 1: reference match ──
    bank_by_ref: dict[str, list[int]] = defaultdict(list)
    for t in bank:
        ref = _norm_ref(t.reference)
        if ref:
            bank_by_ref[ref].append(t.id)
    internal_by_ref: dict[str, list[int]] = defaultdict(list)
    for t in internal:
        ref = _norm_ref(t.reference)
        if ref:
            internal_by_ref[ref].append(t.id)

    for ref, b_ids in bank_by_ref.items():
        i_ids = internal_by_ref.get(ref, [])
        # Both sides must have EXACTLY one transaction for this reference.
        # More than one on either side = ambiguous -> leave for review.
        if len(b_ids) == 1 and len(i_ids) == 1:
            b, i = bank_by_id[b_ids[0]], internal_by_id[i_ids[0]]
            mismatch = _to_cents(b.amount) != _to_cents(i.amount)
            new_matches.append(Match(
                user_id=user_id,
                bank_txn_id=b.id,
                internal_txn_id=i.id,
                method="reference",
                amount_mismatch=mismatch,
            ))
            used_bank.add(b.id)
            used_internal.add(i.id)
            if mismatch:
                mismatches += 1

    # ── Pass 2: amount + date match on what's left ──
    b_remaining = {tid: t for tid, t in bank_by_id.items() if tid not in used_bank}
    i_remaining = {tid: t for tid, t in internal_by_id.items() if tid not in used_internal}

    bank_by_key: dict[tuple[int, object], list[int]] = defaultdict(list)
    for tid, t in b_remaining.items():
        bank_by_key[(_to_cents(t.amount), t.date)].append(tid)
    internal_by_key: dict[tuple[int, object], list[int]] = defaultdict(list)
    for tid, t in i_remaining.items():
        internal_by_key[(_to_cents(t.amount), t.date)].append(tid)

    for key, b_ids in bank_by_key.items():
        i_ids = internal_by_key.get(key, [])
        # Same strict rule: exactly one on each side or it's ambiguous.
        if len(b_ids) == 1 and len(i_ids) == 1:
            b, i = bank_by_id[b_ids[0]], internal_by_id[i_ids[0]]
            new_matches.append(Match(
                user_id=user_id,
                bank_txn_id=b.id,
                internal_txn_id=i.id,
                method="amount_date",
                amount_mismatch=False,
            ))
            used_bank.add(b.id)
            used_internal.add(i.id)

    for m in new_matches:
        db.add(m)
    db.flush()  # assign m.id so exceptions can reference their match

    # ── Derive exceptions from the fresh matches ──
    new_exceptions: list[ExceptionRecord] = []
    for m in new_matches:
        if m.amount_mismatch:
            b = bank_by_id[m.bank_txn_id]
            i = internal_by_id[m.internal_txn_id]
            new_exceptions.append(ExceptionRecord(
                user_id=user_id,
                transaction_id=m.bank_txn_id,
                match_id=m.id,
                exception_type="mismatch",
                reason=f"Amount differs: bank {b.amount:.2f} vs internal {i.amount:.2f}",
            ))

    for tid, t in bank_by_id.items():
        if tid not in used_bank:
            new_exceptions.append(ExceptionRecord(
                user_id=user_id,
                transaction_id=tid,
                exception_type="unmatched",
                reason="No matching transaction found in the internal list",
            ))
    for tid, t in internal_by_id.items():
        if tid not in used_internal:
            new_exceptions.append(ExceptionRecord(
                user_id=user_id,
                transaction_id=tid,
                exception_type="unmatched",
                reason="No matching transaction found in the bank statement",
            ))

    for e in new_exceptions:
        db.add(e)
    db.commit()

    method_counts = {"reference": 0, "amount_date": 0, "manual": len(manual_matches)}
    for m in new_matches:
        method_counts[m.method] += 1

    matched = len(new_matches) + len(manual_matches)
    return MatchResult(
        bank_total=len(all_bank),
        internal_total=len(all_internal),
        matched=matched,
        method_counts=method_counts,
        unmatched_bank=len(all_bank) - matched,
        unmatched_internal=len(all_internal) - matched,
        amount_mismatches=mismatches + sum(1 for m in manual_matches if m.amount_mismatch),
        open_exceptions=len(new_exceptions),
    )


def current_summary(db: Session, user_id: int) -> MatchResult:
    """Read-only snapshot of the current matching state — no recompute, no
    writes. Used by GET /reconcile so the dashboard can render its KPIs on
    load without re-running the engine (POST /reconcile is the only writer)."""
    bank_count = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.source == "bank")
        .count()
    )
    internal_count = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.source == "internal")
        .count()
    )
    matches = db.query(Match).filter(Match.user_id == user_id).all()
    method_counts = {"reference": 0, "amount_date": 0, "manual": 0}
    for m in matches:
        method_counts[m.method] += 1
    used_bank = {m.bank_txn_id for m in matches}
    used_internal = {m.internal_txn_id for m in matches}
    open_exceptions = (
        db.query(ExceptionRecord)
        .filter(ExceptionRecord.user_id == user_id, ExceptionRecord.status == "open")
        .count()
    )
    return MatchResult(
        bank_total=bank_count,
        internal_total=internal_count,
        matched=len(matches),
        method_counts=method_counts,
        unmatched_bank=bank_count - len(used_bank),
        unmatched_internal=internal_count - len(used_internal),
        amount_mismatches=sum(1 for m in matches if m.amount_mismatch),
        open_exceptions=open_exceptions,
    )


def _norm_text(value: str | None) -> str:
    """Reference/description text normalized to space-joined alnum tokens,
    so 'Client-A' and 'CLIENT A' compare equal."""
    if not value:
        return ""
    return " ".join(re.findall(r"[a-z0-9]+", value.casefold()))


def _token_similarity(a: str | None, b: str | None) -> float:
    ta = set(_norm_text(a).split())
    tb = set(_norm_text(b).split())
    if not ta and not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def suggest_matches(
    db: Session,
    txn: Transaction,
    limit: int = 5,
) -> list[tuple[Transaction, int, list[str]]]:
    """Rank the opposite-list transactions `txn` could plausibly match.

    Confidence is a 0-100 score from independent signals, each weighted:
      - exact amount .................. 50 (within $1 -> 35)
      - same date ..................... 25 (within 3 days -> 15)
      - description/reference overlap .  up to 25 (token-set Jaccard)

    Candidates already paired (auto or manual) are excluded, so a suggestion
    is always actionable. Only candidates with at least one signal score > 0
    are returned.
    """
    opposite = "bank" if txn.source == "internal" else "internal"
    used_ids: set[int] = set()
    for m in db.query(Match).filter(Match.user_id == txn.user_id).all():
        used_ids.add(m.bank_txn_id)
        used_ids.add(m.internal_txn_id)

    scored: list[tuple[int, Transaction, list[str]]] = []
    for c in (
        db.query(Transaction)
        .filter(Transaction.user_id == txn.user_id, Transaction.source == opposite)
        .all()
    ):
        if c.id == txn.id or c.id in used_ids:
            continue

        score = 0.0
        reasons: list[str] = []

        if _to_cents(txn.amount) == _to_cents(c.amount):
            score += 50
            reasons.append("same amount")
        elif abs(txn.amount - c.amount) <= 1.0:
            score += 35
            reasons.append("amount within $1")

        days = abs((txn.date - c.date).days)
        if days == 0:
            score += 25
            reasons.append("same date")
        elif days <= 3:
            score += 15
            reasons.append(f"within {days} day{'s' if days > 1 else ''}")

        overlap = max(
            _token_similarity(txn.description, c.description),
            _token_similarity(txn.reference, c.reference),
        )
        if overlap >= 0.5:
            score += round(overlap * 25)
            reasons.append("similar description")

        if score > 0:
            scored.append((int(round(score)), c, reasons))

    scored.sort(key=lambda item: -item[0])
    return [(t, s, r) for s, t, r in scored[:limit]]


def create_manual_match(db: Session, exception: ExceptionRecord, match_txn: Transaction) -> ExceptionRecord:
    """Pair an unmatched exception's transaction to `match_txn` by hand and
    resolve the exception. Callers validate ownership / opposite-side first.

    The match is marked `method="manual"` so `reconcile()` preserves it and
    never re-pairs or re-flags these transactions.
    """
    txn = db.get(Transaction, exception.transaction_id)
    is_bank = txn.source == "bank"
    match = Match(
        user_id=txn.user_id,
        bank_txn_id=txn.id if is_bank else match_txn.id,
        internal_txn_id=txn.id if not is_bank else match_txn.id,
        method="manual",
        amount_mismatch=_to_cents(txn.amount) != _to_cents(match_txn.amount),
    )
    db.add(match)
    db.flush()  # assign match.id so the exception can link to it
    exception.status = "resolved"
    exception.match_id = match.id
    exception.resolved_at = _utcnow()
    db.commit()
    db.refresh(exception)
    return exception