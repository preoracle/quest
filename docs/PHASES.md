# Quest — Build Phases

Five phases, ~14 days. Each phase has a hard exit criterion. No phase
is scaffolded ahead of time — we re-plan at the boundary.

## Phase 1 — CLI Socratic loop (Days 1–2)
Prove the tutor holds the no-explain constraint. Nothing else.

In scope:
- `prompts/socratic.txt` with strong few-shot examples
- `core/chains.py::build_socratic_chain(topic)` — Anthropic Sonnet wrapped in a runnable
- `main.py` — CLI REPL with in-memory turn history
- `concepts/closures_in_javascript.yaml` as the sample map (topic field only used this phase)

Out of scope: SQLite, evaluator, LangGraph, FastAPI, tests, DAG traversal.

Exit criterion: a 10-turn session on the sample topic where the tutor
never explains or asserts a fact. If it slips even once, iterate on
`socratic.txt` few-shots before declaring done.

## Phase 2 — Evaluator + SQLite (Days 3–5)
Score every user response, persist mastery.

**Setup (requires Python 3.11+, not macOS system 3.9):**

```bash
./scripts/setup.sh          # creates .venv and installs deps
source .venv/bin/activate
cp .env.example .env        # add ANTHROPIC_API_KEY
```

Do **not** use bare `pip` / `pytest` / `python` — they may hit Python 3.9.6.
Always use `.venv/bin/python`, or activate the venv first.

**Tests:** `pytest` (mocked, default) · `pytest -m live` (3 real Haiku calls).

In scope:
- `db/schema.sql` — users, concepts, mastery, sessions, turns
- `db/queries.py` — all DB ops (no raw SQL anywhere else)
- `prompts/evaluator.txt` + `core/chains.py::build_evaluator_chain()`
  returning a Pydantic `EvaluatorOutput {score, gaps, reasoning}`
  via Anthropic tool use (Haiku)
- Persist turns and update mastery after each user response
- `tests/test_evaluator.py` — 5+ fixture conversations with expected score ranges

Exit criterion: a CLI session writes turns + mastery to SQLite, and
the evaluator fixtures all pass.

## Phase 3 — LangGraph + Memory + SM-2 (Days 6–8)
Wire the full session as a state graph; add spaced repetition.

**Setup:** `pip install -e ".[phase2,phase3]"` (see `./scripts/setup.sh`).

**CLI:** `:q` pauses (open session + checkpoint). Session ends when every concept in the DAG is mastered (score ≥ 4 for 3 turns each).

In scope:
- `core/sm2.py` — pure SM-2 implementation with unit tests
- `core/memory.py` — end-of-session summary written to `sessions.summary_text`
- `core/graph.py` — `StateGraph` wiring load_state → pick_concept → ask →
  wait_for_user → evaluate → update_mastery → decide → (loop or summarize)
- DAG-aware `pick_concept`: traverse concept YAML, pick weakest unmastered
  prerequisite that's due per SM-2
- SQLite checkpointer for resumability

Exit criterion: kill the CLI mid-session, restart, resume exactly where
we left off. Next session opens on the weakest concept from last time.

## Phase 4 — FastAPI (Days 9–11)
Move from CLI to REST.

**Run API:** `uvicorn main:app --reload` → http://127.0.0.1:8000/docs

**CLI:** `python cli.py` (unchanged behavior)

**Setup:** `pip install -e ".[phase2,phase3,phase4]"`

In scope:
- `api/routes.py`:
  - `POST /sessions` — start (user_id, topic) → session_id
  - `POST /sessions/{id}/turn` — submit response → next question + evaluator output
  - `GET /sessions/{id}` — current state
  - `GET /users/{id}/mastery` — concept mastery for review
- Move CLI to `cli.py`; FastAPI app becomes `main.py`
- httpx-based integration tests

Exit criterion: a session driven entirely through `curl` produces the
same SQLite state as one driven through the CLI.

## Phase 5 — React frontend (Days 12–14)
UI on top of the REST API. Visual reference: `stitch_quest_socratic_ai/` (Socratic Minimalist dark theme).

**Layout:** single repo, `frontend/` (Vite + React + Tailwind). Not a Turborepo.

**Run (two terminals):**

```bash
# API
source .venv/bin/activate
uvicorn main:app --reload

# UI
cd frontend && npm install && npm run dev
```

→ http://localhost:5173 (proxies `/api` → :8000)

In scope:
- `frontend/` — catalog, active session chat, mastery ledger
- CORS for localhost:5173 in `main.py`
- `GET /topics` for the catalog

Exit criterion: full session experience end-to-end through the browser,
including resuming a partial session.
