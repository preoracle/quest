"""Request/response models for the Quest REST API."""

from __future__ import annotations

from pydantic import BaseModel, Field

from core.session_api import EvaluationView, SessionView


class StartSessionRequest(BaseModel):
    """Body for POST /sessions."""

    user_id: str = Field(default="default", min_length=1)
    topic: str = Field(..., min_length=1, description="Topic id, e.g. closures_in_javascript")
    resume: bool = Field(
        default=True,
        description="Reuse open session for this user+topic if one exists",
    )


class SubmitTurnRequest(BaseModel):
    """Body for POST /sessions/{session_id}/turn."""

    answer: str = Field(..., min_length=1)


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


# Re-export for OpenAPI
__all__ = [
    "StartSessionRequest",
    "SubmitTurnRequest",
    "MasteryItem",
    "MasteryResponse",
    "SessionView",
    "EvaluationView",
]
