# Quest – Session Architecture Overhaul

## Context
The session system (the core product) is broken in testing and would catastrophically fail under any real load. This plan covers every identified failure, why it occurs, and exactly how to fix it — with priority ordering.

---

## What's Actually Stored Where

| Store | Connection | Data |
|-------|-----------|------|
| **App DB** (Supabase Postgres) | Transaction Pooler port 6543, `PooledPgConn` pool | users, topics, concepts, sessions, turns, mastery, enrollments |
| **Checkpoint DB** (same Postgres) | Single raw `psycopg.connect()`, `PostgresSaver` singleton | LangGraph graph state snapshots (per session_id / thread_id) |
| **In-Memory** | — | `_pg_pool` singleton, `_checkpointer` singleton, `_known_users` set |

The LangGraph checkpoint is **temporary** — it mirrors the turn data already in SQL, extended with graph traversal state (`current_concept_id`, `history` list, `tutor_message`, etc.). After a session ends, checkpoints are vestigial.

**No vector DB needed.** The tutoring loop is fully SQL-driven: pick concept via mastery table → call Claude → score via Claude → update mastery SQL. Vector search would only be needed for semantic material retrieval (not implemented yet).

---

## Root Causes of "Question Not Appearing"

### Bug 1 — CRITICAL: `session_api` module never imported in `routes.py`
`routes.py:34` imports specific names from `core.session_api`:
```python
from core.session_api import SessionView, get_session_view, start_session, submit_turn
```
But `routes.py:447` calls:
```python
return session_api.finish_session(conn, session_id)  # NameError: 'session_api'
```
`finish_session` is NOT in the import list. Every "Wrap up" click throws `NameError` → 500.

**Fix:** Add `finish_session` to the import line.

---

### Bug 2 — CRITICAL: `tutor_message` hidden when `waiting=False`
`session_api.py:_values_to_view` line ~94:
```python
tutor_message=tutor if waiting or done else None,
```
`waiting = bool(snapshot.next)`. If `snapshot.next` is empty for ANY reason after `graph.invoke()`, the question is returned as `None`. The SessionPage gets a valid 200 response but `tutor_message=null`, `waiting_for_answer=false` — frontend shows "Session paused" instead of the question.

**Fix:** Always return `tutor_message` if it exists in graph state. The frontend already only shows it when `waiting_for_answer=true` anyway.

---

### Bug 3 — CRITICAL: DB connection held during Claude API calls → pool starvation
The request lifecycle:
```
with queries.get_connection() as conn:   # connection checked OUT
    get_session_view(conn, session_id)
        graph = build_quest_graph(conn, ...)
        graph.invoke(...)                # ← Claude called here, takes 5-30s
                                         # conn held for ENTIRE duration
# conn returned to pool only here
```
Pool has `max_size=10`. With 11 concurrent users starting sessions: request 11 blocks forever waiting for a connection. Claude holds all 10 for up to 30s each.

**Fix:** Graph nodes create their OWN short-lived connections. Request-level `conn` is only used for pre/post-graph DB lookups (fast, ms-level). Connection not held during Claude calls.

---

### Bug 4 — CRITICAL: Singleton checkpointer uses ONE psycopg connection — not thread-safe
`core/graph.py:_build_checkpointer()` creates ONE `psycopg.connect()`. ALL concurrent graph operations — `graph.invoke()`, `graph.get_state()`, `graph.update_state()` — share this single connection. psycopg3 connections are NOT thread-safe. Concurrent sessions corrupt each other's checkpoint state.

**Fix:** Replace singleton connection with a small `ConnectionPool` dedicated to checkpointing (`min_size=1, max_size=4`). `PostgresSaver` needs to be constructed per-operation using a pooled connection.

---

### Bug 5 — HIGH: `DuplicatePreparedStatement` still hits checkpointer under load
We fixed this for the app pool. But the singleton checkpointer's raw `psycopg.connect()` (even with `prepare_threshold=None`) gets reused across requests — the same connection sees the same SQL executed repeatedly from different "threads", and psycopg3 may still internally cache prepared statement names on the same connection object.

**Fix:** Covered by Bug 4's fix (per-operation connection from pool, connections reset between uses).

---

