"""Audit writer — no-PII JSON output for clinical review trail."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from .types import EmotionEvent


def write_audit(output_path: str, events: list[EmotionEvent]) -> None:
    """Write audit-trail JSON with deception events and clinical notes.

    Output contains no PII — no patient_id, name, or email fields.
    """
    payload = {
        "audit_timestamp": datetime.now(timezone.utc).isoformat(),
        "deception_events": [e.model_dump() for e in events],
        "clinical_notes": "Synthetic/de-identified prototype output — clinician review required.",
    }
    with open(output_path, "w") as f:
        json.dump(payload, f, indent=2)
