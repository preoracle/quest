"""Tests for topic wizard helpers (no interactive questionary runs)."""

from __future__ import annotations

from core.topic_wizard import build_topic_choices, wizard_available
from core.topic_picker import _filter_topics


def test_build_topic_choices():
    choices = build_topic_choices([("rag_pipeline", "RAG Pipeline")])
    assert len(choices) == 1
    assert choices[0].value == "rag_pipeline"
    assert choices[0].title == "RAG Pipeline"


def test_filter_topics_used_by_wizard_search():
    topics = [
        ("rag_pipeline", "RAG Pipeline"),
        ("binary_search", "Binary Search"),
    ]
    assert _filter_topics(topics, "rag")[0][0] == "rag_pipeline"


def test_wizard_off_by_default(monkeypatch):
    monkeypatch.delenv("QUEST_WIZARD", raising=False)
    monkeypatch.setattr("sys.stdin", type("T", (), {"isatty": lambda self: True})())
    monkeypatch.setattr("sys.stdout", type("T", (), {"isatty": lambda self: True})())
    assert wizard_available() is False


def test_wizard_on_when_env_set(monkeypatch):
    monkeypatch.setenv("QUEST_WIZARD", "1")
    monkeypatch.setattr("sys.stdin", type("T", (), {"isatty": lambda self: True})())
    monkeypatch.setattr("sys.stdout", type("T", (), {"isatty": lambda self: True})())
    assert wizard_available() is True
