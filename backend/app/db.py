"""ReconAI — database setup (Stage 2: SQLite, swap to Postgres by env var).

DATABASE_URL is read from the environment, defaulting to a local SQLite file.
To switch to Neon Postgres later (Stage 7), set:
  DATABASE_URL=postgresql+psycopg://user:pass@host/dbname
and nothing else in the code changes.
"""

import os
import urllib.parse

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./recon.db")

is_sqlite = DATABASE_URL.startswith("sqlite")

# For Postgres, inject connect_timeout into the URL so the driver doesn't hang
# on a sleeping Neon instance during cold starts.
db_url = DATABASE_URL
if not is_sqlite and "connect_timeout" not in DATABASE_URL:
    sep = "&" if "?" in DATABASE_URL else "?"
    db_url = f"{DATABASE_URL}{sep}connect_timeout=10"

engine_kwargs = {
    "pool_pre_ping": True,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_timeout"] = 10

engine = create_engine(db_url, **engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: one database session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
