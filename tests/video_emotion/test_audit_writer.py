"""Audit writer test — no PII verification."""

import json
import tempfile

from src.video_emotion.audit_writer import write_audit
from src.video_emotion.types import EmotionEvent


def test_no_pii_and_has_timestamp():
    events = [EmotionEvent(start_ms=0, end_ms=500, au_combo="AU4+AU15", deception_flag=False, score=0.6)]
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    write_audit(path, events=events)
    with open(path) as f:
        data = json.load(f)
    assert data.get("audit_timestamp") is not None
    # PII exclusion check
    assert "patient_id" not in str(data)
    assert "name" not in str(data)
    # Raw text exclusion (transcript/raw excluded by spec)
    content = json.dumps(data)
    assert "transcript" not in content.lower() or "transcript" in content.lower() == False
