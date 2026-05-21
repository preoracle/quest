"""Package version for CLI and support."""

from __future__ import annotations

try:
    from importlib.metadata import version

    __version__ = version("quest-ai")
except Exception:
    __version__ = "0.0.0"
