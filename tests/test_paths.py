"""Tests for install vs dev path resolution."""

from __future__ import annotations

from pathlib import Path

from core import paths


def test_dev_layout_uses_repo_quest_data(monkeypatch):
    monkeypatch.delenv("QUEST_DATA_DIR", raising=False)
    root = paths._dev_root()
    assert root is not None
    assert (root / "cli.py").is_file()
    assert paths.prompts_dir().name == "prompts"
    assert paths.bundled_concepts_dir().name == "concepts"
    assert (paths.bundled_concepts_dir() / "closures_in_javascript.yaml").exists()


def test_quest_data_dir_override(tmp_path, monkeypatch):
    monkeypatch.setenv("QUEST_DATA_DIR", str(tmp_path))
    assert paths.user_data_dir() == tmp_path
    assert paths.db_path() == tmp_path / "quest.db"
