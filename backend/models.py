"""ReconAI — database tables (the SCHEMA).

Each class = one table, attributes = columns. SQLAlchemy generates the
CREATE TABLE statements and keeps them compatible with SQLite and Postgres.

Stage 3 adds the dual-list model: one `transactions` table holds BOTH lists
(bank statement + internal records), distinguished by the `source` column.
An `imports` row is one uploaded file (a batch) that produced those rows.

Stage 4 adds `matches`: every paired (bank, internal) transaction. The UNIQUE
constraints on both foreign keys enforce strict 1-to-1 pairing — a transaction
can be in at most one match, so re-running reconcile never double-pairs.

Stage 5 adds `exceptions`: state on top of the data. "This doesn't match"
becomes a reviewable, resolvable record (open -> resolved) instead of a one-off
error message. Marking resolved is a human decision stored in the data —
re-running reconcile refreshes only the OPEN exceptions and never touches
resolved ones.
"""

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class Import(Base):
    __tablename__ = "imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    source: Mapped[str] = mapped_column(String(10))  # "bank" | "internal"
    filename: Mapped[str] = mapped_column(String(255))
    imported: Mapped[int] = mapped_column(Integer, default=0)
    rejected: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    import_id: Mapped[int] = mapped_column(ForeignKey("imports.id"), index=True)
    source: Mapped[str] = mapped_column(String(10))  # "bank" | "internal"
    date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Float)  # signed: negative = money out
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    bank_txn_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), unique=True
    )  # a bank txn pairs at most once
    internal_txn_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), unique=True
    )  # an internal txn pairs at most once
    method: Mapped[str] = mapped_column(String(20))  # "reference" | "amount_date"
    amount_mismatch: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class ExceptionRecord(Base):
    __tablename__ = "exceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # The transaction the exception is about. For a mismatch this is the bank
    # side; `match_id` then carries the pair (both sides are recoverable).
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), index=True)
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True, index=True)
    exception_type: Mapped[str] = mapped_column(String(20))  # "unmatched" | "mismatch"
    reason: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(10), default="open")  # "open" | "resolved"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)