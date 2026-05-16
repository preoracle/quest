"""Mastery + SM-2 persistence."""

from core.mastery import apply_evaluation_to_mastery
from core.models import EvaluatorOutput
from db import queries


def test_apply_evaluation_writes_sm2_fields(tmp_db):
    queries.get_or_create_user(tmp_db, "u1")
    queries.upsert_topic_concepts(
        tmp_db,
        {"topic": "t1", "display_name": "T1", "concepts": []},
    )
    ev = EvaluatorOutput(
        score=4,
        gaps=[],
        reasoning="Good.",
        inferred_concept_id=None,
        inferred_concept_confidence=0.0,
    )
    apply_evaluation_to_mastery(tmp_db, "u1", "t1", ev)
    row = tmp_db.execute(
        "SELECT next_review_at, repetitions FROM mastery WHERE user_id = ? AND concept_id = ?",
        ("u1", "t1"),
    ).fetchone()
    assert row["next_review_at"] is not None
    assert row["repetitions"] >= 1
