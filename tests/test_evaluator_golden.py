"""Golden evaluator fixtures — CI without live API (Phase B3)."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from core.models import CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD, EvaluatorOutput
from core.mastery import apply_evaluation_to_mastery
from db import queries

_FIXTURES = Path(__file__).parent / "fixtures" / "evaluator"


def _load_fixtures():
    for path in sorted(_FIXTURES.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        data["_path"] = path.name
        yield data


@pytest.mark.parametrize("fixture", list(_load_fixtures()), ids=lambda f: f["name"])
def test_golden_evaluator_mastery_rules(tmp_db, closures_topic_data, fixture):
    """Each golden file defines an evaluation and expected mastery behavior."""
    queries.get_or_create_user(tmp_db, "u1")
    queries.upsert_topic_concepts(tmp_db, closures_topic_data)

    ev = EvaluatorOutput.model_validate(fixture["evaluation"])
    exp = fixture["expected"]
    assert exp["score_min"] <= ev.score <= exp["score_max"]

    apply_evaluation_to_mastery(
        tmp_db,
        "u1",
        "closures_in_javascript",
        ev,
    )

    concept_row = None
    if ev.inferred_concept_id:
        concept_row = tmp_db.execute(
            "SELECT score FROM mastery WHERE user_id = ? AND concept_id = ?",
            ("u1", ev.inferred_concept_id),
        ).fetchone()

    should_update_concept = exp["updates_mastery"]
    if ev.inferred_concept_confidence < CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD:
        should_update_concept = False

    if should_update_concept:
        assert concept_row is not None
    else:
        assert concept_row is None

    topic_row = tmp_db.execute(
        "SELECT score FROM mastery WHERE user_id = ? AND concept_id = ?",
        ("u1", "closures_in_javascript"),
    ).fetchone()
    assert topic_row is not None
