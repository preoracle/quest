"""LangChain runnables for Quest.

Socratic tutor (Sonnet) and understanding evaluator (Haiku) chains.
Graph-aware chains land in Phase 3.

Prompts live in `prompts/*.txt` — never hardcoded here (per BRIEF).
"""

from __future__ import annotations

import json
import os

from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable
from pydantic import BaseModel, Field

from core.models import EvaluatorOutput
from core.paths import prompts_dir

DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_EVAL_MODEL = "claude-haiku-4-5"


def _load_prompt(name: str) -> str:
    """Read a prompt template from `prompts/<name>.txt`.

    Returns the raw template string. Raises FileNotFoundError if the
    prompt file is missing — prompts are not optional, they ARE the product.
    """
    path = prompts_dir() / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(
            f"Prompt file not found: {path}. "
            f"Prompts must live in quest_data/prompts/*.txt."
        )
    return path.read_text(encoding="utf-8")


def build_socratic_chain(topic: str) -> Runnable:
    """Build the Socratic tutor chain for a given topic.

    Loads the Socratic system prompt from `prompts/socratic.txt`,
    substitutes the topic into the `{topic}` placeholder, and wraps
    Anthropic Claude Sonnet (configurable via ANTHROPIC_MODEL env var)
    with a MessagesPlaceholder for the running conversation history.

    The chain expects an input dict of the form `{"history": [<messages>]}`
    where messages are LangChain HumanMessage / AIMessage objects.

    Returns a Runnable that produces an AIMessage. The caller is responsible
    for appending the user's turn to history before invoking, and appending
    the AIMessage to history after invoking.
    """
    system_template = _load_prompt("socratic")

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_template),
            MessagesPlaceholder(variable_name="history"),
        ]
    ).partial(topic=topic)

    model = ChatAnthropic(
        model=os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL),
        temperature=0.7,
        max_tokens=512,
    )

    return prompt | model


def build_evaluator_chain() -> Runnable:
    """Build the understanding evaluator chain (Haiku, structured output).

    Expects input dict with keys: topic, concept_list (list of dicts with
    id/name/description), tutor_question, student_answer.

    Returns an EvaluatorOutput via Anthropic tool use. The Socratic tutor
    never sees this output (per BRIEF).
    """
    system_template = _load_prompt("evaluator")

    # Anthropic requires at least one non-system message.
    prompt = ChatPromptTemplate.from_messages([("human", system_template)])

    model = ChatAnthropic(
        model=os.environ.get("ANTHROPIC_EVAL_MODEL", DEFAULT_EVAL_MODEL),
        temperature=0,
        max_tokens=512,
    ).with_structured_output(EvaluatorOutput)

    def _prepare(inputs: dict) -> dict:
        concepts = inputs["concept_list"]
        return {
            "topic": inputs["topic"],
            "concept_list_json": json.dumps(concepts, indent=2),
            "tutor_question": inputs["tutor_question"],
            "student_answer": inputs["student_answer"],
        }

    return _prepare | prompt | model


class GeneratedConcept(BaseModel):
    """One node in an LLM-proposed concept DAG."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: str = ""
    prerequisites: list[str] = Field(default_factory=list)


class GeneratedTopicMap(BaseModel):
    """Structured topic map from the topic generator (Sonnet)."""

    topic: str = Field(..., min_length=1)
    display_name: str = Field(..., min_length=1)
    concepts: list[GeneratedConcept] = Field(..., min_length=5, max_length=10)


def build_topic_generator_chain() -> Runnable:
    """Return a Runnable: input ``{\"learning_goal\": str}``, output ``GeneratedTopicMap``."""
    template = _load_prompt("topic_generator")
    prompt = ChatPromptTemplate.from_messages([("human", template)])
    model = ChatAnthropic(
        model=os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL),
        temperature=0.35,
        max_tokens=4096,
    ).with_structured_output(GeneratedTopicMap)
    return prompt | model
