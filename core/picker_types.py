"""Shared types for topic selection."""

from __future__ import annotations

from dataclasses import dataclass

REPLAY_FLAGS = frozenset({"--fresh", "-f", "--replay", "-r"})
BASELINE_FLAGS = frozenset({"--baseline", "-b"})


@dataclass(frozen=True)
class PickerSelection:
    """Topic chosen from the catalog or wizard."""

    topic_id: str
    replay: bool = False
    baseline: bool = False


def split_picker_input(line: str) -> tuple[str, bool, bool]:
    """Return ``(topic_query, replay, baseline)`` from catalog input."""
    parts = line.strip().split()
    replay = any(p in REPLAY_FLAGS for p in parts)
    baseline = any(p in BASELINE_FLAGS for p in parts)
    skip = REPLAY_FLAGS | BASELINE_FLAGS
    topic_tokens = [p for p in parts if p not in skip]
    return " ".join(topic_tokens).strip(), replay, baseline
