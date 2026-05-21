"""Evaluator dialogue modes (Phase B6)."""

from __future__ import annotations

import os

from core.eval_context import (
    EvalMode,
    build_evaluator_invoke_payload,
    format_concept_thread,
    get_eval_mode,
)


def test_last_turn_mode_short_payload():
    payload = build_evaluator_invoke_payload(
        topic_id="t1",
        concept_list=[],
        tutor_question="Why X?",
        student_answer="Because Y.",
        history=[
            {"role": "ai", "content": "Old Q"},
            {"role": "human", "content": "Old A"},
        ],
        mode=EvalMode.LAST_TURN,
    )
    assert payload["student_answer"] == "Because Y."
    assert "FULL concept dialogue" not in payload["scoring_scope"]


def test_concept_thread_includes_history():
    history = [
        {"role": "ai", "content": "First question?"},
        {"role": "human", "content": "First answer."},
    ]
    payload = build_evaluator_invoke_payload(
        topic_id="t1",
        concept_list=[],
        tutor_question="Second?",
        student_answer="Second answer.",
        history=history,
        mode=EvalMode.CONCEPT_THREAD,
    )
    assert "First question?" in payload["student_answer"]
    assert "Second answer." in payload["student_answer"]
    assert "FULL concept dialogue" in payload["scoring_scope"]


def test_format_concept_thread_labels():
    text = format_concept_thread(
        [{"role": "ai", "content": "Q"}, {"role": "human", "content": "A"}],
    )
    assert "Tutor: Q" in text
    assert "Student: A" in text


def test_get_eval_mode_from_env(monkeypatch):
    monkeypatch.setenv("QUEST_EVAL_MODE", "concept_thread")
    assert get_eval_mode() == EvalMode.CONCEPT_THREAD
    monkeypatch.delenv("QUEST_EVAL_MODE", raising=False)
    assert get_eval_mode() == EvalMode.LAST_TURN
