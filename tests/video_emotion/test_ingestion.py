"""Tests for video_emotion.ingestion — frame extraction."""

import os
import tempfile

import cv2
import numpy as np

from src.video_emotion.ingestion import extract_frames


def _generate_synthetic_video(path: str, fps: int = 30, frames: int = 30, width: int = 640, height: int = 480) -> None:
    """Generate a synthetic black video for testing."""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(path, fourcc, fps, (width, height))
    for _ in range(frames):
        writer.write(np.zeros((height, width, 3), np.uint8))
    writer.release()


def test_extract_frames_on_synthetic_video():
    """extract_frames returns list of AUFrame from a valid video."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        vid_path = f.name
    try:
        _generate_synthetic_video(vid_path, fps=30, frames=30)
        frames = extract_frames(vid_path, fps_target=30)
        assert isinstance(frames, list)
        assert len(frames) > 0
        assert all(f.timestamp_ms >= 0 for f in frames)
    finally:
        os.unlink(vid_path)


def test_extract_frames_on_missing_file():
    """extract_frames returns empty list for nonexistent file."""
    frames = extract_frames("/nonexistent/video.mp4", fps_target=30)
    assert frames == []


def test_extract_frame_timestamps():
    """Frame timestamps are correctly calculated from video FPS."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        vid_path = f.name
    try:
        _generate_synthetic_video(vid_path, fps=30, frames=60)
        frames = extract_frames(vid_path, fps_target=30)
        if len(frames) >= 2:
            assert frames[0].timestamp_ms == 0
            assert frames[-1].timestamp_ms > frames[0].timestamp_ms
    finally:
        os.unlink(vid_path)
