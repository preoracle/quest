"""Shared types for topic selection."""

from __future__ import annotations

from dataclasses import dataclass

REPLAY_FLAGS = frozenset({"--fresh", "-f", "--replay", "-r"})


@dataclass(frozen=True)
class PickerSelection:
    """Topic chosen from the catalog or wizard."""

    topic_id: str
    replay: bool = False


def split_picker_input(line: str) -> tuple[str, bool]:
    """Return ``(topic_query, replay)`` from e.g. ``binary_search --fresh``."""
    parts = line.strip().split()
    replay = any(p in REPLAY_FLAGS for p in parts)
    topic_tokens = [p for p in parts if p not in REPLAY_FLAGS]
    return " ".join(topic_tokens).strip(), replay
