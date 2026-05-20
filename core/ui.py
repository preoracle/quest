"""Tasteful terminal UI for Quest's Socratic CLI."""

from __future__ import annotations

import shutil
import sqlite3
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator

from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.styles import Style
from rich import box
from rich.console import Console, Group, RenderableType
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from core.paths import cli_history_path
from core.session_api import EvaluationView, SessionView
from core.terminal_format import normalize_message, tutor_markup
from core.topics import load_topic
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
    """Pin a small header at the top of the terminal via DECSTBM scroll region."""

    def __init__(self) -> None:
        self._enabled = False
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
        self.console = Console(soft_wrap=True)
        self._prompt = make_cli_prompt_session()
        self.sticky = StickyHeader()

    def build_header_lines(
        self,
        view: SessionView,
        progress: ProgressSnapshot,
    ) -> list[str]:
        """Two visible lines + a separator for the sticky top header."""
        focus = _shorten(view.focus or "done", 28)
        progress_label = f"{progress.at_depth}/{progress.total} at depth"
        last_score = view.last_evaluation.score if view.last_evaluation else 0
        blocks = _blocks(last_score)

        line1 = (
            f"\x1b[1m Quest\x1b[0m \x1b[2m·\x1b[0m "
            f"{_shorten(view.topic_display, 32)}"
            f"   \x1b[2m{progress_label}\x1b[0m"
        )
        line2 = (
            f" \x1b[2mnow\x1b[0m \x1b[33m{focus}\x1b[0m"
            f"   \x1b[2mlast\x1b[0m \x1b[33m{blocks}\x1b[0m"
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
        if resuming:
            self.console.print(
                f"[dim]Resuming {view.topic_display} — [/dim]"
                f"[dim]/quit pauses · /help · /last for evaluator detail[/dim]\n"
            )
        else:
            self.console.print(
                f"[dim]{view.topic_display} — answer below. "
                f"/quit pauses · /help[/dim]\n"
            )

    def render_user_reply(self, text: str) -> None:
        """Show the learner's last answer in the thread."""
        body = normalize_message(text)
        self.console.print(
            Panel(
                body,
                title="[dim]You[/dim]",
                title_align="left",
                border_style="dim",
                box=box.MINIMAL,
                padding=(0, 1),
            )
        )

    def render_turn(
        self,
        view: SessionView,
        progress: ProgressSnapshot,
        *,
        synthesis: EvaluationView | None = None,
        user_reply: str | None = None,
    ) -> None:
        del progress
        if user_reply:
            self.render_user_reply(user_reply)

        if synthesis:
            self.render_feedback(synthesis)

        if view.done:
            self.render_completion(view)
            return

        if not view.tutor_message:
            return

        body_parts: list[RenderableType] = []
        if view.focus_scope:
            body_parts.append(
                Text.from_markup(
                    f"[dim]{normalize_message(view.focus_scope)}[/dim]\n"
                )
            )
        body_parts.append(tutor_markup(view.tutor_message))
        body: RenderableType = (
            Group(*body_parts) if len(body_parts) > 1 else body_parts[0]
        )

        self.console.print(
            Panel(
                body,
                title="[bold #e6c364]Question[/bold #e6c364]",
                title_align="left",
                border_style="#e6c364",
                box=box.ROUNDED,
                padding=(0, 1),
            )
        )
        self.console.print()

    def render_feedback(self, evaluation: EvaluationView) -> None:
        """One-line digest after an answer — details via /last."""
        gap = evaluation.gaps[0] if evaluation.gaps else "—"
        gap = normalize_message(gap)
        if len(gap) > 72:
            gap = gap[:69] + "…"
        color = "green" if evaluation.score >= 4 else "yellow" if evaluation.score >= 3 else "red"
        self.console.print(
            f"[dim]Your last answer[/dim]  [{color}]{evaluation.score}/5[/{color}]"
            f"  [dim]·[/dim]  {gap}\n"
            f"[dim]Scored on this Q→A only · /last for evaluator detail[/dim]\n"
        )

    def render_checkpoint(self, turns: int, progress: ProgressSnapshot) -> None:
        self.console.print(
            f"[dim]── {turns} turns · {progress.at_depth}/{progress.total} at depth · "
            f"/progress for map ──[/dim]\n"
        )

    def render_completion(self, view: SessionView) -> None:
        text = view.summary or view.tutor_message or "Session complete."
        self.console.print(
            Panel(
                tutor_markup(text),
                title="[green]Done[/green]",
                title_align="left",
                border_style="green",
                box=box.ROUNDED,
                padding=(0, 1),
            )
        )
        self.console.print()

    def render_help(self) -> None:
        table = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
        table.add_column("cmd", style="bold #e6c364", width=12)
        table.add_column("what", style="")
        table.add_row("/quit", "pause; run quest TOPIC to resume")
        table.add_row("/last", "full evaluator notes on your previous answer")
        table.add_row("/progress", "concept map + depth for this topic")
        table.add_row("/mastery", "all topics")
        self.console.print(Panel(table, title="Commands", border_style="dim"))
        self.console.print()

    def render_last(self, evaluation: EvaluationView | None) -> None:
        if evaluation is None:
            self.console.print("[dim]No evaluated answer yet.[/dim]\n")
            return
        gaps = "\n".join(f"• {normalize_message(g)}" for g in evaluation.gaps) or "• —"
        concept = evaluation.inferred_concept_id or "unknown"
        body = Group(
            Text.from_markup(
                f"[dim]Score[/dim]  [bold]{evaluation.score}/5[/bold]\n"
                f"[dim]Concept[/dim]  {concept} "
                f"({evaluation.inferred_concept_confidence:.0%})\n"
                f"[dim]Reason[/dim]  {normalize_message(evaluation.reasoning)}\n"
            ),
            Text("\n"),
            Text.from_markup(f"[dim]Gaps[/dim]\n{gaps}"),
        )
        self.console.print(
            Panel(
                body,
                title="[yellow]Evaluator[/yellow]",
                border_style="yellow",
                box=box.ROUNDED,
                padding=(0, 1),
            )
        )
        self.console.print()

    def render_progress(self, progress: ProgressSnapshot) -> None:
        table = Table(box=box.SIMPLE_HEAVY, border_style="dim", padding=(0, 0))
        table.add_column("", width=2)
        table.add_column("depth", style="#e6c364", width=12)
        table.add_column("concept")
        table.add_column("n", justify="right", style="dim", width=4)
        for item in progress.items:
            marker = "›" if item.is_current else ""
            table.add_row(
                marker,
                _blocks(round(item.score_1_to_5)),
                item.name,
                str(item.num_evaluations),
            )
        self.console.print(
            Panel(
                table,
                title=f"[bold]{progress.topic_display}[/bold]",
                border_style="dim",
            )
        )
        self.console.print()

    def render_mastery(self, rows: list[queries.MasteryRow]) -> None:
        if not rows:
            self.console.print("[dim]No mastery recorded yet.[/dim]\n")
            return
        table = Table(box=box.SIMPLE, border_style="dim")
        table.add_column("topic", style="dim")
        table.add_column("name")
        table.add_column("depth", style="#e6c364")
        table.add_column("n", justify="right", style="dim")
        for row in rows:
            table.add_row(
                row.topic,
                row.name[:40],
                _blocks(round(row.score_1_to_5)),
                str(row.num_evaluations),
            )
        self.console.print(Panel(table, title="Mastery", border_style="dim"))
        self.console.print()

    def render_paused(self) -> None:
        self.console.print("\n[dim]Paused — same topic resumes next time.[/dim]\n")

    def prompt_answer(self) -> str:
        return self._prompt.prompt(
            [("class:prompt", "› ")],
            multiline=True,
            bottom_toolbar="Enter send · Esc+Enter newline · /help · /quit",
        )

    @contextmanager
    def thinking(self) -> Iterator[None]:
        with self.console.status("[dim]Thinking…[/dim]", spinner="dots"):
            yield


def make_cli_prompt_session() -> PromptSession[str]:
    """Shared prompt session for session loop and topic picker."""
    bindings = KeyBindings()

    @bindings.add("enter")
    def _(event) -> None:  # pragma: no cover
        event.current_buffer.validate_and_handle()

    @bindings.add("escape", "enter")
    def _(event) -> None:  # pragma: no cover
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


# Back-compat for topic_picker
_make_prompt_session = make_cli_prompt_session


def _label_value(label: str, value: str) -> Text:
    text = Text()
    text.append(f"{label:<9}", style="dim")
    text.append(str(value), style="bold")
    return text


def _blocks(score: int | float) -> str:
    filled = max(0, min(5, int(round(score))))
    return " ".join(["■"] * filled + ["□"] * (5 - filled))


def _shorten(text: str, max_len: int) -> str:
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


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
