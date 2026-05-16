from __future__ import annotations

import json
from pathlib import Path

from ai.training_corpus.compare import (
    compare_package_snapshots,
    load_package_snapshot,
    write_package_comparison,
)


def _write_package_fixture(
    root: Path,
    payload: dict[str, object],
) -> None:
    root.mkdir(parents=True, exist_ok=True)
    name = str(payload["name"])
    version = str(payload["version"])
    total_entries = int(payload["total_entries"])
    by_lane = dict(payload["by_lane"])
    benchmark_by_slice = dict(payload["benchmark_by_slice"])
    entries_with_rubrics = int(payload["entries_with_rubrics"])
    rubric_items = int(payload["rubric_items"])
    clinician_hooks = int(payload["clinician_hooks"])
    (root / "manifest.json").write_text(
        json.dumps(
            {
                "name": name,
                "version": version,
                "total_entries": total_entries,
                "by_lane": by_lane,
                "by_stage": {"stage1_foundation": by_lane.get("simulation", 0)},
                "by_family": {"professional_therapeutic": total_entries},
                "by_corpus": {"professional_therapeutic.demo": total_entries},
            }
        ),
        encoding="utf-8",
    )
    (root / "benchmark_summary.json").write_text(
        json.dumps(
            {
                "benchmark_entries": by_lane.get("benchmark", 0),
                "by_slice": benchmark_by_slice,
            }
        ),
        encoding="utf-8",
    )
    (root / "rubric_coverage_summary.json").write_text(
        json.dumps(
            {
                "entries_with_rubrics": entries_with_rubrics,
                "rubric_items": rubric_items,
                "by_lane": {
                    lane: {
                        "entries": count,
                        "entries_with_rubrics": count if lane != "simulation" else 0,
                        "rubric_items": count * 3 if lane != "simulation" else 0,
                    }
                    for lane, count in by_lane.items()
                },
            }
        ),
        encoding="utf-8",
    )
    (root / "clinician_review_summary.json").write_text(
        json.dumps(
            {
                "entries_with_hooks": clinician_hooks,
                "calibration_subset_entries": clinician_hooks,
                "by_lane": {
                    lane: {
                        "entries": count,
                        "entries_with_hooks": count if lane != "simulation" else 0,
                        "calibration_subset_entries": count if lane != "simulation" else 0,
                    }
                    for lane, count in by_lane.items()
                },
            }
        ),
        encoding="utf-8",
    )
    (root / "release_checklist.json").write_text(
        json.dumps(
            {
                "passed": True,
                "checks": [
                    {"name": "corpus_entries_present", "passed": True, "details": f"{total_entries} entries"},
                    {"name": "continuity_checks_passed", "passed": True, "details": "0 issues"},
                ],
            }
        ),
        encoding="utf-8",
    )
    (root / "reproducibility_report.json").write_text(
        json.dumps({"enabled": True, "verified": True}),
        encoding="utf-8",
    )


def test_compare_package_snapshots_reports_expected_deltas(tmp_path: Path) -> None:
    left_root = tmp_path / "left"
    right_root = tmp_path / "right"
    _write_package_fixture(
        left_root,
        {
            "name": "wave1",
            "version": "v1",
            "total_entries": 22,
            "by_lane": {"simulation": 6, "evaluator": 6, "benchmark": 10},
            "benchmark_by_slice": {"benchmark_crisis": 3},
            "entries_with_rubrics": 16,
            "rubric_items": 48,
            "clinician_hooks": 16,
        },
    )
    _write_package_fixture(
        right_root,
        {
            "name": "release",
            "version": "v2",
            "total_entries": 413,
            "by_lane": {"simulation": 273, "evaluator": 66, "policy": 23, "benchmark": 51},
            "benchmark_by_slice": {"benchmark_crisis": 26, "benchmark_multilingual": 10},
            "entries_with_rubrics": 86,
            "rubric_items": 258,
            "clinician_hooks": 86,
        },
    )

    comparison = compare_package_snapshots(
        load_package_snapshot(left_root),
        load_package_snapshot(right_root),
    )

    assert comparison["entry_totals"]["delta"] == 391
    assert comparison["lane_delta"]["policy"]["right"] == 23
    assert comparison["benchmark_slice_delta"]["benchmark_multilingual"]["delta"] == 10
    assert comparison["rubric_delta"]["entries_with_rubrics"]["delta"] == 70
    assert comparison["clinician_review_delta"]["entries_with_hooks"]["delta"] == 70


def test_write_package_comparison_emits_json_and_markdown(tmp_path: Path) -> None:
    left_root = tmp_path / "left"
    right_root = tmp_path / "right"
    output_root = tmp_path / "comparison"
    _write_package_fixture(
        left_root,
        {
            "name": "wave1",
            "version": "v1",
            "total_entries": 22,
            "by_lane": {"simulation": 6, "evaluator": 6, "benchmark": 10},
            "benchmark_by_slice": {"benchmark_crisis": 3},
            "entries_with_rubrics": 16,
            "rubric_items": 48,
            "clinician_hooks": 16,
        },
    )
    _write_package_fixture(
        right_root,
        {
            "name": "release",
            "version": "v2",
            "total_entries": 413,
            "by_lane": {"simulation": 273, "evaluator": 66, "policy": 23, "benchmark": 51},
            "benchmark_by_slice": {"benchmark_crisis": 26},
            "entries_with_rubrics": 86,
            "rubric_items": 258,
            "clinician_hooks": 86,
        },
    )

    comparison = write_package_comparison(left_root, right_root, output_root)

    assert comparison["left"]["name"] == "wave1"
    assert (output_root / "package_comparison.json").exists()
    assert (output_root / "package_comparison.md").exists()
