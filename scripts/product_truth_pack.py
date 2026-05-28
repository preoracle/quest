#!/usr/bin/env python3
"""Compact product-truth pack for Quest's Socratic engine.

Runs four checks:
1) DB schema contract for eval context fields.
2) Evaluator calibration on canonical student answers.
3) Socratic targeting quality from instructor-note eval context.
4) One live end-to-end session turn through graph + persistence.
"""

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.exceptions import OutputParserException

from core.chains import build_evaluator_chain, build_socratic_chain
from core.session_api import get_session_view, start_session, submit_turn
from core.topics import load_topic
from db import queries


TOPIC = os.environ.get("TRUTH_PACK_TOPIC", "tool_calling_agents")
USER_ID = "truth_pack_user"
TUTOR_QUESTION = (
    "A user asks: 'What is the temperature in Tokyo right now?' "
    "Your agent has a weather API tool and model prior knowledge. "
    "Which source should it use and why?"
)


@dataclass
class EvalCase:
    name: str
    answer: str
    expected_score_min: int
    expected_score_max: int
    expected_gap_type: str


@dataclass
class SocraticCase:
    name: str
    student_answer: str
    gap_type: str
    expert_framing: str
    required_patterns: list[str]
    forbidden_patterns: list[str]


EVAL_CASES: list[EvalCase] = [
    EvalCase(
        name="off_topic",
        answer="It should use closures and lexical scope to decide.",
        expected_score_min=1,
        expected_score_max=2,
        expected_gap_type="wrong_model",
    ),
    EvalCase(
        name="blank_signal",
        answer="Not sure.",
        expected_score_min=1,
        expected_score_max=2,
        expected_gap_type="missing_mechanism",
    ),
    EvalCase(
        name="theme_only_live_data",
        answer="Probably use the tool because it has live data.",
        expected_score_min=2,
        expected_score_max=3,
        expected_gap_type="missing_mechanism",
    ),
    EvalCase(
        name="vague_causal_language",
        answer="The API might be better and could be more accurate.",
        expected_score_min=2,
        expected_score_max=3,
        expected_gap_type="missing_mechanism",
    ),
    EvalCase(
        name="factor_id_without_chain",
        answer=(
            "Use the weather API for freshness and avoid stale model knowledge."
        ),
        expected_score_min=3,
        expected_score_max=4,
        expected_gap_type="missing_mechanism",
    ),
    EvalCase(
        name="mechanism_trace_informal_vocab",
        answer=(
            "Use the weather tool: the model's built-in knowledge is frozen at training time, "
            "while the API returns current observations. For 'right now' questions, stale priors "
            "can be wrong, so runtime retrieval should override memory."
        ),
        expected_score_min=4,
        expected_score_max=4,
        expected_gap_type="linguistic_imprecision",
    ),
    EvalCase(
        name="mechanism_with_formal_term",
        answer=(
            "This is a freshness and source-of-truth decision under tool routing: "
            "for time-sensitive queries, the agent should issue a tool call because "
            "parametric memory is non-real-time and non-verifiable, while the API provides "
            "observable current-state data."
        ),
        expected_score_min=5,
        expected_score_max=5,
        expected_gap_type="none",
    ),
    EvalCase(
        name="wrong_model_no_tool_needed",
        answer=(
            "The model should answer directly because LLMs are always connected to the internet."
        ),
        expected_score_min=1,
        expected_score_max=2,
        expected_gap_type="wrong_model",
    ),
    EvalCase(
        name="right_mechanism_everyday_words",
        answer=(
            "Pick the API because it's checking the live world now, while the model is guessing "
            "from older learned patterns."
        ),
        expected_score_min=4,
        expected_score_max=4,
        expected_gap_type="linguistic_imprecision",
    ),
    EvalCase(
        name="mentions_tool_calling_no_chain",
        answer="Use tool calling because this is an agent problem.",
        expected_score_min=2,
        expected_score_max=3,
        expected_gap_type="missing_mechanism",
    ),
    EvalCase(
        name="partial_chain_missing_abstraction",
        answer=(
            "Use the API for current weather since model knowledge is stale; "
            "then answer from that result."
        ),
        expected_score_min=3,
        expected_score_max=4,
        expected_gap_type="missing_abstraction",
    ),
    EvalCase(
        name="strong_with_edge_case",
        answer=(
            "Use the weather API as authoritative source because this is a real-time claim; "
            "parametric memory cannot guarantee temporal correctness. If the tool fails, the "
            "agent should acknowledge uncertainty or ask to retry instead of fabricating a value."
        ),
        expected_score_min=5,
        expected_score_max=5,
        expected_gap_type="none",
    ),
]


