"""Tasteful terminal UI for Quest's Socratic CLI."""

from __future__ import annotations

import shutil
import sqlite3
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from textwrap import shorten
from typing import Iterator

from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.styles import Style
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table
from rich.text import Text

from core.session_api import EvaluationView, SessionView
from core.topics import load_topic
from core.paths import cli_history_path
from db import queries
DEPTH_THRESHOLD = 4.0
STICKY_ROWS = 3


@dataclass(frozen=True)
class ProgressItem:
    """One concept row for the session progress view."""

    concept_id: str
    name: str
    score_1_to_5: float
    num_evaluations: int
    is_current: bool = False


@dataclass(frozen=True)
class ProgressSnapshot:
    """Current topic progress derived from concept maps + mastery rows."""

    topic_display: str
    current_focus: str | None
    items: list[ProgressItem]

    @property
    def total(self) -> int:
        return len(self.items)

    @property
    def at_depth(self) -> int:
        return sum(1 for item in self.items if item.score_1_to_5 >= DEPTH_THRESHOLD)

    @property
    def covered(self) -> list[ProgressItem]:
        return [item for item in self.items if item.num_evaluations > 0]

    @property
    def weakest(self) -> ProgressItem | None:
        untouched = [item for item in self.items if item.num_evaluations == 0]
        if untouched:
            return untouched[0]
        return min(self.items, key=lambda item: item.score_1_to_5, default=None)


class StickyHeader:
    """Pin a small header at the top of the terminal via DECSTBM scroll region.

    The terminal reserves the top `STICKY_ROWS` rows for the header; the rest
    becomes a scroll region where the chat flows naturally. Subsequent writes
    (Rich prints, prompt_toolkit input) scroll only within that region.
    """

    def __init__(self) -> None:
        self._enabled = False
        self._lines: list[str] = ["", "", ""]
        self._is_tty = sys.stdout.isatty()

    def enable(self, lines: list[str]) -> None:
        """Reserve top rows and place cursor inside the scroll region."""
        if self._enabled or not self._is_tty:
            self._enabled = self._is_tty
            return
        _, rows = shutil.get_terminal_size((80, 24))
        sys.stdout.write("\x1b[2J\x1b[H")
        sys.stdout.write(f"\x1b[{STICKY_ROWS + 1};{rows}r")
        sys.stdout.flush()
        self._enabled = True
        self.update(lines)
        sys.stdout.write(f"\x1b[{STICKY_ROWS + 1};1H")
        sys.stdout.flush()

    def update(self, lines: list[str]) -> None:
        """Redraw header content without touching the scroll region."""
        if not self._enabled:
            return
        cols, _ = shutil.get_terminal_size((80, 24))
        self._lines = lines
        sys.stdout.write("\x1b7")
        for i, line in enumerate(lines[:STICKY_ROWS], start=1):
            sys.stdout.write(f"\x1b[{i};1H\x1b[2K")
            sys.stdout.write(_clip_visible(line, cols))
        sys.stdout.write("\x1b8")
        sys.stdout.flush()

    def disable(self) -> None:
        """Release the scroll region and leave the cursor at the bottom."""
        if not self._enabled:
            return
        _, rows = shutil.get_terminal_size((80, 24))
        sys.stdout.write(f"\x1b[1;{rows}r")
        sys.stdout.write(f"\x1b[{rows};1H\n")
        sys.stdout.flush()
        self._enabled = False


