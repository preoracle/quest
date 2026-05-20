"""Resolve Quest data directories for dev checkout vs installed package."""

from __future__ import annotations

import os
from functools import lru_cache
from importlib import resources
from pathlib import Path


def _dev_root() -> Path | None:
    """Repo root when running from a source checkout (`cli.py` present)."""
    root = Path(__file__).resolve().parent.parent
    if (root / "cli.py").is_file():
        return root
    return None


def user_data_dir() -> Path:
    """Writable home for DB, checkpoints, CLI history, and user topics.

    - ``QUEST_DATA_DIR`` env overrides everything.
    - Dev checkout: repo root (keeps ``quest.db`` beside ``cli.py``).
    - Installed: ``~/.quest`` (created if missing).
    """
    if raw := os.environ.get("QUEST_DATA_DIR"):
        path = Path(raw).expanduser()
        path.mkdir(parents=True, exist_ok=True)
        return path
    if root := _dev_root():
        return root
    path = Path.home() / ".quest"
    path.mkdir(parents=True, exist_ok=True)
    return path


@lru_cache(maxsize=1)
def _bundled_data_root() -> Path:
    """Directory containing shipped ``prompts/`` and ``concepts/``."""
    if root := _dev_root():
        return root / "quest_data"
    return Path(resources.files("quest_data"))


def prompts_dir() -> Path:
    """Directory of ``*.txt`` prompt templates."""
    path = _bundled_data_root() / "prompts"
    if not path.is_dir():
        raise FileNotFoundError(f"Prompts directory missing: {path}")
    return path


def bundled_concepts_dir() -> Path:
    """Shipped concept YAMLs (read-only in a normal install)."""
    path = _bundled_data_root() / "concepts"
    if not path.is_dir():
        raise FileNotFoundError(f"Bundled concepts missing: {path}")
    return path


def user_concepts_dir() -> Path:
    """User-created topic YAMLs (``topic new``). Always under user data dir."""
    if root := _dev_root():
        # Contributors edit bundled concepts in-repo.
        return root / "quest_data" / "concepts"
    path = user_data_dir() / "concepts"
    path.mkdir(parents=True, exist_ok=True)
    return path


def concept_search_dirs() -> list[Path]:
    """Dirs to scan for topic YAMLs, user overrides first."""
    dirs: list[Path] = []
    user = user_concepts_dir()
    if user.is_dir():
        dirs.append(user)
    bundled = bundled_concepts_dir()
    if bundled.resolve() != user.resolve() and bundled.is_dir():
        dirs.append(bundled)
    return dirs


def db_path() -> Path:
    """Primary SQLite database path."""
    return user_data_dir() / "quest.db"


def checkpoint_db_path() -> Path:
    """LangGraph SQLite checkpointer path."""
    return user_data_dir() / "quest_checkpoints.db"


def cli_history_path() -> Path:
    """Prompt-toolkit history file."""
    return user_data_dir() / "quest_cli_history"