SOCRATIC_CASES: list[SocraticCase] = [
    SocraticCase(
        name="near_miss_linguistic_imprecision",
        student_answer="The model should use the live source because it's current.",
        gap_type="linguistic_imprecision",
        expert_framing=(
            "A complete answer would explicitly name this as a source-of-truth and "
            "freshness constraint in tool-routing decisions."
        ),
        required_patterns=[r"term|technical|precise|called|name"],
        forbidden_patterns=[r"source-of-truth", r"freshness constraint"],
    ),
    SocraticCase(
        name="near_miss_missing_abstraction",
        student_answer="Use the weather API because model memory can be old.",
        gap_type="missing_abstraction",
        expert_framing=(
            "A complete answer would invoke the general rule: time-sensitive facts require "
            "external observation over parametric memory."
        ),
        required_patterns=[r"rule|principle|general|framework"],
        forbidden_patterns=[r"time-sensitive facts", r"parametric memory"],
    ),
    SocraticCase(
        name="near_miss_missing_mechanism",
        student_answer="Tool is better for current weather.",
        gap_type="missing_mechanism",
        expert_framing=(
            "A complete answer would walk step-by-step through intent detection, "
            "tool call execution, observation return, and final response grounding."
        ),
        required_patterns=[r"step|walk|exactly what happens|sequence"],
        forbidden_patterns=[r"intent detection", r"grounding"],
    ),
    SocraticCase(
        name="wrong_model_probe_contradiction",
        student_answer="LLMs are always online so no tool call needed.",
        gap_type="wrong_model",
        expert_framing=(
            "A complete answer would contrast static training cutoff with live API observation "
            "using a contradiction test."
        ),
        required_patterns=[r"if|what would happen|print|predict|counterexample"],
        forbidden_patterns=[r"training cutoff", r"live api observation"],
    ),
    SocraticCase(
        name="single_question_discipline",
        student_answer="I think tools help sometimes.",
        gap_type="missing_mechanism",
        expert_framing=(
            "A complete answer would trace one concrete request lifecycle from question to grounded answer."
        ),
        required_patterns=[r"\?"],
        forbidden_patterns=[r"Great|Exactly|Good start"],
    ),
    SocraticCase(
        name="no_direct_explaining",
        student_answer="I am stuck, just tell me.",
        gap_type="missing_mechanism",
        expert_framing=(
            "A complete answer would specify the operational chain without direct explanation."
        ),
        required_patterns=[r"\?"],
        forbidden_patterns=[r"is when|means that|tool calling is"],
    ),
]


def _maybe_limit_cases[T](cases: list[T], env_key: str) -> list[T]:
    raw = os.environ.get(env_key, "").strip()
    if not raw:
        return cases
    try:
        n = int(raw)
    except ValueError:
        return cases
    if n <= 0:
        return cases
    return cases[:n]


def _require_live_env() -> None:
    key = os.environ.get("LLM_API_KEY", "").strip()
    base = os.environ.get("LLM_BASE_URL", "").strip()
    if not key or not base:
        raise RuntimeError("LLM_API_KEY and LLM_BASE_URL must be set for truth-pack run.")


def _concept_list_for_topic(topic_id: str) -> list[dict]:
    topic_data = load_topic(topic_id)
    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, USER_ID, name="Truth Pack Runner")
        return queries.upsert_topic_concepts(conn, topic_data)


