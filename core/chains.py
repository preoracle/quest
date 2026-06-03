"""LangChain runnables for Quest.

All chains use ``core.llm_client.make_chat_model`` so every call shares the same
proxy (``LLM_BASE_URL`` / ``LLM_API_KEY``) and documented model fallback chains.

Prompts live in ``prompts/*.txt`` — never hardcoded here (per BRIEF).
"""

from __future__ import annotations

import json

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable
from pydantic import BaseModel, Field

from core.llm_client import (
    DEFAULT_MODEL,
    MODEL_CHAIN_EVAL,
    MODEL_CHAIN_TOPIC,
    MODEL_CHAIN_TUTOR,
    make_chat_model,
)
from core.models import EvaluatorOutput
from core.paths import prompts_dir


def _load_prompt(name: str) -> str:
    """Read a prompt template from `prompts/<name>.txt`."""
    path = prompts_dir() / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(
            f"Prompt file not found: {path}. "
            f"Prompts must live in quest_data/prompts/*.txt."
        )
    return path.read_text(encoding="utf-8")


def build_socratic_chain(topic: str, temperature: float = 0.7) -> Runnable:
    """Socratic tutor — ``LLM_MODEL`` then ``LLM_EVAL_MODEL``, max 200 tokens out."""
    system_template = _load_prompt("socratic")

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_template),
            MessagesPlaceholder(variable_name="history"),
        ]
    ).partial(topic=topic)

    model = make_chat_model(
        *MODEL_CHAIN_TUTOR,
        temperature=temperature,
        max_tokens=200,
    )

    return prompt | model


def build_evaluator_chain() -> Runnable:
    """Evaluator — ``LLM_EVAL_MODEL`` then ``LLM_MODEL``, structured output, 400 tokens."""
    system_template = _load_prompt("evaluator")
    prompt = ChatPromptTemplate.from_messages([("human", system_template)])

    model = make_chat_model(
        *MODEL_CHAIN_EVAL,
        temperature=0,
        max_tokens=400,
    ).with_structured_output(EvaluatorOutput, method="function_calling")

    def _prepare(inputs: dict) -> dict:
        concepts = inputs["concept_list"]
        raw_answer = inputs["student_answer"]
        wrapped_answer = f"<student_answer>\n{raw_answer}\n</student_answer>"
        return {
            "topic": inputs["topic"],
            "concept_list_json": json.dumps(concepts, indent=2),
            "scoring_scope": inputs.get(
                "scoring_scope",
                "Score ONLY the latest tutor question and student answer pair below.",
            ),
            "tutor_question": inputs["tutor_question"],
            "student_answer": wrapped_answer,
        }

    return _prepare | prompt | model


class GeneratedConcept(BaseModel):
    """One node in an LLM-proposed concept DAG."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: str = ""
    prerequisites: list[str] = Field(default_factory=list)
    difficulty: int = Field(default=1, ge=1, le=3)


class GeneratedTopicMap(BaseModel):
    """Structured topic map from the topic generator."""

    topic: str = Field(..., min_length=1)
    display_name: str = Field(..., min_length=1)
    concepts: list[GeneratedConcept] = Field(..., min_length=5, max_length=10)


def build_topic_generator_chain() -> Runnable:
    """Topic map generator — same fallback as eval; structured output; 2048 tokens max."""
    template = _load_prompt("topic_generator")
    prompt = ChatPromptTemplate.from_messages([("human", template)])
    model = make_chat_model(
        *MODEL_CHAIN_TOPIC,
        temperature=0.35,
        max_tokens=2048,
    ).with_structured_output(GeneratedTopicMap, method="function_calling")
    return prompt | model
