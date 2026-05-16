#!/usr/bin/env python3
"""Phase 3 smoke test: graph init, pause/resume, concept pick, open session."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
from langgraph.types import Command

from core.concept_pick import pick_next_concept
from core.graph import build_checkpointer, build_quest_graph
from core.topics import load_topic
from db import queries

TOPIC = "closures_in_javascript"
USER = "default"


def main() -> int:
    load_dotenv()
    queries.init_db()
    topic_data = load_topic(TOPIC)

    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, USER)
        concept_list = queries.upsert_topic_concepts(conn, topic_data)
        concepts = queries.get_topic_concepts(conn, TOPIC)
        scores, reviews = queries.get_mastery_maps(conn, USER, TOPIC)
        picked = pick_next_concept(concepts, TOPIC, scores, reviews)
        if not picked:
            print("FAIL: no concept to pick (all mastered?)")
            return 1
        print(f"OK pick_concept -> {picked['name']} ({picked['id']})")

        session_id = queries.create_session(conn, USER, TOPIC)
        checkpointer = build_checkpointer()
        graph = build_quest_graph(conn, checkpointer)
        config = {"configurable": {"thread_id": session_id}}

        state = {
            "user_id": USER,
            "topic_id": TOPIC,
            "session_id": session_id,
            "concept_list": concept_list,
            "turn_idx": 0,
            "history": [],
            "concept_turn_count": 0,
        }
        graph.invoke(state, config)
        snap = graph.get_state(config)
        if not snap.next:
            print("FAIL: expected interrupt after first ask")
            return 1
        focus = snap.values.get("current_concept_name")
        tutor = snap.values.get("tutor_message", "")[:80]
        print(f"OK graph interrupted | focus={focus}")
        print(f"   tutor: {tutor}...")

        graph.invoke(Command(resume="Inner functions look in outer lexical scope."), config)
        snap2 = graph.get_state(config)
        ev = snap2.values.get("last_evaluation")
        if not ev:
            print("FAIL: no evaluation after resume")
            return 1
        print(f"OK evaluator score={ev.get('score')} concept={ev.get('inferred_concept_id')}")

        # Checkpoint persists
        snap3 = graph.get_state(config)
        if not snap3.values.get("session_id"):
            print("FAIL: checkpoint missing session_id")
            return 1
        print("OK checkpoint has state")

        queries.end_session(conn, session_id)
        print("OK phase 3 graph smoke passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
