"""Baseline assessment (Phase B5)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from core.baseline import (
    BASELINE_SKIP_IF_MASTERED,
    baseline_probe_question,
    run_baseline_assessment,
)
from core.models import EvaluatorOutput
from db import queries


@pytest.fixture
def mock_evaluator_chain_baseline():
    mock = MagicMock()
    mock.invoke.return_value = EvaluatorOutput(
        score=5,
        gaps=[],
        reasoning="Strong baseline.",
        inferred_concept_id="closures_in_javascript:closure",
        inferred_concept_confidence=0.9,
    )
    return mock


def test_baseline_probe_question_uses_name(tmp_db, closures_topic_data):
    queries.upsert_topic_concepts(tmp_db, closures_topic_data)
    concepts = queries.get_topic_concepts(tmp_db, "closures_in_javascript")
    q = baseline_probe_question(concepts[0])
    assert concepts[0]["name"] in q


def test_run_baseline_seeds_mastery(
    tmp_db, closures_topic_data, mock_evaluator_chain_baseline, monkeypatch,
):
    monkeypatch.setattr(
        "core.baseline.build_evaluator_chain",
        lambda: mock_evaluator_chain_baseline,
    )

    answers = iter(["know scope", "know closure", "ok", "ok", "ok"])

    def on_question(_q: str) -> str:
        return next(answers, "done")

    result = run_baseline_assessment(
        tmp_db,
        "u1",
        "closures_in_javascript",
        on_question=on_question,
    )
    assert len(result.concepts) >= 1
    assert queries.topic_has_concept_mastery(
        tmp_db, "u1", "closures_in_javascript",
    )
    row = queries.get_session(tmp_db, result.session_id)
    assert row["session_kind"] == "baseline"
    assert row["ended_at"]


def test_baseline_skip_flag(
    tmp_db, closures_topic_data, mock_evaluator_chain_baseline, monkeypatch,
):
    monkeypatch.setattr(
        "core.baseline.build_evaluator_chain",
        lambda: mock_evaluator_chain_baseline,
    )

    result = run_baseline_assessment(
        tmp_db,
        "u1",
        "closures_in_javascript",
        on_question=lambda _q: "expert answer",
    )
    assert result.concepts[0].score >= BASELINE_SKIP_IF_MASTERED
    assert result.concepts[0].skipped_study
