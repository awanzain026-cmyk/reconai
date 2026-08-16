# AI Bank Reconciliation Tool — MVP Plan

## Main Goal (learning journey)
Same goal as Ledgerly: understand the full journey from planning → building → deployment,
one stage at a time. Every stage introduces **one new core concept**, explained before we
build it. Where Ledgerly already settled a decision, we **reuse it without re-deciding**.

## Architecture (decided — reused from Ledgerly, no re-decision)
- **Frontend**: **Next.js** → deploy on **Vercel**
- **Backend**: **FastAPI** → deploy on **FastAPI Cloud**
- **Database**: **SQLite** locally (via SQLAlchemy) → **Neon Postgres** in production (swap = one connection string)
- **Auth**: our own email/password — **bcrypt hashing + JWT tokens** (same pattern as Ledgerly)
- **CORS**: configured **from the start**, not retrofitted later
- **Supabase**: skipped entirely
- **LLM**: **none in the MVP.** Reconciliation here is deterministic matching (rules), not
  classification. The product is called "AI" but the honest MVP does matching with rules —
  an LLM-assisted matching pass is a listed future idea (Stage 8), not part of this build.

## Project: AI Bank Reconciliation Tool (MVP only)
One core workflow and nothing else: upload two transaction lists (bank statement + internal
records) as CSVs, match them, flag what doesn't line up as exceptions, review them on a
dashboard.

**In scope (this is the entire MVP):**
1. Upload two CSVs — bank statement list + internal records list
2. Matching engine — pair by (amount + date) **or** reference number
3. Exceptions — unmatched and mismatched transactions flagged for manual review
4. Dashboard — matched count, exceptions list, mark an exception as resolved

**Explicitly out of scope:** multi-agent, bulk-file automation, scheduling, LLM-assisted
matching, multi-account/company management, bank API integrations, Supabase.

## Stage-by-Stage Build Plan (one stage at a time — never mix)
**RULE: after every stage we take "Learn & Reflect" time** — review what was built, the core
concept behind it, and any questions. The stage is not done until the concept is understood.

### Stage 1 — Planning & Architecture
- Scope locked to the MVP list above (what we build / what we deliberately cut)
- Reused decisions locked (stack, auth, CORS, deploy targets, no Supabase, no LLM)
- Folder structure: `backend/` + `frontend/` monorepo, same layout as Ledgerly
- ➤ Core concept: **scoping** — what "MVP" means here. Every later stage builds only what's
  listed above; anything beyond it gets written in Stage 8 as "future", not built.

### Stage 2 — Foundations: FastAPI + SQLite + CORS + Auth (reused patterns) ✅ (done)
- FastAPI skeleton in `backend/`, SQLAlchemy engine/session (`db.py`), `User` model
- CORS middleware from the start — localhost:3000/127.0.0.1:3000 + the `https://.*\.vercel\.app` wildcard regex, so deploy needs no CORS change
- Auth endpoints: signup / login, bcrypt hashing, JWT, `get_current_user` dependency —
  copied pattern from Ledgerly (`backend/auth.py`, `backend/models.py`, `backend/main.py`)
- Verified via curl: signup returns JWT, login works, `/auth/me` with token returns user;
  no token → 401, wrong password → 401, duplicate email → 400. CORS: localhost + Vercel origins allowed, evil.com rejected.
