"""All database access for Quest. No raw SQL outside this module (per BRIEF)."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.paths import checkpoint_db_path as default_checkpoint_path
from db import connection as _conn_module

_SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"
_PG_SCHEMA_PATH = Path(__file__).resolve().parent / "schema.pg.sql"

# Topics seeded for every new user on first login.
DEFAULT_TOPICS: list[str] = [
    "rag_pipeline",
    "tool_calling_agents",
    "embeddings_vector_search",
    "model_context_protocol",
    "memory_systems",
]


def _utc_now() -> str:
    """Return current UTC timestamp as ISO string for SQLite."""
    return datetime.now(timezone.utc).isoformat()


def get_connection(db_path: Path | str | None = None):
    """Return a DB connection — Postgres when DATABASE_URL is set, else SQLite."""
    return _conn_module.get_connection(db_path)


def _migrate_schema(conn) -> None:
    """Apply additive schema changes for existing databases."""
    if conn.db_type == "postgres":
        conn.execute("ALTER TABLE turns ADD COLUMN IF NOT EXISTS evaluator_gap_type TEXT")
        conn.execute("ALTER TABLE turns ADD COLUMN IF NOT EXISTS evaluator_expert_framing TEXT")
        conn.execute("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_kind_check")
        conn.execute(
            "ALTER TABLE sessions ADD CONSTRAINT sessions_session_kind_check "
            "CHECK (session_kind IN ('study', 'baseline', 'replay'))"
        )
        conn.commit()
        return

    cols = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(sessions)").fetchall()
    }
    if "report_json" not in cols:
        conn.execute("ALTER TABLE sessions ADD COLUMN report_json TEXT")
    if "session_kind" not in cols:
        conn.execute(
            "ALTER TABLE sessions ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'study'"
        )
    tables = {
        row["name"]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    turn_cols = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(turns)").fetchall()
    }
    if "evaluator_gap_type" not in turn_cols:
        conn.execute("ALTER TABLE turns ADD COLUMN evaluator_gap_type TEXT")
    if "evaluator_expert_framing" not in turn_cols:
        conn.execute("ALTER TABLE turns ADD COLUMN evaluator_expert_framing TEXT")
    if "topic_metadata" not in tables:
        conn.execute(
            """
            CREATE TABLE topic_metadata (
              topic_id TEXT PRIMARY KEY,
              archived_at TEXT,
              pinned_at TEXT,
              tags_json TEXT NOT NULL DEFAULT '[]',
              user_created INTEGER NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL
            )
            """
        )
    if "user_topics" not in tables:
        conn.execute(
            """
            CREATE TABLE user_topics (
              user_id TEXT NOT NULL REFERENCES users(id),
              topic_id TEXT NOT NULL,
              enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (user_id, topic_id)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_topics_user ON user_topics(user_id)"
        )
    if "llm_calls" not in tables:
        conn.execute(
            """
            CREATE TABLE llm_calls (
              id            INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id    TEXT REFERENCES sessions(id) ON DELETE SET NULL,
              turn_idx      INTEGER,
              chain         TEXT NOT NULL,
              model         TEXT NOT NULL,
              latency_ms    INTEGER,
              input_tokens  INTEGER,
              output_tokens INTEGER,
              retries       INTEGER NOT NULL DEFAULT 0,
              success       INTEGER NOT NULL DEFAULT 1,
              error         TEXT,
              created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_llm_calls_session ON llm_calls(session_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_llm_calls_chain_created "
            "ON llm_calls(chain, created_at)"
        )


def init_db(db_path: Path | str | None = None) -> Path | None:
    """Create tables from schema if they do not exist.

    Uses schema.pg.sql for Postgres (DATABASE_URL set) or schema.sql for SQLite.
    Returns the resolved database file path for SQLite, None for Postgres.
    """
    if _conn_module.db_mode() == "postgres":
        schema = _PG_SCHEMA_PATH.read_text(encoding="utf-8")
        with get_connection() as conn:
            conn.executescript(schema)
            _migrate_schema(conn)
        return None
    from core.paths import db_path as _default_db_path  # noqa: PLC0415
    path = Path(db_path) if db_path else _default_db_path()
    schema = _SCHEMA_PATH.read_text(encoding="utf-8")
    with get_connection(path) as conn:
        conn.executescript(schema)
        _migrate_schema(conn)
    return path


def namespace_concept_id(topic_id: str, local_id: str) -> str:
    """Build a namespaced concept id: `{topic_id}:{local_id}`."""
    return f"{topic_id}:{local_id}"


# In-memory set of user IDs confirmed to exist — avoids a DB round-trip on every request.
_known_users: set[str] = set()


def get_or_create_user(
    conn,
    user_id: str = "default",
    name: str = "Default User",
) -> str:
    """Ensure a user row exists and return the user id.

    Seeds DEFAULT_TOPICS enrollment on first creation.
    Uses an in-memory cache to skip the DB check on subsequent calls.
    """
    if user_id in _known_users:
        return user_id
    row = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        conn.execute(
            "INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)",
            (user_id, name, _utc_now()),
        )
        conn.commit()
        seed_default_topics(conn, user_id)
    _known_users.add(user_id)
    return user_id


def get_user_name(conn, user_id: str) -> str | None:
    """Return the stored display name for a user, or None if not found."""
    row = conn.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
    return row["name"] if row else None


def upsert_topic_concepts(conn: sqlite3.Connection, topic_data: dict[str, Any]) -> list[dict[str, str]]:
    """Upsert topic + concept rows from a parsed concept YAML dict.

    Topic row uses id = topic field. Concept rows use id = `{topic}:{local_id}`.
    Returns the concept list passed to the evaluator (id, name, description only).
    """
    topic_id = topic_data["topic"]
    display_name = topic_data.get("display_name") or topic_id.replace("_", " ").title()

    conn.execute(
        """
        INSERT INTO concepts (id, topic, kind, name, description, prerequisites_json)
        VALUES (?, ?, 'topic', ?, ?, '[]')
        ON CONFLICT(id) DO UPDATE SET
            topic = excluded.topic,
            kind = excluded.kind,
            name = excluded.name,
            description = excluded.description
        """,
        (topic_id, topic_id, display_name, topic_data.get("description")),
    )

    evaluator_concepts: list[dict[str, str]] = []
    for concept in topic_data.get("concepts") or []:
        local_id = concept["id"]
        namespaced = namespace_concept_id(topic_id, local_id)
        prereqs = concept.get("prerequisites") or []
        conn.execute(
            """
            INSERT INTO concepts (id, topic, kind, name, description, prerequisites_json)
            VALUES (?, ?, 'concept', ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                topic = excluded.topic,
                kind = excluded.kind,
                name = excluded.name,
                description = excluded.description,
                prerequisites_json = excluded.prerequisites_json
            """,
            (
                namespaced,
                topic_id,
                concept.get("name", local_id),
                concept.get("description"),
                json.dumps(prereqs),
            ),
        )
        evaluator_concepts.append(
            {
                "id": namespaced,
                "name": concept.get("name", local_id),
                "description": concept.get("description") or "",
            }
        )

    conn.commit()
    return evaluator_concepts


def create_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic: str,
    session_id: str | None = None,
    *,
    session_kind: str = "study",
) -> str:
    """Insert a new session row and return its id."""
    if session_kind not in ("study", "baseline", "replay"):
        raise ValueError(f"Invalid session_kind: {session_kind}")
    sid = session_id or str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO sessions (id, user_id, topic, started_at, session_kind)
        VALUES (?, ?, ?, ?, ?)
        """,
        (sid, user_id, topic, _utc_now(), session_kind),
    )
    conn.commit()
    return sid


def end_session(conn: sqlite3.Connection, session_id: str) -> None:
    """Set ended_at on a session."""
    conn.execute(
        "UPDATE sessions SET ended_at = ? WHERE id = ?",
        (_utc_now(), session_id),
    )
    conn.commit()


def get_session(conn: sqlite3.Connection, session_id: str) -> dict | None:
    """Return a session row as a dict, or None if missing."""
    row = conn.execute(
        """
        SELECT id, user_id, topic, started_at, ended_at, summary_text, report_json,
               session_kind
        FROM sessions WHERE id = ?
        """,
        (session_id,),
    ).fetchone()
    return dict(row) if row else None


def count_user_turns_last_hour(conn, user_id: str) -> int:
    """Count student (role='user') turns submitted in the past hour for rate limiting.

    Counts across all sessions for this user.  Used to enforce the 60 turns/hour
    per-user cap — prevents automated scoring attacks while being far above any
    realistic human session rate (~6 turns/session × 2 sessions/hour = 12 turns).
    """
    # SQLite uses datetime() expressions; Postgres uses interval arithmetic.
    if getattr(conn, "db_type", "sqlite") == "postgres":
        since_expr = "NOW() - INTERVAL '1 hour'"
    else:
        since_expr = "datetime('now', '-1 hour')"
    row = conn.execute(
        f"""
        SELECT COUNT(*) AS n
        FROM turns t
        JOIN sessions s ON s.id = t.session_id
        WHERE s.user_id = ?
          AND t.role = 'user'
          AND t.created_at >= {since_expr}
        """,
        (user_id,),
    ).fetchone()
    return int(row["n"]) if row else 0


def record_turn(
    conn,
    session_id: str,
    turn_idx: int,
    role: str,
    content: str,
    *,
    evaluator_score: int | None = None,
    evaluator_gaps: list[str] | None = None,
    evaluator_reasoning: str | None = None,
    evaluator_gap_type: str | None = None,
    evaluator_expert_framing: str | None = None,
    evaluator_concept_id: str | None = None,
    evaluator_concept_confidence: float | None = None,
) -> int:
    """Insert one turn row. Returns the new turn's autoincrement id."""
    gaps_json = json.dumps(evaluator_gaps or []) if evaluator_gaps is not None else None
    params = (
        session_id, turn_idx, role, content,
        evaluator_score, gaps_json, evaluator_reasoning,
        evaluator_gap_type, evaluator_expert_framing,
        evaluator_concept_id, evaluator_concept_confidence, _utc_now(),
    )
    insert_sql = """
        INSERT INTO turns (
            session_id, turn_idx, role, content,
            evaluator_score, evaluator_gaps_json, evaluator_reasoning,
            evaluator_gap_type, evaluator_expert_framing,
            evaluator_concept_id, evaluator_concept_confidence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    if conn.db_type == "postgres":
        cursor = conn.execute(insert_sql + " RETURNING id", params)
        conn.commit()
        row = cursor.fetchone()
        return int(row["id"])
    cursor = conn.execute(insert_sql, params)
    conn.commit()
    return int(cursor.lastrowid)


def get_checkpoint_db_path() -> Path:
    """Return the LangGraph SQLite checkpointer database path."""
    return default_checkpoint_path()


def reset_user_progress(
    conn: sqlite3.Connection,
    user_id: str,
    *,
    topic: str | None = None,
) -> dict[str, int]:
    """Delete sessions, turns, and mastery for a user.

    Concept rows survive (they come from `concepts/*.yaml`). If `topic` is
    given, scopes the reset to one topic. Returns row counts deleted.
    """
    if topic:
        turns_cur = conn.execute(
            """
            DELETE FROM turns WHERE session_id IN (
                SELECT id FROM sessions WHERE user_id = ? AND topic = ?
            )
            """,
            (user_id, topic),
        )
        sessions_cur = conn.execute(
            "DELETE FROM sessions WHERE user_id = ? AND topic = ?",
            (user_id, topic),
        )
        mastery_cur = conn.execute(
            """
            DELETE FROM mastery
            WHERE user_id = ? AND concept_id IN (
                SELECT id FROM concepts WHERE topic = ?
            )
            """,
            (user_id, topic),
        )
    else:
        turns_cur = conn.execute(
            """
            DELETE FROM turns WHERE session_id IN (
                SELECT id FROM sessions WHERE user_id = ?
            )
            """,
            (user_id,),
        )
        sessions_cur = conn.execute(
            "DELETE FROM sessions WHERE user_id = ?",
            (user_id,),
        )
        mastery_cur = conn.execute(
            "DELETE FROM mastery WHERE user_id = ?",
            (user_id,),
        )
    conn.commit()
    return {
        "turns": int(turns_cur.rowcount or 0),
        "sessions": int(sessions_cur.rowcount or 0),
        "mastery": int(mastery_cur.rowcount or 0),
    }


def delete_checkpoint_db() -> list[Path]:
    """Remove the LangGraph SQLite checkpoint DB and its WAL sidecars.

    Returns the list of paths that were removed.
    """
    removed: list[Path] = []
    base = default_checkpoint_path()
    for path in (base, base.with_suffix(".db-shm"), base.with_suffix(".db-wal")):
        if path.exists():
            path.unlink()
            removed.append(path)
    return removed


def get_open_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic: str,
    *,
    session_kind: str = "study",
) -> str | None:
    """Return the id of an in-progress session (ended_at IS NULL), if any.

    Defaults to ``study`` only — baseline sessions use a separate flow and must
    not be resumed as Socratic study (they have no LangGraph checkpoint).
    """
    row = conn.execute(
        """
        SELECT id FROM sessions
        WHERE user_id = ? AND topic = ? AND ended_at IS NULL
          AND session_kind = ?
        ORDER BY started_at DESC
        LIMIT 1
        """,
        (user_id, topic, session_kind),
    ).fetchone()
    return row["id"] if row else None


def close_open_study_sessions(
    conn: sqlite3.Connection,
    user_id: str,
    topic: str,
) -> int:
    """End all open study sessions for a user+topic. Returns rows updated."""
    cur = conn.execute(
        """
        UPDATE sessions SET ended_at = ?
        WHERE user_id = ? AND topic = ? AND ended_at IS NULL
          AND session_kind = 'study'
        """,
        (_utc_now(), user_id, topic),
    )
    conn.commit()
    return cur.rowcount


def get_topic_last_study_at(
    conn: sqlite3.Connection,
    user_id: str,
) -> dict[str, str]:
    """Most recent study session start time per topic (ISO timestamps)."""
    rows = conn.execute(
        """
        SELECT topic, MAX(started_at) AS last_at
        FROM sessions
        WHERE user_id = ? AND session_kind = 'study'
        GROUP BY topic
        """,
        (user_id,),
    ).fetchall()
    def _to_iso(v):
        if v is None:
            return None
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)
    return {row["topic"]: _to_iso(row["last_at"]) for row in rows}


def get_topic_concepts(conn: sqlite3.Connection, topic_id: str) -> list[dict]:
    """Return concept rows (kind=concept) for a topic as dicts."""
    rows = conn.execute(
        """
        SELECT id, topic, kind, name, description, prerequisites_json
        FROM concepts
        WHERE topic = ? AND kind = 'concept'
        ORDER BY name
        """,
        (topic_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def topic_has_concept_mastery(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
) -> bool:
    """True if the user has any concept-level mastery rows for this topic."""
    row = conn.execute(
        """
        SELECT 1 FROM mastery m
        JOIN concepts c ON c.id = m.concept_id
        WHERE m.user_id = ? AND c.topic = ? AND c.kind = 'concept'
        LIMIT 1
        """,
        (user_id, topic_id),
    ).fetchone()
    return row is not None


def get_mastery_maps(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
) -> tuple[dict[str, float], dict[str, str | None], dict[str, int]]:
    """Return (scores, next_review_at, num_evaluations) keyed by concept_id."""
    rows = conn.execute(
        """
        SELECT m.concept_id, m.score, m.next_review_at, m.num_evaluations
        FROM mastery m
        JOIN concepts c ON c.id = m.concept_id
        WHERE m.user_id = ? AND c.topic = ? AND c.kind = 'concept'
        """,
        (user_id, topic_id),
    ).fetchall()
    scores = {r["concept_id"]: float(r["score"]) for r in rows}
    reviews = {r["concept_id"]: r["next_review_at"] for r in rows}
    eval_counts = {r["concept_id"]: int(r["num_evaluations"]) for r in rows}
    return scores, reviews, eval_counts


def get_turns_for_session(
    conn: sqlite3.Connection,
    session_id: str,
) -> list[dict]:
    """Return turn rows ordered by turn_idx."""
    rows = conn.execute(
        """
        SELECT role, content, turn_idx
        FROM turns
        WHERE session_id = ?
        ORDER BY turn_idx
        """,
        (session_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_session_turns_detailed(
    conn: sqlite3.Connection,
    session_id: str,
) -> list[dict]:
    """Return turns with evaluator fields for session reports."""
    rows = conn.execute(
        """
        SELECT turn_idx, role, content, evaluator_score, evaluator_gaps_json,
               evaluator_concept_id, evaluator_reasoning,
               evaluator_gap_type, evaluator_expert_framing
        FROM turns
        WHERE session_id = ?
        ORDER BY turn_idx
        """,
        (session_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def set_session_summary(
    conn: sqlite3.Connection,
    session_id: str,
    summary_text: str,
) -> None:
    """Write the session summary blob."""
    conn.execute(
        "UPDATE sessions SET summary_text = ? WHERE id = ?",
        (summary_text, session_id),
    )
    conn.commit()


def set_session_report(
    conn: sqlite3.Connection,
    session_id: str,
    report_json: str,
) -> None:
    """Write structured session report JSON."""
    conn.execute(
        "UPDATE sessions SET report_json = ? WHERE id = ?",
        (report_json, session_id),
    )
    conn.commit()


def log_llm_call(
    conn,
    *,
    chain: str,
    model: str,
    session_id: str | None = None,
    turn_idx: int | None = None,
    latency_ms: int | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    retries: int = 0,
    success: bool = True,
    error: str | None = None,
) -> None:
    """Insert one LLM call log row.

    Best-effort: callers should swallow exceptions so a logging failure never
    interrupts a live session.  All fields except chain and model are optional.
    """
    conn.execute(
        """
        INSERT INTO llm_calls
          (session_id, turn_idx, chain, model, latency_ms,
           input_tokens, output_tokens, retries, success, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_id, turn_idx, chain, model, latency_ms,
            input_tokens, output_tokens, retries,
            bool(success), error,  # Postgres BOOLEAN requires bool, not int
        ),
    )
    conn.commit()


