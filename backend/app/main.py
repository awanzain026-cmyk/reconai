"""ReconAI — Backend (REST API + SQLite/Postgres + CORS + auth + CSV imports).

The Next.js frontend (localhost:3000, later the Vercel domain) is a different
origin than the API, so CORS is configured from the start — not retrofitted.

Stage 6 additions (firm-grade): clients, reconciliation runs, audit trail,
amount-at-risk KPIs, and a demo reset that tells a realistic story.
"""

import csv
import io
import json
import threading
from datetime import date, datetime
from typing import List

from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from app.auth import create_token, get_current_user, hash_password, verify_password
from app.db import Base, engine, get_db
from app.importer import parse_csv
from app.matcher import create_manual_match, current_summary, reconcile, suggest_matches
from app.models import (
    AuditEvent,
    Client,
    ExceptionRecord,
    Import,
    Match,
    ReconciliationRun,
    Transaction,
    User,
    _utcnow,
)


# ─── Schema: create new tables, then add new columns to existing ones ───
# `create_all` is idempotent but it never ALTERs an existing table, so new
# columns on `imports` / `transactions` / `matches` / `exceptions` are added
# explicitly here. Additive only (nullable), so it is safe to run on every boot
# and works on both SQLite and Postgres.
_ADDITIVE_COLUMNS: list[tuple[str, str, str]] = [
    ("imports", "client_id", "INTEGER"),
    ("transactions", "client_id", "INTEGER"),
    ("matches", "client_id", "INTEGER"),
    ("exceptions", "client_id", "INTEGER"),
]


def _ensure_schema() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        for table, column, ddl in _ADDITIVE_COLUMNS:
            if table not in tables:
                continue
            columns = {c["name"] for c in inspector.get_columns(table)}
            if column in columns:
                continue
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
    except Exception:
        # Never block startup on a migration hiccup; endpoints will surface a
        # clear error if the schema is genuinely unusable.
        pass


# Run in a background thread with a timeout so a sleeping Postgres doesn't block startup.
_t = threading.Thread(target=_ensure_schema, daemon=True)
_t.start()
_t.join(timeout=8)  # don't block startup for more than 8 seconds

app = FastAPI(title="ReconAI API")

# CORS from the start: local dev origins + the wildcard Vercel pattern so the
# deployed frontend works without touching this again at deploy time.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic models: what the API accepts / returns ───
class AuthIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    # bcrypt 5.x rejects passwords > 72 bytes, so we cap here rather than crash.
    password: str = Field(min_length=6, max_length=72)


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str


class MeOut(BaseModel):
    user_id: int
    email: str


class ClientIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    code: str | None = Field(default=None, max_length=40)
    currency: str = Field(default="USD", max_length=8)


class ClientUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    code: str | None = Field(default=None, max_length=40)
    currency: str | None = Field(default=None, max_length=8)


class ClientOut(BaseModel):
    id: int
    name: str
    code: str | None = None
    currency: str = "USD"
    created_at: datetime
    bank_total: int = 0
    internal_total: int = 0
    matched: int = 0
    open_exceptions: int = 0
    amount_at_risk: float = 0.0
    last_run_at: datetime | None = None


class ImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int | None = None
    source: str
    filename: str
    imported: int
    rejected: int
    created_at: datetime


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    date: date
    amount: float
    reference: str | None
    description: str | None


class RejectionOut(BaseModel):
    row: str
    reason: str


class ImportCreateOut(BaseModel):
    import_id: int
    client_id: int | None = None
    source: str
    filename: str
    imported: int
    rejected: int
    created_at: datetime
    rejections: List[RejectionOut]


class ReconcileOut(BaseModel):
    bank_total: int
    internal_total: int
    matched: int
    method_counts: dict[str, int]
    unmatched_bank: int
    unmatched_internal: int
    amount_mismatches: int
    open_exceptions: int
    amount_at_risk: float = 0.0
    client_id: int | None = None
    client_name: str | None = None
    last_run_at: datetime | None = None
    period_start: date | None = None
    period_end: date | None = None


class ExceptionTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    date: date
    amount: float
    reference: str | None
    description: str | None


class ExceptionOut(BaseModel):
    id: int
    exception_type: str
    reason: str
    status: str
    created_at: datetime
    resolved_at: datetime | None
    # For an unmatched exception only one side exists; for a mismatch both do.
    bank_txn: ExceptionTransactionOut | None
    internal_txn: ExceptionTransactionOut | None


class ExceptionUpdateIn(BaseModel):
    status: str = Field(pattern="^(open|resolved)$")


class SuggestionOut(BaseModel):
    """One candidate transaction the user could match an unmatched exception to,
    with the confidence score and the signals that produced it."""
    transaction_id: int
    source: str
    date: date
    amount: float
    reference: str | None
    description: str | None
    confidence: int
    reasons: List[str]


