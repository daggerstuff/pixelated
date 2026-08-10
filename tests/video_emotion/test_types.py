"""Tests for video_emotion.types — AUFrame and EmotionEvent pydantic models."""

from src.video_emotion.types import AUFrame, EmotionEvent


def test_au_frame_parses():
    """AUFrame accepts timestamp, au_scores dict, and face bbox."""
    frame = AUFrame(timestamp_ms=150, au_scores={12: 0.85}, face_bbox=(10, 20, 100, 120))
    assert frame.au_scores[12] == 0.85
    assert frame.face_bbox == (10, 20, 100, 120)


def test_au_frame_defaults():
    """AUFrame fills defaults for optional fields."""
    frame = AUFrame(timestamp_ms=0)
    assert frame.au_scores == {}
    assert frame.face_bbox == (0, 0, 0, 0)


def test_emotion_event_parses():
    """EmotionEvent accepts all fields including deception flag and score."""
    event = EmotionEvent(
        start_ms=0,
        end_ms=500,
        au_combo="AU12+AU6-",
        deception_flag=True,
        score=0.8,
    )
    assert event.deception_flag is True
    assert event.score == 0.8


def test_emotion_event_score_bounds():
    """EmotionEvent score must be in [0.0, 1.0]."""
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        EmotionEvent(start_ms=0, end_ms=100, au_combo="test", score=1.5)
    with pytest.raises(ValidationError):
        EmotionEvent(start_ms=0, end_ms=100, au_combo="test", score=-0.1)
