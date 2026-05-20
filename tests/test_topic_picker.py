"""Tests for topic search filtering."""

from __future__ import annotations

from core.topic_picker import _filter_topics, parse_new_command


def test_filter_topics_by_display_name():
    topics = [
        ("rag_pipeline", "RAG Pipeline"),
        ("binary_search", "Binary Search"),
    ]
    assert _filter_topics(topics, "rag") == [topics[0]]


def test_filter_topics_by_id():
    topics = [
        ("rag_pipeline", "RAG Pipeline"),
        ("binary_search", "Binary Search"),
    ]
    assert _filter_topics(topics, "binary") == [topics[1]]


def test_filter_empty_query_returns_all():
    topics = [("a", "A"), ("b", "B")]
    assert len(_filter_topics(topics, "")) == 2


def test_parse_new_command_with_quoted_goal():
    assert parse_new_command('new "react hooks"') == "react hooks"


def test_parse_new_command_with_words():
    assert parse_new_command("new react hooks") == "react hooks"


def test_parse_new_command_bare_new():
    assert parse_new_command("new") == ""


def test_parse_new_command_not_new():
    assert parse_new_command("rag pipeline") is None