def _check_schema_contract() -> tuple[bool, list[str]]:
    details: list[str] = []
    ok = True
    with queries.get_connection() as conn:
        if conn.db_type == "postgres":
            cols = conn.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'turns'
                  AND column_name IN ('evaluator_gap_type', 'evaluator_expert_framing')
                """
            ).fetchall()
            col_names = {r["column_name"] for r in cols}
            if "evaluator_gap_type" not in col_names:
                ok = False
                details.append("missing turns.evaluator_gap_type")
            if "evaluator_expert_framing" not in col_names:
                ok = False
                details.append("missing turns.evaluator_expert_framing")

            constraint = conn.execute(
                """
                SELECT pg_get_constraintdef(oid) AS def
                FROM pg_constraint
                WHERE conrelid = 'sessions'::regclass
                  AND conname = 'sessions_session_kind_check'
                """
            ).fetchone()
            if not constraint or "replay" not in (constraint.get("def") or ""):
                ok = False
                details.append("sessions.session_kind constraint does not include replay")
        else:
            cols = conn.execute("PRAGMA table_info(turns)").fetchall()
            col_names = {r["name"] for r in cols}
            if "evaluator_gap_type" not in col_names:
                ok = False
                details.append("missing turns.evaluator_gap_type")
            if "evaluator_expert_framing" not in col_names:
                ok = False
                details.append("missing turns.evaluator_expert_framing")
    if ok:
        details.append("schema contract OK")
    return ok, details


def _run_evaluator_pack(concept_list: list[dict]) -> tuple[int, int, list[str]]:
    chain = build_evaluator_chain()
    passed = 0
    cases = _maybe_limit_cases(EVAL_CASES, "TRUTH_PACK_EVAL_LIMIT")
    total = len(cases)
    logs: list[str] = []

    for case in cases:
        try:
            result = chain.invoke(
                {
                    "topic": TOPIC,
                    "concept_list": concept_list,
                    "tutor_question": TUTOR_QUESTION,
                    "student_answer": case.answer,
                }
            )
        except OutputParserException as exc:
            logs.append(f"FAIL evaluator/{case.name} parser_error={exc}")
            continue
        except Exception as exc:  # noqa: BLE001
            logs.append(f"FAIL evaluator/{case.name} invoke_error={type(exc).__name__}: {exc}")
            continue
        score_ok = case.expected_score_min <= result.score <= case.expected_score_max
        gap_ok = result.gap_type == case.expected_gap_type
        framing_ok = (result.score == 5 and not result.expert_framing) or (
            result.score < 5 and bool(result.expert_framing)
        )
        ok = score_ok and gap_ok and framing_ok
        if ok:
            passed += 1
            logs.append(f"PASS evaluator/{case.name} score={result.score} gap={result.gap_type}")
        else:
            logs.append(
                "FAIL evaluator/"
                f"{case.name} expected_score={case.expected_score_min}-{case.expected_score_max} "
                f"got_score={result.score} expected_gap={case.expected_gap_type} "
                f"got_gap={result.gap_type} framing_present={bool(result.expert_framing)}"
            )
    return passed, total, logs


def _question_shape_ok(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    if stripped.count("?") < 1:
        return False
    # Allow one setup sentence + one question (at most two question marks).
    return stripped.count("?") <= 2


def _run_socratic_pack() -> tuple[int, int, list[str]]:
    chain = build_socratic_chain(topic=TOPIC, temperature=0)
    passed = 0
    cases = _maybe_limit_cases(SOCRATIC_CASES, "TRUTH_PACK_SOCRATIC_LIMIT")
    total = len(cases)
    logs: list[str] = []

    for case in cases:
        note = (
            "[Instructor note: "
            f"Last eval: 4/5, gap={case.gap_type}. "
            "Probe toward this missing layer WITHOUT revealing it — "
            f"ask a question that forces them to articulate: {case.expert_framing}"
            "]"
        )
        history = [
            AIMessage(content="What happens to x after outer returns?"),
            HumanMessage(content=case.student_answer),
            HumanMessage(content=note),
        ]
        try:
            response = chain.invoke({"history": history})
        except Exception as exc:  # noqa: BLE001
            logs.append(f"FAIL socratic/{case.name} invoke_error={type(exc).__name__}: {exc}")
            continue
        text = (response.content or "").strip()
        text_lower = text.lower()

        shape_ok = _question_shape_ok(text)
        required_ok = all(re.search(pat, text_lower) for pat in case.required_patterns)
        forbidden_ok = not any(re.search(pat.lower(), text_lower) for pat in case.forbidden_patterns)
        ok = shape_ok and required_ok and forbidden_ok
        if ok:
            passed += 1
            logs.append(f"PASS socratic/{case.name} text={text[:140]!r}")
        else:
            logs.append(
                f"FAIL socratic/{case.name} "
                f"shape_ok={shape_ok} required_ok={required_ok} forbidden_ok={forbidden_ok} "
                f"text={text[:220]!r}"
            )
    return passed, total, logs


def _run_end_to_end_sanity() -> tuple[bool, list[str]]:
    details: list[str] = []
    ok = True
    answer = (
        "For right-now weather, call the live API tool because model memory can be stale. "
        "Then answer from the tool observation."
    )

    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, USER_ID, name="Truth Pack Runner")
        session = start_session(conn, USER_ID, TOPIC, resume=False, replay=True)

    first = get_session_view(session.session_id)
    if not first.tutor_message:
        ok = False
        details.append("missing first tutor question")
        return ok, details

    after = submit_turn(session.session_id, answer)
    if not after.last_evaluation:
        ok = False
        details.append("missing last_evaluation after submit_turn")
    else:
        if after.last_evaluation.gap_type is None:
            ok = False
            details.append("last_evaluation missing gap_type")
        if after.last_evaluation.score < 5 and not after.last_evaluation.expert_framing:
            ok = False
            details.append("expert_framing missing for score < 5")

    with queries.get_connection() as conn:
        rows = queries.get_session_turns_detailed(conn, session.session_id)
    user_rows = [r for r in rows if r["role"] == "user"]
    if not user_rows:
        ok = False
        details.append("no persisted user turn row")
    else:
        latest = user_rows[-1]
        if latest.get("evaluator_gap_type") is None:
            ok = False
            details.append("persisted turn missing evaluator_gap_type")
        if latest.get("evaluator_score") is not None and latest.get("evaluator_score") < 5:
            if not latest.get("evaluator_expert_framing"):
                ok = False
                details.append("persisted turn missing evaluator_expert_framing for score < 5")

    if ok:
        details.append("end-to-end flow OK")
    return ok, details


def main() -> int:
    load_dotenv()
    _require_live_env()
    try:
        queries.init_db()
    except Exception as exc:  # noqa: BLE001 - tolerate concurrent DDL lock contention
        # If another process is applying schema DDL at the same time (common while
        # the API server is booting), continue and run read/write checks against
        # the live DB state instead of aborting immediately.
        print(f"WARN: init_db failed, continuing with existing schema: {type(exc).__name__}: {exc}")
    concept_list = _concept_list_for_topic(TOPIC)

    schema_ok, schema_logs = _check_schema_contract()
    eval_pass, eval_total, eval_logs = _run_evaluator_pack(concept_list)
    soc_pass, soc_total, soc_logs = _run_socratic_pack()
    e2e_ok, e2e_logs = _run_end_to_end_sanity()

    print("=== Quest Product Truth Pack ===")
    print(f"Schema: {'PASS' if schema_ok else 'FAIL'}")
    for line in schema_logs:
        print(f"  - {line}")

    print(f"Evaluator calibration: {eval_pass}/{eval_total} passed")
    for line in eval_logs:
        print(f"  - {line}")

    print(f"Socratic targeting: {soc_pass}/{soc_total} passed")
    for line in soc_logs:
        print(f"  - {line}")

    print(f"End-to-end session flow: {'PASS' if e2e_ok else 'FAIL'}")
    for line in e2e_logs:
        print(f"  - {line}")

    hard_fail = (not schema_ok) or (not e2e_ok)
    # Keep thresholds realistic for LLM variance while still strict enough to catch drift.
    eval_threshold = max(8, int(eval_total * 0.75))
    soc_threshold = max(4, int(soc_total * 0.65))
    if eval_pass < eval_threshold:
        hard_fail = True
        print(
            f"FAIL: evaluator pass count below threshold "
            f"({eval_pass} < {eval_threshold})"
        )
    if soc_pass < soc_threshold:
        hard_fail = True
        print(
            f"FAIL: socratic pass count below threshold "
            f"({soc_pass} < {soc_threshold})"
        )

    return 1 if hard_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
