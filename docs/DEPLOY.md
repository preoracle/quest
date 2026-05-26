# Quest — Deploy & Scope Tracker

_Last updated: 2026-05-26_

---

## What's shipped (feature-complete, committed)

| Area | Status | Notes |
|------|--------|-------|
| **CLI** (`quest-ai` 0.3.0 on PyPI) | ✅ Done | SM-2, concept DAG, baseline, due |
| **Auth** (Clerk) | ✅ Done | Test keys in `.env`; swap to prod keys before deploy |
| **Dashboard** | ✅ Done | Streak, continue CTA, due count |
| **Topics page** | ✅ Done | Search, filters, create, archive, pin |
| **Topic detail** | ✅ Done | Progress, concept list, action tiles |
| **Session** | ✅ Done | Cycle UI, chat bubbles, wrap-up, sidebar panel, mastery chart |
| **Due page** | ✅ Done | SM-2 urgency groups, per-concept overdue labels |
| **Mastery page** | ✅ Done | Tier grid, drill-down, concept graph |
| **Baseline** | ✅ Done | Framing intro + interactive assessment |
| **Home page** | ✅ Done | Hero demo card, feature contrast, CTA |
| **Concept graph** | ✅ Done | Zoom/pan, progress rings, hover/click popups |
| **CORS** | ✅ Done | `CORS_ORIGINS` env var; defaults to localhost for dev |
| **LLM resilience** | ✅ Done | `max_retries=3` on all three chains |
| **`POST /sessions/{id}/finish`** | ✅ Done | Early wrap-up endpoint with report |

---

## Deployment checklist (before going live)

### 1. Clerk — swap to production keys
- Log into [clerk.com](https://clerk.com), create a **Production** instance
- Replace `VITE_CLERK_PUBLISHABLE_KEY` (and `CLERK_SECRET_KEY` if using server-side auth) with prod values
- Add your production domain to Clerk's allowed origins

### 2. Database — persistent storage
- **Option A (quick):** keep SQLite, mount a persistent volume on your host, set `QUEST_DATA_DIR=/data/quest`
- **Option B (recommended for multi-user):** migrate to Supabase (Postgres); schema is nearly identical — swap `sqlite3` calls in `db/queries.py` for `psycopg2` + `DATABASE_URL` env var

### 3. Backend host (API + Python)
Recommended: **Render** or **Railway** (free tier, sleeps on inactivity — cold starts ~30s, fine for a side project)
- Set env vars: `ANTHROPIC_API_KEY`, `CORS_ORIGINS=https://your-frontend.vercel.app`, `QUEST_DATA_DIR=/data/quest`
- If using SQLite: attach a persistent disk (Render: $0.25/GB/mo)
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 4. Frontend host (React/Vite static)
Recommended: **Vercel** (free, auto-deploys from GitHub, preview URLs)
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Env vars: `VITE_CLERK_PUBLISHABLE_KEY=<prod key>`, `VITE_API_URL=https://your-api.onrender.com`

### 5. CORS
- Set `CORS_ORIGINS=https://your-app.vercel.app` on the backend host

---

## Open feature work (not yet built)

These are intentionally deferred — not blockers for v1 launch.

| Feature | Why deferred | Rough size |
|---------|--------------|-----------|
| **Supabase migration** | SQLite works fine with a persistent volume; Supabase adds multi-user isolation + hosted DB | Large (1–2 days) |
| **Shared topic library** | Users sharing/importing community topics | Medium |
| **Concept search (embeddings)** | Semantic search across all concepts via vector store | Medium |
| **Graph RAG** | Retrieval-first tutor using concept graph context | Large |
| **Progress insights** | Weak-spot detection, learning velocity charts | Medium |
| **Voice mode** | Speak answers instead of typing | Large |
| **Team / classroom** | Multiple users under one workspace | Large |
| **Import from URL / PDF** | Auto-generate topic from a doc or article | Medium |
| **Topic editor UI** | Edit concept names/descriptions/prereqs in the browser | Small |
| **Notifications / reminders** | Push or email nudge when concepts are due | Small |

---

## Environment variables reference

| Variable | Where | Required | Description |
|----------|-------|----------|-------------|
| `ANTHROPIC_API_KEY` | backend | **yes** | Anthropic API key |
| `ANTHROPIC_MODEL` | backend | no | Tutor model (default: `claude-sonnet-4-6`) |
| `ANTHROPIC_EVAL_MODEL` | backend | no | Evaluator model (default: `claude-haiku-4-5`) |
| `CORS_ORIGINS` | backend | prod only | Comma-separated frontend origins |
| `QUEST_DATA_DIR` | backend | prod only | Writable dir for DB + checkpoints |
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend | **yes** | Clerk publishable key |
| `VITE_API_URL` | frontend | prod only | Backend base URL (e.g. `https://api.yourapp.com`) |