### Bug 6 — HIGH: Race condition on lazy graph initialization
Two simultaneous `GET /sessions/:id` requests for a brand-new session BOTH see `snapshot.values == {}` and BOTH call `graph.invoke()`. Two questions are generated; whichever checkpointer write lands last wins. The other request's question is lost.

**Fix:** Add an `initialized BOOLEAN DEFAULT FALSE` column to `sessions`. Set it to `TRUE` (in the DB, atomically) before invoking the graph. Second request sees `initialized=true`, skips invoke, waits for or returns the pending state.

---

### Bug 7 — MEDIUM: `_initial_graph_state` takes `conn` as arg but ignores it
The helper function signature has `conn` as first parameter but never uses it. Minor confusion; `conn` can be removed from the signature.

---

## Architecture After Fixes

```
POST /sessions
  │  with get_connection() as conn:          ← fast, ms-level
  │      create_session(conn)
  │      upsert_topic_concepts(conn)
  │  return SessionView(waiting=False)        ← instant, no Claude call
  │
  ▼
GET /sessions/:id  (triggered by SessionPage)
  │  with get_connection() as conn:          ← fast, ms-level
  │      row = get_session(conn)
  │      if not initialized:
  │          mark initialized (atomic UPDATE)
  │  [conn returned to pool]                 ← RELEASED before Claude
  │
  │  checkpointer_conn = checkpointer_pool.getconn()
  │  saver = PostgresSaver(checkpointer_conn)
  │  graph = build_quest_graph(saver)         ← no conn arg
  │  graph.invoke(initial_state)
  │    └─ pick_concept():
  │         with get_connection() as c:      ← 5ms read
  │             get_topic_concepts(c)
  │    └─ ask_question():
  │         with get_connection() as c:      ← 5ms read
  │             get_recent_summaries(c)
  │         [Claude API call — 5-30s]        ← NO DB connection held
  │         with get_connection() as c:      ← 5ms write
  │             record_turn(c)
  │    └─ wait_for_user: interrupt()         ← graph pauses
  │  checkpointer_pool.putconn(checkpointer_conn)
  │  return SessionView(waiting=True, tutor_message="...")
  │
  ▼
POST /sessions/:id/turn
  [same pattern: brief conn for validation, graph uses own connections]
```

---

## Files to Change

| File | What changes |
|------|-------------|
| `api/routes.py` | Add `finish_session` to import from `core.session_api` |
| `core/session_api.py` | Fix `_values_to_view` tutor_message; remove `conn` arg from `_initial_graph_state`; update `get_session_view` and `start_session` to NOT pass `conn` to `build_quest_graph`; add initialized guard |
| `core/graph.py` | `build_quest_graph(checkpointer)` — remove `conn` param; all nodes call `queries.get_connection()` internally; `_build_checkpointer` uses a `ConnectionPool` instead of single connect; `get_checkpointer` returns a pool-aware wrapper |
| `db/queries.py` | Add `initialized BOOLEAN DEFAULT FALSE` to sessions schema migration; add `mark_session_initialized(conn, session_id)` function returning bool (True if we got to set it, False if already set — uses UPDATE … WHERE initialized=FALSE RETURNING id) |

---

## Detailed Implementation

### 1. `api/routes.py`
```python
# Line 34: add finish_session
from core.session_api import SessionView, get_session_view, start_session, submit_turn, finish_session

# Line 447: change session_api.finish_session to finish_session
return finish_session(conn, session_id)
```

### 2. `core/session_api.py`

**`_values_to_view`** — always expose tutor_message:
```python
tutor_message=tutor,  # was: tutor if waiting or done else None
```

**`_initial_graph_state`** — remove `conn` param (it was never used).

**`get_session_view`** — initialized guard before graph.invoke:
```python
# After loading row, before graph.invoke():
if not values and not row.get("ended_at"):
    # Atomic: only the first request proceeds; concurrent ones skip
    claimed = queries.mark_session_initialized(conn, session_id)
    if claimed:
        concept_list = queries.upsert_topic_concepts(conn, topic_data)
        queries.get_or_create_user(conn, row["user_id"])
        replay_mode = row.get("session_kind") == "replay"
        graph.invoke(_initial_graph_state(session_id, ...), config)
    snapshot = graph.get_state(config)
    values = snapshot.values or {}
```

**`build_quest_graph` call** — no longer passes `conn`:
```python
graph = build_quest_graph(get_checkpointer())
```

### 3. `core/graph.py`

