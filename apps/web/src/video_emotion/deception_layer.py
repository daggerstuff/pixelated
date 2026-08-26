"""Deception enrichment layer — cross-modal misalignment placeholder."""

from __future__ import annotations

from .types import EmotionEvent


def enrich_deception_score(event: EmotionEvent) -> EmotionEvent:
    """Enrich deception score with cross-modal misalignment signal.

    Future: fuse audio prosody, transcript sentiment, and facial AU streams.
    Prototype: pass-through — no amplification without cross-modal confirmation.
    Amplifying on deception_flag alone would inflate scores from a single modality.
    """
    # Minimal enrichment: slight score adjustment; no suppression.
    event.score = min(1.0, max(0.0, event.score * 1.05))
    return event
