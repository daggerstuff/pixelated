"""Pydantic models for video emotion pipeline."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AUFrame(BaseModel):
    """Single video frame with Action Unit scores and face bounding box."""

    timestamp_ms: int = Field(..., ge=0)
    au_scores: dict[int, float] = Field(default_factory=dict)
    face_bbox: tuple[int, int, int, int] = Field(default_factory=lambda: (0, 0, 0, 0))


class EmotionEvent(BaseModel):
    """Detected emotional event from temporal AU analysis."""

    start_ms: int
    end_ms: int
    au_combo: str
    deception_flag: bool = False
    score: float = Field(..., ge=0.0, le=1.0)
