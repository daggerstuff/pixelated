"""Minimal deception layer test."""

from src.video_emotion.deception_layer import enrich_deception_score
from src.video_emotion.types import EmotionEvent


def test_score_in_range():
    event = EmotionEvent(start_ms=0, end_ms=500, au_combo="AU12+AU6-", deception_flag=True, score=0.8)
    enriched = enrich_deception_score(event)
    assert 0.0 <= enriched.score <= 1.0
