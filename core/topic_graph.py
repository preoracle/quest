"""Topic concept DAG + mastery for progress / graph UI."""

from __future__ import annotations

import json
import sqlite3

from pydantic import BaseModel, Field

from core.concept_pick import is_concept_mastered
from core.topics import list_topics, load_topic
from db import queries


class GraphNode(BaseModel):
    """One concept node with mastery for visualization."""

    id: str
    name: str
    description: str = ""
    prerequisites: list[str] = Field(default_factory=list)
    score_1_to_5: float = 0.0
    num_evaluations: int = 0


class TopicGraph(BaseModel):
    """Concept map edges and scores for a topic."""

    topic_id: str
    display_name: str
    nodes: list[GraphNode]


def get_topic_graph(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
) -> TopicGraph:
    """Load topic YAML into DB and return nodes with user mastery."""
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id
    queries.get_or_create_user(conn, user_id)
    queries.upsert_topic_concepts(conn, topic_data)
    concepts = queries.get_topic_concepts(conn, topic_id)
    mastery_rows = queries.get_mastery_for_user(conn, user_id, topic_id)
    mastery_by_id = {m.concept_id: m for m in mastery_rows}

    nodes: list[GraphNode] = []
    for c in concepts:
        prereqs_raw = c.get("prerequisites_json") or "[]"
        try:
            prereqs = json.loads(prereqs_raw) if isinstance(prereqs_raw, str) else prereqs_raw
        except json.JSONDecodeError:
            prereqs = []
        if not isinstance(prereqs, list):
            prereqs = []
        m = mastery_by_id.get(c["id"])
        nodes.append(
            GraphNode(
                id=c["id"],
                name=c["name"],
                description=(c.get("description") or "")[:200],
                prerequisites=[str(p) for p in prereqs],
                score_1_to_5=m.score_1_to_5 if m else 0.0,
                num_evaluations=m.num_evaluations if m else 0,
            )
        )

    return TopicGraph(topic_id=topic_id, display_name=display, nodes=nodes)


def topic_mastery_summary(
    conn,
    user_id: str,
) -> list[dict]:
    """Per-topic rollup using two bulk SQL queries — no per-topic round-trips."""
    from datetime import datetime, timezone  # noqa: PLC0415

    # --- Query 1: mastery rollup + last study time per topic (single round-trip) ---
    now_iso = datetime.now(timezone.utc).isoformat()
    mastery_rows = conn.execute(
        """
        SELECT
            c.topic                                                        AS topic_id,
            COUNT(DISTINCT c.id)                                           AS concept_count,
            COALESCE(SUM(CASE WHEN m.user_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS evaluated_count,
            COALESCE(AVG(CASE WHEN m.num_evaluations > 0 THEN m.score * 5 END), 0) AS avg_score,
            COALESCE(SUM(
                CASE WHEN m.score >= 0.8 AND m.num_evaluations >= 3 THEN 1 ELSE 0 END
            ), 0)                                                          AS mastered_count,
            MAX(m.last_reviewed_at)                                        AS last_studied_at
        FROM concepts c
        LEFT JOIN mastery m ON m.concept_id = c.id AND m.user_id = ?
        WHERE c.kind = 'concept'
        GROUP BY c.topic
        """,
        (user_id,),
    ).fetchall()

    # --- Query 2: due counts per topic (single round-trip) ---
    due_rows = conn.execute(
        """
        SELECT c.topic, COUNT(*) AS due_count
        FROM mastery m
        JOIN concepts c ON c.id = m.concept_id
        WHERE m.user_id = ?
          AND c.kind = 'concept'
          AND (m.next_review_at IS NULL OR m.next_review_at <= ?)
        GROUP BY c.topic
        """,
        (user_id, now_iso),
    ).fetchall()
    due_by_topic = {r["topic"]: int(r["due_count"]) for r in due_rows}

    # Build output using YAML display names (no extra DB calls)
    topic_meta = {tid: name for tid, name in list_topics()}

    out = []
    for r in mastery_rows:
        tid = r["topic_id"]
        if tid not in topic_meta:
            continue  # YAML file was deleted
        evaluated = int(r["evaluated_count"] or 0)
        last_at = r["last_studied_at"]
        if last_at is not None and hasattr(last_at, "isoformat"):
            last_at = last_at.isoformat()
        out.append(
            {
                "topic_id": tid,
                "display_name": topic_meta[tid],
                "concept_count": int(r["concept_count"] or 0),
                "mastered_count": int(r["mastered_count"] or 0),
                "avg_score_1_to_5": round(float(r["avg_score"] or 0), 2),
                "due_count": due_by_topic.get(tid, 0),
                "started": evaluated > 0,
                "last_studied_at": last_at,
            }
        )
    return out
