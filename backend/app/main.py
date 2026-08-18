"""ReconAI — Backend (Stage 3: REST API + SQLite + CORS + auth + CSV imports).

The Next.js frontend (localhost:3000, later the Vercel domain) is a different
origin than the API, so CORS is configured from the start — not retrofitted.
"""

import io
from datetime import date, datetime
from typing import List

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth import create_token, get_current_user, hash_password, verify_password
from app.db import Base, engine, get_db
from app.importer import parse_csv
from app.matcher import current_summary, reconcile
from app.models import ExceptionRecord, Import, Match, Transaction, User, _utcnow

# Create tables if they don't exist (idempotent). In production we'd use migrations.
Base.metadata.create_all(bind=engine)

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


class ImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
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


# ─── Demo access (public landing-page CTA) ───
DEMO_EMAIL = "demo@reconai.app"
DEMO_PASSWORD = "reconai-demo"
DEMO_BANK_CSV = """date,amount,reference,description
2026-08-01,2500.00,INV-1001,Client A payment
2026-08-02,-1249.00,INV-1002,AWS hosting
2026-08-03,850.00,,Office rent deposit
2026-08-05,-320.50,INV-1004,Adobe subscription
2026-08-06,1200.00,INV-1005,Client B payment
2026-08-07,-75.00,,Coffee supplies
2026-08-08,540.00,INV-1007,Client C payment
2026-08-09,-210.00,INV-1008,Phone bill
2026-08-10,99.00,,Subscriptions
2026-08-11,-500.00,INV-1010,ATM withdrawal
"""
DEMO_INTERNAL_CSV = """date,amount,reference,description
2026-08-01,2500.00,INV-1001,Client A
2026-08-02,-1249.50,INV-1002,AWS hosting
2026-08-03,850.00,,Rent deposit
2026-08-05,-320.50,INV-1004,Adobe
2026-08-06,1200.00,INV-1005,Client B
2026-08-07,-75.00,,Coffee
2026-08-08,540.00,INV-1007,Client C
2026-08-10,99.00,,Subscriptions
"""


def _seed_demo_data(db: Session, user_id: int) -> None:
    """Populate the demo account with a sample reconciliation (two lists, then
    run the real matching engine so matches + exceptions exist on first login)."""
    for source, raw in (("bank", DEMO_BANK_CSV), ("internal", DEMO_INTERNAL_CSV)):
        rows, rejections = parse_csv(raw.encode("utf-8"))
        batch = Import(
            user_id=user_id,
            source=source,
            filename=f"demo_{source}.csv",
            imported=len(rows),
            rejected=len(rejections),
        )
        db.add(batch)
        db.flush()
        for row in rows:
            db.add(Transaction(
                user_id=user_id,
                import_id=batch.id,
                source=source,
                date=row["date"],
                amount=row["amount"],
                description=row["description"],
                reference=row["reference"],
            ))
    db.commit()
    reconcile(db, user_id)


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
        _seed_demo_data(db, user.id)
    return {"access_token": create_token(user.id), "token_type": "bearer",
            "user_id": user.id, "email": user.email}


# ─── Imports (PROTECTED) ───
@app.post("/imports", response_model=ImportCreateOut, status_code=201)
async def create_import(
    source: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Upload one CSV as a 'bank' or 'internal' list. Parses it, stores the
    batch (an `imports` row) and its rows (`transactions`), and reports how
    many rows were imported vs rejected (with reasons)."""
    if source not in {"bank", "internal"}:
        raise HTTPException(status_code=422, detail="source must be 'bank' or 'internal'")

    content = await file.read()
    rows, rejections = parse_csv(content)

    batch = Import(
        user_id=current.id,
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
            import_id=batch.id,
            source=source,
            date=row["date"],
            amount=row["amount"],
            description=row["description"],
            reference=row["reference"],
        ))
    db.commit()

    return {
        "import_id": batch.id,
        "source": batch.source,
        "filename": batch.filename,
        "imported": batch.imported,
        "rejected": batch.rejected,
        "created_at": batch.created_at,
        "rejections": [{"row": r, "reason": reason} for r, reason in rejections],
    }


@app.get("/imports", response_model=List[ImportOut])
def list_imports(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    return (
        db.query(Import)
        .filter(Import.user_id == current.id)
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


# ─── Reconcile (PROTECTED) ───
@app.post("/reconcile", response_model=ReconcileOut)
def run_reconcile(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Run the matching engine over the user's bank vs internal transactions.
    Idempotent: safe to re-run after uploading more data — it recomputes all
    matches from the current transactions."""
    bank_count = (
        db.query(Transaction)
        .filter(Transaction.user_id == current.id, Transaction.source == "bank")
        .count()
    )
    internal_count = (
        db.query(Transaction)
        .filter(Transaction.user_id == current.id, Transaction.source == "internal")
        .count()
    )
    if bank_count == 0 or internal_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Upload both a bank and an internal CSV before reconciling",
        )
    return reconcile(db, current.id)


@app.get("/reconcile", response_model=ReconcileOut)
def reconcile_summary(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Read-only view of the current matching state (same shape as POST
    /reconcile). Lets the dashboard render KPIs on load without re-running."""
    return current_summary(db, current.id)


# ─── Exceptions (PROTECTED) ───
@app.get("/exceptions", response_model=List[ExceptionOut])
def list_exceptions(
    status: str | None = None,
    type: str | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """The review queue. Optional filters: ?status=open|resolved, ?type=unmatched|mismatch."""
    if status is not None and status not in {"open", "resolved"}:
        raise HTTPException(status_code=422, detail="status must be 'open' or 'resolved'")
    if type is not None and type not in {"unmatched", "mismatch"}:
        raise HTTPException(status_code=422, detail="type must be 'unmatched' or 'mismatch'")

    q = db.query(ExceptionRecord).filter(ExceptionRecord.user_id == current.id)
    if status:
        q = q.filter(ExceptionRecord.status == status)
    if type:
        q = q.filter(ExceptionRecord.exception_type == type)

    records = q.order_by(ExceptionRecord.id.desc()).all()
    return [_exception_out(db, r) for r in records]


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
    return _exception_out(db, rec)