class ManualMatchIn(BaseModel):
    match_transaction_id: int


class RunOut(BaseModel):
    id: int
    client_id: int
    client_name: str | None = None
    run_at: datetime
    bank_total: int
    internal_total: int
    matched: int
    unmatched_bank: int
    unmatched_internal: int
    amount_mismatches: int
    open_exceptions: int
    amount_at_risk: float
    match_rate: float
    method_counts: dict[str, int]
    triggered_by: str


class AuditOut(BaseModel):
    id: int
    client_id: int | None = None
    client_name: str | None = None
    event_type: str
    message: str
    actor: str
    created_at: datetime


# ─── Workspace helpers ───
def _ensure_default_client(db: Session, user_id: int) -> Client:
    """Every account needs at least one client. Create one on first use and
    backfill any legacy rows that predate the client_id column."""
    client = (
        db.query(Client)
        .filter(Client.user_id == user_id)
        .order_by(Client.id.asc())
        .first()
    )
    if client is None:
        client = Client(user_id=user_id, name="My first client", code="CL-001")
        db.add(client)
        db.commit()
        db.refresh(client)

    changed = False
    for model in (Import, Transaction, Match, ExceptionRecord):
        updated = (
            db.query(model)
            .filter(model.user_id == user_id, model.client_id.is_(None))
            .update({"client_id": client.id}, synchronize_session=False)
        )
        changed = changed or bool(updated)
    if changed:
        db.commit()
    return client


def _resolve_client(db: Session, user: User, client_id: int | None) -> Client:
    if client_id is None:
        return _ensure_default_client(db, user.id)
    client = db.get(Client, client_id)
    if client is None or client.user_id != user.id:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


def _client_out(db: Session, client: Client) -> ClientOut:
    summary = current_summary(db, client.user_id, client.id)
    last_run = (
        db.query(ReconciliationRun)
        .filter(
            ReconciliationRun.user_id == client.user_id,
            ReconciliationRun.client_id == client.id,
        )
        .order_by(ReconciliationRun.run_at.desc(), ReconciliationRun.id.desc())
        .first()
    )
    return ClientOut(
        id=client.id,
        name=client.name,
        code=client.code,
        currency=client.currency,
        created_at=client.created_at,
        bank_total=summary.bank_total,
        internal_total=summary.internal_total,
        matched=summary.matched,
        open_exceptions=summary.open_exceptions,
        amount_at_risk=summary.amount_at_risk,
        last_run_at=last_run.run_at if last_run else None,
    )


def _summary_payload(
    db: Session,
    client: Client,
    result,
) -> ReconcileOut:
    last_run = (
        db.query(ReconciliationRun)
        .filter(
            ReconciliationRun.user_id == client.user_id,
            ReconciliationRun.client_id == client.id,
        )
        .order_by(ReconciliationRun.run_at.desc(), ReconciliationRun.id.desc())
        .first()
    )
    bounds = (
        db.query(func.min(Transaction.date), func.max(Transaction.date))
        .filter(
            Transaction.user_id == client.user_id,
            Transaction.client_id == client.id,
        )
        .one()
    )
    return ReconcileOut(
        bank_total=result.bank_total,
        internal_total=result.internal_total,
        matched=result.matched,
        method_counts=result.method_counts,
        unmatched_bank=result.unmatched_bank,
        unmatched_internal=result.unmatched_internal,
        amount_mismatches=result.amount_mismatches,
        open_exceptions=result.open_exceptions,
        amount_at_risk=result.amount_at_risk,
        client_id=client.id,
        client_name=client.name,
        last_run_at=last_run.run_at if last_run else None,
        period_start=bounds[0],
        period_end=bounds[1],
    )


def _audit(
    db: Session,
    user_id: int,
    client_id: int | None,
    event_type: str,
    message: str,
    actor: str = "system",
) -> None:
    db.add(AuditEvent(
        user_id=user_id,
        client_id=client_id,
        event_type=event_type,
        message=message[:500],
        actor=actor,
    ))
    db.commit()