**`build_quest_graph(checkpointer)`** — remove `conn` from signature and all node closures.

Each node pattern (example — `ask_question`):
```python
def ask_question(state: QuestState) -> dict:
    # Brief read — connection held ~5ms
    with queries.get_connection() as c:
        prior = queries.get_recent_summaries(c, state["user_id"], state["topic_id"], limit=2)
    
    # Claude call — NO connection held
    chain = build_socratic_chain(topic=state["topic_id"])
    response = chain.invoke({"history": invoke_history})
    tutor_text = message_content(response)
    
    # Brief write — connection held ~5ms
    with queries.get_connection() as c:
        queries.record_turn(c, state["session_id"], state.get("turn_idx", 0), "tutor", tutor_text)
    
    return {"tutor_message": tutor_text, ...}
```

**`_build_checkpointer`** — use connection pool, return wrapper:
```python
_checkpointer_pool = None

def _get_checkpointer_pool():
    global _checkpointer_pool
    if _checkpointer_pool is None:
        url = os.environ.get("DATABASE_URL")
        if url:
            from psycopg_pool import ConnectionPool
            from psycopg.rows import dict_row
            _checkpointer_pool = ConnectionPool(
                url, min_size=1, max_size=4,
                kwargs={"autocommit": True, "prepare_threshold": None},
            )
    return _checkpointer_pool

def get_checkpointer():
    """Return a per-call PostgresSaver using the checkpointer pool."""
    pool = _get_checkpointer_pool()
    if pool is None:
        # Dev: SQLite
        return _get_sqlite_checkpointer()
    conn = pool.getconn()
    saver = PostgresSaver(conn)
    return saver, lambda: pool.putconn(conn)  # caller must call release()
```

Actually, PostgresSaver wrapping changes the call pattern. Simpler: expose a context manager.

```python
from contextlib import contextmanager

@contextmanager
def checkpointer_session():
    pool = _get_checkpointer_pool()
    if pool is None:
        yield _get_sqlite_checkpointer()
        return
    conn = pool.getconn()
    try:
        saver = PostgresSaver(conn)
        yield saver
    finally:
        pool.putconn(conn)
```

Then in `session_api.py`:
```python
with checkpointer_session() as checkpointer:
    graph = build_quest_graph(checkpointer)
    graph.invoke(...)
    snapshot = graph.get_state(config)
```

### 4. `db/queries.py`

Schema migration (added to `_migrate` or equivalent):
```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS initialized BOOLEAN NOT NULL DEFAULT FALSE;
```

New function:
```python
def mark_session_initialized(conn, session_id: str) -> bool:
    """Atomically claim initialization. Returns True if this call claimed it (first caller).
    Uses UPDATE ... WHERE initialized=FALSE so only one concurrent caller wins."""
    cur = conn.execute(
        "UPDATE sessions SET initialized = TRUE WHERE id = ? AND initialized = FALSE",
        (session_id,),
    )
    conn.commit()
    return cur.rowcount == 1
```

For Postgres the `?` becomes `%s` via the existing `PgConn.execute` adapter.

---

## Verification Steps

1. **Restart backend** (picks up all changes including `prepare_threshold=None`)
2. **Start a session** — navigation happens instantly (< 300ms); session page shows skeleton with spinner
3. **Wait 5-20s** — question appears in chat; `waiting_for_answer=true` in API response
4. **Submit an answer** — evaluator scores, next question appears
5. **Wrap up** — `POST /sessions/:id/finish` works (previously crashed with NameError)
6. **Two browsers, same session** — only one generates the question; both see it correctly
7. **10 concurrent session starts** — all succeed; check pool connection count stays < 10 during Claude calls
8. **Server logs** — no `DuplicatePreparedStatement`, no NameError, no 500s

---

## What's NOT Needed

- **Vector DB**: Not required for the current architecture. The tutoring loop is SQL + Claude. Vector search would be added only when supporting user-uploaded learning materials or semantic concept similarity.
- **Message queue / Celery**: Not needed at <100 users. The connection-per-node pattern with pool size 10 supports ~50 concurrent sessions comfortably (each node holds connection for ~5ms, Claude calls don't hold connections).
- **Redis**: Not needed. LangGraph checkpoint pool in Postgres handles session state. Redis would only be needed for pub/sub or caching if we hit scale.
