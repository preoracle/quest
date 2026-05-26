# Quest — Deploy & Scope Tracker

_Last updated: 2026-05-26_

---

## What's shipped (feature-complete, committed)

| Area | Status | Notes |
|------|--------|-------|
| **Auth** (Supabase) | ✅ Done | JWT via JWKS; `SUPABASE_URL` env var; swaps to `VITE_SUPABASE_*` on frontend |
| **Dashboard** | ✅ Done | Streak, continue CTA, due count, skeleton loading |
| **Topics page** | ✅ Done | Search, filters, create, archive, pin |
| **Topic detail** | ✅ Done | Progress, concept list, action tiles |
| **Session** | ✅ Done | Cycle UI, chat bubbles, wrap-up, sidebar panel, mastery chart |
| **Session architecture** | ✅ Done | No conn held during Claude; separate checkpointer pool; deferred init |
| **Due page** | ✅ Done | SM-2 urgency groups, per-concept overdue labels, skeleton loading |
| **Mastery page** | ✅ Done | Tier grid, drill-down, concept graph, skeleton loading |
| **Baseline** | ✅ Done | Framing intro + interactive assessment |
| **Home page** | ✅ Done | Hero demo card, feature contrast, CTA |
| **Concept graph** | ✅ Done | Zoom/pan, progress rings, hover/click popups |
| **CORS** | ✅ Done | `CORS_ORIGINS` env var; defaults to localhost for dev |
| **LLM resilience** | ✅ Done | `max_retries=3` on all three chains |
| **Docker** | ✅ Done | `Dockerfile.api`, `Dockerfile.frontend`, `docker-compose.yml` |
| **`POST /sessions/{id}/finish`** | ✅ Done | Early wrap-up endpoint with report |

---

## Quick start (Docker Compose — local testing)

```bash
# 1. Copy and fill in env vars
cp .env.example .env
# Edit .env: add ANTHROPIC_API_KEY, DATABASE_URL, SUPABASE_URL, VITE_SUPABASE_*

# 2. Build and start both services
docker compose up --build

# 3. Open http://localhost:3000
#    API is available at http://localhost:8000 (or via /api proxy through nginx)
```

> **Rebuild frontend only** (after code changes):
> ```bash
> docker compose build frontend && docker compose up -d frontend
> ```

---

## Deployment checklist (production)

### 1. Supabase — verify configuration

- **Auth**: Supabase Auth is the identity provider. Users sign in via the Supabase frontend SDK. The backend verifies JWTs via the Supabase JWKS endpoint — no secret needed.
- **Database**: Use the **Transaction Pooler** URL (port **6543**) for `DATABASE_URL`. PgBouncer transaction mode is required for psycopg3 compatibility.
  - Dashboard → Settings → Database → Connection pooling → Transaction mode → copy URI
  - Format: `postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres`
- **Add your production domain** to Supabase Auth → URL Configuration → Allowed URLs.

### 2. Backend (Render / Railway / Fly.io)

**Recommended: [Render](https://render.com)** — free tier, Docker deploy, cold starts ~10-15s.

Option A — **Docker deploy** (any platform):
```bash
docker build -f Dockerfile.api -t quest-api .
# Push to registry, deploy from there
```

Option B — **Render buildpack** (no Docker):
- Runtime: Python 3.12
- Build command: `pip install uv && uv sync --extra api --extra postgres --no-dev`
- Start command: `uv run uvicorn main:app --host 0.0.0.0 --port $PORT`

**Required env vars on the backend host:**

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `DATABASE_URL` | Supabase transaction pooler URL (port 6543) |
| `SUPABASE_URL` | `https://YOURREF.supabase.co` |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app` |

### 3. Frontend (Vercel — recommended)

Vercel auto-deploys from GitHub. Set root directory to `frontend`.

**Required env vars in Vercel:**

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://YOURREF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_API_URL` | `https://your-api.onrender.com` |

Build command: `npm run build` — Output dir: `dist`

### 4. CORS

Set `CORS_ORIGINS=https://your-app.vercel.app` on the backend. Comma-separate multiple origins.

---

## Environment variables reference

### Backend (runtime)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **yes** | — | Anthropic API key |
| `ANTHROPIC_MODEL` | no | `claude-sonnet-4-6` | Tutor model |
| `ANTHROPIC_EVAL_MODEL` | no | `claude-haiku-4-5` | Evaluator model (cheap scoring) |
| `DATABASE_URL` | prod | — | Supabase transaction pooler URL (port 6543) |
| `SUPABASE_URL` | prod | — | `https://YOURREF.supabase.co` — for JWT verification |
| `CORS_ORIGINS` | prod | localhost:5173/5174 | Comma-separated allowed origins |
| `QUEST_DATA_DIR` | no | repo-relative | Override path for DB + checkpoints |

### Frontend (build-time — baked into JS bundle)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | **yes** | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | **yes** | Supabase anon/public key |
| `VITE_API_URL` | prod only | Backend URL; defaults to `/api` (proxied by nginx or Vite dev server) |

---

## Architecture notes

- **No connection held during Claude calls.** App pool: `max_size=10`, each connection held ~5ms for SQL. Claude calls (5–30s) happen with zero DB connections held — pool supports ~100+ concurrent sessions.
- **Separate checkpointer pool.** LangGraph checkpoint reads/writes use a dedicated `psycopg_pool.ConnectionPool(max_size=5)` — isolated from app SQL traffic.
- **Deferred session init.** `POST /sessions` is instant (<100ms). `GET /sessions/:id` triggers the first Claude call while the SessionPage skeleton shows — no blocking on session start.
- **Supabase Transaction Pooler required.** psycopg3 auto-prepared statements are disabled (`prepare_threshold=None`) on all pools — PgBouncer transaction mode compatibility.

---

## Open feature work (deferred, not v1 blockers)

| Feature | Why deferred | Size |
|---------|--------------|------|
| **Race condition guard** (`initialized` flag on sessions) | Only matters for thundering herd on brand-new sessions; extremely rare in practice | Small |
| **Concept search (embeddings)** | Semantic search across concepts via vector store | Medium |
| **Graph RAG** | Retrieval-first tutor using concept graph context | Large |
| **Progress insights** | Weak-spot detection, learning velocity charts | Medium |
| **Voice mode** | Speak answers instead of typing | Large |
| **Team / classroom** | Multiple users, one workspace | Large |
| **Import from URL / PDF** | Auto-generate topic from a doc | Medium |
| **Notifications / reminders** | Push or email nudge for due reviews | Small |
