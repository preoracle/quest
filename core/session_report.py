"""Structured end-of-session report (Phase B1)."""

from __future__ import annotations

import json
from collections import defaultdict

from pydantic import BaseModel, Field

from db import queries


class ConceptReportRow(BaseModel):
    """Per-concept stats for one session."""

    concept_id: str
    name: str
    answer_turns: int
    scores: list[int] = Field(default_factory=list)
    best_score: int = 0
    last_score: int = 0
    gaps: list[str] = Field(default_factory=list)


class SessionReport(BaseModel):
    """Machine-readable session report stored in sessions.report_json."""

    session_id: str
    topic_id: str
    topic_display: str
    total_turns: int
    evaluated_answers: int
    concepts: list[ConceptReportRow] = Field(default_factory=list)
    top_gaps: list[str] = Field(default_factory=list)
    narrative: str | None = None


def _parse_gaps(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return [str(g) for g in data if g]
    except json.JSONDecodeError:
        return []


def build_session_report(
    conn,
    session_id: str,
    topic_id: str,
    topic_display: str,
    *,
    narrative: str | None = None,
) -> SessionReport:
    """Build a structured report from SQLite turns for a session."""
    turns = queries.get_session_turns_detailed(conn, session_id)
    by_concept: dict[str, ConceptReportRow] = {}
    all_gaps: list[str] = []

    name_cache: dict[str, str] = {}

    def concept_name(cid: str) -> str:
        if cid in name_cache:
            return name_cache[cid]
        row = conn.execute(
            "SELECT name FROM concepts WHERE id = ?",
            (cid,),
        ).fetchone()
        name = row["name"] if row else cid.split(":")[-1].replace("_", " ")
        name_cache[cid] = name
        return name

    for t in turns:
        if t["role"] != "user" or t.get("evaluator_score") is None:
            continue
        cid = t.get("evaluator_concept_id") or "unknown"
        if cid not in by_concept:
            by_concept[cid] = ConceptReportRow(
                concept_id=cid,
                name=concept_name(cid) if cid != "unknown" else "Unmapped",
                answer_turns=0,
            )
        row = by_concept[cid]
        score = int(t["evaluator_score"])
        row.answer_turns += 1
        row.scores.append(score)
        row.best_score = max(row.best_score, score)
        row.last_score = score
        for g in _parse_gaps(t.get("evaluator_gaps_json")):
            if g not in row.gaps:
                row.gaps.append(g)
            if g not in all_gaps:
                all_gaps.append(g)

    concepts = sorted(
        by_concept.values(),
        key=lambda c: (-c.answer_turns, c.concept_id),
    )
    top_gaps = all_gaps[:5]
    evaluated = sum(c.answer_turns for c in concepts)

    return SessionReport(
        session_id=session_id,
        topic_id=topic_id,
        topic_display=topic_display,
        total_turns=len(turns),
        evaluated_answers=evaluated,
        concepts=concepts,
        top_gaps=top_gaps,
        narrative=narrative,
    )


def report_from_json(raw: str | None) -> SessionReport | None:
    """Parse stored report_json; return None if missing or invalid."""
    if not raw:
        return None
    try:
        return SessionReport.model_validate_json(raw)
    except Exception:
        return None