@dataclass
class DueConceptRow:
    """One concept due for SM-2 review."""

    topic: str
    concept_id: str
    name: str
    score_1_to_5: float
    next_review_at: str | None
    overdue: bool


def get_due_concepts(
    conn: sqlite3.Connection,
    user_id: str,
    *,
    topic: str | None = None,
    as_of: datetime | None = None,
) -> list[DueConceptRow]:
    """Return concepts due for review (never scheduled or next_review_at <= as_of)."""
    from core.concept_pick import is_due

    now = as_of or datetime.now(timezone.utc)
    params: list[Any] = [user_id]
    topic_clause = ""
    if topic:
        topic_clause = " AND c.topic = ?"
        params.append(topic)

    rows = conn.execute(
        f"""
        SELECT c.topic, c.id, c.name, m.score, m.next_review_at
        FROM mastery m
        JOIN concepts c ON c.id = m.concept_id
        WHERE m.user_id = ? AND c.kind = 'concept'{topic_clause}
        ORDER BY c.topic, m.next_review_at IS NULL DESC, m.next_review_at ASC
        """,
        params,
    ).fetchall()

    out: list[DueConceptRow] = []
    for r in rows:
        nra_raw = r["next_review_at"]
        nra = nra_raw.isoformat() if isinstance(nra_raw, datetime) else nra_raw
        if not is_due(nra, now):
            continue
        overdue = bool(nra)
        out.append(
            DueConceptRow(
                topic=r["topic"],
                concept_id=r["id"],
                name=r["name"],
                score_1_to_5=float(r["score"]) * 5.0,
                next_review_at=nra,
                overdue=overdue and nra is not None,
            )
        )
    return out


