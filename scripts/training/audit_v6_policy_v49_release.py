"""Verify frozen v49 responses, reviewer provenance, and packet integrity."""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

from ai.training.cliche_gate import is_sycophantic
from ai.training.contextual_support_policy import explicit_completion_issue
from ai.training.support_task_review import explicit_format_issue
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs/training/execution-2026-10-21"
V48 = DIRECTORY / "bounded-support-v48"
V49 = DIRECTORY / "bounded-support-v49"
V48_REVIEW = V48 / "qualified-review-v48"
V49_REVIEW = V49 / "qualified-review-v49"
ARCHIVE = Path.home() / "Paige_Taylor_v48_completed_assessment.zip"
NOTES = Path.home() / "v48_review_improvement_notes.md"
PACKET = V49 / "Paige-Taylor-v49-blinded-review.zip"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit_outputs() -> tuple[int, str]:
    cases = rows(V49 / "cases.jsonl")
    results = rows(OUTPUT / "bounded-v49/results.jsonl")
    if len(cases) != 56 or len(results) != 112:
        raise ValueError("v49 release does not contain 56 cases and 112 paired outputs")
    case_by_id = {case["id"]: case for case in cases}
    keyed = {(row["case_id"], row["arm_id"]): row for row in results}
    if len(case_by_id) != 56 or len(keyed) != 112:
        raise ValueError("v49 release has duplicate case or response identities")
    if any(row.get("status") != "success" for row in results):
        raise ValueError("v49 release contains a failed response")
    task_failures, format_failures, style_failures = [], [], []
    for row in results:
        messages = case_by_id[row["case_id"]]["messages"]
        response = row["response"]
        task_issue = explicit_completion_issue(messages, response)
        format_issue = explicit_format_issue(messages, response)
        rejected, reason = is_sycophantic(response)
        if task_issue:
            task_failures.append({"case_id": row["case_id"], "arm_id": row["arm_id"], "issue": task_issue})
        if format_issue:
            format_failures.append({"case_id": row["case_id"], "arm_id": row["arm_id"], "issue": format_issue})
        if rejected:
            style_failures.append({"case_id": row["case_id"], "arm_id": row["arm_id"], "issue": reason})
    if task_failures or format_failures or style_failures:
        raise ValueError(
            f"v49 release guard failure: task={task_failures}, format={format_failures}, style={style_failures}"
        )

    return len(results), digest(OUTPUT / "bounded-v49/results.jsonl")


def audit_source_files() -> tuple[Path, str, str]:
    assessment = json.loads((V48_REVIEW / "review-results-v48.json").read_text())
    if assessment.get("responses_rated") != 112 or assessment.get("ratings_preserved_unchanged") is not True:
        raise ValueError("v48 assessment evidence validation or source preservation is incomplete")
    archive_digest = digest(ARCHIVE)
    notes_digest = digest(NOTES)
    if archive_digest != assessment.get("source_archive_sha256"):
        raise ValueError("user-supplied v48 assessment archive hash changed")
    if notes_digest != digest(V48_REVIEW / "99-REVIEW-NOTES.md"):
        raise ValueError("user-supplied v48 review notes differ from the preserved copy")
    assessment_bytes = V48_REVIEW / "assessment-v48-submitted.json"
    with zipfile.ZipFile(ARCHIVE) as source_zip:
        if source_zip.read("Paige_Taylor_v48_completed_assessment.json") != assessment_bytes.read_bytes():
            raise ValueError("preserved v48 assessment bytes differ from the supplied archive")
        if source_zip.read("99-REVIEW-NOTES.md") != (V48_REVIEW / "99-REVIEW-NOTES.md").read_bytes():
            raise ValueError("preserved v48 notes bytes differ from the supplied archive")
    return assessment_bytes, archive_digest, notes_digest


def audit_packet() -> str:
    manifest = json.loads((V49_REVIEW / "manifest.json").read_text())
    with zipfile.ZipFile(PACKET) as packet_zip:
        names = set(packet_zip.namelist())
        if "sealed-mapping.jsonl" in names:
            raise ValueError("sealed candidate mapping appears in Paige's packet")
        if len(names) != 5 or "manifest.json" not in names:
            raise ValueError("v49 review packet has missing or unexpected files")
        packet_data = packet_zip.read("blinded-packets.jsonl")
        if hashlib.sha256(packet_data).hexdigest() != manifest["blinded_packet_sha256"]:
            raise ValueError("v49 blinded packet hash does not match its manifest")
        for name, field in (
            ("review-form-template.json", "review_form_sha256"),
            ("review-rubric.json", "rubric_sha256"),
            ("README.md", "readme_sha256"),
        ):
            if hashlib.sha256(packet_zip.read(name)).hexdigest() != manifest[field]:
                raise ValueError(f"v49 packet member hash mismatch: {name}")
    return digest(PACKET)


def audit() -> dict:
    response_count, result_hash = audit_outputs()
    assessment_path, archive_hash, notes_hash = audit_source_files()
    packet_hash = audit_packet()
    record = {
        "candidate": "bounded-support-v49",
        "passed": True,
        "case_count": 56,
        "response_count": response_count,
        "explicit_task_guard_failures": 0,
        "explicit_format_guard_failures": 0,
        "shared_style_gate_failures": 0,
        "validated_v48_ratings": 112,
        "v48_review_validity": "user-confirmed verified and valid",
        "source_archive_sha256": archive_hash,
        "source_assessment_sha256": digest(assessment_path),
        "source_notes_sha256": notes_hash,
        "v49_result_sha256": result_hash,
        "runtime_policy_source_sha256": digest(ROOT / "ai/training/contextual_support_policy.py"),
        "v49_packet_sha256": packet_hash,
        "sealed_mapping_in_packet": False,
        "reviewer_identity_qualification_independence": "user-confirmed Paige Taylor, LPCC-S",
        "submitted_ratings_changed": False,
        "fresh_model_inference": False,
        "clinical_validation": False,
        "deployment_authorized": False,
    }
    write(V49 / "comprehensive-release-audit.json", record)
    return record


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2))
