# ReconAI — Frontend

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 front-end for ReconAI.

See the [root README](../README.md) for the full project overview, setup instructions, and API reference.

## Quick start

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL defaults to http://127.0.0.1:8000
npm run dev                  # http://localhost:3000
```

## Layout

- `app/` — routes: `/login`, `/dashboard`, `/upload`, `/exceptions`, `/settings`
- `components/` — UI kit (Base UI + shadcn-style primitives), upload dropzone, exceptions review panel, KPI cards
- `lib/api.ts` — typed API client (session storage, fetch helpers, file downloads)

The backend must be running for the app to work — see the root README.