def get_recent_summaries(
    conn: sqlite3.Connection,
    user_id: str,
    topic: str,
    limit: int = 3,
) -> list[str]:
    """Return the most recent non-null session summaries for a user/topic."""
    rows = conn.execute(
        """
        SELECT summary_text FROM sessions
        WHERE user_id = ? AND topic = ? AND summary_text IS NOT NULL
        ORDER BY ended_at DESC
        LIMIT ?
        """,
        (user_id, topic, limit),
    ).fetchall()
    return [r["summary_text"] for r in rows]


def upsert_mastery(
    conn: sqlite3.Connection,
    user_id: str,
    concept_id: str,
    normalized_score: float,
) -> None:
    """Update running-average mastery for (user_id, concept_id).

    `normalized_score` must be in [0, 1] (typically evaluator score / 5).
    """
    row = conn.execute(
        """
        SELECT score, num_evaluations FROM mastery
        WHERE user_id = ? AND concept_id = ?
        """,
        (user_id, concept_id),
    ).fetchone()

    if row is None:
        conn.execute(
            """
            INSERT INTO mastery (
                user_id, concept_id, score, num_evaluations, last_reviewed_at
            ) VALUES (?, ?, ?, 1, ?)
            """,
            (user_id, concept_id, normalized_score, _utc_now()),
        )
    else:
        n = int(row["num_evaluations"])
        old = float(row["score"])
        new_score = (old * n + normalized_score) / (n + 1)
        conn.execute(
            """
            UPDATE mastery
            SET score = ?, num_evaluations = ?, last_reviewed_at = ?
            WHERE user_id = ? AND concept_id = ?
            """,
            (new_score, n + 1, _utc_now(), user_id, concept_id),
        )
    conn.commit()