def _record_run(
    db: Session,
    user_id: int,
    client_id: int,
    result,
    actor: str = "system",
) -> ReconciliationRun:
    match_rate = (
        round((result.matched / result.bank_total) * 100, 1) if result.bank_total else 0.0
    )
    run = ReconciliationRun(
        user_id=user_id,
        client_id=client_id,
        bank_total=result.bank_total,
        internal_total=result.internal_total,
        matched=result.matched,
        unmatched_bank=result.unmatched_bank,
        unmatched_internal=result.unmatched_internal,
        amount_mismatches=result.amount_mismatches,
        open_exceptions=result.open_exceptions,
        amount_at_risk=result.amount_at_risk,
        match_rate=match_rate,
        method_counts=json.dumps(result.method_counts),
        triggered_by=actor,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _delete_client_data(db: Session, user_id: int, client_id: int) -> None:
    """Remove everything derived from one client's uploads (the client row
    itself is handled by the caller)."""
    db.query(ExceptionRecord).filter(
        ExceptionRecord.user_id == user_id,
        ExceptionRecord.client_id == client_id,
    ).delete(synchronize_session=False)
    db.query(Match).filter(
        Match.user_id == user_id,
        Match.client_id == client_id,
    ).delete(synchronize_session=False)
    db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.client_id == client_id,
    ).delete(synchronize_session=False)
    db.query(Import).filter(
        Import.user_id == user_id,
        Import.client_id == client_id,
    ).delete(synchronize_session=False)
    db.query(ReconciliationRun).filter(
        ReconciliationRun.user_id == user_id,
        ReconciliationRun.client_id == client_id,
    ).delete(synchronize_session=False)
    db.commit()


def _wipe_user_data(db: Session, user_id: int) -> None:
    db.query(AuditEvent).filter(AuditEvent.user_id == user_id).delete(synchronize_session=False)
    db.query(ExceptionRecord).filter(ExceptionRecord.user_id == user_id).delete(synchronize_session=False)
    db.query(Match).filter(Match.user_id == user_id).delete(synchronize_session=False)
    db.query(Transaction).filter(Transaction.user_id == user_id).delete(synchronize_session=False)
    db.query(Import).filter(Import.user_id == user_id).delete(synchronize_session=False)
    db.query(ReconciliationRun).filter(ReconciliationRun.user_id == user_id).delete(synchronize_session=False)
    db.query(Client).filter(Client.user_id == user_id).delete(synchronize_session=False)
    db.commit()


def _exception_out(db: Session, rec: ExceptionRecord) -> ExceptionOut:
    """Build the API view of an exception. For a mismatch, pull both sides from
    the match record; for unmatched, show the single transaction. Falls back to
    the single side if a resolved exception's match no longer exists."""
    bank: Transaction | None = None
    internal: Transaction | None = None

    if rec.match_id is not None:
        match = db.get(Match, rec.match_id)
        if match is not None:
            bank = db.get(Transaction, match.bank_txn_id)
            internal = db.get(Transaction, match.internal_txn_id)

    if bank is None and internal is None:
        txn = db.get(Transaction, rec.transaction_id)
        if txn is not None:
            if txn.source == "bank":
                bank = txn
            else:
                internal = txn

    return ExceptionOut(
        id=rec.id,
        exception_type=rec.exception_type,
        reason=rec.reason,
        status=rec.status,
        created_at=rec.created_at,
        resolved_at=rec.resolved_at,
        bank_txn=bank,
        internal_txn=internal,
    )


# ─── Routes ───
@app.get("/")
def root():
    return {"app": "ReconAI API", "docs": "/docs"}


