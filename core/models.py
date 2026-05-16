"""Pydantic models shared across Quest chains and persistence."""

from __future__ import annotations

from pydantic import BaseModel, Field

CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD = 0.7


class EvaluatorOutput(BaseModel):
    """Structured output from the understanding evaluator (Haiku).

    The tutor chain never receives this object — it is a separate LLM call.
    """

    score: int = Field(
        ...,
        ge=1,
        le=5,
        description="Understanding score for the student's answer",
    )
    gaps: list[str] = Field(
        default_factory=list,
        description="Specific gaps revealed by the answer",
    )
    reasoning: str = Field(
        ...,
        description="One-sentence justification for the score",
    )
    inferred_concept_id: str | None = Field(
        None,
        description="Namespaced concept id from the provided list, or null",
    )
    inferred_concept_confidence: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Confidence in concept inference; use <0.7 to skip concept mastery",
    )

    def normalized_score(self) -> float:
        """Map the 1–5 rubric score to [0, 1] for mastery running average."""
        return self.score / 5.0
