"""Pytest fixtures for Quest."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from dotenv import load_dotenv

from core.models import EvaluatorOutput
from db import queries


@pytest.fixture(scope="session", autouse=True)
def _load_dotenv() -> None:
    """Load `.env` so live tests can reach the LLM proxy (freellmapi)."""
    load_dotenv()


@pytest.fixture(scope="session")
def llm_api_key() -> str:
    """Require LLM_API_KEY + LLM_BASE_URL for live tests; skip if missing."""
    key = os.environ.get("LLM_API_KEY", "").strip()
    base_url = os.environ.get("LLM_BASE_URL", "").strip()
    if not key or not base_url:
        pytest.skip("LLM_API_KEY / LLM_BASE_URL not set — skip live LLM tests")
    return key


@pytest.fixture
def tmp_db_path() -> Path:
    """Return a path to a fresh temporary SQLite database."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        return Path(f.name)


@pytest.fixture
def tmp_db(tmp_db_path: Path):
    """Yield a connection to an initialized temporary database."""
    queries.init_db(tmp_db_path)
    with queries.get_connection(tmp_db_path) as conn:
        yield conn


@pytest.fixture
def closures_topic_data() -> dict:
    """Minimal topic payload matching concepts/closures_in_javascript.yaml shape."""
    return {
        "topic": "closures_in_javascript",
        "display_name": "Closures in JavaScript",
        "concepts": [
            {
                "id": "variable_scope",
                "name": "Variable scope",
                "description": "Block vs function scope.",
                "prerequisites": [],
            },
            {
                "id": "closure",
                "name": "Closure",
                "description": "Inner function plus lexical environment.",
                "prerequisites": ["variable_scope"],
            },
        ],
    }


@pytest.fixture
def mock_evaluator_output() -> EvaluatorOutput:
    """A typical high-confidence evaluator result."""
    return EvaluatorOutput(
        score=4,
        gaps=["live reference vs snapshot"],
        reasoning="Correct core idea with minor imprecision.",
        inferred_concept_id="closures_in_javascript:closure",
        inferred_concept_confidence=0.85,
    )


@pytest.fixture
def mock_evaluator_chain(mock_evaluator_output: EvaluatorOutput):
    """Runnable that always returns `mock_evaluator_output`."""
    mock = MagicMock()
    mock.invoke.return_value = mock_evaluator_output
    return mock