# ─── Auth ───
@app.post("/auth/signup", response_model=AuthOut, status_code=201)
def signup(payload: AuthIn, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    _ensure_default_client(db, user.id)
    return {"access_token": create_token(user.id), "token_type": "bearer",
            "user_id": user.id, "email": user.email}


@app.post("/auth/login", response_model=AuthOut)
def login(payload: AuthIn, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": create_token(user.id), "token_type": "bearer",
            "user_id": user.id, "email": user.email}


@app.get("/auth/me", response_model=MeOut)
def me(current: User = Depends(get_current_user)):
    return {"user_id": current.id, "email": current.email}


# ─── Demo data ───
DEMO_EMAIL = "demo@reconai.app"
DEMO_PASSWORD = "reconai-demo"

# Two clients, deliberately different stories:
#  * Northwind Trading — a realistic month with 4 exceptions (one juicy amount
#    mismatch where HubSpot was recorded at $99 but the bank took $649).
#  * Cedar & Co. Advisory — a clean 100% match, to show the "done" state.
DEMO_CLIENTS: list[tuple[str, str, str, str]] = [
    (
        "Northwind Trading Ltd",
        "NWT-01",
        """date,amount,reference,description
2026-08-01,12500.00,INV-2041,Meridian Retail — invoice payment
2026-08-02,-3200.00,RENT-08,Office rent — August
2026-08-03,-845.50,AWS-08,AWS hosting
2026-08-04,4800.00,INV-2042,Harbour Logistics — invoice payment
2026-08-05,-1250.00,SAL-08,Payroll — August
2026-08-06,-189.99,SOFT-08,Adobe Creative Cloud
2026-08-07,-649.00,SOFT-08B,HubSpot subscription
2026-08-08,2200.00,INV-2043,Pinewood Studios — invoice payment
2026-08-10,-95.40,UTIL-08,Electricity
2026-08-11,-420.00,TRAV-08,Client travel — Manchester
2026-08-12,7600.00,INV-2044,Atlas Manufacturing — invoice payment
2026-08-14,-1500.00,VAT-08,VAT payment — HMRC
2026-08-15,-79.99,SOFT-08C,Zoom subscription
2026-08-18,3100.00,INV-2045,Bluebird Media — invoice payment
2026-08-20,-2150.00,,Contractor payment — design
2026-08-22,-340.00,INS-08,Business insurance
2026-08-25,900.00,,Refund — duplicate invoice
2026-08-28,-125.00,BANK-08,Bank charges
""",
        """date,amount,reference,description
2026-08-01,12500.00,INV-2041,Meridian Retail
2026-08-02,-3200.00,RENT-08,Office rent — August
2026-08-03,-845.50,AWS-08,AWS hosting
2026-08-04,4800.00,INV-2042,Harbour Logistics
2026-08-05,-1250.00,SAL-08,Payroll — August
2026-08-06,-189.99,SOFT-08,Adobe Creative Cloud
2026-08-07,-99.00,SOFT-08B,HubSpot subscription
2026-08-08,2200.00,INV-2043,Pinewood Studios
2026-08-10,-95.40,UTIL-08,Electricity
2026-08-11,-420.00,TRAV-08,Client travel — Manchester
2026-08-12,7600.00,INV-2044,Atlas Manufacturing
2026-08-14,-1500.00,VAT-08,VAT payment — HMRC
2026-08-15,-79.99,SOFT-08C,Zoom subscription
2026-08-18,3100.00,INV-2045,Bluebird Media
2026-08-22,-340.00,INS-08,Business insurance
2026-08-28,-125.00,BANK-08,Bank charges
2026-08-29,-2150.00,,Contractor — design
""",
    ),
    (
        "Cedar & Co. Advisory",
        "CED-02",
        """date,amount,reference,description
2026-07-01,6400.00,INV-3101,Client retainer — Q3
2026-07-03,-1800.00,RENT-07,Office rent — July
2026-07-05,-450.00,SUB-07,Microsoft 365
2026-07-08,2750.00,INV-3102,Advisory project — phase 1
2026-07-12,-620.00,TRAV-07,Travel — client site
2026-07-18,-2100.00,SAL-07,Payroll — July
2026-07-25,1800.00,INV-3103,Advisory project — phase 2
2026-07-30,-85.00,BANK-07,Bank charges
""",
        """date,amount,reference,description
2026-07-01,6400.00,INV-3101,Client retainer — Q3
2026-07-03,-1800.00,RENT-07,Office rent — July
2026-07-05,-450.00,SUB-07,Microsoft 365
2026-07-08,2750.00,INV-3102,Advisory project — phase 1
2026-07-12,-620.00,TRAV-07,Travel — client site
2026-07-18,-2100.00,SAL-07,Payroll — July
2026-07-25,1800.00,INV-3103,Advisory project — phase 2
2026-07-30,-85.00,BANK-07,Bank charges
""",
    ),
]


def _seed_demo_data(db: Session, user_id: int, actor: str) -> list[Client]:
    """Replace the account's data with two realistic sample clients, then run
    the real matching engine so the dashboard, history and workpaper all have
    genuine records on first login."""
    _wipe_user_data(db, user_id)
    created: list[Client] = []

    for name, code, bank_csv, internal_csv in DEMO_CLIENTS:
        client = Client(user_id=user_id, name=name, code=code)
        db.add(client)
        db.commit()
        db.refresh(client)

        for source, raw in (("bank", bank_csv), ("internal", internal_csv)):
            rows, rejections = parse_csv(raw.encode("utf-8"))
            batch = Import(
                user_id=user_id,
                client_id=client.id,
                source=source,
                filename=f"{code.lower()}-{source}.csv",
                imported=len(rows),
                rejected=len(rejections),
            )
            db.add(batch)
            db.flush()
            for row in rows:
                db.add(Transaction(
                    user_id=user_id,
                    client_id=client.id,
                    import_id=batch.id,
                    source=source,
                    date=row["date"],
                    amount=row["amount"],
                    description=row["description"],
                    reference=row["reference"],
                ))
            db.commit()
            _audit(
                db,
                user_id,
                client.id,
                "import.uploaded",
                f"Imported {batch.filename} ({batch.imported} rows) for {name}",
                actor,
            )

        result = reconcile(db, user_id, client.id)
        _record_run(db, user_id, client.id, result, actor=actor)
        _audit(
            db,
            user_id,
            client.id,
            "reconcile.run",
            f"Reconciliation run for {name}: {result.matched} matched, {result.open_exceptions} open exceptions",
            actor,
        )
        _audit(
            db,
            user_id,
            client.id,
            "client.seeded",
            f"Sample data loaded for {name}",
            actor,
        )
        created.append(client)

    return created


def _demo_needs_seed(db: Session, user_id: int) -> bool:
    has_clients = db.query(Client).filter(Client.user_id == user_id).count() > 0
    has_runs = db.query(ReconciliationRun).filter(ReconciliationRun.user_id == user_id).count() > 0
    return not (has_clients and has_runs)


@app.post("/auth/demo", response_model=AuthOut)
def demo_login(db: Session = Depends(get_db)):
    """One-click demo access for the landing page. Creates (or reuses) a shared
    demo account seeded with sample data on first use — no signup friction."""
    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if user is None:
        user = User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD))
        db.add(user)
        db.commit()
        db.refresh(user)
        _seed_demo_data(db, user.id, actor=DEMO_EMAIL)
    elif _demo_needs_seed(db, user.id):
        _seed_demo_data(db, user.id, actor=DEMO_EMAIL)
    return {"access_token": create_token(user.id), "token_type": "bearer",
            "user_id": user.id, "email": user.email}


