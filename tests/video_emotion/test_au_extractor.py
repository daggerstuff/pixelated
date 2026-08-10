"""Tests for video_emotion.au_extractor — mock AU score extraction."""

from src.video_emotion.au_extractor import extract_au_scores
from src.video_emotion.types import AUFrame


def test_mock_au_scores():
    """Mock AU extractor populates au_scores dict with expected AUs."""
    result = extract_au_scores(AUFrame(timestamp_ms=100), use_real_openface=False)
    assert 12 in result.au_scores  # AU12 (smile)
    assert len(result.au_scores) == 17  # all 17 AUs


def test_mock_au_score_range():
    """Mock AU scores are within [0.0, 1.0]."""
    result = extract_au_scores(AUFrame(timestamp_ms=0), use_real_openface=False)
    for au, score in result.au_scores.items():
        assert 0.0 <= score <= 1.0, f"AU{au} score {score} out of range"


def test_real_openface_raises():
    """Real OpenFace raises NotImplementedError in prototype."""
    import pytest

    with pytest.raises(NotImplementedError):
        extract_au_scores(AUFrame(timestamp_ms=0), use_real_openface=True)


def test_au_scores_deterministic_with_seed():
    """AU scores are reproducible when random seed is set."""
    import random

    random.seed(42)
    result1 = extract_au_scores(AUFrame(timestamp_ms=0), use_real_openface=False)
    random.seed(42)
    result2 = extract_au_scores(AUFrame(timestamp_ms=0), use_real_openface=False)
    assert result1.au_scores == result2.au_scores
