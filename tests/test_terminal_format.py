"""Tests for tutor message normalization and markdown detection."""

from __future__ import annotations

from core.terminal_format import has_markdown, normalize_message, tutor_markup
from rich.markdown import Markdown


def test_normalize_strips_trailing_space_and_extra_blanks():
    raw = "line one   \n\n\nline two\n"
    assert normalize_message(raw) == "line one\n\nline two"


def test_has_markdown_detects_bold():
    assert has_markdown("pick **one** criterion")
    assert not has_markdown("pick one criterion")


def test_tutor_markup_uses_markdown_when_needed():
    result = tutor_markup("choose **one** path")
    assert isinstance(result, Markdown)


def test_tutor_markup_plain_string_otherwise():
    result = tutor_markup("choose one path")
    assert result == "choose one path"
