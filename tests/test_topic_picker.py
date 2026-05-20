"""Tests for topic search filtering."""

from __future__ import annotations

from core.picker_types import split_picker_input
from core.topic_picker import _filter_topics, _resolve_topic, parse_new_command


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


def test_split_picker_input_strips_replay_flags():
    query, replay = split_picker_input("binary_search --replay")
    assert query == "binary_search"
    assert replay is True


def test_split_picker_input_fresh_alias():
    query, replay = split_picker_input("3 --fresh")
    assert query == "3"
    assert replay is True


def test_resolve_topic_with_flag():
    topics = [("binary_search", "Binary Search")]
    sel = _resolve_topic(topics, "binary_search --fresh")
    assert sel is not None
    assert sel.topic_id == "binary_search"
    assert sel.replay is True
