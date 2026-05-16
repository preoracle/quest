"""LangGraph session flow (Phase 3). Replaces the Phase 2 REPL loop."""

from __future__ import annotations

import sqlite3
from typing import Literal, TypedDict

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, StateGraph
from langgraph.types import Command, interrupt

from core.chains import build_evaluator_chain, build_socratic_chain
from core.concept_pick import pick_next_concept
from core.mastery import apply_evaluation_to_mastery
from core.memory import summarize_session
from core.messages import message_content, messages_from_dicts, messages_to_dicts
from core.models import EvaluatorOutput
from db import queries

CONCEPT_MASTERED_MIN_SCORE = 4
CONCEPT_MASTERED_MIN_TURNS = 3


class QuestState(TypedDict, total=False):
    """Graph state persisted by LangGraph checkpointer."""

    user_id: str
    topic_id: str
    session_id: str
    concept_list: list[dict]
    current_concept_id: str | None
    current_concept_name: str | None
    concept_turn_count: int
    turn_idx: int
    last_tutor_question: str | None
    history: list[dict]
    tutor_message: str
    user_input: str
    done: bool
    session_complete: bool
    advance_concept: bool
    last_score: int | None
    last_evaluation: dict | None


def build_checkpointer() -> SqliteSaver:
    """Create the SQLite checkpointer for graph resumability."""
    path = queries.get_checkpoint_db_path()
    conn = sqlite3.connect(str(path), check_same_thread=False)
    return SqliteSaver(conn)


