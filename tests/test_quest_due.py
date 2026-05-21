"""quest due / get_due_concepts (Phase B2)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from db import queries


def test_get_due_concepts_includes_unscheduled_and_past(tmp_db, closures_topic_data):
    queries.get_or_create_user(tmp_db, "u1")
    queries.upsert_topic_concepts(tmp_db, closures_topic_data)
    cid = "closures_in_javascript:closure"

    queries.upsert_mastery(tmp_db, "u1", cid, 0.6)
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    tmp_db.execute(
        """
        UPDATE mastery SET next_review_at = ? WHERE user_id = ? AND concept_id = ?
        """,
        (past, "u1", cid),
    )
    tmp_db.commit()

    due = queries.get_due_concepts(tmp_db, "u1", topic="closures_in_javascript")
    ids = {r.concept_id for r in due}
    assert cid in ids

    future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    tmp_db.execute(
        "UPDATE mastery SET next_review_at = ? WHERE user_id = ? AND concept_id = ?",
        (future, "u1", cid),
    )
    tmp_db.commit()
    due_future = queries.get_due_concepts(tmp_db, "u1", topic="closures_in_javascript")
    assert cid not in {r.concept_id for r in due_future}
