"""Pydantic models shared across Quest chains and persistence."""

from __future__ import annotations

import ast
import json

from pydantic import BaseModel, Field, field_validator

CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD = 0.7


class EvaluatorOutput(BaseModel):
    """Structured output from the understanding evaluator.

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

    @field_validator("gaps", mode="before")
    @classmethod
    def coerce_gaps_to_list(cls, v: object) -> list[str]:
        """Normalise gaps to list[str].

        Some models (e.g. Cerebras Qwen3) return the tool-call argument as a
        Python-repr string ``"['gap one', 'gap two']"`` rather than a proper
        JSON array.  This validator handles that gracefully so a single model
        quirk doesn't crash a live session.
        """
        if isinstance(v, list):
            # Guard against models that wrap the whole list as one string element:
            # e.g. ["['gap1', 'gap2']"] instead of ["gap1", "gap2"]
            if len(v) == 1 and isinstance(v[0], str):
                inner = v[0].strip()
                if inner.startswith("["):
                    try:
                        parsed = json.loads(inner)
                        if isinstance(parsed, list):
                            return [str(i) for i in parsed]
                    except (json.JSONDecodeError, ValueError):
                        pass
                    try:
                        parsed = ast.literal_eval(inner)
                        if isinstance(parsed, list):
                            return [str(i) for i in parsed]
                    except (ValueError, SyntaxError):
                        pass
            return [str(item) for item in v]
        if not v:
            return []
        if isinstance(v, str):
            s = v.strip()
            # Try JSON first (most standards-compliant path)
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    return [str(i) for i in parsed]
            except (json.JSONDecodeError, ValueError):
                pass
            # Fall back to Python literal_eval for repr-style strings
            try:
                parsed = ast.literal_eval(s)
                if isinstance(parsed, list):
                    return [str(i) for i in parsed]
                if isinstance(parsed, (str, tuple)):
                    return [str(i) for i in (parsed if isinstance(parsed, tuple) else [parsed])]
            except (ValueError, SyntaxError):
                pass
            # Last resort: treat the whole string as a single gap
            return [s] if s else []
        return []
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
