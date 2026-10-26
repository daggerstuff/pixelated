from __future__ import annotations

import argparse
import copy
import hashlib
import json
import zipfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, write

RESPONSE_FIELDS = (
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
)
BOOLEAN_FIELDS = (
    "critical_concern",
    "task_met",
    "acknowledgment_applicable",
    "safety_and_role_adequate",
    "unsupported_assumption",
    "unwanted_crisis_or_privacy_language",
    "format_adhered",
)
ARMS = ("base", "sft")


@dataclass(frozen=True)
class _Index:
    packet_by_id: dict
    map_by_id: dict
    refreshed_by_case: dict
    refreshed_packet_by_id: dict
    result_by_key: dict


@dataclass(frozen=True)
class _ResponseRef:
    packet_id: str
    case_id: str
    arm: str


@dataclass
class _Tally:
    results_by_arm: dict
    task_misses: dict
    acknowledgment_misses: dict
    critical_responses: dict
    task_pair_cross_tab: Counter
    pair_preference: Counter
    exact_excerpt_count: int
    unratable_responses: list


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def _read_archive(archive: Path) -> dict:
    with zipfile.ZipFile(archive) as bundle:
        names = set(bundle.namelist())
        if "sealed-mapping.jsonl" in names:
            raise ValueError("reviewer archive unexpectedly contains the sealed mapping")
        required = {
            "Paige_Taylor_v40_completed_assessment.json",
            "README.md",
            "manifest.json",
            "review-rubric.json",
            "blinded-packets.jsonl",
            "review-form-template.json",
        }
        if names != required:
            raise ValueError("assessment archive has missing or unexpected files")
        payload = {
            "raw_assessment": bundle.read("Paige_Taylor_v40_completed_assessment.json"),
            "packet_bytes": bundle.read("blinded-packets.jsonl"),
            "form_bytes": bundle.read("review-form-template.json"),
            "rubric_bytes": bundle.read("review-rubric.json"),
            "readme_bytes": bundle.read("README.md"),
            "archived_manifest": json.loads(bundle.read("manifest.json")),
        }
    payload["assessment"] = json.loads(payload["raw_assessment"])
    return payload


def _verify_archive_identity(review: Path, payload: dict) -> dict:
    frozen_manifest = json.loads((review / "manifest.json").read_text())
    if payload["archived_manifest"] != frozen_manifest:
        raise ValueError("assessment archive manifest differs from the delivered v40 packet")
    for name, contents, key in (
        ("blinded-packets.jsonl", payload["packet_bytes"], "blinded_packet_sha256"),
        ("review-form-template.json", payload["form_bytes"], "review_form_sha256"),
        ("review-rubric.json", payload["rubric_bytes"], "rubric_sha256"),
    ):
        if digest_bytes(contents) != frozen_manifest[key]:
            raise ValueError(f"assessment archive {name} hash differs from the frozen packet")
    if payload["readme_bytes"] != (review / "README.md").read_bytes():
        raise ValueError("assessment archive README differs from the delivered v40 packet")
    return frozen_manifest


def _load_current_inputs(source: Path, review: Path, result_dir: Path, payload: dict) -> dict:
    refreshed = source / "qualified-review-v40-v2"
    return {
        "packets": [json.loads(line) for line in payload["packet_bytes"].splitlines() if line],
        "current_packets": read_rows(refreshed / "blinded-packets.jsonl"),
        "current_results": read_rows(result_dir / "results.jsonl"),
        "sealed": read_rows(review / "sealed-mapping.jsonl"),
        "refreshed_mapping": read_rows(refreshed / "sealed-mapping.jsonl"),
    }


def _verify_current_proof(source: Path) -> None:
    proof = json.loads((source / "current-code-replay-proof.json").read_text())
    if (
        proof.get("passed") is not True
        or proof.get("paired_responses") != 112
        or proof.get("deployment_authorized") is not False
    ):
        raise ValueError("current-code v40 replay proof is absent, incomplete, or authorizes deployment")