class QuestCliUi:
    """Rich/prompt-toolkit presentation for the Quest session loop."""

    def __init__(self) -> None:
        self.console = Console()
        self._prompt = _make_prompt_session()
        self.sticky = StickyHeader()

    def build_header_lines(
        self,
        view: SessionView,
        progress: ProgressSnapshot,
    ) -> list[str]:
        """Two visible lines + a separator for the sticky top header."""
        focus = view.focus or "complete"
        progress_label = f"{progress.at_depth} of {progress.total} concepts at depth"
        last_score = view.last_evaluation.score if view.last_evaluation else 0
        blocks = _blocks(last_score)

        line1 = (
            f"\x1b[1m Quest\x1b[0m \x1b[2m·\x1b[0m {view.topic_display}"
            f"   \x1b[2m{progress_label}\x1b[0m"
        )
        line2 = (
            f" \x1b[2mfocus:\x1b[0m \x1b[33m{focus}\x1b[0m"
            f"   \x1b[2msession depth\x1b[0m \x1b[33m{blocks}\x1b[0m"
        )
        cols, _ = shutil.get_terminal_size((80, 24))
        line3 = "\x1b[2m" + ("─" * max(0, cols)) + "\x1b[0m"
        return [line1, line2, line3]

    def build_progress(
        self,
        conn: sqlite3.Connection,
        user_id: str,
        view: SessionView,
    ) -> ProgressSnapshot:
        topic_data = load_topic(view.topic_id)
        mastery = {
            row.concept_id: row
            for row in queries.get_mastery_for_user(conn, user_id, topic=view.topic_id)
        }
        items: list[ProgressItem] = []
        current = (view.focus or "").strip().casefold()

        for concept in topic_data.get("concepts") or []:
            local_id = concept["id"]
            concept_id = queries.namespace_concept_id(view.topic_id, local_id)
            row = mastery.get(concept_id)
            name = concept.get("name", local_id)
            items.append(
                ProgressItem(
                    concept_id=concept_id,
                    name=name,
                    score_1_to_5=row.score_1_to_5 if row else 0.0,
                    num_evaluations=row.num_evaluations if row else 0,
                    is_current=name.strip().casefold() == current,
                )
            )

        return ProgressSnapshot(
            topic_display=view.topic_display,
            current_focus=view.focus,
            items=items,
        )

    def render_session_start(self, view: SessionView, *, resuming: bool) -> None:
        del view
        if resuming:
            self.console.print("[dim]resuming open session[/dim]")
        self.console.print("[dim]type /help for commands, /quit to pause[/dim]\n")

    def render_turn(
        self,
        view: SessionView,
        progress: ProgressSnapshot,
        *,
        synthesis: EvaluationView | None = None,
    ) -> None:
        del progress
        if synthesis:
            self.render_synthesis(synthesis)

        if view.done:
            self.render_completion(view)
            return

        if view.tutor_message:
            body = Text()
            if view.focus_scope:
                body.append("What to figure out: ", style="dim")
                body.append(f"{view.focus_scope}\n\n", style="dim italic")
            body.append(view.tutor_message, style="bold")
            title = "[yellow]tutor[/yellow]"
            if view.focus:
                title = f"[yellow]tutor[/yellow] · {view.focus}"
            self.console.print(
                Panel(
                    body,
                    title=title,
                    title_align="left",
                    border_style="yellow",
                    box=box.MINIMAL,
                    padding=(1, 2),
                )
            )
            self.console.print()

    def render_status(self, view: SessionView, progress: ProgressSnapshot) -> None:
        table = Table.grid(expand=True)
        table.add_column(ratio=1)
        table.add_column(ratio=1)
        focus = view.focus or "complete"
        covered = ", ".join(item.name for item in progress.covered[:2]) or "none yet"
        if len(progress.covered) > 2:
            covered += f" +{len(progress.covered) - 2}"

        table.add_row(
            _label_value("focus", focus),
            _label_value("progress", f"{progress.at_depth} of {progress.total} concepts"),
        )
        table.add_row(
            _label_value("session", _blocks(view.last_evaluation.score if view.last_evaluation else 0)),
            _label_value("covered", covered),
        )
        self.console.print(table)
        self.console.print()

    def render_synthesis(self, evaluation: EvaluationView) -> None:
        gap = evaluation.gaps[0] if evaluation.gaps else "no sharp gap detected"
        text = shorten(gap, width=80, placeholder="...")
        style = "yellow" if evaluation.score >= 3 else "red"
        self.console.print(Rule(f"{evaluation.score}/5 · gap: {text}", style=style))

    def render_checkpoint(self, turns: int, progress: ProgressSnapshot) -> None:
        weakest = progress.weakest.name if progress.weakest else "none"
        self.console.print(
            Rule(
                (
                    f"checkpoint · {turns} turns · "
                    f"{progress.at_depth} of {progress.total} at depth · "
                    f"weakest: {weakest}"
                ),
                style="dim",
            )
        )

    def render_completion(self, view: SessionView) -> None:
        self.console.print(
            Panel(
                view.summary or view.tutor_message or "Session complete.",
                title="[green]session complete[/green]",
                title_align="left",
                border_style="green",
                box=box.MINIMAL,
                padding=(1, 2),
            )
        )

    def render_help(self) -> None:
        table = Table(
            title="Quest commands",
            box=box.SIMPLE,
            show_header=False,
            padding=(0, 2),
        )
        table.add_column("command", style="bold yellow")
        table.add_column("meaning", style="dim")
        table.add_row("/progress", "show concept progress for this topic")
        table.add_row("/last", "show full evaluator output for the previous answer")
        table.add_row("/mastery", "show mastery across all topics")
        table.add_row("/quit", "pause and resume later")
        table.add_row(":q", "same as /quit")
        table.add_row("(cli)", "python cli.py TOPIC --fresh  — new run, full DAG replay")
        self.console.print(table)
        self.console.print()

    def render_last(self, evaluation: EvaluationView | None) -> None:
        if evaluation is None:
            self.console.print("[dim]No synthesis yet.[/dim]\n")
            return
        gaps = "\n".join(f"- {gap}" for gap in evaluation.gaps) or "- none"
        concept = evaluation.inferred_concept_id or "unknown"
        body = (
            f"score: {evaluation.score}/5\n"
            f"concept: {concept} ({evaluation.inferred_concept_confidence:.0%})\n"
            f"reason: {evaluation.reasoning}\n\n"
            f"gaps:\n{gaps}"
        )
        self.console.print(
            Panel(
                body,
                title="[yellow]last synthesis[/yellow]",
                title_align="left",
                border_style="yellow",
                box=box.MINIMAL,
                padding=(1, 2),
            )
        )
        self.console.print()

    def render_progress(self, progress: ProgressSnapshot) -> None:
        table = Table(
            title=f"progress · {progress.topic_display}",
            box=box.SIMPLE,
            show_lines=False,
        )
        table.add_column("", width=2)
        table.add_column("depth", style="yellow")
        table.add_column("concept")
        table.add_column("turns", justify="right", style="dim")
        for item in progress.items:
            marker = ">" if item.is_current else ""
            table.add_row(
                marker,
                _blocks(round(item.score_1_to_5)),
                item.name,
                str(item.num_evaluations),
            )
        self.console.print(table)
        self.console.print()

    def render_mastery(self, rows: list[queries.MasteryRow]) -> None:
        if not rows:
            self.console.print("[dim]No mastery recorded yet.[/dim]\n")
            return
        table = Table(title="mastery", box=box.SIMPLE)
        table.add_column("topic", style="dim")
        table.add_column("kind")
        table.add_column("name")
        table.add_column("depth", style="yellow")
        table.add_column("n", justify="right")
        for row in rows:
            table.add_row(
                row.topic,
                row.kind,
                row.name,
                _blocks(round(row.score_1_to_5)),
                str(row.num_evaluations),
            )
        self.console.print(table)
        self.console.print()

    def render_paused(self) -> None:
        self.console.print("\n[dim]Paused. Run again to resume.[/dim]\n")

    def prompt_answer(self) -> str:
        return self._prompt.prompt(
            [("class:prompt", "› ")],
            multiline=True,
            bottom_toolbar="Enter submits · Esc+Enter inserts newline · /help",
        )

    @contextmanager
    def thinking(self) -> Iterator[None]:
        with self.console.status("[dim]◇ thinking...[/dim]", spinner="dots"):
            yield


