"""All SQLite access for Quest. No raw SQL outside this module (per BRIEF)."""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"
_DEFAULT_DB_PATH = _REPO_ROOT / "quest.db"
_CHECKPOINT_DB_PATH = _REPO_ROOT / "quest_checkpoints.db"


def _utc_now() -> str:
    """Return current UTC timestamp as ISO string for SQLite."""
    return datetime.now(timezone.utc).isoformat()


def get_connection(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Open a SQLite connection with row factory enabled.

    Returns a connection to `db_path` or the default `quest.db` in the repo root.
    """
    path = Path(db_path) if db_path else _DEFAULT_DB_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path: Path | str | None = None) -> Path:
    """Create tables from schema.sql if they do not exist.

    Returns the resolved database file path.
    """
    path = Path(db_path) if db_path else _DEFAULT_DB_PATH
    schema = _SCHEMA_PATH.read_text(encoding="utf-8")
    with get_connection(path) as conn:
        conn.executescript(schema)
        conn.commit()
    return path


def namespace_concept_id(topic_id: str, local_id: str) -> str:
    """Build a namespaced concept id: `{topic_id}:{local_id}`."""
    return f"{topic_id}:{local_id}"


def get_or_create_user(
    conn: sqlite3.Connection,
    user_id: str = "default",
    name: str = "Default User",
) -> str:
    """Ensure a user row exists and return the user id."""
    row = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        conn.execute(
            "INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)",
            (user_id, name, _utc_now()),
        )
        conn.commit()
    return user_id


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
) -> str:
    """Insert a new session row and return its id."""
    sid = session_id or str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO sessions (id, user_id, topic, started_at)
        VALUES (?, ?, ?, ?)
        """,
        (sid, user_id, topic, _utc_now()),
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
        SELECT id, user_id, topic, started_at, ended_at, summary_text
        FROM sessions WHERE id = ?
        """,
        (session_id,),
    ).fetchone()
    return dict(row) if row else None


def record_turn(
    conn: sqlite3.Connection,
    session_id: str,
    turn_idx: int,
    role: str,
    content: str,
    *,
    evaluator_score: int | None = None,
    evaluator_gaps: list[str] | None = None,
    evaluator_reasoning: str | None = None,
    evaluator_concept_id: str | None = None,
    evaluator_concept_confidence: float | None = None,
) -> int:
    """Insert one turn row. Returns the new turn's autoincrement id."""
    gaps_json = json.dumps(evaluator_gaps or []) if evaluator_gaps is not None else None
    cursor = conn.execute(
        """
        INSERT INTO turns (
            session_id, turn_idx, role, content,
            evaluator_score, evaluator_gaps_json, evaluator_reasoning,
            evaluator_concept_id, evaluator_concept_confidence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_id,
            turn_idx,
            role,
            content,
            evaluator_score,
            gaps_json,
            evaluator_reasoning,
            evaluator_concept_id,
            evaluator_concept_confidence,
            _utc_now(),
        ),
    )
    conn.commit()
    return int(cursor.lastrowid)


def get_checkpoint_db_path() -> Path:
    """Return the LangGraph SQLite checkpointer database path."""
    return _CHECKPOINT_DB_PATH


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
    base = _CHECKPOINT_DB_PATH
    for path in (base, base.with_suffix(".db-shm"), base.with_suffix(".db-wal")):
        if path.exists():
            path.unlink()
            removed.append(path)
    return removed


def get_open_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic: str,
) -> str | None:
    """Return the id of an in-progress session (ended_at IS NULL), if any."""
    row = conn.execute(
        """
        SELECT id FROM sessions
        WHERE user_id = ? AND topic = ? AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
        """,
        (user_id, topic),
    ).fetchone()
    return row["id"] if row else None


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


def get_mastery_maps(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
) -> tuple[dict[str, float], dict[str, str | None]]:
    """Return (concept_id -> normalized score, concept_id -> next_review_at)."""
    rows = conn.execute(
        """
        SELECT m.concept_id, m.score, m.next_review_at
        FROM mastery m
        JOIN concepts c ON c.id = m.concept_id
        WHERE m.user_id = ? AND c.topic = ? AND c.kind = 'concept'
        """,
        (user_id, topic_id),
    ).fetchall()
    scores = {r["concept_id"]: float(r["score"]) for r in rows}
    reviews = {r["concept_id"]: r["next_review_at"] for r in rows}
    return scores, reviews


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
