"""Bind the revalidated dated Mitch ingestion crosswalk to frozen v6 partitions."""

from __future__ import annotations

import json
from collections import Counter, defaultdict

from scripts.training.audit_v6_source_status import LEDGER, RELEASE, ROOT, audit, digest, load_partitions


def main() -> None:
    source_audit = audit(ROOT, RELEASE, LEDGER)
    release = json.loads(RELEASE.read_text())
    directory = ROOT / "ai/training/output/mitch_ingest_private_20261020"
    summary_path = directory / "v4-crosswalk-summary.json"
    summary = json.loads(summary_path.read_text())
    for key in ("sidecar", "ingestion_artifact"):
        entry = summary[key]
        path = ROOT / entry["path"] if key == "sidecar" else directory / "ingested.jsonl"
        if digest(path) != entry["sha256"]:
            raise ValueError("dated ingestion or crosswalk hash changed")
    if digest(directory / "manifest.json") != summary["ingestion_artifact"]["manifest_sha256"]:
        raise ValueError("dated ingestion manifest changed")
    partitions, _ = load_partitions(
        ROOT / release["internal_manifest"]["path"],
        ROOT / release["evidence"]["group_disjointness"]["heldout_exclusions_path"],
    )
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    locators: dict[str, set[str]] = defaultdict(set)
    seen = set()
    for line in (ROOT / summary["sidecar"]["path"]).read_text().splitlines():
        row = json.loads(line)
        index = row["candidate_family_row_1based"]
        if index in seen or partitions[index][:2] != (row["candidate_row_sha256"], "mitch_hamidi_bpd_nlp"):
            raise ValueError("crosswalk row does not bind exactly to v6 partition")
        seen.add(index)
        split = partitions[index][2]
        count = counts[split]
        count["rows"] += 1
        count[row["existing_source_match_status"]] += 1
        count["rows_with_dated_artifact_match"] += bool(row["ingested_artifact_matches"])
        count["rows_with_pinned_file_artifact_match"] += bool(row["pinned_commit_file_matches"])
        for match in row["pinned_commit_file_matches"]:
            locators[str(match["artifact_line_ordinal"])].add(split)
    expected = next(
        entry["partition_counts"]
        for entry in source_audit["legacy_source_followup_queue"]
        if entry["source_label"] == "mitch_hamidi_bpd_nlp"
    )
    if {split: count["rows"] for split, count in counts.items()} != expected or len(seen) != summary["sidecar"]["rows"]:
        raise ValueError("v6 Mitch family coverage differs from frozen source audit")
    report = {
        "schema_version": "v6-mitch-ingestion-crosswalk-v1",
        "candidate_sha256": source_audit["candidate_sha256"],
        "release_manifest_sha256": digest(RELEASE),
        "heldout_sha256": source_audit["heldout_sha256"],
        "crosswalk_sha256": summary["sidecar"]["sha256"],
        "crosswalk_summary_sha256": digest(summary_path),
        "pinned_repo": summary["pinned_public_repo"],
        "pinned_revision": summary["pinned_public_commit"],
        "dated_ingestion_sha256": summary["ingestion_artifact"]["sha256"],
        "by_v6_partition": {split: dict(count) for split, count in sorted(counts.items())},
        "matched_dated_artifact_line_overlap": {
            "distinct_pinned_file_artifact_lines": len(locators),
            "lines_crossing_v6_partitions": sum(len(splits) > 1 for splits in locators.values()),
        },
        "rights_privacy_or_clinical_clearance_granted": False,
        "limitations": [
            "Exact message correspondence in a dated artifact does not prove that artifact fed the candidate build.",
            "Pinned-file matches retain all ambiguous alternatives; source-row statuses are not upgraded.",
            "This bridges revalidated dated ingestion evidence, not a fresh independent rerun of the public upstream CSV adapter.",
            "No corpus rows, targets, source decisions, authorization or explicit holdouts changed.",
        ],
    }
    output = ROOT / "docs/training/execution-2026-10-21/v6-mitch-ingestion-crosswalk.json"
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
