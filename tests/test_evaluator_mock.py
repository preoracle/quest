"""Evaluator parsing and persistence flow with mocked Haiku."""

from __future__ import annotations

import pytest

from core.models import (
    CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD,
    EvaluatorOutput,
)
from core.mastery import apply_evaluation_to_mastery
from db import queries


def test_evaluator_output_normalized_score():
  """normalized_score maps 1–5 rubric to [0, 1]."""
  assert EvaluatorOutput(
    score=5,
    gaps=[],
    reasoning="Complete.",
  ).normalized_score() == 1.0
  assert EvaluatorOutput(
    score=3,
    gaps=[],
    reasoning="Fuzzy.",
  ).normalized_score() == 0.6


def test_apply_mastery_skips_low_confidence_concept(tmp_db):
  """Concept mastery is not updated when confidence is below threshold."""
  queries.get_or_create_user(tmp_db, "u1")
  queries.upsert_topic_concepts(
    tmp_db,
    {"topic": "t1", "display_name": "T1", "concepts": []},
  )
  evaluation = EvaluatorOutput(
    score=3,
    gaps=[],
    reasoning="Generic answer.",
    inferred_concept_id="t1:closure",
    inferred_concept_confidence=0.4,
  )
  apply_evaluation_to_mastery(tmp_db, "u1", "t1", evaluation)
  count = tmp_db.execute(
    "SELECT COUNT(*) FROM mastery WHERE user_id = ?", ("u1",)
  ).fetchone()[0]
  assert count == 1  # topic only


def test_apply_mastery_updates_both_when_confident(tmp_db, closures_topic_data):
  """High-confidence inference updates topic and concept mastery rows."""
  queries.get_or_create_user(tmp_db, "u1")
  queries.upsert_topic_concepts(tmp_db, closures_topic_data)
  evaluation = EvaluatorOutput(
    score=4,
    gaps=[],
    reasoning="Strong.",
    inferred_concept_id="closures_in_javascript:closure",
    inferred_concept_confidence=CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD,
  )
  apply_evaluation_to_mastery(tmp_db, "u1", "closures_in_javascript", evaluation)
  count = tmp_db.execute(
    "SELECT COUNT(*) FROM mastery WHERE user_id = ?", ("u1",)
  ).fetchone()[0]
  assert count == 2


def test_session_persists_evaluator_fields(
  tmp_db,
  closures_topic_data,
  mock_evaluator_output,
):
  """One user turn should write evaluator columns on the user turn row."""
  queries.get_or_create_user(tmp_db, "u1")
  queries.upsert_topic_concepts(tmp_db, closures_topic_data)
  session_id = queries.create_session(tmp_db, "u1", "closures_in_javascript")

  # Simulate one evaluated turn without running the REPL
  queries.record_turn(tmp_db, session_id, 0, "tutor", "Opening question?")
  queries.record_turn(
    tmp_db,
    session_id,
    1,
    "user",
    "Functions remember variables",
    evaluator_score=mock_evaluator_output.score,
    evaluator_gaps=mock_evaluator_output.gaps,
    evaluator_reasoning=mock_evaluator_output.reasoning,
    evaluator_concept_id=mock_evaluator_output.inferred_concept_id,
    evaluator_concept_confidence=mock_evaluator_output.inferred_concept_confidence,
  )
  apply_evaluation_to_mastery(
    tmp_db, "u1", "closures_in_javascript", mock_evaluator_output
  )

  row = tmp_db.execute(
    "SELECT evaluator_score, evaluator_concept_id FROM turns WHERE turn_idx = 1"
  ).fetchone()
  assert row["evaluator_score"] == 4
  assert row["evaluator_concept_id"] == "closures_in_javascript:closure"

  mastery = queries.get_mastery_for_user(tmp_db, "u1")
  assert len(mastery) == 2
