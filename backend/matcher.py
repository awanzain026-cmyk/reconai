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

Reconcile is idempotent: it deletes the user's existing matches and recomputes
from the current transactions. The UNIQUE constraints on `matches` make it
impossible to double-pair a transaction anyway.

Stage 5: reconcile ALSO derives exceptions from the fresh matches — every
transaction left out of a match is `unmatched`, and every reference pair whose
amounts differ is `mismatch`. Only OPEN exceptions are refreshed; RESOLVED ones
are a human decision and are left untouched (resolved is never a hard delete).
"""

from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from models import ExceptionRecord, Match, Transaction


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
    bank = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.source == "bank")
        .all()
    )
    internal = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.source == "internal")
        .all()
    )

    # Idempotent: start from a clean slate for this user every run. Only the
    # OPEN exceptions are refreshed — resolved ones are a human decision and
    # are preserved as history.
    db.query(Match).filter(Match.user_id == user_id).delete()
    db.query(ExceptionRecord).filter(
        ExceptionRecord.user_id == user_id,
        ExceptionRecord.status == "open",
    ).delete()
    db.commit()

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

    method_counts = {"reference": 0, "amount_date": 0}
    for m in new_matches:
        method_counts[m.method] += 1

    return MatchResult(
        bank_total=len(bank),
        internal_total=len(internal),
        matched=len(new_matches),
        method_counts=method_counts,
        unmatched_bank=len(bank) - len(used_bank),
        unmatched_internal=len(internal) - len(used_internal),
        amount_mismatches=mismatches,
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
    method_counts = {"reference": 0, "amount_date": 0}
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