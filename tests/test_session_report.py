"""Structured session report (Phase B1)."""

from __future__ import annotations

import json

from core.session_report import build_session_report, report_from_json
from db import queries


def test_build_session_report_groups_by_concept(tmp_db, closures_topic_data):
    queries.get_or_create_user(tmp_db, "u1")
    queries.upsert_topic_concepts(tmp_db, closures_topic_data)
    sid = queries.create_session(tmp_db, "u1", "closures_in_javascript")

    cid = "closures_in_javascript:closure"
    queries.record_turn(tmp_db, sid, 0, "tutor", "What is a closure?")
    queries.record_turn(
        tmp_db,
        sid,
        1,
        "user",
        "A function plus its lexical env.",
        evaluator_score=4,
        evaluator_gaps=["minor gap"],
        evaluator_concept_id=cid,
    )
    queries.record_turn(tmp_db, sid, 2, "tutor", "When does it matter?")
    queries.record_turn(
        tmp_db,
        sid,
        3,
        "user",
        "Callbacks and factories.",
        evaluator_score=3,
        evaluator_gaps=["timing"],
        evaluator_concept_id=cid,
    )

    report = build_session_report(
        tmp_db,
        sid,
        "closures_in_javascript",
        "Closures in JavaScript",
        narrative="Good session.",
    )
    assert report.evaluated_answers == 2
    assert len(report.concepts) == 1
    assert report.concepts[0].name == "Closure"
    assert report.concepts[0].scores == [4, 3]
    assert report.concepts[0].best_score == 4
    assert report.top_gaps

    queries.set_session_report(tmp_db, sid, report.model_dump_json())
    row = queries.get_session(tmp_db, sid)
    parsed = report_from_json(row["report_json"])
    assert parsed is not None
    assert parsed.session_id == sid


def test_init_db_adds_report_json_column(tmp_db_path):
    queries.init_db(tmp_db_path)
    with queries.get_connection(tmp_db_path) as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(sessions)").fetchall()}
    assert "report_json" in cols
