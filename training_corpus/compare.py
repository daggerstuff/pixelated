"""Compare two built training-corpus package directories."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PackageSnapshot:
    root: Path
    manifest: dict[str, Any]
    benchmark_summary: dict[str, Any]
    rubric_summary: dict[str, Any]
    clinician_review_summary: dict[str, Any]
    release_checklist: dict[str, Any]
    reproducibility_report: dict[str, Any]

    @property
    def name(self) -> str:
        return str(self.manifest.get("name") or self.root.name)

    @property
    def version(self) -> str:
        return str(self.manifest.get("version") or "unknown")


def load_package_snapshot(root: Path) -> PackageSnapshot:
    return PackageSnapshot(
        root=root,
        manifest=_read_json(root / "manifest.json"),
        benchmark_summary=_read_json(root / "benchmark_summary.json"),
        rubric_summary=_read_json(root / "rubric_coverage_summary.json"),
        clinician_review_summary=_read_json(root / "clinician_review_summary.json"),
        release_checklist=_read_json(root / "release_checklist.json"),
        reproducibility_report=_read_json(root / "reproducibility_report.json"),
    )


def compare_package_snapshots(left: PackageSnapshot, right: PackageSnapshot) -> dict[str, Any]:
    return {
        "left": _package_header(left),
        "right": _package_header(right),
        "entry_totals": {
            "left": int(left.manifest["total_entries"]),
            "right": int(right.manifest["total_entries"]),
            "delta": int(right.manifest["total_entries"]) - int(left.manifest["total_entries"]),
        },
        "lane_delta": _counter_delta(left.manifest.get("by_lane"), right.manifest.get("by_lane")),
        "stage_delta": _counter_delta(left.manifest.get("by_stage"), right.manifest.get("by_stage")),
        "family_delta": _counter_delta(left.manifest.get("by_family"), right.manifest.get("by_family")),
        "corpus_delta": _counter_delta(left.manifest.get("by_corpus"), right.manifest.get("by_corpus")),
        "benchmark_slice_delta": _counter_delta(
            left.benchmark_summary.get("by_slice"),
            right.benchmark_summary.get("by_slice"),
        ),
        "rubric_delta": {
            "entries_with_rubrics": _numeric_delta(
                left.rubric_summary.get("entries_with_rubrics"),
                right.rubric_summary.get("entries_with_rubrics"),
            ),
            "rubric_items": _numeric_delta(
                left.rubric_summary.get("rubric_items"),
                right.rubric_summary.get("rubric_items"),
            ),
            "by_lane": {
                lane: {
                    key: _numeric_delta(left_lane.get(key), right_lane.get(key))
                    for key in ("entries", "entries_with_rubrics", "rubric_items")
                }
                for lane, left_lane, right_lane in _paired_lane_objects(
                    left.rubric_summary.get("by_lane"),
                    right.rubric_summary.get("by_lane"),
                )
            },
        },
        "clinician_review_delta": {
            "entries_with_hooks": _numeric_delta(
                left.clinician_review_summary.get("entries_with_hooks"),
                right.clinician_review_summary.get("entries_with_hooks"),
            ),
            "calibration_subset_entries": _numeric_delta(
                left.clinician_review_summary.get("calibration_subset_entries"),
                right.clinician_review_summary.get("calibration_subset_entries"),
            ),
            "by_lane": {
                lane: {
                    key: _numeric_delta(left_lane.get(key), right_lane.get(key))
                    for key in ("entries", "entries_with_hooks", "calibration_subset_entries")
                }
                for lane, left_lane, right_lane in _paired_lane_objects(
                    left.clinician_review_summary.get("by_lane"),
                    right.clinician_review_summary.get("by_lane"),
                )
            },
        },
        "release_check_comparison": {
            check_name: {
                "left_passed": left_check.get("passed"),
                "right_passed": right_check.get("passed"),
                "left_details": left_check.get("details"),
                "right_details": right_check.get("details"),
            }
            for check_name, left_check, right_check in _paired_checks(
                left.release_checklist.get("checks"),
                right.release_checklist.get("checks"),
            )
        },
        "reproducibility": {
            "left_verified": bool(left.reproducibility_report.get("verified")),
            "right_verified": bool(right.reproducibility_report.get("verified")),
        },
    }


def write_package_comparison(
    left_root: Path,
    right_root: Path,
    output_dir: Path,
) -> dict[str, Any]:
    left = load_package_snapshot(left_root)
    right = load_package_snapshot(right_root)
    comparison = compare_package_snapshots(left, right)
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "package_comparison.json"
    md_path = output_dir / "package_comparison.md"
    json_path.write_text(f"{json.dumps(comparison, indent=2)}\n", encoding="utf-8")
    md_path.write_text(_comparison_markdown(comparison), encoding="utf-8")
    return comparison


def _read_json(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object at {path}")
    return payload


def _package_header(snapshot: PackageSnapshot) -> dict[str, Any]:
    return {
        "name": snapshot.name,
        "version": snapshot.version,
        "root": str(snapshot.root),
    }


def _numeric_delta(left: Any, right: Any) -> dict[str, int]:
    left_value = int(left or 0)
    right_value = int(right or 0)
    return {"left": left_value, "right": right_value, "delta": right_value - left_value}


def _counter_delta(left: Any, right: Any) -> dict[str, dict[str, int]]:
    left_map = left if isinstance(left, dict) else {}
    right_map = right if isinstance(right, dict) else {}
    keys = sorted({str(key) for key in left_map} | {str(key) for key in right_map})
    return {key: _numeric_delta(left_map.get(key), right_map.get(key)) for key in keys}


def _paired_lane_objects(
    left: Any,
    right: Any,
) -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
    left_map = left if isinstance(left, dict) else {}
    right_map = right if isinstance(right, dict) else {}
    keys = sorted({str(key) for key in left_map} | {str(key) for key in right_map})
    pairs: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
    for key in keys:
        left_lane = left_map.get(key) if isinstance(left_map.get(key), dict) else {}
        right_lane = right_map.get(key) if isinstance(right_map.get(key), dict) else {}
        pairs.append((key, left_lane, right_lane))
    return pairs


def _paired_checks(
    left: Any,
    right: Any,
) -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
    left_checks = (
        {str(check["name"]): check for check in left if isinstance(check, dict) and isinstance(check.get("name"), str)}
        if isinstance(left, list)
        else {}
    )
    right_checks = (
        {str(check["name"]): check for check in right if isinstance(check, dict) and isinstance(check.get("name"), str)}
        if isinstance(right, list)
        else {}
    )
    keys = sorted(set(left_checks) | set(right_checks))
    return [(key, left_checks.get(key, {}), right_checks.get(key, {})) for key in keys]


def _comparison_markdown(comparison: dict[str, Any]) -> str:
    lines = [
        "# Training Corpus Package Comparison",
        "",
        f"- Left: {comparison['left']['name']} ({comparison['left']['version']})",
        f"- Right: {comparison['right']['name']} ({comparison['right']['version']})",
        "",
        "## Entry Totals",
        f"- Left: {comparison['entry_totals']['left']}",
        f"- Right: {comparison['entry_totals']['right']}",
        f"- Delta: {comparison['entry_totals']['delta']}",
        "",
        "## Lane Delta",
    ]
    for lane, payload in comparison["lane_delta"].items():
        lines.append(f"- {lane}: left={payload['left']} right={payload['right']} delta={payload['delta']}")
    lines.extend(["", "## Benchmark Slice Delta"])
    for slice_name, payload in comparison["benchmark_slice_delta"].items():
        lines.append(f"- {slice_name}: left={payload['left']} right={payload['right']} delta={payload['delta']}")
    lines.extend(["", "## Release Checks"])
    for check_name, payload in comparison["release_check_comparison"].items():
        lines.append(f"- {check_name}: left={payload['left_passed']} right={payload['right_passed']}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("left_root", type=Path)
    parser.add_argument("right_root", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    write_package_comparison(args.left_root, args.right_root, args.output_dir)


if __name__ == "__main__":
    main()
