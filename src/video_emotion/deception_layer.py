"""Deception enrichment layer — cross-modal misalignment placeholder."""

from __future__ import annotations

from .types import EmotionEvent


def enrich_deception_score(event: EmotionEvent) -> EmotionEvent:
    """Enrich deception score with cross-modal misalignment signal.

    Future: fuse audio prosody, transcript sentiment, and facial AU streams.
    Prototype: minimal boost on flagged events, clamp to [0, 1].
    """
    if event.deception_flag:
        event.score = min(1.0, event.score * 1.1)
    return event