def _make_prompt_session() -> PromptSession[str]:
    bindings = KeyBindings()

    @bindings.add("enter")
    def _(event) -> None:  # pragma: no cover - prompt-toolkit callback
        event.current_buffer.validate_and_handle()

    @bindings.add("escape", "enter")
    def _(event) -> None:  # pragma: no cover - prompt-toolkit callback
        event.current_buffer.insert_text("\n")

    style = Style.from_dict(
        {
            "prompt": "bold #e6c364",
            "bottom-toolbar": "#929097",
        }
    )
    return PromptSession(
        history=FileHistory(str(cli_history_path())),
        key_bindings=bindings,
        style=style,
    )


def _label_value(label: str, value: str) -> Text:
    text = Text()
    text.append(f"{label:<9}", style="dim")
    text.append(str(value), style="bold")
    return text


def _blocks(score: int | float) -> str:
    filled = max(0, min(5, int(round(score))))
    return " ".join(["■"] * filled + ["□"] * (5 - filled))


def _clip_visible(text: str, max_cols: int) -> str:
    """Truncate a string to `max_cols` visible characters, preserving ANSI codes."""
    out: list[str] = []
    visible = 0
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "\x1b" and i + 1 < len(text) and text[i + 1] == "[":
            end = text.find("m", i + 2)
            if end == -1:
                break
            out.append(text[i : end + 1])
            i = end + 1
            continue
        if visible >= max_cols:
            break
        out.append(ch)
        visible += 1
        i += 1
    return "".join(out)