def build_quest_graph(
    conn: sqlite3.Connection,
    checkpointer: SqliteSaver,
):
    """Compile the Quest StateGraph with DB-aware nodes.

    Returns a compiled graph. Use thread_id = session_id in config.
    """
    evaluator = build_evaluator_chain()

    def pick_concept(state: QuestState) -> dict:
        """Select the next due, unmastered concept with satisfied prerequisites."""
        topic_id = state["topic_id"]
        user_id = state["user_id"]
        concepts = queries.get_topic_concepts(conn, topic_id)
        scores, reviews = queries.get_mastery_maps(conn, user_id, topic_id)
        nxt = pick_next_concept(concepts, topic_id, scores, reviews)
        if nxt is None:
            return {
                "session_complete": True,
                "current_concept_id": None,
                "current_concept_name": None,
            }
        prev = state.get("current_concept_id")
        reset_turns = prev != nxt["id"]
        return {
            "session_complete": False,
            "advance_concept": False,
            "current_concept_id": nxt["id"],
            "current_concept_name": nxt["name"],
            "concept_turn_count": 0 if reset_turns else state.get("concept_turn_count", 0),
        }

    def ask_question(state: QuestState) -> dict:
        """Generate the next Socratic question for the current concept."""
        topic_id = state["topic_id"]
        history = messages_from_dicts(state.get("history") or [])
        concept_name = state.get("current_concept_name") or "this topic"

        if state.get("concept_turn_count", 0) == 0:
            prompt = (
                f"Begin exploring the concept '{concept_name}'. "
                "Ask one opening question about it."
            )
        else:
            prompt = (
                f"Continue probing the concept '{concept_name}'. "
                "Ask the next harder question."
            )
        history.append(HumanMessage(content=prompt))

        chain = build_socratic_chain(topic=topic_id)
        response = chain.invoke({"history": history})
        tutor_text = message_content(response)
        history.append(AIMessage(content=tutor_text))

        turn_idx = state.get("turn_idx", 0)
        queries.record_turn(conn, state["session_id"], turn_idx, "tutor", tutor_text)

        return {
            "history": messages_to_dicts(history),
            "tutor_message": tutor_text,
            "last_tutor_question": tutor_text,
            "turn_idx": turn_idx + 1,
        }

    def wait_for_user(state: QuestState) -> dict:
        """Pause until the CLI supplies the student's answer."""
        answer = interrupt(state.get("tutor_message", ""))
        return {"user_input": str(answer)}

    def evaluate_answer(state: QuestState) -> dict:
        """Score the student's answer with the evaluator chain."""
        evaluation: EvaluatorOutput = evaluator.invoke(
            {
                "topic": state["topic_id"],
                "concept_list": state["concept_list"],
                "tutor_question": state.get("last_tutor_question") or "",
                "student_answer": state["user_input"],
            }
        )
        turn_idx = state.get("turn_idx", 0)
        queries.record_turn(
            conn,
            state["session_id"],
            turn_idx,
            "user",
            state["user_input"],
            evaluator_score=evaluation.score,
            evaluator_gaps=evaluation.gaps,
            evaluator_reasoning=evaluation.reasoning,
            evaluator_concept_id=evaluation.inferred_concept_id,
            evaluator_concept_confidence=evaluation.inferred_concept_confidence,
        )
        return {
            "turn_idx": turn_idx + 1,
            "last_score": evaluation.score,
            "last_evaluation": evaluation.model_dump(),
        }

    def update_mastery(state: QuestState) -> dict:
        """Persist mastery + SM-2 from the latest evaluation."""
        raw = state.get("last_evaluation")
        if raw:
            apply_evaluation_to_mastery(
                conn,
                state["user_id"],
                state["topic_id"],
                EvaluatorOutput.model_validate(raw),
            )
        return {"concept_turn_count": state.get("concept_turn_count", 0) + 1}

    def decide(state: QuestState) -> dict:
        """Set routing flags after an evaluated turn."""
        score = state.get("last_score") or 0
        turns = state.get("concept_turn_count", 0)
        if score >= CONCEPT_MASTERED_MIN_SCORE and turns >= CONCEPT_MASTERED_MIN_TURNS:
            return {"advance_concept": True}
        return {"advance_concept": False}

    def summarize(state: QuestState) -> dict:
        """End session and write summary_text."""
        session_id = state["session_id"]
        from core.topics import load_topic

        topic_id = state["topic_id"]
        display = load_topic(topic_id).get("display_name") or topic_id
        queries.end_session(conn, session_id)
        summary = summarize_session(conn, session_id, display)
        return {"done": True, "tutor_message": f"\nSession complete.\n\n{summary}\n"}

    def route_after_pick(state: QuestState) -> Literal["ask_question", "summarize"]:
        if state.get("session_complete"):
            return "summarize"
        return "ask_question"

    def route_after_decide(state: QuestState) -> Literal["pick_concept", "ask_question"]:
        if state.get("advance_concept"):
            return "pick_concept"
        return "ask_question"

    graph = StateGraph(QuestState)
    graph.add_node("pick_concept", pick_concept)
    graph.add_node("ask_question", ask_question)
    graph.add_node("wait_for_user", wait_for_user)
    graph.add_node("evaluate_answer", evaluate_answer)
    graph.add_node("update_mastery", update_mastery)
    graph.add_node("decide", decide)
    graph.add_node("summarize", summarize)

    graph.set_entry_point("pick_concept")
    graph.add_conditional_edges("pick_concept", route_after_pick)
    graph.add_edge("ask_question", "wait_for_user")
    graph.add_edge("wait_for_user", "evaluate_answer")
    graph.add_edge("evaluate_answer", "update_mastery")
    graph.add_edge("update_mastery", "decide")
    graph.add_conditional_edges("decide", route_after_decide)
    graph.add_edge("summarize", END)

    return graph.compile(checkpointer=checkpointer)


def seed_state_from_turns(
    conn: sqlite3.Connection,
    session_id: str,
    user_id: str,
    topic_id: str,
    concept_list: list[dict],
) -> QuestState:
    """Rebuild graph state from SQLite turns when checkpoint is missing."""
    turns = queries.get_turns_for_session(conn, session_id)
    history: list[dict] = []
    last_tutor: str | None = None
    for t in turns:
        role = "human" if t["role"] == "user" else "ai"
        history.append({"role": role, "content": t["content"]})
        if t["role"] == "tutor":
            last_tutor = t["content"]
    return {
        "user_id": user_id,
        "topic_id": topic_id,
        "session_id": session_id,
        "concept_list": concept_list,
        "turn_idx": len(turns),
        "history": history,
        "last_tutor_question": last_tutor,
        "concept_turn_count": 0,
        "done": False,
        "session_complete": False,
    }
