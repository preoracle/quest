"""Request/response models for the Quest REST API."""

from __future__ import annotations

from pydantic import BaseModel, Field

from core.baseline_api import BaselineView
from core.session_api import EvaluationView, SessionView
from core.session_report import ConceptReportRow, SessionReport
from core.topic_graph import GraphNode, TopicGraph


class StartSessionRequest(BaseModel):
    """Body for POST /sessions."""

    user_id: str = Field(default="default", min_length=1)
    topic: str = Field(..., min_length=1, description="Topic id, e.g. closures_in_javascript")
    resume: bool = Field(
        default=True,
        description="Reuse open session for this user+topic if one exists",
    )
    replay: bool = Field(
        default=False,
        description=(
            "Start a new session that walks the concept DAG from scratch for this run "
            "(scheduling ignores stored mastery; mastery still updates)"
        ),
    )
    baseline: bool = Field(
        default=False,
        description="If true, client should run POST /baseline first (legacy flag).",
    )


class SubmitTurnRequest(BaseModel):
    """Body for POST /sessions/{session_id}/turn."""

    # 2000-char cap: prevents token-stuffing attacks and LLM context overflows.
    # Real answers to Socratic questions are rarely >500 chars; 2000 is generous.
    answer: str = Field(..., min_length=1, max_length=2000)


class MasteryItem(BaseModel):
    """One mastery row for GET /users/{user_id}/mastery."""

    concept_id: str
    topic: str
    kind: str
    name: str
    score: float
    score_1_to_5: float
    num_evaluations: int


class MasteryResponse(BaseModel):
    """Mastery list for a user."""

    user_id: str
    items: list[MasteryItem]


class DueItem(BaseModel):
    """One concept due for SM-2 review."""

    topic: str
    concept_id: str
    name: str
    score_1_to_5: float
    next_review_at: str | None = None
    overdue: bool = False


class DueResponse(BaseModel):
    """Concepts due for review."""

    user_id: str
    items: list[DueItem]


class TopicCatalogItem(BaseModel):
    """Rich topic row for the catalog UI."""

    id: str
    display_name: str
    concept_count: int
    preview_concepts: list[str] = Field(default_factory=list)
    hook: str = ""
    started: bool = False
    mastered_count: int = 0
    avg_score_1_to_5: float = 0.0
    due_count: int = 0
    last_studied_at: str | None = None
    archived: bool = False
    pinned: bool = False
    user_created: bool = False
    deletable: bool = False
    enrolled: bool = False


class UpdateTopicRequest(BaseModel):
    """Body for PATCH /topics/{topic_id}."""

    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    archived: bool | None = None
    pinned: bool | None = None
    new_topic_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=48,
        description="Rename slug (user-created topics only)",
    )


class TopicLifecycleResponse(BaseModel):
    """Result of PATCH or DELETE on a topic."""

    topic_id: str
    display_name: str | None = None
    archived: bool | None = None
    pinned: bool | None = None
    deleted: bool | None = None
    previous_id: str | None = None
    message: str | None = None


class ConceptSearchHit(BaseModel):
    topic_id: str
    topic_display_name: str
    concept_name: str


class ConceptSearchResponse(BaseModel):
    query: str
    hits: list[ConceptSearchHit]


class TopicCatalogResponse(BaseModel):
    user_id: str
    topics: list[TopicCatalogItem]


class GenerateTopicRequest(BaseModel):
    """Body for POST /topics/generate."""

    goal: str = Field(..., min_length=3, max_length=500)
    force: bool = Field(default=False, description="Overwrite existing topic YAML")


class ImportTopicRequest(BaseModel):
    """Body for POST /topics/import (raw YAML text)."""

    yaml_text: str = Field(..., min_length=10)
    force: bool = False


class TopicCreatedResponse(BaseModel):
    topic_id: str
    display_name: str
    concept_count: int
    path: str


class TopicSummaryItem(BaseModel):
    topic_id: str
    display_name: str
    concept_count: int
    mastered_count: int
    avg_score_1_to_5: float
    due_count: int
    started: bool


class TopicSummaryResponse(BaseModel):
    user_id: str
    topics: list[TopicSummaryItem]


class StartBaselineRequest(BaseModel):
    user_id: str = Field(default="default")
    topic: str = Field(..., min_length=1)


class BaselineAnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1, max_length=2000)


class TurnItem(BaseModel):
    """One turn for session transcript UI."""

    turn_idx: int
    role: str
    content: str
    evaluator_score: int | None = None
    evaluator_gaps: list[str] = Field(default_factory=list)
    evaluator_reasoning: str | None = None
    evaluator_gap_type: str | None = None
    evaluator_expert_framing: str | None = None


# Re-export for OpenAPI
__all__ = [
    "StartSessionRequest",
    "SubmitTurnRequest",
    "TopicCatalogItem",
    "TopicCatalogResponse",
    "GenerateTopicRequest",
    "ImportTopicRequest",
    "TopicCreatedResponse",
    "TopicSummaryItem",
    "TopicSummaryResponse",
    "StartBaselineRequest",
    "BaselineAnswerRequest",
    "BaselineView",
    "TopicGraph",
    "GraphNode",
    "MasteryItem",
    "MasteryResponse",
    "DueItem",
    "DueResponse",
    "TurnItem",
    "SessionView",
    "EvaluationView",
    "SessionReport",
    "ConceptReportRow",
]
