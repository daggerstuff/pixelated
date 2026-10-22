"""An audit link must resolve and remain bound to the evidence it reviewed."""

import hashlib
import json

import pytest

from scripts.training import summarize_v6_policy_resolution as report


@pytest.fixture
def audit_workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(report, "ROOT", tmp_path)
    monkeypatch.setattr(report, "DOCS", tmp_path / "docs")
    monkeypatch.setattr(report, "DIRECTORY", tmp_path / "docs/policy-resolution-v1")
    path = report.DIRECTORY / "bounded-support-v18/agent-evidence-audit.json"
    path.parent.mkdir(parents=True)
    (tmp_path / "raw.jsonl").write_text("original evidence\n")
    audit = {
        "candidate": "bounded-support-v18",
        "evidence_sha256": {"raw.jsonl": hashlib.sha256((tmp_path / "raw.jsonl").read_bytes()).hexdigest()},
    }
    return path, audit


def test_missing_audit_does_not_publish_a_dangling_link(audit_workspace):
    path, _ = audit_workspace
    assert not path.exists()
    assert report.agent_audit_details("v18") == {
        "current": None,
        "status": "missing",
        "qualified_external_review": False,
    }


def test_audit_is_hash_bound_without_authorizing_clinical_review(audit_workspace):
    path, audit = audit_workspace
    path.write_text(json.dumps(audit))
    result = report.agent_audit_details("v18")
    assert result["current"] == "policy-resolution-v1/bounded-support-v18/agent-evidence-audit.json"
    assert result["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert result["qualified_external_review"] is False


@pytest.mark.parametrize("corruption", ["candidate", "empty", "changed", "deleted"])
def test_foreign_or_stale_audit_cannot_be_published(audit_workspace, corruption):
    path, audit = audit_workspace
    if corruption == "candidate":
        audit["candidate"] = "bounded-support-v17"
    elif corruption == "empty":
        audit["evidence_sha256"] = {}
    elif corruption == "changed":
        (report.ROOT / "raw.jsonl").write_text("altered evidence\n")
    else:
        (report.ROOT / "raw.jsonl").unlink()
    path.write_text(json.dumps(audit))
    with pytest.raises((ValueError, FileNotFoundError)):
        report.agent_audit_details("v18")
