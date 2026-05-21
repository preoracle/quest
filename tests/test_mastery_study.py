"""Study-mode mastery: SM-2 scheduling and concept binding."""

from datetime import datetime, timedelta, timezone

from core.concept_pick import is_concept_mastered
from core.mastery import apply_evaluation_to_mastery
from core.models import EvaluatorOutput
from db import queries


def test_unmastered_next_review_is_immediate(tmp_db, closures_topic_data):
    user_id = "u-study"
    topic_id = "closures_in_javascript"
    cid = f"{topic_id}:closure"
    queries.get_or_create_user(tmp_db, user_id)
    queries.upsert_topic_concepts(tmp_db, closures_topic_data)

    ev = EvaluatorOutput(
        score=5,
        gaps=[],
        reasoning="strong",
        inferred_concept_id=cid,
        inferred_concept_confidence=0.95,
    )
    apply_evaluation_to_mastery(
        tmp_db, user_id, topic_id, ev, current_concept_id=cid,
    )

    row = tmp_db.execute(
        "SELECT score, num_evaluations, next_review_at FROM mastery WHERE user_id = ? AND concept_id = ?",
        (user_id, cid),
    ).fetchone()
    assert row is not None
    assert not is_concept_mastered(float(row["score"]), int(row["num_evaluations"]))
    due = datetime.fromisoformat(row["next_review_at"].replace("Z", "+00:00"))
    assert due <= datetime.now(timezone.utc) + timedelta(minutes=1)


def test_mastery_updates_current_concept_not_inferred(tmp_db, closures_topic_data):
    user_id = "u-bind"
    topic_id = "closures_in_javascript"
    current = f"{topic_id}:variable_scope"
    inferred = f"{topic_id}:closure"
    queries.get_or_create_user(tmp_db, user_id)
    queries.upsert_topic_concepts(tmp_db, closures_topic_data)

    ev = EvaluatorOutput(
        score=4,
        gaps=[],
        reasoning="ok",
        inferred_concept_id=inferred,
        inferred_concept_confidence=0.95,
    )
    apply_evaluation_to_mastery(
        tmp_db, user_id, topic_id, ev, current_concept_id=current,
    )

    current_row = tmp_db.execute(
        "SELECT score FROM mastery WHERE user_id = ? AND concept_id = ?",
        (user_id, current),
    ).fetchone()
    inferred_row = tmp_db.execute(
        "SELECT score FROM mastery WHERE user_id = ? AND concept_id = ?",
        (user_id, inferred),
    ).fetchone()
    assert current_row is not None
    assert inferred_row is None
