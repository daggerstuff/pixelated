from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from scripts.training.audit_v6_mentalchat_origin import bridge, locator_overlap_summary


def write_json(path: Path, value: dict) -> str:
    path.write_text(json.dumps(value) + "\n")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def origin_fixture(root: Path) -> tuple[Path, Path, dict]:
    row = {"source": "mentalchat16k", "messages": [{"role": "user", "content": "Synthetic fixture"}]}
    raw = json.dumps(row)
    row_hash = hashlib.sha256(raw.encode()).hexdigest()
    (root / "candidate.jsonl").write_text(raw + "\n")
    member_hash = write_json(
        root / "membership.jsonl",
        {
            "candidate_row_number_1based": 1,
            "candidate_row_sha256": row_hash,
            "source_label": "mentalchat16k",
            "split": "train",
        },
    )
    (root / "heldout.jsonl").write_text("")
    write_json(
        root / "release.json",
        {
            "release_id": "synthetic-fixture",
            "source_candidate": {
                "path": "candidate.jsonl",
                "sha256": hashlib.sha256((raw + "\n").encode()).hexdigest(),
            },
            "internal_manifest": {"path": "membership.jsonl", "sha256": member_hash},
            "evidence": {
                "group_disjointness": {
                    "heldout_exclusions_path": "heldout.jsonl",
                    "heldout_exclusions_sha256": hashlib.sha256(b"").hexdigest(),
                }
            },
        },
    )
    write_json(
        root / "sidecar.jsonl",
        {
            "candidate_row_number_1based": 1,
            "candidate_line_sha256": row_hash,
            "source_label": "mentalchat16k",
            "exact_match_status": "unmatched",
            "normalized_match_status": "unique_upstream_row",
            "exact_adapter_sequence_matches": [],
            "normalized_adapter_sequence_matches": [
                {
                    "repo": "synthetic/repo",
                    "revision": "fixture-revision",
                    "file": "fixture.csv",
                    "row_number_1based": 1,
                }
            ],
        },
    )
    validation = {
        "results": {
            "candidate_family_rows": 1,
            "exact_status_counts": {"unmatched": 1},
            "normalized_status_counts": {"unique_upstream_row": 1},
        },
        "source_repo": "synthetic/repo",
        "source_revision": "fixture-revision",
        "source_files": {},
        "adapter_sha256": "fixture-adapter",
        "candidate": {"sha256": "fixture-legacy-candidate"},
    }
    return root / "release.json", root / "sidecar.jsonl", validation


def test_normalized_origin_does_not_become_exact_or_clearance(tmp_path: Path) -> None:
    release, sidecar, validation = origin_fixture(tmp_path)
    report = bridge(tmp_path, release, sidecar, validation)
    assert report["by_v6_partition"]["train"] == {
        "rows": 1,
        "exact_unmatched": 1,
        "normalized_unique_upstream_row": 1,
    }
    assert report["rights_privacy_or_clinical_clearance_granted"] is False


def test_changed_candidate_cannot_reuse_origin_reference(tmp_path: Path) -> None:
    release, sidecar, validation = origin_fixture(tmp_path)
    (tmp_path / "candidate.jsonl").write_text(json.dumps({"source": "mentalchat16k", "messages": []}) + "\n")
    with pytest.raises(ValueError, match="does not bind to revalidated origin sidecar"):
        bridge(tmp_path, release, sidecar, validation)


def test_changed_partition_evidence_is_rejected(tmp_path: Path) -> None:
    release, sidecar, validation = origin_fixture(tmp_path)
    (tmp_path / "membership.jsonl").write_text("{}\n")
    with pytest.raises(ValueError, match="partition evidence changed"):
        bridge(tmp_path, release, sidecar, validation)


def test_origin_status_disagreement_is_rejected(tmp_path: Path) -> None:
    release, sidecar, validation = origin_fixture(tmp_path)
    validation["results"]["exact_status_counts"] = {"unique_upstream_row": 1}
    with pytest.raises(ValueError, match="status counts differ"):
        bridge(tmp_path, release, sidecar, validation)


def test_locator_overlap_keeps_train_test_and_holdout_exposure_visible() -> None:
    counts = locator_overlap_summary(
        {
            "source-row-1": {"train", "test"},
            "source-row-2": {"train", "validation", "heldout"},
            "source-row-3": {"validation"},
        }
    )
    assert counts["distinct_matched_source_rows"] == 3
    assert counts["source_rows_in_multiple_v6_partitions"] == 2
    assert counts["source_rows_shared_by_train_and_test"] == 1
    assert counts["source_rows_shared_by_train_and_validation"] == 1
    assert counts["source_rows_shared_by_train_and_heldout"] == 1
