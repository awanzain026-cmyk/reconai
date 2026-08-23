# ReconAI

**Bank reconciliation for accounting firms — upload two CSVs, auto-match transactions, review what didn't match.**

ReconAI takes a bank statement export and an internal ledger export, matches them with a deterministic two-pass engine (reference first, then amount + date), flags everything that doesn't line up as an *exception*, and gives you a review queue with smart suggestions to resolve them in one click.

| | |
|---|---|
| **Live app** | https://reconai-orcin.vercel.app |
| **API** | https://reconai-2992db9d.fastapicloud.dev (docs at `/docs`) |
| **Demo** | "Try the live demo" button on the login page (pre-seeded account) |

![Dashboard](dashboard-desktop.png)

## Features

- **Email + password auth** — JWT bearer tokens, bcrypt-hashed passwords; every query is scoped to the signed-in user.
- **CSV imports that fail loudly** — flexible column detection (`date`/`postingdate`, `amount` or `debit`/`credit`, `description`/`memo`/`narration`, `reference`/`refno`/…), 9 date formats, `$1,234.56` and `(500)` style amounts. Bad rows are rejected *with reasons* instead of silently corrupting the run.
- **Deterministic matching engine**
  - **Pass 1 — reference:** normalized reference matches on both sides (only when each side has exactly one row for it; ambiguous duplicates go to review). Amount differences are flagged as mismatches.
  - **Pass 2 — amount + date:** exact amount in integer cents on the same date, same uniqueness rule.
  - Amounts are compared as integer cents to avoid float rounding surprises.
- **Exceptions review queue** — unmatched and amount-mismatch items, filterable by status/type, resolve or reopen with one click.
- **Smart suggestions** — for any unmatched exception, the app ranks candidate transactions on the other side with a 0–100 confidence score (amount 50 pts, date proximity 25 pts, description/reference token overlap up to 25 pts) and shows the reasons why.
- **One-click manual matching** — accept a suggestion or "resolve without matching". Manual decisions survive re-reconciliation by design: the auto engine never touches them.
- **Upload management** — full upload history per account, delete a mis-uploaded file (its transactions, matches and exceptions are removed and reconciliation re-runs so the remaining data stays consistent), or wipe all data from Settings → Danger zone.
- **CSV templates** — downloadable sample files (`reconai-bank-template.csv`, `reconai-internal-template.csv`) so users know exactly which columns to provide.
- **Audit export** — download the whole exceptions list as CSV (both sides of every exception included) for working papers.
- **Dashboard KPIs** — matched %, open exceptions, unmatched counts, match-method breakdown; fully responsive down to mobile.

![Exceptions](exceptions-desktop.png)

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0, PyJWT, bcrypt |
| Database | Neon Postgres in production, SQLite locally (zero config) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Base UI + shadcn-style components, lucide-react |
| Deploy | FastAPI Cloud (backend) + Vercel (frontend) — push to `main` deploys both |

## Project structure

```
reconai/
├── backend/
│   └── app/
│       ├── main.py       # REST API routes
│       ├── auth.py       # JWT issuing/verification, password hashing
│       ├── db.py         # SQLAlchemy engine + session
│       ├── models.py     # User / Import / Transaction / Match / ExceptionRecord
│       ├── importer.py   # CSV parsing + validation
│       └── matcher.py    # reconciliation engine + suggestions
├── frontend/
│   ├── app/              # login, dashboard, upload, exceptions, settings pages
│   ├── components/       # UI components (dropzone, exception panel, KPI cards…)
│   └── lib/api.ts        # typed API client
└── README.md
```

## Running locally

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

No `.env` needed by default — it falls back to a local SQLite file. To use Postgres:

```bash
cp .env.example .env              # then set DATABASE_URL, e.g. Neon:
# DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/dbname?sslmode=require
```

Interactive API docs: http://127.0.0.1:8000/docs

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local        # NEXT_PUBLIC_API_URL defaults to http://127.0.0.1:8000
npm run dev
```

Open http://localhost:3000, create an account (or use the demo button), upload the two sample templates from the upload page, and hit **Run reconciliation**.

## API overview

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/signup`, `/auth/login`, `/auth/demo` | Account + session (JWT) |
| GET | `/auth/me` | Current user |
| POST | `/imports` | Upload a CSV (`source=bank\|internal`, multipart) — returns imported/rejected counts + rejection reasons |
| GET | `/imports` | Upload history |
| GET | `/imports/{id}/transactions` | Rows of one import |
| DELETE | `/imports/{id}` | Delete one upload + everything derived from it, re-reconciles |
| DELETE | `/data` | Wipe all reconciliation data for the account |
| POST | `/reconcile` | Run the matching engine, returns summary |
| GET | `/reconcile` | Current KPI summary |
| GET | `/exceptions?status=&type=` | Review queue (filterable) |
| PATCH | `/exceptions/{id}` | Resolve / reopen |
| GET | `/exceptions/{id}/suggestions` | Ranked match candidates with confidence + reasons |
| POST | `/exceptions/{id}/match` | Manually match (or resolve without a match) |
| GET | `/exceptions/export` | Full exceptions audit trail as CSV |
| GET | `/templates/{bank\|internal}` | Sample CSV download |

## How matching works

```
bank rows ──┐
            ├─► Pass 1: reference equality (normalized, unique on both sides)
internal ───┤        └─ amount differs? → mismatch exception
            ├─► Pass 2: exact amount (integer cents) + same date, unique on both sides
            └─► Everything still unpaired → unmatched exception (review queue)
```

- Ambiguity is never guessed: if two rows share a reference or an amount+date key, they're left for human review.
- Re-running reconciliation is idempotent — auto matches and *open* exceptions are recomputed from scratch, while manual matches and resolved exceptions are preserved.
- Deleting an upload cascades correctly (transactions → matches → exceptions) and triggers a fresh reconcile, so a partner transaction that lost its pair shows up in the review queue again.

## Deployment

Both apps deploy automatically on push to `main`:

- **Backend** — FastAPI Cloud, `DATABASE_URL` points at Neon Postgres (migrations are handled by `Base.metadata.create_all` at startup).
- **Frontend** — Vercel, `NEXT_PUBLIC_API_URL` points at the FastAPI Cloud URL. CORS allows the deployed origins plus any `*.vercel.app` preview.

## Roadmap

- [ ] Custom column mapping UI for bank-specific CSV headers
- [ ] Search & filter inside the exceptions table (amount, date, keyword)
- [ ] Monthly / date-range reconciliation periods
- [ ] Duplicate-row detection (possible double postings)
- [ ] Dashboard charts over time (match rate trend, exception breakdown)
- [ ] Email notification when a reconciliation finishes

---

Last updated: 2026-08-23
