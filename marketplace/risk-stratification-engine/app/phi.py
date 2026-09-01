"""PHI redaction helpers for safe logging in the risk stratification service.

These functions sanitize patient-identifiable information before writing
to logs or audit trails. They follow the same pattern as the note_drafting
service's phi module.
"""

from __future__ import annotations

import hashlib
import re


def redact_patient_id(patient_id: str) -> str:
    """Redact a patient ID to a short, non-reversible token.

    Args:
        patient_id: The raw patient identifier.

    Returns:
        A redacted identifier like ``pid:a1b2c3``.
    """
    digest = hashlib.sha256(patient_id.encode("utf-8")).hexdigest()
    return f"pid:{digest[:6]}"


def redact_session_id(session_id: str) -> str:
    """Redact a session ID to a short, non-reversible token.

    Args:
        session_id: The raw session identifier.

    Returns:
        A redacted identifier like ``sid:a1b2c3``.
    """
    digest = hashlib.sha256(session_id.encode("utf-8")).hexdigest()
    return f"sid:{digest[:6]}"


# Patterns for PII in free-text
_PHONE_RE = re.compile(
    r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b"
)
_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
)
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_DATE_RE = re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b")
_MRN_RE = re.compile(r"\bMRN[-:s]?\d+\b", re.IGNORECASE)
_ADDRESS_RE = re.compile(
    r"\b\d+\s+[A-Za-z0-9\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Court|Ct|Place|Pl)\b",
    re.IGNORECASE,
)


def sanitize_for_logging(text: str) -> str:
    """Remove PII from free text before logging.

    Redacts phone numbers, emails, SSNs, dates, MRNs, and addresses.

    Args:
        text: Free text that may contain PII.

    Returns:
        Sanitized text with PII replaced by ``[REDACTED]``.
    """
    sanitized = text
    sanitized = _PHONE_RE.sub("[REDACTED]", sanitized)
    sanitized = _EMAIL_RE.sub("[REDACTED]", sanitized)
    sanitized = _SSN_RE.sub("[REDACTED]", sanitized)
    sanitized = _DATE_RE.sub("[REDACTED]", sanitized)
    sanitized = _MRN_RE.sub("[REDACTED]", sanitized)
    return _ADDRESS_RE.sub("[REDACTED]", sanitized)
