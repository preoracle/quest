"""Normalize and render tutor text for the terminal."""

from __future__ import annotations

import re

from rich.markdown import Markdown

# LLM markdown we support in the tutor panel.
_MD_HINT = re.compile(r"(\*\*|__|\*[^*]|_[^_]|`[^`]|^#{1,6}\s)", re.MULTILINE)


def normalize_message(text: str) -> str:
    """Trim noise from model output before display."""
    lines = [line.rstrip() for line in text.strip().splitlines()]
    cleaned: list[str] = []
    blank_run = 0
    for line in lines:
        if not line:
            blank_run += 1
            if blank_run <= 1:
                cleaned.append("")
            continue
        blank_run = 0
        cleaned.append(line)
    return "\n".join(cleaned).strip()


def has_markdown(text: str) -> bool:
    """True if the string likely contains markdown formatting."""
    return bool(_MD_HINT.search(text))


def tutor_markup(text: str) -> Markdown | str:
    """Rich renderable for tutor prose (markdown when needed)."""
    body = normalize_message(text)
    if has_markdown(body):
        return Markdown(body, code_theme="monokai", justify="left")
    return body