@app.post("/demo/reset", response_model=List[ClientOut])
def reset_demo(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Wipe this account's workspace and load the two sample clients again.
    Lets a demo be restarted cleanly after a fumbled run — no signup needed."""
    clients = _seed_demo_data(db, current.id, actor=current.email)
    return [_client_out(db, c) for c in clients]


# ─── Templates ───
# Sample CSVs that match the importer's expected columns. Public: they contain
# no user data, just a reference format users can download from the upload page.
CSV_TEMPLATES: dict[str, list[list[str]]] = {
    "bank": [
        ["date", "description", "reference", "amount"],
        ["2025-07-01", "Opening balance", "", ""],
        ["2025-07-02", "Payment to Vendor A", "REF-0001", "-1250.00"],
        ["2025-07-03", "Payroll run July", "PAY-2207", "-8420.50"],
        ["2025-07-05", "Sale invoice 1041", "INV-1041", "3600.00"],
        ["2025-07-08", "Transfer to savings", "TRF-0112", "-2000.00"],
        ["2025-07-10", "Refund from supplier", "REF-0002", "150.75"],
    ],
    "internal": [
        ["date", "description", "reference", "amount"],
        ["2025-07-01", "Opening balance", "", ""],
        ["2025-07-02", "Vendor A invoice", "REF-0001", "-1250.00"],
        ["2025-07-03", "Payroll - July", "PAY-2207", "-8420.50"],
        ["2025-07-05", "Invoice 1041 issued", "INV-1041", "3600.00"],
        ["2025-07-08", "Transfer to savings", "TRF-0112", "-2000.00"],
        ["2025-07-11", "Supplier credit note", "REF-0002", "150.75"],
    ],
}


@app.get("/templates/{source}")
def download_template(source: str):
    """Download a sample CSV that matches ReconAI's expected columns, ready to
    fill in and upload (bank or internal)."""
    if source not in CSV_TEMPLATES:
        raise HTTPException(status_code=404, detail="template not found")
    buf = io.StringIO()
    csv.writer(buf).writerows(CSV_TEMPLATES[source])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="reconai-{source}-template.csv"'},
    )


# ─── Clients (PROTECTED) ───
@app.get("/clients", response_model=List[ClientOut])
def list_clients(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Every client in the workspace, with live KPIs so the client list doubles
    as a firm-wide dashboard. Creates a default client on first use."""
    _ensure_default_client(db, current.id)
    clients = (
        db.query(Client)
        .filter(Client.user_id == current.id)
        .order_by(Client.id.asc())
        .all()
    )
    return [_client_out(db, c) for c in clients]


@app.post("/clients", response_model=ClientOut, status_code=201)
def create_client(
    payload: ClientIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    client = Client(
        user_id=current.id,
        name=payload.name.strip(),
        code=payload.code.strip() if payload.code else None,
        currency=(payload.currency or "USD").upper(),
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    _audit(db, current.id, client.id, "client.created", f"Client “{client.name}” created", current.email)
    return _client_out(db, client)


@app.patch("/clients/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    payload: ClientUpdateIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    client = db.get(Client, client_id)
    if client is None or client.user_id != current.id:
        raise HTTPException(status_code=404, detail="Client not found")

    if payload.name is not None:
        client.name = payload.name.strip()
    if payload.code is not None:
        client.code = payload.code.strip() or None
    if payload.currency is not None:
        client.currency = payload.currency.upper()
    db.commit()
    db.refresh(client)
    _audit(db, current.id, client.id, "client.updated", f"Client “{client.name}” updated", current.email)
    return _client_out(db, client)


@app.delete("/clients/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Delete a client and every upload, match and exception that belongs to it."""
    client = db.get(Client, client_id)
    if client is None or client.user_id != current.id:
        raise HTTPException(status_code=404, detail="Client not found")
    remaining = db.query(Client).filter(Client.user_id == current.id).count()
    if remaining <= 1:
        raise HTTPException(
            status_code=400,
            detail="A workspace needs at least one client. Create another one first.",
        )

    name = client.name
    _delete_client_data(db, current.id, client_id)
    db.query(AuditEvent).filter(
        AuditEvent.user_id == current.id,
        AuditEvent.client_id == client_id,
    ).delete(synchronize_session=False)
    db.delete(client)
    db.commit()
    _audit(db, current.id, None, "client.deleted", f"Client “{name}” deleted", current.email)
    return {"ok": True, "deleted_client_id": client_id}


# ─── Imports (PROTECTED) ───
@app.post("/imports", response_model=ImportCreateOut, status_code=201)
async def create_import(
    source: str = Form(...),
    file: UploadFile = File(...),
    client_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Upload one CSV as a 'bank' or 'internal' list for a specific client.
    Parses it, stores the batch (an `imports` row) and its rows
    (`transactions`), and reports how many rows were imported vs rejected."""
    if source not in {"bank", "internal"}:
        raise HTTPException(status_code=422, detail="source must be 'bank' or 'internal'")

    client = _resolve_client(db, current, client_id)

    content = await file.read()
    rows, rejections = parse_csv(content)

    batch = Import(
        user_id=current.id,
        client_id=client.id,
        source=source,
        filename=file.filename or "upload.csv",
        imported=len(rows),
        rejected=len(rejections),
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    for row in rows:
        db.add(Transaction(
            user_id=current.id,
            client_id=client.id,
            import_id=batch.id,
            source=source,
            date=row["date"],
            amount=row["amount"],
            description=row["description"],
            reference=row["reference"],
        ))
    db.commit()

    _audit(
        db,
        current.id,
        client.id,
        "import.uploaded",
        f"Imported {batch.filename} ({batch.imported} rows, {batch.rejected} rejected) for {client.name}",
        current.email,
    )

    return {
        "import_id": batch.id,
        "client_id": client.id,
        "source": batch.source,
        "filename": batch.filename,
        "imported": batch.imported,
        "rejected": batch.rejected,
        "created_at": batch.created_at,
        "rejections": [{"row": r, "reason": reason} for r, reason in rejections],
    }


@app.get("/imports", response_model=List[ImportOut])
def list_imports(
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    client = _resolve_client(db, current, client_id)
    return (
        db.query(Import)
        .filter(Import.user_id == current.id, Import.client_id == client.id)
        .order_by(Import.id.desc())
        .all()
    )


@app.get("/imports/{import_id}/transactions", response_model=List[TransactionOut])
def list_import_transactions(
    import_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    batch = db.get(Import, import_id)
    if batch is None or batch.user_id != current.id:
        raise HTTPException(status_code=404, detail="Import not found")
    return (
        db.query(Transaction)
        .filter(Transaction.import_id == import_id)
        .order_by(Transaction.date, Transaction.id)
        .all()
    )


@app.delete("/imports/{import_id}", response_model=ReconcileOut)
def delete_import(
    import_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Delete one uploaded file and everything derived from it: its
    transactions, any matches they participate in, and the exceptions they
    produced. Reconciliation re-runs so the remaining data stays consistent
    (e.g. a matched partner that lost its pair becomes an unmatched exception)."""
    batch = db.get(Import, import_id)
    if batch is None or batch.user_id != current.id:
        raise HTTPException(status_code=404, detail="Import not found")

    client = _resolve_client(db, current, batch.client_id)

    txn_ids = [
        t.id
        for t in db.query(Transaction)
        .filter(Transaction.import_id == import_id)
        .all()
    ]
    if txn_ids:
        match_ids = [
            m.id
            for m in db.query(Match)
            .filter(
                Match.user_id == current.id,
                (Match.bank_txn_id.in_(txn_ids)) | (Match.internal_txn_id.in_(txn_ids)),
            )
            .all()
        ]
        if match_ids:
            db.query(ExceptionRecord).filter(
                ExceptionRecord.user_id == current.id,
                ExceptionRecord.match_id.in_(match_ids),
            ).delete(synchronize_session=False)
            db.query(Match).filter(Match.id.in_(match_ids)).delete(synchronize_session=False)
        db.query(ExceptionRecord).filter(
            ExceptionRecord.user_id == current.id,
            ExceptionRecord.transaction_id.in_(txn_ids),
        ).delete(synchronize_session=False)
        db.query(Transaction).filter(Transaction.id.in_(txn_ids)).delete(synchronize_session=False)

    removed_filename = batch.filename
    db.delete(batch)
    db.commit()
    _audit(
        db,
        current.id,
        client.id,
        "import.deleted",
        f"Removed upload {removed_filename} for {client.name}",
        current.email,
    )
    result = reconcile(db, current.id, client.id)
    return _summary_payload(db, client, result)


@app.delete("/data", response_model=ReconcileOut)
def delete_all_data(
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Wipe ALL reconciliation data for one client — every import, transaction,
    match, exception and run. The client itself (and the account) stays, so the
    user can start fresh from the upload page."""
    client = _resolve_client(db, current, client_id)
    _delete_client_data(db, current.id, client.id)
    _audit(db, current.id, client.id, "data.deleted", f"All reconciliation data cleared for {client.name}", current.email)
    return _summary_payload(db, client, current_summary(db, current.id, client.id))


# ─── Reconcile (PROTECTED) ───
@app.post("/reconcile", response_model=ReconcileOut)
def run_reconcile(
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Run the matching engine over one client's bank vs internal transactions.
    Idempotent: safe to re-run after uploading more data — it recomputes all
    matches from the current transactions and records a run in the history."""
    client = _resolve_client(db, current, client_id)
    bank_count = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current.id,
            Transaction.client_id == client.id,
            Transaction.source == "bank",
        )
        .count()
    )
    internal_count = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current.id,
            Transaction.client_id == client.id,
            Transaction.source == "internal",
        )
        .count()
    )
    if bank_count == 0 or internal_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Upload both a bank and an internal CSV before reconciling",
        )

    result = reconcile(db, current.id, client.id)
    _record_run(db, current.id, client.id, result, actor=current.email)
    _audit(
        db,
        current.id,
        client.id,
        "reconcile.run",
        f"Reconciliation run for {client.name}: {result.matched} matched, {result.open_exceptions} open exceptions",
        current.email,
    )
    return _summary_payload(db, client, result)


@app.get("/reconcile", response_model=ReconcileOut)
def reconcile_summary(
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Read-only view of the current matching state (same shape as POST
    /reconcile). Lets the dashboard render KPIs on load without re-running."""
    client = _resolve_client(db, current, client_id)
    return _summary_payload(db, client, current_summary(db, current.id, client.id))


# ─── Run history (PROTECTED) ───
@app.get("/runs", response_model=List[RunOut])
def list_runs(
    client_id: int | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    client = _resolve_client(db, current, client_id)
    runs = (
        db.query(ReconciliationRun)
        .filter(
            ReconciliationRun.user_id == current.id,
            ReconciliationRun.client_id == client.id,
        )
        .order_by(ReconciliationRun.run_at.desc(), ReconciliationRun.id.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )
    return [
        RunOut(
            id=r.id,
            client_id=r.client_id,
            client_name=client.name,
            run_at=r.run_at,
            bank_total=r.bank_total,
            internal_total=r.internal_total,
            matched=r.matched,
            unmatched_bank=r.unmatched_bank,
            unmatched_internal=r.unmatched_internal,
            amount_mismatches=r.amount_mismatches,
            open_exceptions=r.open_exceptions,
            amount_at_risk=r.amount_at_risk,
            match_rate=r.match_rate,
            method_counts=json.loads(r.method_counts or "{}"),
            triggered_by=r.triggered_by,
        )
        for r in runs
    ]


# ─── Audit trail (PROTECTED) ───
@app.get("/audit", response_model=List[AuditOut])
def list_audit(
    client_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    client = _resolve_client(db, current, client_id)
    events = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.user_id == current.id,
            AuditEvent.client_id == client.id,
        )
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [
        AuditOut(
            id=e.id,
            client_id=e.client_id,
            client_name=client.name,
            event_type=e.event_type,
            message=e.message,
            actor=e.actor,
            created_at=e.created_at,
        )
        for e in events
    ]


# ─── Exceptions (PROTECTED) ───
@app.get("/exceptions", response_model=List[ExceptionOut])
def list_exceptions(
    status: str | None = None,
    type: str | None = None,
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """The review queue. Optional filters: ?status=open|resolved, ?type=unmatched|mismatch."""
    if status is not None and status not in {"open", "resolved"}:
        raise HTTPException(status_code=422, detail="status must be 'open' or 'resolved'")
    if type is not None and type not in {"unmatched", "mismatch"}:
        raise HTTPException(status_code=422, detail="type must be 'unmatched' or 'mismatch'")

    client = _resolve_client(db, current, client_id)
    q = db.query(ExceptionRecord).filter(
        ExceptionRecord.user_id == current.id,
        ExceptionRecord.client_id == client.id,
    )
    if status:
        q = q.filter(ExceptionRecord.status == status)
    if type:
        q = q.filter(ExceptionRecord.exception_type == type)

    records = q.order_by(ExceptionRecord.id.desc()).all()
    return [_exception_out(db, r) for r in records]


@app.get("/exceptions/export")
def export_exceptions(
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Download every exception for one client as a CSV audit trail."""
    client = _resolve_client(db, current, client_id)
    records = (
        db.query(ExceptionRecord)
        .filter(
            ExceptionRecord.user_id == current.id,
            ExceptionRecord.client_id == client.id,
        )
        .order_by(ExceptionRecord.id.desc())
        .all()
    )

    def txn_row(t: ExceptionTransactionOut | None) -> list[str]:
        if t is None:
            return ["", "", "", ""]
        return [
            t.date.isoformat(),
            t.description or "",
            t.reference or "",
            f"{t.amount:.2f}",
        ]

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id",
        "type",
        "reason",
        "status",
        "created_at",
        "resolved_at",
        "bank_date",
        "bank_description",
        "bank_reference",
        "bank_amount",
        "internal_date",
        "internal_description",
        "internal_reference",
        "internal_amount",
    ])
    for rec in records:
        out = _exception_out(db, rec)
        writer.writerow([
            rec.id,
            rec.exception_type,
            rec.reason,
            rec.status,
            rec.created_at.isoformat(),
            rec.resolved_at.isoformat() if rec.resolved_at else "",
            *txn_row(out.bank_txn),
            *txn_row(out.internal_txn),
        ])

    safe_name = "".join(ch for ch in client.name if ch.isalnum() or ch in " -_").strip() or "client"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="reconai-exceptions-{safe_name}.csv"'},
    )