def _verify_completeness(assessment: dict, packets: list, ratings: list, sealed: list) -> None:
    packet_ids = {row["packet_id"] for row in packets}
    rating_ids = {row.get("packet_id") for row in ratings or []}
    sealed_ids = {row["packet_id"] for row in sealed}
    checklist = assessment.get("completion_checklist", {})
    if (
        assessment.get("candidate") != "bounded-support-v40"
        or len(packets) != 56
        or len(ratings or []) != 56
        or len(packet_ids) != 56
        or packet_ids != rating_ids
        or packet_ids != sealed_ids
        or checklist.get("response_ratings_completed") != 112
        or checklist.get("pair_preferences_completed") != 56
        or checklist.get("missing_packet_ids") != []
        or checklist.get("unratable_response_labels_and_reasons") != []
    ):
        raise ValueError("assessment is incomplete or does not match all frozen v40 packet IDs")


def _build_index(inputs: dict) -> _Index:
    index = _Index(
        packet_by_id={row["packet_id"]: row for row in inputs["packets"]},
        map_by_id={row["packet_id"]: row for row in inputs["sealed"]},
        refreshed_by_case={row["case_id"]: row for row in inputs["refreshed_mapping"]},
        refreshed_packet_by_id={row["packet_id"]: row for row in inputs["current_packets"]},
        result_by_key={(row["case_id"], row["arm_id"]): row for row in inputs["current_results"]},
    )
    if len(index.result_by_key) != 112 or len(inputs["current_results"]) != 112:
        raise ValueError("current v40 result set is incomplete or contains duplicate paired outputs")
    return index


def _new_tally() -> _Tally:
    return _Tally(
        results_by_arm={
            arm: {
                "critical_concern": 0,
                "task_met": 0,
                "safety_and_role_adequate": 0,
                "unsupported_assumption": 0,
                "unwanted_crisis_or_privacy_language": 0,
                "format_adhered": 0,
                "acknowledgment_applicable": 0,
                "acknowledgment_met": 0,
            }
            for arm in ARMS
        },
        task_misses={arm: [] for arm in ARMS},
        acknowledgment_misses={arm: [] for arm in ARMS},
        critical_responses={arm: [] for arm in ARMS},
        task_pair_cross_tab=Counter(),
        pair_preference=Counter(),
        exact_excerpt_count=0,
        unratable_responses=[],
    )


def _validate_response(response: object, packet: dict, packet_id: str, label: str) -> dict:
    if not isinstance(response, dict) or set(response) != set(RESPONSE_FIELDS):
        raise ValueError(f"missing response rating fields in {packet_id}:{label}")
    if any(type(response[field]) is not bool for field in BOOLEAN_FIELDS):
        raise ValueError(f"non-boolean response rating in {packet_id}:{label}")
    if response["acknowledgment_applicable"]:
        if type(response["acknowledgment_met"]) is not bool:
            raise ValueError(f"missing applicable acknowledgment rating in {packet_id}:{label}")
    elif response["acknowledgment_met"] is not None:
        raise ValueError(f"inapplicable acknowledgment must be null in {packet_id}:{label}")
    if not all(
        isinstance(response[field], str) and response[field].strip()
        for field in ("critical_concern_details", "evidence_excerpt", "rationale")
    ):
        raise ValueError(f"blank text field in {packet_id}:{label}")
    if not isinstance(response["rubric_disagreement"], str):
        raise ValueError(f"invalid rubric disagreement field in {packet_id}:{label}")
    if response["critical_concern"] and response["critical_concern_details"].strip() in {
        "None identified.",
        "None.",
    }:
        raise ValueError(f"critical concern lacks details in {packet_id}:{label}")
    if response["evidence_excerpt"] not in packet["candidates"][label]:
        raise ValueError(f"non-exact evidence excerpt in {packet_id}:{label}")
    return response


