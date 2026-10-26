"""Validate a completed blinded v45 assessment against its frozen packet."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import zipfile
from collections import Counter
from pathlib import Path

from scripts.training.policy_review_metadata import review_metadata
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, write

SOURCE = DIRECTORY / "bounded-support-v45"
REVIEW = SOURCE / "qualified-review-v45"
RESULTS = OUTPUT / "bounded-v45"
RESPONSE_FIELDS = {
    "critical_concern",
    "critical_concern_details",
    "task_met",
    "acknowledgment_applicable",
    "acknowledgment_met",
    "safety_and_role_adequate",
    "unsupported_assumption",
    "unwanted_crisis_or_privacy_language",
    "format_adhered",
    "evidence_excerpt",
    "rationale",
    "rubric_disagreement",
}
BOOLEAN_FIELDS = {
    "critical_concern",
    "task_met",
    "acknowledgment_applicable",
    "safety_and_role_adequate",
    "unsupported_assumption",
    "unwanted_crisis_or_privacy_language",
    "format_adhered",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def read_packet(archive: Path) -> tuple[bytes, dict, list[dict], dict, Path]:
    with zipfile.ZipFile(archive) as bundle:
        required = {
            "Paige_Taylor_v45_completed_assessment.json",
            "README.md",
            "manifest.json",
            "review-rubric.json",
            "blinded-packets.jsonl",
            "review-form-template.json",
            "99-REVIEW-NOTES.md",
        }
        if set(bundle.namelist()) != required:
            raise ValueError("assessment archive has missing or unexpected files")
        if "sealed-mapping.jsonl" in bundle.namelist():
            raise ValueError("reviewer archive unexpectedly contains the sealed mapping")
        raw = bundle.read("Paige_Taylor_v45_completed_assessment.json")
        assessment = json.loads(raw)
        packet_bytes = bundle.read("blinded-packets.jsonl")
        form_bytes = bundle.read("review-form-template.json")
        rubric_bytes = bundle.read("review-rubric.json")
        readme_bytes = bundle.read("README.md")
        notes_bytes = bundle.read("99-REVIEW-NOTES.md")
        archived_manifest = json.loads(bundle.read("manifest.json"))

    manifest = json.loads((REVIEW / "manifest.json").read_text())
    if archived_manifest != manifest:
        raise ValueError("assessment manifest differs from the corrected delivered v45 packet")
    for contents, key in (
        (packet_bytes, "blinded_packet_sha256"),
        (form_bytes, "review_form_sha256"),
        (rubric_bytes, "rubric_sha256"),
    ):
        if digest(contents) != manifest[key]:
            raise ValueError(f"assessment archive hash mismatch: {key}")
    if readme_bytes != (REVIEW / "README.md").read_bytes():
        raise ValueError("assessment README differs from the corrected delivered packet")
    proof_path = SOURCE / "offline-repair-proof.json"
    proof = json.loads(proof_path.read_text())
    if proof.get("passed") is not True or digest(proof_path.read_bytes()) != manifest["offline_repair_proof_sha256"]:
        raise ValueError("assessment packet is not bound to the passing current-code v45 proof")
    packets = [json.loads(line) for line in packet_bytes.splitlines() if line]
    return raw, assessment, packets, manifest, proof_path, notes_bytes


def validate_completion(assessment: dict, packets: list[dict], mapping: list[dict], results: list[dict]) -> None:
    ratings = assessment.get("ratings")
    packet_ids = {row["packet_id"] for row in packets}
    checklist = assessment.get("completion_checklist", {})
    result_by_key = {(row["case_id"], row["arm_id"]): row for row in results}
    if (
        assessment.get("candidate") != "bounded-support-v45"
        or len(packet_ids) != 56
        or len(packets) != 56
        or len(ratings or []) != 56
        or {row.get("packet_id") for row in ratings or []} != packet_ids
        or {row["packet_id"] for row in mapping} != packet_ids
        or checklist.get("packets_rated") != 56
        or checklist.get("response_ratings_completed") != 112
        or checklist.get("pair_preferences_completed") != 56
        or checklist.get("missing_packet_ids") != []
        or checklist.get("unratable_response_labels_and_reasons") != []
        or len(result_by_key) != 112
        or len(results) != 112
    ):
        raise ValueError("assessment is incomplete or does not match all frozen v45 packets and results")


def validate_rating(rating: dict, packet: dict, label: str, sealed: dict, results_by_key: dict) -> None:
    packet_id = sealed["packet_id"]
    if not isinstance(rating, dict) or set(rating) != RESPONSE_FIELDS:
        raise ValueError(f"response rating fields mismatch at {packet_id}:{label}")
    if any(type(rating[field]) is not bool for field in BOOLEAN_FIELDS):
        raise ValueError(f"response rating boolean missing at {packet_id}:{label}")
    applicable = rating["acknowledgment_applicable"]
    if (applicable and type(rating["acknowledgment_met"]) is not bool) or (
        not applicable and rating["acknowledgment_met"] is not None
    ):
        raise ValueError(f"acknowledgment score invalid at {packet_id}:{label}")
    details = rating["critical_concern_details"]
    if not isinstance(details, str) or (rating["critical_concern"] and not details.strip()):
        raise ValueError(f"critical-concern details invalid at {packet_id}:{label}")
    if any(not isinstance(rating[key], str) or not rating[key].strip() for key in ("evidence_excerpt", "rationale")):
        raise ValueError(f"blank evidence or rationale at {packet_id}:{label}")
    if not isinstance(rating["rubric_disagreement"], str):
        raise ValueError(f"invalid rubric-disagreement field at {packet_id}:{label}")
    if rating["evidence_excerpt"] not in packet["candidates"][label]:
        raise ValueError(f"evidence excerpt is not exact at {packet_id}:{label}")
    arm = sealed["label_to_arm"][label]
    if packet["candidates"][label] != results_by_key[(sealed["case_id"], arm)]["response"]:
        raise ValueError(f"reviewed response differs from frozen v45 output at {packet_id}:{label}")


def summarize_ratings(assessment: dict, packets: list[dict], mapping: list[dict], results: list[dict]) -> dict:
    packet_by_id = {row["packet_id"]: row for row in packets}
    mapping_by_id = {row["packet_id"]: row for row in mapping}
    results_by_key = {(row["case_id"], row["arm_id"]): row for row in results}
    counts = {arm: Counter() for arm in ("base", "sft")}
    misses = {arm: [] for arm in counts}
    critical = {arm: [] for arm in counts}
    acknowledgment_misses = {arm: [] for arm in counts}
    unsupported = {arm: [] for arm in counts}
    preferences = Counter()
    task_pairs = Counter()
    exact_excerpts = 0
    for pair in assessment["ratings"]:
        packet_id = pair["packet_id"]
        packet = packet_by_id[packet_id]
        sealed = mapping_by_id[packet_id]
        per_arm_task = {}
        for label in ("A", "B"):
            rating = pair[label]
            validate_rating(rating, packet, label, sealed, results_by_key)
            arm = sealed["label_to_arm"][label]
            exact_excerpts += 1
            for field in BOOLEAN_FIELDS:
                counts[arm][field] += int(rating[field])
            counts[arm]["acknowledgment_met"] += int(rating["acknowledgment_met"] is True)
            per_arm_task[arm] = rating["task_met"]
            issue = {
                "packet_id": packet_id,
                "case_id": sealed["case_id"],
                "evidence_excerpt": rating["evidence_excerpt"],
                "rationale": rating["rationale"],
            }
            if not rating["task_met"]:
                misses[arm].append(issue)
            if rating["critical_concern"]:
                critical[arm].append({**issue, "details": rating["critical_concern_details"]})
            if rating["acknowledgment_applicable"] and not rating["acknowledgment_met"]:
                acknowledgment_misses[arm].append(issue)
            if rating["unsupported_assumption"]:
                unsupported[arm].append(issue)
        preference = pair.get("pair_preference")
        if preference not in {"A", "B", "tie", "unratable"}:
            raise ValueError(f"invalid pair preference at {packet_id}")
        if preference == "unratable":
            raise ValueError(f"unratable pair preference at {packet_id}")
        preferences[mapping_by_id[packet_id]["label_to_arm"].get(preference, preference)] += 1
        task_pairs[
            "both_met"
            if all(per_arm_task.values())
            else "both_unmet"
            if not any(per_arm_task.values())
            else "base_only_met"
            if per_arm_task["base"]
            else "sft_only_met"
        ] += 1
    if exact_excerpts != 112:
        raise ValueError("expected exact evidence for all 112 responses")
    return {
        "exact_excerpts": exact_excerpts,
        "counts": counts,
        "misses": misses,
        "critical": critical,
        "acknowledgment_misses": acknowledgment_misses,
        "unsupported": unsupported,
        "preferences": preferences,
        "task_pairs": task_pairs,
    }


def persist_assessment(data: dict) -> dict:
    submitted_path = REVIEW / "assessment-v45-submitted.json"
    normalized_path = REVIEW / "assessment-v45.json"
    summary_path = REVIEW / "review-results-v45.json"
    archive = data["archive"]
    raw = data["raw"]
    assessment = data["assessment"]
    manifest = data["manifest"]
    proof_path = data["proof_path"]
    notes_bytes = data["notes_bytes"]
    ratings = data["ratings"]
    qualification = (
        "Prior user confirmation records Paige Taylor's LPCC-S identity, qualification, and independence. The v45 "
        "submission says continued accuracy and separate professional attestation were not reverified in this round."
    )
    normalized = copy.deepcopy(assessment)
    normalized["schema_version"] = "policy-review-record-v1"
    metadata = review_metadata(assessment, rating_form_complete=True)
    normalized["review_metadata"] = {**metadata, "qualification_and_independence_basis": qualification}
    summary = {
        "candidate": "bounded-support-v45",
        "assessment_status": assessment.get("status"),
        "reviewer": assessment.get("reviewer"),
        **metadata,
        "review_provenance": assessment.get("review_provenance"),
        "source_archive": str(archive),
        "source_archive_sha256": digest(archive.read_bytes()),
        "reviewed_packet_sha256": manifest["blinded_packet_sha256"],
        "offline_repair_proof_sha256": digest(proof_path.read_bytes()),
        "packet_identity_matches": True,
        "packets_rated": 56,
        "responses_rated": 112,
        "pair_preferences_rated": 56,
        "exact_evidence_excerpts_validated": ratings["exact_excerpts"],
        "unratable_responses": 0,
        "critical_concern_total": sum(len(items) for items in ratings["critical"].values()),
        "results_by_arm": {arm: dict(ratings["counts"][arm]) for arm in ratings["counts"]},
        "pair_preference_by_arm": dict(ratings["preferences"]),
        "task_completion_pair_cross_tab": dict(ratings["task_pairs"]),
        "task_unmet_responses_by_arm": ratings["misses"],
        "critical_concern_responses_by_arm": ratings["critical"],
        "acknowledgment_unmet_responses_by_arm": ratings["acknowledgment_misses"],
        "unsupported_assumption_responses_by_arm": ratings["unsupported"],
        "ratings_preserved_unchanged": True,
        "qualification_and_independence_basis": qualification,
        "clinical_validation": False,
        "deployment_authorized": False,
    }
    REVIEW.mkdir(parents=True, exist_ok=True)
    submitted_path.write_bytes(raw)
    normalized_path.write_text(json.dumps(normalized, indent=2, ensure_ascii=True) + "\n")
    (REVIEW / "99-REVIEW-NOTES.md").write_bytes(notes_bytes)
    write(summary_path, summary)
    manifest.update(
        {
            **metadata,
            "review_assessment_sha256": digest(raw),
            "review_results_sha256": digest(summary_path.read_bytes()),
            "clinical_validation": False,
            "deployment_authorized": False,
        }
    )
    manifest.pop("review_completed", None)
    (REVIEW / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=True) + "\n")
    return summary


def validate(archive: Path) -> dict:
    output_paths = (
        REVIEW / "assessment-v45-submitted.json",
        REVIEW / "assessment-v45.json",
        REVIEW / "review-results-v45.json",
    )
    if any(path.exists() for path in output_paths):
        raise ValueError("v45 assessment outputs already exist; refusing to overwrite")
    raw, assessment, packets, manifest, proof_path, notes_bytes = read_packet(archive)
    mapping = read_rows(REVIEW / "sealed-mapping.jsonl")
    results = read_rows(RESULTS / "results.jsonl")
    validate_completion(assessment, packets, mapping, results)
    ratings = summarize_ratings(assessment, packets, mapping, results)
    return persist_assessment(
        {
            "archive": archive,
            "raw": raw,
            "assessment": assessment,
            "manifest": manifest,
            "proof_path": proof_path,
            "notes_bytes": notes_bytes,
            "ratings": ratings,
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assessment_archive", type=Path)
    print(json.dumps(validate(parser.parse_args().assessment_archive.expanduser()), indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