def get_mastery_sm2_state(
    conn: sqlite3.Connection,
    user_id: str,
    concept_id: str,
) -> tuple[float, int, float, int, int] | None:
    """Return (score, num_evaluations, ease_factor, interval_days, repetitions) or None."""
    row = conn.execute(
        """
        SELECT score, num_evaluations, ease_factor, interval_days, repetitions
        FROM mastery
        WHERE user_id = ? AND concept_id = ?
        """,
        (user_id, concept_id),
    ).fetchone()
    if row is None:
        return None
    return (
        float(row["score"]),
        int(row["num_evaluations"]),
        float(row["ease_factor"]),
        int(row["interval_days"]),
        int(row["repetitions"]),
    )


@dataclass
class MasteryRow:
    """One mastery record joined with concept metadata."""

    concept_id: str
    topic: str
    kind: str
    name: str
    score: float
    num_evaluations: int
    score_1_to_5: float


def get_mastery_for_user(
    conn: sqlite3.Connection,
    user_id: str,
    topic: str | None = None,
) -> list[MasteryRow]:
    """Return mastery rows for a user, optionally filtered by topic."""
    if topic:
        rows = conn.execute(
            """
            SELECT m.concept_id, c.topic, c.kind, c.name, m.score, m.num_evaluations
            FROM mastery m
            JOIN concepts c ON c.id = m.concept_id
            WHERE m.user_id = ? AND c.topic = ?
            ORDER BY c.kind DESC, c.name
            """,
            (user_id, topic),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT m.concept_id, c.topic, c.kind, c.name, m.score, m.num_evaluations
            FROM mastery m
            JOIN concepts c ON c.id = m.concept_id
            WHERE m.user_id = ?
            ORDER BY c.topic, c.kind DESC, c.name
            """,
            (user_id,),
        ).fetchall()

    return [
        MasteryRow(
            concept_id=r["concept_id"],
            topic=r["topic"],
            kind=r["kind"],
            name=r["name"],
            score=float(r["score"]),
            num_evaluations=int(r["num_evaluations"]),
            score_1_to_5=float(r["score"]) * 5.0,
        )
        for r in rows
    ]


def get_topic_metadata(
    conn: sqlite3.Connection,
    topic_id: str,
) -> dict[str, Any] | None:
    """Return topic_metadata row as a dict, or None if unset."""
    row = conn.execute(
        """
        SELECT topic_id, archived_at, pinned_at, tags_json, user_created, updated_at
        FROM topic_metadata WHERE topic_id = ?
        """,
        (topic_id,),
    ).fetchone()
    if row is None:
        return None
    tags: list[str] = []
    if row["tags_json"]:
        try:
            parsed = json.loads(row["tags_json"])
            if isinstance(parsed, list):
                tags = [str(t) for t in parsed]
        except json.JSONDecodeError:
            tags = []
    return {
        "topic_id": row["topic_id"],
        "archived_at": row["archived_at"],
        "pinned_at": row["pinned_at"],
        "tags": tags,
        "user_created": bool(row["user_created"]),
        "updated_at": row["updated_at"],
    }


def list_topic_metadata(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """Return all topic_metadata rows keyed by topic_id."""
    rows = conn.execute(
        """
        SELECT topic_id, archived_at, pinned_at, tags_json, user_created, updated_at
        FROM topic_metadata
        """
    ).fetchall()
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        meta = get_topic_metadata(conn, row["topic_id"])
        if meta:
            out[row["topic_id"]] = meta
    return out


def upsert_topic_metadata(
    conn: sqlite3.Connection,
    topic_id: str,
    *,
    archived: bool | None = None,
    pinned: bool | None = None,
    tags: list[str] | None = None,
    user_created: bool | None = None,
) -> dict[str, Any]:
    """Create or update topic_metadata. Returns the merged row."""
    existing = get_topic_metadata(conn, topic_id)
    archived_at = existing["archived_at"] if existing else None
    pinned_at = existing["pinned_at"] if existing else None
    tags_json = json.dumps(existing["tags"] if existing else [])
    uc = int(existing["user_created"]) if existing else 0

    if archived is True:
        archived_at = _utc_now()
    elif archived is False:
        archived_at = None
    if pinned is True:
        pinned_at = _utc_now()
    elif pinned is False:
        pinned_at = None
    if tags is not None:
        tags_json = json.dumps(tags)
    if user_created is not None:
        uc = int(user_created)

    now = _utc_now()
    # SQLite allows scalar MAX(a,b); Postgres needs GREATEST or CASE — use CASE for both.
    uc_merge = """
        CASE
            WHEN topic_metadata.user_created > excluded.user_created
            THEN topic_metadata.user_created
            ELSE excluded.user_created
        END
    """
    conn.execute(
        f"""
        INSERT INTO topic_metadata (
            topic_id, archived_at, pinned_at, tags_json, user_created, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(topic_id) DO UPDATE SET
            archived_at = excluded.archived_at,
            pinned_at = excluded.pinned_at,
            tags_json = excluded.tags_json,
            user_created = {uc_merge},
            updated_at = excluded.updated_at
        """,
        (topic_id, archived_at, pinned_at, tags_json, uc, now),
    )
    conn.commit()
    result = get_topic_metadata(conn, topic_id)
    assert result is not None
    return result


def delete_topic_metadata(conn: sqlite3.Connection, topic_id: str) -> None:
    """Remove topic_metadata row for a topic."""
    conn.execute("DELETE FROM topic_metadata WHERE topic_id = ?", (topic_id,))
    conn.commit()


def delete_concepts_for_topic(conn: sqlite3.Connection, topic_id: str) -> int:
    """Delete all concept rows (topic + concepts) for a topic. Returns rows removed."""
    cur = conn.execute("DELETE FROM concepts WHERE topic = ?", (topic_id,))
    conn.commit()
    return int(cur.rowcount or 0)


def migrate_topic_id(
    conn: sqlite3.Connection,
    old_id: str,
    new_id: str,
) -> None:
    """Rename a topic id across concepts, mastery, sessions, and metadata."""
    if old_id == new_id:
        return
    prefix_old = f"{old_id}:"
    prefix_new = f"{new_id}:"
    conn.execute(
        """
        UPDATE concepts SET id = ?, topic = ?
        WHERE id = ? AND kind = 'topic'
        """,
        (new_id, new_id, old_id),
    )
    rows = conn.execute(
        "SELECT id FROM concepts WHERE topic = ? AND kind = 'concept'",
        (old_id,),
    ).fetchall()
    for row in rows:
        old_cid = row["id"]
        if old_cid.startswith(prefix_old):
            local = old_cid[len(prefix_old) :]
            new_cid = namespace_concept_id(new_id, local)
            conn.execute(
                """
                UPDATE concepts SET id = ?, topic = ? WHERE id = ?
                """,
                (new_cid, new_id, old_cid),
            )
    conn.execute(
        """
        UPDATE mastery SET concept_id = REPLACE(concept_id, ?, ?)
        WHERE concept_id LIKE ?
        """,
        (prefix_old, prefix_new, f"{prefix_old}%"),
    )
    conn.execute(
        "UPDATE sessions SET topic = ? WHERE topic = ?",
        (new_id, old_id),
    )
    conn.execute(
        "UPDATE topic_metadata SET topic_id = ? WHERE topic_id = ?",
        (new_id, old_id),
    )
    conn.execute(
        "UPDATE user_topics SET topic_id = ? WHERE topic_id = ?",
        (new_id, old_id),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# User topic enrollment
# ---------------------------------------------------------------------------

def seed_default_topics(conn, user_id: str) -> None:
    """Enroll a new user in DEFAULT_TOPICS."""
    now = _utc_now()
    for tid in DEFAULT_TOPICS:
        conn.execute(
            """
            INSERT INTO user_topics (user_id, topic_id, enrolled_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, topic_id) DO NOTHING
            """,
            (user_id, tid, now),
        )
    conn.commit()


def get_user_enrolled_topics(conn, user_id: str) -> set[str]:
    """Return the set of topic_ids this user is enrolled in."""
    rows = conn.execute(
        "SELECT topic_id FROM user_topics WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    return {r["topic_id"] for r in rows}


def enroll_topic(conn, user_id: str, topic_id: str) -> None:
    """Add a topic to this user's enrolled set (idempotent)."""
    conn.execute(
        """
        INSERT INTO user_topics (user_id, topic_id, enrolled_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, topic_id) DO NOTHING
        """,
        (user_id, topic_id, _utc_now()),
    )
    conn.commit()


def unenroll_topic(conn, user_id: str, topic_id: str) -> None:
    """Remove a topic from this user's enrolled set."""
    conn.execute(
        "DELETE FROM user_topics WHERE user_id = ? AND topic_id = ?",
        (user_id, topic_id),
    )
    conn.commit()


def get_last_student_turn(
    conn,
    session_id: str,
) -> dict | None:
    """Return the most recent student (user-role) turn and the preceding tutor question.

    Returns a dict with keys: turn_idx, student_answer, tutor_question.
    Returns None if no student turn exists yet.
    """
    row = conn.execute(
        """
        SELECT turn_idx, content FROM turns
        WHERE session_id = ? AND role = 'user'
        ORDER BY turn_idx DESC
        LIMIT 1
        """,
        (session_id,),
    ).fetchone()
    if row is None:
        return None

    student_turn_idx = int(row["turn_idx"])
    student_answer = row["content"]

    tutor_row = conn.execute(
        """
        SELECT content FROM turns
        WHERE session_id = ? AND role = 'tutor' AND turn_idx < ?
        ORDER BY turn_idx DESC
        LIMIT 1
        """,
        (session_id, student_turn_idx),
    ).fetchone()
    tutor_question = tutor_row["content"] if tutor_row else ""

    return {
        "turn_idx": student_turn_idx,
        "student_answer": student_answer,
        "tutor_question": tutor_question,
    }


def update_turn_evaluation(
    conn,
    session_id: str,
    turn_idx: int,
    *,
    evaluator_score: int,
    evaluator_gaps: list[str],
    evaluator_reasoning: str,
    evaluator_gap_type: str | None,
    evaluator_expert_framing: str | None,
) -> None:
    """Overwrite the stored evaluator fields for a turn (used by re-evaluate flow)."""
    gaps_json = json.dumps(evaluator_gaps)
    conn.execute(
        """
        UPDATE turns SET
            evaluator_score = ?,
            evaluator_gaps_json = ?,
            evaluator_reasoning = ?,
            evaluator_gap_type = ?,
            evaluator_expert_framing = ?
        WHERE session_id = ? AND turn_idx = ?
        """,
        (
            evaluator_score, gaps_json, evaluator_reasoning,
            evaluator_gap_type, evaluator_expert_framing,
            session_id, turn_idx,
        ),
    )
    conn.commit()