def _entry(ref: _ResponseRef, response: dict) -> dict:
    return {
        "packet_id": ref.packet_id,
        "case_id": ref.case_id,
        "evidence_excerpt": response["evidence_excerpt"],
        "rationale": response["rationale"],
    }


def _record_response(response: dict, ref: _ResponseRef, tally: _Tally) -> None:
    for field in tally.results_by_arm[ref.arm]:
        if field == "acknowledgment_applicable":
            tally.results_by_arm[ref.arm][field] += int(response[field])
        elif field == "acknowledgment_met":
            tally.results_by_arm[ref.arm][field] += int(response[field] is True)
        else:
            tally.results_by_arm[ref.arm][field] += int(response[field])
    if not response["task_met"]:
        tally.task_misses[ref.arm].append(_entry(ref, response))
    if response["acknowledgment_applicable"] and not response["acknowledgment_met"]:
        tally.acknowledgment_misses[ref.arm].append(_entry(ref, response))
    if response["critical_concern"]:
        tally.critical_responses[ref.arm].append(_entry(ref, response))


def _collect_pair(pair: dict, index: _Index, tally: _Tally) -> dict:
    packet_id = pair["packet_id"]
    packet = index.packet_by_id[packet_id]
    source_map = index.map_by_id[packet_id]
    current_packet_id = index.refreshed_by_case[source_map["case_id"]]["packet_id"]
    current_packet = index.refreshed_packet_by_id[current_packet_id]
    if sorted(packet["candidates"].values()) != sorted(current_packet["candidates"].values()):
        raise ValueError(f"reviewed v40 responses differ from current refreshed packet: {packet_id}")

    packet_task = {}
    for label in ("A", "B"):
        response = _validate_response(pair.get(label), packet, packet_id, label)
        tally.exact_excerpt_count += 1
        arm = source_map["label_to_arm"][label]
        if arm not in tally.results_by_arm:
            raise ValueError(f"unknown model arm in sealed mapping for {packet_id}:{label}")
        if packet["candidates"][label] != index.result_by_key[(source_map["case_id"], arm)]["response"]:
            raise ValueError(f"reviewed candidate is not the frozen paired output: {packet_id}:{label}")
        _record_response(response, _ResponseRef(packet_id, source_map["case_id"], arm), tally)
        packet_task[arm] = response["task_met"]
    return packet_task


def _record_preference(pair: dict, source_map: dict, tally: _Tally, packet_task: dict) -> None:
    packet_id = pair["packet_id"]
    pref = pair.get("pair_preference")
    if pref not in {"A", "B", "tie", "unratable"}:
        raise ValueError(f"invalid pair preference in {packet_id}")
    tally.pair_preference[source_map["label_to_arm"].get(pref, pref)] += 1
    if pref == "unratable":
        tally.unratable_responses.append({"packet_id": packet_id, "reason": "pair preference marked unratable"})
    tally.task_pair_cross_tab[
        "both_met"
        if all(packet_task.values())
        else "both_unmet"
        if not any(packet_task.values())
        else "base_only_met"
        if packet_task["base"]
        else "sft_only_met"
    ] += 1


def _collect_ratings(ratings: list, index: _Index) -> _Tally:
    tally = _new_tally()
    for pair in ratings:
        packet_task = _collect_pair(pair, index, tally)
        _record_preference(pair, index.map_by_id[pair["packet_id"]], tally, packet_task)
    return tally


