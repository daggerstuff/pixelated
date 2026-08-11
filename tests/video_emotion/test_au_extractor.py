"""Tests for video_emotion.au_extractor — mock AU + not-implemented real."""

from src.video_emotion.au_extractor import extract_au_scores
from src.video_emotion.types import AUFrame


def test_mock_au_scores_has_seventeen_aus():
    frame = AUFrame(timestamp_ms=100)
    result = extract_au_scores(frame, use_real_openface=False)
    assert len(result.au_scores) == 17
    assert 1 in result.au_scores
    assert 12 in result.au_scores


def test_real_openface_raises():
    frame = AUFrame(timestamp_ms=100)
    try:
        extract_au_scores(frame, use_real_openface=True)
        assert False, "Should raise NotImplementedError"
    except NotImplementedError:
        pass