- Gotcha: bcrypt 5.x (newer than Ledgerly's 4.x) **raises** on passwords > 72 bytes instead of truncating — capped `AuthIn.password` at 72 chars to avoid a 500.
- ➤ Core concept: **none new — this stage is deliberately boring.** We re-use the proven
  Ledgerly setup so the new project's energy goes to the new logic. Verified signup/login
  via curl before moving on.

### Stage 3 — CSV Upload & the Dual-List Data Model ✅ (done)
- `imports` table: one row per uploaded file (`user_id`, `source`: bank | internal, `filename`, `imported`/`rejected` counts) — a **batch**
- `transactions` table: `user_id`, `import_id`, `source`, `date`, `amount`, `reference`, `description`
- `POST /imports` (multipart CSV upload) → parse with the `csv` module → validate (date
  parseable, amount numeric) → store → report per file: N rows imported, M rejected
- Implemented: `backend/importer.py` (header auto-mapping: date/amount or debit+credit/
  description/reference keys; amount parser handles `$`, `,`, parentheses = negative; date
  parser handles 9+ formats), routes in `backend/main.py` (`POST /imports`, `GET /imports`,
  `GET /imports/{id}/transactions`, all auth-protected), `python-multipart` added
- Verified via curl: bank CSV (7 imported / 2 rejected with reasons), internal debit/credit
  CSV (6 / 0), amounts signed correctly, multi-format dates parse; no token → 401,
  bad source → 422, other user's import → 404
- Gotcha: Pydantic `date: datetime.date` fails ("schema for unknown type") — must import
  `date` from `datetime` and use it as the field type
- ➤ Core concept: **one table holds BOTH lists**, distinguished by a `source` column.
  Matching later is a comparison *across* the two sources within one user's data. Also new:
  file upload (multipart) + CSV parsing, including the CSV column-mapping question (which
  column is date / amount / reference — default mapping first, header mapping later).

### Stage 4 — The Matching Engine (the heart) ✅ (done)
- `POST /reconcile`: run matching across the user's bank vs internal transactions
- **Normalize first**: dates → ISO, amounts → cents (integer), references → trimmed + case-insensitive
- **Pass 1 — reference match**: pair exact reference numbers (strong signal); strictly 1-to-1
  (a transaction already paired can never be paired again)
- **Pass 2 — amount + date match**: group by (amount, date). Group has exactly one bank + one
  internal → pair them. Multiple in a group → ambiguous, leave to exceptions (never guess)
- **Mismatch detection**: paired by reference but amounts differ → exception type `mismatch`
- **Idempotent**: `matches` table stores every pair (`bank_txn_id`, `internal_txn_id`,
  `method`, created_at) — re-running reconcile never double-pairs
- **Derive exceptions**: every transaction not in a match → exception type `unmatched`
- Implemented: `Match` model (`matches` table with UNIQUE FKs on both `bank_txn_id` and
  `internal_txn_id` — the DB itself enforces 1-to-1, so double-pairing is impossible),
  `backend/matcher.py` (normalize to integer cents + casefolded references; pass 1 reference,
  pass 2 amount+date; ambiguity skipped, never guessed; `amount_mismatch` flag on reference
  pairs whose amounts differ), `POST /reconcile` returning matched count + method breakdown +
  unmatched counts + mismatch count. Reconcile recomputes from current transactions
  (delete + recreate the user's matches) → deterministic and idempotent
- Verified via curl on real data: 7 bank + 6 internal → 4 reference + 1 amount+date matched,
  2 bank / 1 internal unmatched, 0 mismatches; re-run → identical numbers. A second pair of
  uploads: reference pair with differing amounts → flagged `amount_mismatch=1` (still paired);
  a reference shared by two bank rows → ambiguous, nothing paired. Guard: reconcile with no
  lists → 400
- ➤ Core concept: **deterministic matching** — normalization, strict 1-to-1 pairing, and
  ambiguity handling (duplicates → exceptions, not guesses). This is the "AI" of the MVP,
  and it's rules, not ML — that's the honest MVP decision.

### Stage 5 — Exceptions & the Review Workflow ✅ (done)
- `exceptions` table: `id`, `user_id`, `transaction_id`, `exception_type` (unmatched |
  mismatch), `reason`, `status` (open | resolved), `resolved_at`
- `GET /exceptions` (filter by status / type), `PATCH /exceptions/{id}` → mark resolved
  (own data only, 404 otherwise)
- Implemented: `ExceptionRecord` model (`exceptions` table; `match_id` FK added so a
  mismatch exception can reference BOTH sides of its pair), exception derivation inside
  `reconcile` (every transaction not in a match → `unmatched`; every reference pair with
  differing amounts → `mismatch` with a reason showing both amounts), `GET /exceptions`
  (filters `?status=` / `?type=`, returns nested bank_txn/internal_txn), `PATCH
  /exceptions/{id}` (resolved sets resolved_at, reopen clears it). Reconcile refreshes
  only OPEN exceptions — resolved ones persist across re-runs (resolved is a human
  decision, never a hard delete)
- Verified via curl: reconcile → 8 open exceptions (7 unmatched + 1 mismatch, both sides
  shown for the mismatch); resolve → resolved_at set; re-reconcile → open count refreshed
  to 8 again while the resolved record survives; reopen undoes it. Guards: invalid
  filter/patch value → 422, no token → 401, another user's exception → 404
- ➤ Core concept: **state on top of data** — "this doesn't match" becomes a reviewable,
  resolvable record (open → resolved) instead of a one-off error message. Marking resolved
  is a human decision stored in the data, never a hard delete.

### Stage 6 — Dashboard Frontend ✅ (done)
- Next.js app: `lib/api.ts` API client (token in localStorage), auth gate screen — Ledgerly pattern
- Upload UI: pick two CSVs → `POST /imports` → run reconciliation
- Dashboard: KPIs (matched count, bank unmatched, internal unmatched, open exceptions),
  exceptions list (type, reason, resolve button → `PATCH`, optimistic update),
  loading / empty / error states
- Implemented: `frontend/lib/api.ts` (typed client, token + email in localStorage, `ApiError`
  with server `detail`, base URL from `NEXT_PUBLIC_API_URL` defaulting to 127.0.0.1:8000);
  `app/login/page.tsx` (login/signup tabs); `(app)/layout.tsx` converted to a client auth
  gate (no token → redirect to `/login`); `dashboard/page.tsx` (KPIs from a new read-only
  `GET /reconcile` + open exceptions; empty state when nothing uploaded, banner when only one
  list is in, optimistic resolve that re-syncs KPIs); `upload/page.tsx` (two dropzones +
  Run reconciliation → uploads both CSVs then POST /reconcile → run-result card with
  imported/rejected counts, rejected-row reasons, and matched/exceptions totals);
  `exceptions/page.tsx` + rewritten `exceptions-panel.tsx` (open/resolved tabs, mismatch shows
  BOTH amounts, Resolve/Reopen with optimistic update); sidebar exceptions badge + topbar
  sign-out now live (badge refreshes on navigation, the `refreshKey` pattern)
- Added `GET /reconcile` to the backend — a read-only `current_summary()` (same shape as POST)
  so the dashboard can render KPIs on load without re-running the engine
- Verified: `tsc --noEmit` clean, `next build` compiles all routes (/, /login, /dashboard,
  /upload, /exceptions), dev server serves every route 200, login page renders, the auth
  gate shows while unauthenticated, and every API call the client makes was curl-verified
  against the live backend with matching response shapes
- ➤ Core concept: turning engine output into a **reconciliation dashboard** — matched count
  is the progress metric, the exceptions list is the work queue. Server state changes drive
  the UI refresh (same `refreshKey` pattern as Ledgerly).

### Stage 7 — Deployment (reused targets)
- **Backend → FastAPI Cloud**: Application Directory = `backend`, env `DATABASE_URL`; known
  gotchas from Ledgerly (cold starts → first request may 500 once, trailing-slash URL hygiene)
- **Frontend → Vercel**: env `NEXT_PUBLIC_API_URL`
- **Database → Neon Postgres**: connection-string swap; verify `sslmode` / `channel_binding`
- CORS updated to the live domains
- ➤ Core concept: **none new** — repeat the proven Ledgerly deployment runbook. Verify live
  via Playwright: signup → upload two CSVs → reconcile → resolve an exception.

### Stage 8 — Final Review & Learnings
- Walk through each stage's core concept and how it built the single workflow
- Write down what we'd add if this grew beyond the MVP: LLM-assisted matching (the actual
  "AI"), bulk-file automation, scheduling, multi-account management — noted as future, not built