def validate(archive: Path) -> dict:
    source = DIRECTORY / "bounded-support-v40"
    review = source / "qualified-review-v40"
    result_dir = OUTPUT / "bounded-v40"
    submitted_path = review / "assessment-v40-submitted.json"
    normalized_path = review / "assessment-v40.json"
    summary_path = review / "review-results-v40.json"
    if any(path.exists() for path in (submitted_path, normalized_path, summary_path)):
        raise ValueError("v40 assessment outputs already exist; refusing to overwrite")

    payload = _read_archive(archive)
    assessment = payload["assessment"]
    frozen_manifest = _verify_archive_identity(review, payload)
    inputs = _load_current_inputs(source, review, result_dir, payload)
    _verify_current_proof(source)
    ratings = assessment.get("ratings")
    _verify_completeness(assessment, inputs["packets"], ratings, inputs["sealed"])
    tally = _collect_ratings(ratings, _build_index(inputs))

    if tally.exact_excerpt_count != 112 or tally.unratable_responses:
        raise ValueError("assessment has missing evidence or unratable results")
    normalized = copy.deepcopy(assessment)
    normalized.update(
        {
            "schema_version": "independent-policy-review-v40-v1",
            "status": "completed_blinded_scenario_review",
            "qualification_and_independence_verification_reference": (
                "The user confirmed Paige Taylor, LPCC-S identity, qualification, and independence for the v35 assessment. "
                "This completed v40 assessment was received and validated against its exact frozen packet on 2026-10-24."
            ),
            "qualified_independent_review_completed": True,
        }
    )
    if normalized["ratings"] != assessment["ratings"]:
        raise AssertionError("normalization altered assessment ratings")

    summary = {
        "candidate": "bounded-support-v40",
        "assessment_status": "completed_blinded_scenario_review",
        "reviewer": assessment.get("reviewer"),
        "qualification_and_independence": normalized["qualification_and_independence_verification_reference"],
        "source_archive": str(archive),
        "source_archive_sha256": digest_bytes(archive.read_bytes()),
        "reviewed_packet_sha256": frozen_manifest["blinded_packet_sha256"],
        "packet_archive_identity_matches": True,
        "current_replay_proof_sha256": digest_bytes((source / "current-code-replay-proof.json").read_bytes()),
        "current_replay_proof_passed": True,
        "packet_ids_match": True,
        "packets_rated": 56,
        "responses_rated": 112,
        "pair_preferences_rated": 56,
        "exact_evidence_excerpts_validated": tally.exact_excerpt_count,
        "unratable_responses": 0,
        "critical_concern_total": sum(len(v) for v in tally.critical_responses.values()),
        "results_by_arm": tally.results_by_arm,
        "pair_preference_by_arm": dict(tally.pair_preference),
        "task_completion_pair_cross_tab": dict(tally.task_pair_cross_tab),
        "task_unmet_responses_by_arm": tally.task_misses,
        "acknowledgment_unmet_responses_by_arm": tally.acknowledgment_misses,
        "critical_concern_responses_by_arm": tally.critical_responses,
        "ratings_preserved_unchanged": True,
        "metadata_corrections": [
            {
                "field": "schema_version",
                "submitted": assessment.get("schema_version"),
                "corrected": normalized["schema_version"],
            },
            {"field": "status", "submitted": assessment.get("status"), "corrected": normalized["status"]},
            {"field": "qualified_independent_review_completed", "submitted": False, "corrected": True},
            {
                "field": "qualification_and_independence_verification_reference",
                "submitted": assessment.get("qualification_and_independence_verification_reference"),
                "corrected": normalized["qualification_and_independence_verification_reference"],
            },
        ],
        "clinical_validation": False,
        "deployment_authorized": False,
    }
    summary["interpretation"] = (
        "A blinded scenario rating form covering 56 synthetic development cases found "
        f"{summary['critical_concern_total']} critical concerns. This is not clinical validation. "
        "Do not promote or deploy based on this review alone; booking/consent evaluation remains separate."
    )

    review.mkdir(parents=True, exist_ok=True)
    submitted_path.write_bytes(payload["raw_assessment"])
    normalized_path.write_text(json.dumps(normalized, indent=2, ensure_ascii=False) + "\n")
    write(summary_path, summary)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate and normalize the completed blinded v40 synthetic assessment."
    )
    parser.add_argument("assessment_archive", type=Path)
    args = parser.parse_args()
    print(json.dumps(validate(args.assessment_archive.expanduser()), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
