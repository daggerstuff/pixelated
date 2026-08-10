"""Tests for deception enrichment layer."""

from src.video_emotion.deception_layer import enrich_deception_score
from src.video_emotion.types import EmotionEvent


def test_deception_score_range():
    """Enriched score stays within [0, 1]."""
    event = EmotionEvent(
        start_ms=0,
        end_ms=500,
        au_combo="AU12+AU6-",
        deception_flag=True,
        score=0.8,
    )
    enriched = enrich_deception_score(event)
    assert 0.0 <= enriched.score <= 1.0


def test_deception_flag_boosts_score():
    """Flagged events get score boosted."""
    event = EmotionEvent(
        start_ms=0,
        end_ms=400,
        au_combo="AU12+AU6-",
        deception_flag=True,
        score=0.7,
    )
    enriched = enrich_deception_score(event)
    assert enriched.score > 0.7


def test_non_deception_unchanged():
    """Non-deception events pass through unchanged."""
    event = EmotionEvent(
        start_ms=0,
        end_ms=300,
        au_combo="AU4+AU15",
        deception_flag=False,
        score=0.6,
    )
    enriched = enrich_deception_score(event)
    assert enriched.score == 0.6


def test_score_clamped_to_one():
    """Score near 1.0 stays clamped after boost."""
    event = EmotionEvent(
        start_ms=0,
        end_ms=400,
        au_combo="AU12+AU6-",
        deception_flag=True,
        score=0.95,
    )
    enriched = enrich_deception_score(event)
    assert enriched.score <= 1.0
