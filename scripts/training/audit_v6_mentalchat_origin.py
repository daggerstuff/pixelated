"""Carry revalidated MentalChat origin evidence to frozen v6 partitions.

Run from the repository root with python -m scripts.training.audit_v6_mentalchat_origin.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from scripts.training.audit_v6_source_status import LEDGER, RELEASE, ROOT, audit, digest, load_partitions

SIDECAR = ROOT / (
    "ai/data/curated/recovery/gold-20261017/private-source-origin-binding-20261019/"
    "bindings/mentalchat16k-candidate-upstream-rowrefs.jsonl"
)
VALIDATOR = ROOT / "scripts/training/validate_mentalchat16k_origin_binding.py"


def origin_references(sidecar_path: Path) -> dict[int, dict[str, Any]]:
    references = {}
    for line in sidecar_path.read_text().splitlines():
        ref = json.loads(line)
        index = ref["candidate_row_number_1based"]
        if index in references or ref["source_label"] != "mentalchat16k":
            raise ValueError("invalid or duplicate MentalChat origin reference")
        references[index] = ref
    return references


def validate_status_counts(counts: dict[str, Counter[str]], validation: dict[str, Any]) -> None:
    for mode in ("exact", "normalized"):
        observed = Counter()
        for values in counts.values():
            for status in validation["results"][f"{mode}_status_counts"]:
                observed[status] += values[f"{mode}_{status}"]
        if dict(observed) != validation["results"][f"{mode}_status_counts"]:
            raise ValueError("v6 origin status counts differ from upstream revalidation")


def locator_overlap_summary(locators: dict[str, set[str]]) -> dict[str, int]:
    return {
        "distinct_matched_source_rows": len(locators),
        "source_rows_in_multiple_v6_partitions": sum(len(splits) > 1 for splits in locators.values()),
        "source_rows_shared_by_train_and_validation": sum(
            {"train", "validation"}.issubset(splits) for splits in locators.values()
        ),
        "source_rows_shared_by_train_and_test": sum({"train", "test"}.issubset(splits) for splits in locators.values()),
        "source_rows_shared_by_train_and_heldout": sum(
            {"train", "heldout"}.issubset(splits) for splits in locators.values()
        ),
    }


def record_locators(ref: dict[str, Any], split: str, locators: dict[str, dict[str, set[str]]]) -> None:
    for mode in ("exact", "normalized"):
        for locator in ref[f"{mode}_adapter_sequence_matches"]:
            key = json.dumps([locator[field] for field in ("repo", "revision", "file", "row_number_1based")])
            locators[mode].setdefault(key, set()).add(split)


def bridge(root: Path, release_path: Path, sidecar_path: Path, validation: dict[str, Any]) -> dict[str, Any]:
    release = json.loads(release_path.read_text())
    evidence = release["evidence"]["group_disjointness"]
    membership = root / release["internal_manifest"]["path"]
    heldout = root / evidence["heldout_exclusions_path"]
    for path, expected in (
        (membership, release["internal_manifest"]["sha256"]),
        (heldout, evidence["heldout_exclusions_sha256"]),
    ):
        if digest(path) != expected:
            raise ValueError("release partition evidence changed")
    partitions, _ = load_partitions(membership, heldout)
    references = origin_references(sidecar_path)
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    locators: dict[str, dict[str, set[str]]] = {"exact": {}, "normalized": {}}
    seen = set()
    candidate = root / release["source_candidate"]["path"]
    candidate_hash = hashlib.sha256()
    for index, raw in enumerate(candidate.open("rb"), 1):
        candidate_hash.update(raw)
        row = json.loads(raw)
        if row.get("source") != "mentalchat16k":
            continue
        ref = references.get(index)
        row_hash = hashlib.sha256(raw.removesuffix(b"\n")).hexdigest()
        if ref is None or ref["candidate_line_sha256"] != row_hash:
            raise ValueError("v6 MentalChat row does not bind to revalidated origin sidecar")
        bound = partitions.get(index)
        if bound is None or bound[:2] != (row_hash, "mentalchat16k"):
            raise ValueError("MentalChat origin row does not bind to v6 partition")
        seen.add(index)
        split = bound[2]
        counts[split]["rows"] += 1
        counts[split][f"exact_{ref['exact_match_status']}"] += 1
        counts[split][f"normalized_{ref['normalized_match_status']}"] += 1
        record_locators(ref, split, locators)
    if candidate_hash.hexdigest() != release["source_candidate"]["sha256"]:
        raise ValueError("v6 candidate hash changed")
    if seen != set(references) or len(seen) != validation["results"]["candidate_family_rows"]:
        raise ValueError("v6 MentalChat origin coverage differs from revalidated sidecar")
    validate_status_counts(counts, validation)
    return {
        "schema_version": "v6-mentalchat-origin-v1",
        "release_id": release["release_id"],
        "release_manifest_sha256": digest(release_path),
        "candidate_sha256": candidate_hash.hexdigest(),
        "sidecar_sha256": digest(sidecar_path),
        "membership_sha256": digest(membership),
        "heldout_sha256": digest(heldout),
        "source_repo": validation["source_repo"],
        "source_revision": validation["source_revision"],
        "source_files": validation["source_files"],
        "source_adapter_sha256": validation["adapter_sha256"],
        "legacy_candidate_sha256": validation["candidate"]["sha256"],
        "candidate_family_rows": len(seen),
        "by_v6_partition": {split: dict(values) for split, values in sorted(counts.items())},
        "source_locator_overlap": {mode: locator_overlap_summary(refs) for mode, refs in locators.items()},
        "rights_privacy_or_clinical_clearance_granted": False,
        "limitations": [
            "Exact sequence matches establish limited technical origin evidence, not rights or consent.",
            "Normalized matches are weaker evidence and remain separate from exact matches.",
            "Locator overlap checks only matched rows; unmatched rows and semantic similarities are not certified.",
            "Ambiguous and unmatched rows retain their status; no source decision is upgraded.",
            "This binds original candidate rows, not repaired targets or clinical quality.",
            "No corpus rows, partitions, release authorization or explicit holdouts are modified.",
        ],
    }


def main() -> None:
    # Recompute source-file, adapter and locator evidence before using the sidecar.
    result = subprocess.run([sys.executable, str(VALIDATOR)], check=True, capture_output=True, text=True, cwd=ROOT)
    validation = json.loads(result.stdout)
    audit(ROOT, RELEASE, LEDGER)
    report = bridge(ROOT, RELEASE, SIDECAR, validation)
    report["origin_validator_sha256"] = digest(VALIDATOR)
    report["origin_revalidation"] = validation
    output = ROOT / "docs/training/execution-2026-10-21/v6-mentalchat-origin-audit.json"
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"report": str(output), "by_v6_partition": report["by_v6_partition"]}, indent=2))


if __name__ == "__main__":
    main()