@app.patch("/exceptions/{exception_id}", response_model=ExceptionOut)
def update_exception(
    exception_id: int,
    payload: ExceptionUpdateIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Mark an exception resolved (or reopen it). Own data only; 404 otherwise.
    Resolving sets resolved_at; reopening clears it."""
    rec = db.get(ExceptionRecord, exception_id)
    if rec is None or rec.user_id != current.id:
        raise HTTPException(status_code=404, detail="Exception not found")

    rec.status = payload.status
    rec.resolved_at = _utcnow() if payload.status == "resolved" else None
    db.commit()
    db.refresh(rec)
    _audit(
        db,
        current.id,
        rec.client_id,
        "exception.resolved" if payload.status == "resolved" else "exception.reopened",
        f"Exception #{rec.id} marked {payload.status}",
        current.email,
    )
    return _exception_out(db, rec)


@app.get("/exceptions/{exception_id}/suggestions", response_model=List[SuggestionOut])
def exception_suggestions(
    exception_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Smart auto-match suggestions for an open unmatched exception: the
    opposite-list transactions it could plausibly be, ranked by confidence
    (amount + date + description signals), with the reasons shown. Already-paired
    transactions are excluded so every suggestion is actionable."""
    rec = db.get(ExceptionRecord, exception_id)
    if rec is None or rec.user_id != current.id:
        raise HTTPException(status_code=404, detail="Exception not found")
    if rec.exception_type != "unmatched" or rec.status != "open":
        return []
    txn = db.get(Transaction, rec.transaction_id)
    if txn is None:
        return []
    return [
        SuggestionOut(
            transaction_id=t.id,
            source=t.source,
            date=t.date,
            amount=t.amount,
            reference=t.reference,
            description=t.description,
            confidence=score,
            reasons=reasons,
        )
        for t, score, reasons in suggest_matches(db, txn)
    ]


@app.post("/exceptions/{exception_id}/match", response_model=ExceptionOut)
def match_exception(
    exception_id: int,
    payload: ManualMatchIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Resolve an unmatched exception by pairing its transaction to a chosen
    opposite-list transaction. Stored as a manual match, so it survives future
    re-reconciliations instead of being recomputed away."""
    rec = db.get(ExceptionRecord, exception_id)
    if rec is None or rec.user_id != current.id:
        raise HTTPException(status_code=404, detail="Exception not found")
    if rec.status != "open":
        raise HTTPException(status_code=400, detail="Exception is already resolved")
    if rec.exception_type != "unmatched":
        raise HTTPException(status_code=400, detail="Only unmatched exceptions can be matched directly")

    txn = db.get(Transaction, rec.transaction_id)
    candidate = db.get(Transaction, payload.match_transaction_id)
    if txn is None or candidate is None or candidate.user_id != current.id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if candidate.client_id != txn.client_id:
        raise HTTPException(status_code=422, detail="Candidate belongs to a different client")
    if candidate.source == txn.source:
        raise HTTPException(status_code=422, detail="Candidate must be on the opposite list")
    if candidate.id == txn.id:
        raise HTTPException(status_code=422, detail="Cannot match a transaction to itself")

    already = (
        db.query(Match)
        .filter(
            Match.user_id == current.id,
            (Match.bank_txn_id == txn.id)
            | (Match.internal_txn_id == txn.id)
            | (Match.bank_txn_id == candidate.id)
            | (Match.internal_txn_id == candidate.id),
        )
        .first()
    )
    if already is not None:
        raise HTTPException(status_code=400, detail="One of these transactions is already matched")

    create_manual_match(db, rec, candidate)
    _audit(
        db,
        current.id,
        rec.client_id,
        "exception.matched",
        f"Exception #{rec.id} matched by hand",
        current.email,
    )
    return _exception_out(db, rec)
