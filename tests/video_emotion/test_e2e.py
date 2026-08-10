"""End-to-end integration test for video emotion pipeline."""

import json
import os
import tempfile

import cv2
import numpy as np

from scripts.run_video_emotion_prototype import run_pipeline


def _generate_synthetic_video(path: str, fps: int = 30, frames: int = 30, width: int = 640, height: int = 480) -> None:
    """Generate a synthetic black video for testing."""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(path, fourcc, fps, (width, height))
    for _ in range(frames):
        writer.write(np.zeros((height, width, 3), np.uint8))
    writer.release()


def test_e2e_produces_audit():
    """Pipeline produces audit JSON with required fields."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as vid:
        vid_path = vid.name
    audit_path = vid_path.replace(".mp4", "_audit.json")
    try:
        _generate_synthetic_video(vid_path, fps=30, frames=30)
        run_pipeline(vid_path, audit_path)
        assert os.path.exists(audit_path)
        with open(audit_path) as f:
            data = json.load(f)
        assert "audit_timestamp" in data
        assert "deception_events" in data
        assert "clinical_notes" in data
    finally:
        for p in (vid_path, audit_path):
            if os.path.exists(p):
                os.unlink(p)


def test_e2e_no_pii_in_audit():
    """Audit JSON contains no PII fields."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as vid:
        vid_path = vid.name
    audit_path = vid_path.replace(".mp4", "_audit.json")
    try:
        _generate_synthetic_video(vid_path, fps=30, frames=30)
        run_pipeline(vid_path, audit_path)
        with open(audit_path) as f:
            raw = f.read()
        for pii_field in ("patient_id", "patient_name", "email", "ssn", "phone"):
            assert pii_field not in raw.lower(), f"PII field '{pii_field}' found in audit"
    finally:
        for p in (vid_path, audit_path):
            if os.path.exists(p):
                os.unlink(p)


def test_e2e_missing_video_still_writes_audit():
    """Pipeline writes audit even for missing video (empty events)."""
    audit_path = tempfile.mktemp(suffix="_audit.json")
    try:
        run_pipeline("/nonexistent/video.mp4", audit_path)
        assert os.path.exists(audit_path)
        with open(audit_path) as f:
            data = json.load(f)
        assert data["deception_events"] == []
    finally:
        if os.path.exists(audit_path):
            os.unlink(audit_path)
