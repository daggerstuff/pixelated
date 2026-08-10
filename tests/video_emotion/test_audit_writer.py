"""Tests for audit writer — no-PII JSON output."""

import json
import tempfile

from src.video_emotion.audit_writer import write_audit
from src.video_emotion.types import EmotionEvent


def test_audit_has_no_pii():
    """Audit JSON must not contain patient_id, name, or email."""
    events = [
        EmotionEvent(
            start_ms=0,
            end_ms=500,
            au_combo="AU4+AU15",
            deception_flag=False,
            score=0.6,
        )
    ]
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    write_audit(path, events=events)
    with open(path) as f:
        data = json.load(f)
    assert "patient_id" not in str(data)
    assert "name" not in str(data)
    assert "email" not in str(data)


def test_audit_has_timestamp():
    """Audit JSON must contain audit_timestamp."""
    events = [
        EmotionEvent(
            start_ms=0,
            end_ms=400,
            au_combo="AU12+AU6-",
            deception_flag=True,
            score=0.9,
        )
    ]
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    write_audit(path, events=events)
    with open(path) as f:
        data = json.load(f)
    assert data.get("audit_timestamp") is not None


def test_audit_has_deception_events():
    """Audit JSON contains serialized deception events."""
    events = [
        EmotionEvent(
            start_ms=0,
            end_ms=500,
            au_combo="AU12+AU6-",
            deception_flag=True,
            score=0.85,
        ),
        EmotionEvent(
            start_ms=1000,
            end_ms=1500,
            au_combo="AU4+AU15",
            deception_flag=False,
            score=0.5,
        ),
    ]
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    write_audit(path, events=events)
    with open(path) as f:
        data = json.load(f)
    assert len(data["deception_events"]) == 2
    assert data["deception_events"][0]["au_combo"] == "AU12+AU6-"


def test_audit_has_clinical_notes():
    """Audit JSON contains clinical notes placeholder."""
    events = []
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    write_audit(path, events=events)
    with open(path) as f:
        data = json.load(f)
    assert "clinical_notes" in data
    assert "de-identified" in data["clinical_notes"].lower()
