"""Live evaluator tests against real Haiku (skipped by default)."""

from __future__ import annotations

import pytest

from core.chains import build_evaluator_chain
from core.topics import load_topic
from db import queries

pytestmark = pytest.mark.live

TUTOR_QUESTION = (
    "If the outer function has already finished running and returned, "
    "does that outer scope still exist?"
)

@pytest.fixture(scope="module")
def concept_list():
  """Concept list from the real closures YAML."""
  topic_data = load_topic("closures_in_javascript")
  # Use in-memory DB only to reuse upsert logic for evaluator ids
  import tempfile
  from pathlib import Path

  path = Path(tempfile.mktemp(suffix=".db"))
  queries.init_db(path)
  with queries.get_connection(path) as conn:
    concepts = queries.upsert_topic_concepts(conn, topic_data)
  path.unlink(missing_ok=True)
  return concepts


@pytest.fixture(scope="module")
def evaluator(anthropic_api_key):
  """Shared evaluator chain for the module."""
  _ = anthropic_api_key
  return build_evaluator_chain()


def _invoke(evaluator, student_answer: str, concept_list: list):
  return evaluator.invoke(
    {
      "topic": "closures_in_javascript",
      "concept_list": concept_list,
      "tutor_question": TUTOR_QUESTION,
      "student_answer": student_answer,
    }
  )


def test_live_strong_answer(evaluator, concept_list):
  """Precise answer about lexical environment retention should score 4–5."""
  answer = (
    "Yes — the inner function keeps a live reference to the lexical "
    "environment from where it was defined, so the outer bindings still "
    "exist as long as something references that environment."
  )
  result = _invoke(evaluator, answer, concept_list)
  assert 4 <= result.score <= 5, f"got {result.score}: {result.reasoning}"


def test_live_medium_answer(evaluator, concept_list):
  """Vague but directionally correct answer should score 2–4."""
  answer = (
    "I think the scope might still be there somehow because the function "
    "needs to remember variables."
  )
  result = _invoke(evaluator, answer, concept_list)
  assert 2 <= result.score <= 4, f"got {result.score}: {result.reasoning}"


def test_live_weak_answer(evaluator, concept_list):
  """Confused or off-topic answer should score 1–2."""
  answer = "Closures are just callbacks in the event loop."
  result = _invoke(evaluator, answer, concept_list)
  assert 1 <= result.score <= 2, f"got {result.score}: {result.reasoning}"
