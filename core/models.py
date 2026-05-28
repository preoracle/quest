"""Pydantic models shared across Quest chains and persistence."""

from __future__ import annotations

import ast
import json
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

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
        description="3–4 sentence structured feedback shown directly to the student",
    )
    gap_type: Literal[
        "none",
        "linguistic_imprecision",
        "missing_mechanism",
        "missing_abstraction",
        "wrong_model",
    ] = Field(
        default="none",
        description=(
            "Primary reason the answer is below 5: "
            "'none' if score=5; "
            "'linguistic_imprecision' if mechanism is right but vocabulary is informal; "
            "'missing_mechanism' if factors named but causal chain absent; "
            "'missing_abstraction' if chain traced but formal framework/term missing; "
            "'wrong_model' if the causal reasoning itself is incorrect"
        ),
    )
    expert_framing: str | None = Field(
        default=None,
        description=(
            "1–2 sentences describing what a score-5 answer would contain, "
            "shown to the student when score < 5. "
            "Must start with 'A complete answer would...' and name the specific mechanism or term."
        ),
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

    @model_validator(mode="after")
    def normalize_eval_consistency(self) -> "EvaluatorOutput":
        """Enforce internal consistency for downstream tutor and UI logic.

        Some providers occasionally emit contradictory combinations
        (e.g. score < 5 with gap_type='none', or score < 5 without expert framing).
        Normalizing here prevents brittle behavior in the follow-up question flow.
        """
        if self.score >= 5:
            self.gap_type = "none"
            self.expert_framing = None
            return self

        if self.gap_type == "none":
            # Sensible fallback when model omits/contradicts gap type.
            self.gap_type = "missing_mechanism" if self.score <= 3 else "missing_abstraction"

        if not (self.expert_framing or "").strip():
            self.expert_framing = (
                "A complete answer would state the precise causal mechanism and formal term, "
                "then apply it directly to this specific scenario."
            )
        return self

    def normalized_score(self) -> float:
        """Map the 1–5 rubric score to [0, 1] for mastery running average."""
        return self.score / 5.0
