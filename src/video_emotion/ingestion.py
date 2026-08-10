"""Video ingestion — frame extraction at target FPS using OpenCV."""

from __future__ import annotations

import cv2

from .types import AUFrame


def extract_frames(video_path: str, fps_target: int = 30) -> list[AUFrame]:
    """Extract frames from video at target FPS.

    Returns list of AUFrame with timestamp_ms only (no AU scores yet).
    Returns empty list if video cannot be opened or fps_target is invalid.
    """
    if fps_target <= 0:
        return []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    original_fps = cap.get(cv2.CAP_PROP_FPS)
    interval = max(1, int(original_fps / fps_target)) if original_fps > 0 else 1

    frames: list[AUFrame] = []
    frame_idx = 0
    while True:
        ret, _frame = cap.read()
        if not ret:
            break
        if frame_idx % interval == 0:
            ts_ms = int((frame_idx / original_fps) * 1000) if original_fps > 0 else 0
            frames.append(AUFrame(timestamp_ms=ts_ms))
        frame_idx += 1

    cap.release()
    return frames
