from __future__ import annotations

import hashlib
import json
import zipfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from scripts.training.policy_review_metadata import review_metadata
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, write

SOURCE = DIRECTORY / "bounded-support-v46"
REVIEW = SOURCE / "qualified-review-v46"
RESULTS = OUTPUT / "bounded-v46"
EXPECTED_ARCHIVE_FILES = {
    "blinded-packets.jsonl",
    "review-form-template.json",
    "review-rubric.json",
    "README.md",
    "manifest.json",
    "Paige_Taylor_v46_completed_assessment.json",
    "99-REVIEW-NOTES.md",
}
RATING_FIELDS = {
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
ARMS = ("base", "sft")


@dataclass(frozen=True)
class _Index:
    packet_by_id: dict
    map_by_id: dict
    results_by_key: dict


@dataclass(frozen=True)
class _ResponseRef:
    packet_id: str
    case_id: str
    label: str
    arm: str


@dataclass
class _Tally:
    counts: dict
    misses: dict
    flagged: dict
    acknowledgments: dict
    preferences: Counter
    task_pairs: Counter
    exact_excerpts: int


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def _read_archive(archive: Path) -> dict:
    with zipfile.ZipFile(archive) as bundle:
        names = set(bundle.namelist())
        if names != EXPECTED_ARCHIVE_FILES:
            raise ValueError(f"v46 assessment archive contents differ: {sorted(names ^ EXPECTED_ARCHIVE_FILES)}")
        raw_assessment = bundle.read("Paige_Taylor_v46_completed_assessment.json")
        return {
            "raw_assessment": raw_assessment,
            "assessment": json.loads(raw_assessment),
            "notes": bundle.read("99-REVIEW-NOTES.md"),
            "manifest": json.loads(bundle.read("manifest.json")),
            "archived_files": {
                name: bundle.read(name)
                for name in ("blinded-packets.jsonl", "review-form-template.json", "review-rubric.json", "README.md")
            },
        }


def _verify_packet_identity(payload: dict) -> None:
    manifest = payload["manifest"]
    if manifest != json.loads((REVIEW / "manifest.json").read_text()):
        raise ValueError("assessment manifest differs from the locally frozen v46 packet")
    hash_fields = {
        "blinded-packets.jsonl": "blinded_packet_sha256",
        "review-form-template.json": "review_form_sha256",
        "review-rubric.json": "rubric_sha256",
        "README.md": "readme_sha256",
    }
    for filename, field in hash_fields.items():
        archived = payload["archived_files"][filename]
        if digest(archived) != manifest[field] or archived != (REVIEW / filename).read_bytes():
            raise ValueError(f"v46 packet identity mismatch: {filename}")
    proof_path = SOURCE / "offline-repair-proof.json"
    proof = json.loads(proof_path.read_text())
    if digest(proof_path.read_bytes()) != manifest["offline_repair_proof_sha256"] or proof.get("passed") is not True:
        raise ValueError("v46 assessment is not bound to the frozen passing repair proof")


def _verify_completeness(assessment: dict, packets: list, mapping: list, results: list) -> None:
    packet_ids = {row.get("packet_id") for row in packets}
    ratings = assessment.get("ratings")
    if (
        assessment.get("candidate") != "bounded-support-v46"
        or len(packet_ids) != 56
        or len(packets) != 56
        or len(ratings or []) != 56
        or {row.get("packet_id") for row in ratings or []} != packet_ids
        or len(mapping) != 56
        or {row.get("packet_id") for row in mapping} != packet_ids
        or len(results) != 112
        or len({(row["case_id"], row["arm_id"]) for row in results}) != 112
    ):
        raise ValueError("v46 assessment or frozen outputs have missing or duplicate entries")
    checklist = assessment.get("completion_checklist", {})
    if (
        checklist.get("packets_rated") != 56
        or checklist.get("response_ratings_completed") != 112
        or checklist.get("pair_preferences_completed") != 56
        or checklist.get("missing_packet_ids") != []
        or checklist.get("unratable_response_labels_and_reasons") != []
    ):
        raise ValueError("assessment checklist does not attest complete ratings for all v46 packets")


def _validate_rating(rating: dict, packet: dict, packet_id: str, label: str) -> None:
    if not isinstance(rating, dict) or set(rating) != RATING_FIELDS:
        raise ValueError(f"rating fields mismatch at {packet_id}:{label}")
    if any(type(rating[field]) is not bool for field in BOOLEAN_FIELDS):
        raise ValueError(f"rating booleans invalid at {packet_id}:{label}")
    applicable = rating["acknowledgment_applicable"]
    if (applicable and type(rating["acknowledgment_met"]) is not bool) or (
        not applicable and rating["acknowledgment_met"] is not None
    ):
        raise ValueError(f"acknowledgment state invalid at {packet_id}:{label}")
    if not isinstance(rating["critical_concern_details"], str) or (
        rating["critical_concern"] and not rating["critical_concern_details"].strip()
    ):
        raise ValueError(f"critical-concern detail missing at {packet_id}:{label}")
    if any(not isinstance(rating[key], str) or not rating[key].strip() for key in ("evidence_excerpt", "rationale")):
        raise ValueError(f"evidence or rationale missing at {packet_id}:{label}")
    if (
        not isinstance(rating["rubric_disagreement"], str)
        or rating["evidence_excerpt"] not in packet["candidates"][label]
    ):
        raise ValueError(f"evidence excerpt is invalid at {packet_id}:{label}")


def _entry(ref: _ResponseRef, rating: dict) -> dict:
    return {
        "packet_id": ref.packet_id,
        "case_id": ref.case_id,
        "label": ref.label,
        "evidence_excerpt": rating["evidence_excerpt"],
        "rationale": rating["rationale"],
    }


def _record_rating(rating: dict, ref: _ResponseRef, tally: _Tally) -> None:
    for field in BOOLEAN_FIELDS:
        tally.counts[ref.arm][field] += int(rating[field])
    if rating["acknowledgment_applicable"]:
        tally.acknowledgments[ref.arm]["applicable"] += 1
        tally.acknowledgments[ref.arm]["met"] += int(rating["acknowledgment_met"])
        if not rating["acknowledgment_met"]:
            tally.acknowledgments[ref.arm]["misses"].append(_entry(ref, rating))
    for field in tally.flagged[ref.arm]:
        if rating[field]:
            tally.flagged[ref.arm][field].append(_entry(ref, rating))
    if not rating["task_met"]:
        tally.misses[ref.arm].append(_entry(ref, rating))


def _collect_pair(pair: dict, index: _Index, tally: _Tally) -> dict:
    packet_id = pair["packet_id"]
    if packet_id not in index.packet_by_id or set(pair) != {"packet_id", "A", "B", "pair_preference"}:
        raise ValueError(f"invalid pair record at {packet_id}")
    packet = index.packet_by_id[packet_id]
    sealed = index.map_by_id[packet_id]
    per_arm_task = {}
    for label in ("A", "B"):
        rating = pair[label]
        _validate_rating(rating, packet, packet_id, label)
        arm = sealed["label_to_arm"][label]
        output = index.results_by_key[(sealed["case_id"], arm)]["response"]
        if packet["candidates"][label] != output:
            raise ValueError(f"reviewed response differs from frozen v46 output at {packet_id}:{label}")
        tally.exact_excerpts += 1
        _record_rating(rating, _ResponseRef(packet_id, sealed["case_id"], label, arm), tally)
        per_arm_task[arm] = rating["task_met"]
    return per_arm_task


def _record_preference(pair: dict, sealed: dict, tally: _Tally, per_arm_task: dict) -> None:
    packet_id = pair["packet_id"]
    preference = pair["pair_preference"]
    if preference not in {"A", "B", "tie", "unratable"} or preference == "unratable":
        raise ValueError(f"invalid pair preference at {packet_id}")
    tally.preferences[sealed["label_to_arm"].get(preference, preference)] += 1
    tally.task_pairs[
        "both_met"
        if all(per_arm_task.values())
        else "both_unmet"
        if not any(per_arm_task.values())
        else "base_only_met"
        if per_arm_task["base"]
        else "sft_only_met"
    ] += 1


def _collect_ratings(ratings: list, index: _Index) -> _Tally:
    tally = _Tally(
        counts={arm: Counter() for arm in ARMS},
        misses={arm: [] for arm in ARMS},
        flagged={
            arm: {
                key: [] for key in ("critical_concern", "unsupported_assumption", "unwanted_crisis_or_privacy_language")
            }
            for arm in ARMS
        },
        acknowledgments={arm: {"applicable": 0, "met": 0, "misses": []} for arm in ARMS},
        preferences=Counter(),
        task_pairs=Counter(),
        exact_excerpts=0,
    )
    for pair in ratings:
        per_arm_task = _collect_pair(pair, index, tally)
        _record_preference(pair, index.map_by_id[pair["packet_id"]], tally, per_arm_task)
    return tally


def validate(archive: Path) -> dict:
    payload = _read_archive(archive)
    _verify_packet_identity(payload)
    assessment = payload["assessment"]
    packets = [json.loads(line) for line in payload["archived_files"]["blinded-packets.jsonl"].splitlines() if line]
    mapping = read_rows(REVIEW / "sealed-mapping.jsonl")
    results = read_rows(RESULTS / "results.jsonl")
    ratings = assessment.get("ratings")
    _verify_completeness(assessment, packets, mapping, results)
    index = _Index(
        packet_by_id={row["packet_id"]: row for row in packets},
        map_by_id={row["packet_id"]: row for row in mapping},
        results_by_key={(row["case_id"], row["arm_id"]): row for row in results},
    )
    tally = _collect_ratings(ratings, index)

    metadata = review_metadata(
        {
            "review_mode": assessment.get("review_mode"),
            "status": assessment.get("status"),
            "reviewer": assessment.get("reviewer"),
            "review_attested_by": assessment.get("attestor"),
            "credential_verified_at": None,
            "qualified_independent_review_completed": assessment.get("qualified_independent_review_completed") is True,
        },
        rating_form_complete=tally.exact_excerpts == 112,
    )
    summary = {
        "candidate": "bounded-support-v46",
        "assessment_status": assessment.get("status"),
        "review_mode": assessment.get("review_mode"),
        "reviewer_as_submitted": assessment.get("reviewer"),
        "preparer_as_submitted": assessment.get("preparer"),
        "attestor_as_submitted": assessment.get("attestor"),
        "credentials_verified_for_this_review": assessment.get("credentials_verified_for_this_review"),
        **metadata,
        "source_archive": str(archive),
        "source_archive_sha256": digest(archive.read_bytes()),
        "reviewed_packet_sha256": payload["manifest"]["blinded_packet_sha256"],
        "packets_rated": len(packets),
        "responses_rated": tally.exact_excerpts,
        "pair_preferences_rated": len(ratings),
        "unratable_responses": 0,
        "critical_concerns_by_arm": {arm: tally.flagged[arm]["critical_concern"] for arm in tally.counts},
        "counts_by_arm": {arm: dict(tally.counts[arm]) for arm in tally.counts},
        "task_misses_by_arm": tally.misses,
        "acknowledgment_misses_by_arm": {arm: tally.acknowledgments[arm]["misses"] for arm in tally.counts},
        "unsupported_assumptions_by_arm": {arm: tally.flagged[arm]["unsupported_assumption"] for arm in tally.counts},
        "unwanted_crisis_or_privacy_language_by_arm": {
            arm: tally.flagged[arm]["unwanted_crisis_or_privacy_language"] for arm in tally.counts
        },
        "acknowledgment_by_arm": tally.acknowledgments,
        "pair_preference_by_arm": dict(tally.preferences),
        "task_completion_pair_cross_tab": dict(tally.task_pairs),
        "ratings_preserved_unchanged": True,
        "clinical_validation": False,
        "deployment_authorized": False,
    }
    (REVIEW / "assessment-v46-submitted.json").write_bytes(payload["raw_assessment"])
    (REVIEW / "99-REVIEW-NOTES.md").write_bytes(payload["notes"])
    write(REVIEW / "review-results-v46.json", summary)
    normalized = {
        "schema_version": "policy-review-record-v1",
        "assessment": assessment,
        "review_metadata": metadata,
        "qualification_and_independence_basis": "Assessment explicitly labels this a simulated blinded rubric assessment and states no credential verification or attestation occurred; no independent qualification claim is made.",
    }
    write(REVIEW / "assessment-v46.json", normalized)
    return summary


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate Paige's v46 assessment against the exact frozen review packet."
    )
    parser.add_argument("assessment_archive", type=Path)
    print(json.dumps(validate(parser.parse_args().assessment_archive.expanduser()), indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
