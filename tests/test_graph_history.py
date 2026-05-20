"""Tests for tutor dialogue history (student answers must reach the model)."""

from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage

from core.messages import messages_from_dicts, messages_to_dicts


def test_evaluate_turn_appends_student_message():
    """Student answers belong in persisted history for the next tutor turn."""
    history = messages_from_dicts(
        [{"role": "ai", "content": "What is a closure?"}]
    )
    history.append(HumanMessage(content="A function that remembers variables."))
    stored = messages_to_dicts(history)
    restored = messages_from_dicts(stored)
    assert len(restored) == 2
    assert isinstance(restored[-1], HumanMessage)
    assert "remembers" in restored[-1].content


def test_opening_turn_history_is_tutor_only():
    """Opening steer is transient; persisted history starts with tutor AIMessage."""
    tutor_only = messages_to_dicts([AIMessage(content="First question?")])
    restored = messages_from_dicts(tutor_only)
    assert len(restored) == 1
    assert isinstance(restored[0], AIMessage)
