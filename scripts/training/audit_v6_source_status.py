#!/usr/bin/env python3
"""Bind the frozen v6 candidate to source decisions without granting clearance."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RELEASE = ROOT / "docs/training/execution-2026-10-21/wandb-full-corpus-current-master-20261021-v6.json"
LEDGER = ROOT / "docs/training/execution-2026-10-17/current-master-source-decision-ledger-2026-10-19-v4.jsonl"
REPORT = ROOT / "docs/training/execution-2026-10-21/v6-source-status-audit.json"
STATUS_FIELDS = ("rights_status", "privacy_review_status", "authority_status", "training_eligibility")


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def load_references(ledger_path: Path) -> dict[int, tuple[str, str, dict[str, str]]]:
    references = {}
    with ledger_path.open() as stream:
        for line in stream:
            entry = json.loads(line)
            decision = {field: entry["decision"][field] for field in STATUS_FIELDS}
            for row in entry["candidate_rows"]:
                index = row["row_number_1based"]
                if index in references:
                    raise ValueError("duplicate source-ledger row reference")
                references[index] = (row["row_sha256"], entry["source_label"], decision)

    return references


def load_partitions(membership: Path, heldout: Path) -> tuple[dict[int, tuple[str, str, str]], Counter[str]]:
    partitions = {}
    partition_counts: Counter[str] = Counter()
    for path, held_out in ((membership, False), (heldout, True)):
        with path.open() as stream:
            for line in stream:
                row = json.loads(line)
                index = row["candidate_row_number_1based"]
                if index in partitions:
                    raise ValueError("retained and heldout membership overlaps or repeats")
                split = "heldout" if held_out else row["split"]
                if split not in {"train", "validation", "test", "heldout"}:
                    raise ValueError("unknown release partition")
                partitions[index] = (row["candidate_row_sha256"], row["source_label"], split)
                partition_counts[split] += 1

    return partitions, partition_counts


def audit(root: Path, release_path: Path, ledger_path: Path) -> dict[str, Any]:
    release = json.loads(release_path.read_text())
    candidate = root / release["source_candidate"]["path"]
    membership = root / release["internal_manifest"]["path"]
    heldout_evidence = release["evidence"]["group_disjointness"]
    heldout = root / heldout_evidence["heldout_exclusions_path"]
    for path, expected in (
        (candidate, release["source_candidate"]["sha256"]),
        (membership, release["internal_manifest"]["sha256"]),
        (heldout, heldout_evidence["heldout_exclusions_sha256"]),
    ):
        if digest(path) != expected:
            raise ValueError(f"release evidence hash mismatch: {path.name}")

    references = load_references(ledger_path)
    partitions, partition_counts = load_partitions(membership, heldout)

    statuses: dict[str, Counter[str]] = {field: Counter() for field in STATUS_FIELDS}
    legacy_by_split: Counter[str] = Counter()
    synthetic_by_split: Counter[str] = Counter()
    by_source: dict[str, Counter[str]] = {}
    count = 0
    with candidate.open("rb") as stream:
        for count, raw in enumerate(stream, 1):
            row = json.loads(raw)
            row_hash = hashlib.sha256(raw.removesuffix(b"\n")).hexdigest()
            source = row.get("source", "agent_tool_synthetic" if count not in references else None)
            bound = partitions.get(count)
            if bound is None or bound[:2] != (row_hash, source):
                raise ValueError("candidate does not bind to release membership")
            reference = references.get(count)
            if reference is None:
                if source != "agent_tool_synthetic":
                    raise ValueError("non-synthetic candidate lacks a source-ledger reference")
                synthetic_by_split[bound[2]] += 1
            else:
                if reference[:2] != (row_hash, source):
                    raise ValueError("candidate does not bind to source-ledger hash and source")
                legacy_by_split[bound[2]] += 1
                by_source.setdefault(source, Counter())[bound[2]] += 1
                for field in STATUS_FIELDS:
                    statuses[field][reference[2][field]] += 1

    if set(references) - set(range(1, count + 1)):
        raise ValueError("source-ledger references rows outside the candidate")
    if set(partitions) != set(range(1, count + 1)):
        raise ValueError("release membership does not account for every candidate exactly once")
    expected_counts = {key: value["row_count"] for key, value in release["partitions"].items()}
    expected_counts["heldout"] = release["scope"]["dropped_structurally_untrainable_rows"]
    if count != release["source_candidate"]["row_count"] or dict(partition_counts) != expected_counts:
        raise ValueError("release partition counts changed")
    return {
        "schema_version": "v6-source-status-audit-v1",
        "release_id": release["release_id"],
        "release_manifest_sha256": digest(release_path),
        "candidate_sha256": digest(candidate),
        "source_ledger_sha256": digest(ledger_path),
        "candidate_rows": count,
        "partition_counts": dict(partition_counts),
        "legacy_exact_hash_and_source_matches": sum(legacy_by_split.values()),
        "legacy_by_partition": dict(legacy_by_split),
        "synthetic_without_legacy_ledger_by_partition": dict(synthetic_by_split),
        "legacy_status_counts": {field: dict(values) for field, values in statuses.items()},
        "legacy_source_followup_queue": [
            {"source_label": source, "partition_counts": dict(counts)}
            for source, counts in sorted(
                by_source.items(), key=lambda item: (-item[1]["train"], -sum(item[1].values()), item[0])
            )
        ],
        "source_followup_queue_policy": (
            "Prioritize source-level provenance evidence by retained train exposure; "
            "this does not change release authorization, ledger dispositions, or holdouts."
        ),
        "heldout_sha256": digest(heldout),
        "research_training_authorization": release["status"],
        "clinical_or_production_clearance_granted": False,
        "limitations": [
            "Exact source-row binding preserves prior decisions; it does not establish rights or privacy clearance.",
            "Synthetic additions have release provenance but no legacy source-ledger decision or human review.",
            "Repairs are payload transformations; this audit binds original candidate rows, not clinical quality of repaired targets.",
            "Semantic near-duplicate leakage and source-specific human decision attachment are not certified here.",
        ],
    }


def main() -> None:
    report = audit(ROOT, RELEASE, LEDGER)
    REPORT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
