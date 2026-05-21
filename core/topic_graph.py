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
    conn: sqlite3.Connection,
    user_id: str,
) -> list[dict]:
    """Per-topic rollup: total concepts, mastered (>=4), avg score, due count."""
    topics = [tid for tid, _ in list_topics()]
    due_rows = queries.get_due_concepts(conn, user_id)
    due_by_topic: dict[str, int] = {}
    for d in due_rows:
        due_by_topic[d.topic] = due_by_topic.get(d.topic, 0) + 1

    out: list[dict] = []
    for tid in topics:
        try:
            graph = get_topic_graph(conn, user_id, tid)
        except FileNotFoundError:
            continue
        nodes = graph.nodes
        if not nodes:
            continue
        scores = [n.score_1_to_5 for n in nodes if n.num_evaluations > 0]
        mastered = sum(
            1
            for n in nodes
            if is_concept_mastered(n.score_1_to_5 / 5.0, n.num_evaluations)
        )
        avg = sum(scores) / len(scores) if scores else 0.0
        out.append(
            {
                "topic_id": tid,
                "display_name": graph.display_name,
                "concept_count": len(nodes),
                "mastered_count": mastered,
                "avg_score_1_to_5": round(avg, 2),
                "due_count": due_by_topic.get(tid, 0),
                "started": len(scores) > 0,
            }
        )
    return out
