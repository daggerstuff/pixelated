"""Provenance and privacy release gates for the fresh training corpus builder."""

from __future__ import annotations

import re

from .model import CorpusEntry, CorpusSource

_PII_PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    "phone": re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
}


def _source_gate_issues(source: CorpusSource) -> list[str]:
    issues: list[str] = []
    registry_path = source.provenance.get("registry_path")
    if not isinstance(registry_path, str) or not registry_path.startswith("s3://"):
        issues.append("missing_registry_path")
    if source.rights_status in {"unknown", "restricted"}:
        issues.append(f"rights_status:{source.rights_status}")
    return issues


def _entry_privacy_hits(entry: CorpusEntry) -> list[str]:
    text = f"{entry.prompt}\n{entry.response}"
    hits: list[str] = []
    for label, pattern in _PII_PATTERNS.items():
        if pattern.search(text):
            hits.append(label)
    return hits


def build_governance_report(
    sources: tuple[CorpusSource, ...],
    entries: tuple[CorpusEntry, ...],
) -> dict[str, object]:
    source_issues = []
    for source in sources:
        issues = _source_gate_issues(source)
        if issues:
            source_issues.append({"source_id": source.source_id, "issues": issues})

    privacy_issues = []
    for entry in entries:
        hits = _entry_privacy_hits(entry)
        if hits:
            privacy_issues.append(
                {
                    "entry_id": entry.entry_id,
                    "source_id": entry.source_id,
                    "matches": hits,
                }
            )

    blocking_issue_count = len(source_issues) + len(privacy_issues)
    return {
        "source_issue_count": len(source_issues),
        "privacy_issue_count": len(privacy_issues),
        "blocking_issue_count": blocking_issue_count,
        "passed": blocking_issue_count == 0,
        "source_issues": source_issues,
        "privacy_issues": privacy_issues,
    }
