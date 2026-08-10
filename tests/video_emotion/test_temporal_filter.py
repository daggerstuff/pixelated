"""Tests for temporal filter microexpression detection."""

from src.video_emotion.temporal_filter import detect_events
from src.video_emotion.types import AUFrame


def test_forced_smile_detection():
    """High AU12 + zero AU6 → forced smile with deception flag."""
    frames = [
        AUFrame(timestamp_ms=0, au_scores={12: 0.95, 6: 0.0}),
        AUFrame(timestamp_ms=400, au_scores={12: 0.95, 6: 0.0}),
    ]
    events = detect_events(frames)
    assert len(events) >= 1
    assert any(e.deception_flag for e in events)
    assert events[0].au_combo == "AU12+AU6-"


def test_hurt_expression_detection():
    """AU4 + AU15 combo → hurt expression, no deception flag."""
    frames = [
        AUFrame(timestamp_ms=0, au_scores={4: 0.7, 15: 0.6, 12: 0.1, 6: 0.5}),
        AUFrame(timestamp_ms=300, au_scores={4: 0.7, 15: 0.6, 12: 0.1, 6: 0.5}),
    ]
    events = detect_events(frames)
    assert any(e.au_combo == "AU4+AU15" for e in events)
    assert not any(e.deception_flag for e in events)


def test_no_event_for_neutral_frames():
    """Low AU scores → no events detected."""
    frames = [
        AUFrame(timestamp_ms=0, au_scores={12: 0.3, 6: 0.5, 4: 0.1, 15: 0.1}),
        AUFrame(timestamp_ms=400, au_scores={12: 0.3, 6: 0.5, 4: 0.1, 15: 0.1}),
    ]
    events = detect_events(frames)
    assert len(events) == 0


def test_window_filter_excludes_long_gaps():
    """Frames >500ms apart → no event (exceeds microexpression window)."""
    frames = [
        AUFrame(timestamp_ms=0, au_scores={12: 0.95, 6: 0.0}),
        AUFrame(timestamp_ms=800, au_scores={12: 0.95, 6: 0.0}),
    ]
    events = detect_events(frames, window_ms=500)
    assert len(events) == 0


def test_empty_frames_returns_empty():
    """Empty or single frame → no events."""
    assert detect_events([]) == []
    assert detect_events([AUFrame(timestamp_ms=0, au_scores={})]) == []
