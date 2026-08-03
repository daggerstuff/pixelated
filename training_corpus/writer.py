"""Artifact writer for the fresh training corpus builder."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .benchmarks import benchmark_slice_name, build_benchmark_summary
from .model import CorpusEntry, CorpusManifest, CorpusSource
from .source_inventory import inventory_rows


@dataclass(frozen=True)
class ArtifactReportBundle:
    leakage_report: dict[str, object]
    governance_report: dict[str, object]
    continuity_report: dict[str, object]


@dataclass(frozen=True)
class ArtifactWriteRequest:
    destination: Path
    sources: tuple[CorpusSource, ...]
    entries: tuple[CorpusEntry, ...]
    manifest: CorpusManifest
    reports: ArtifactReportBundle
    build_context: dict[str, Any]


def build_manifest(
    *,
    name: str,
    version: str,
    destination: Path,
    entries: tuple[CorpusEntry, ...],
) -> CorpusManifest:
    return CorpusManifest(
        name=name,
        version=version,
        destination=destination,
        total_entries=len(entries),
        by_split=dict(Counter(entry.split for entry in entries)),
        by_stage=dict(Counter(entry.stage for entry in entries)),
        by_corpus=dict(Counter(entry.source_id for entry in entries)),
        by_lane=dict(Counter(entry.lane for entry in entries)),
        by_family=dict(Counter(entry.source_family for entry in entries)),
    )


def build_rubric_coverage_summary(entries: tuple[CorpusEntry, ...]) -> dict[str, object]:
    by_lane: dict[str, dict[str, int]] = {}
    total_entries_with_rubrics = 0
    total_rubric_items = 0

    for lane_name in ("simulation", "policy", "evaluator", "benchmark"):
        lane_entries = [entry for entry in entries if entry.lane == lane_name]
        entries_with_rubrics = 0
        rubric_items = 0
        for entry in lane_entries:
            items = entry.attributes.get("rubric_items")
            if isinstance(items, list) and items:
                entries_with_rubrics += 1
                rubric_items += len(items)
        total_entries_with_rubrics += entries_with_rubrics
        total_rubric_items += rubric_items
        by_lane[lane_name] = {
            "entries": len(lane_entries),
            "entries_with_rubrics": entries_with_rubrics,
            "rubric_items": rubric_items,
        }

    return {
        "entries_with_rubrics": total_entries_with_rubrics,
        "rubric_items": total_rubric_items,
        "by_lane": by_lane,
    }


def build_clinician_review_summary(entries: tuple[CorpusEntry, ...]) -> dict[str, object]:
    by_lane: dict[str, dict[str, object]] = {}
    by_status: Counter[str] = Counter()
    entries_with_hooks = 0
    reviewed_entries = 0
    calibration_subset_entries = 0

    for lane_name in ("simulation", "policy", "evaluator", "benchmark"):
        lane_entries = [entry for entry in entries if entry.lane == lane_name]
        lane_hooks = 0
        lane_reviewed = 0
        lane_calibration = 0
        for entry in lane_entries:
            review = entry.attributes.get("clinician_review")
            if not isinstance(review, dict):
                continue
            lane_hooks += 1
            entries_with_hooks += 1
            status = str(review.get("status") or "unreviewed")
            by_status[status] += 1
            if status in {"approved", "reviewed", "calibrated"}:
                lane_reviewed += 1
                reviewed_entries += 1
            if bool(review.get("calibration_subset")):
                lane_calibration += 1
                calibration_subset_entries += 1
        by_lane[lane_name] = {
            "entries": len(lane_entries),
            "entries_with_hooks": lane_hooks,
            "reviewed_entries": lane_reviewed,
            "calibration_subset_entries": lane_calibration,
        }

    return {
        "entries_with_hooks": entries_with_hooks,
        "reviewed_entries": reviewed_entries,
        "calibration_subset_entries": calibration_subset_entries,
        "by_status": dict(by_status),
        "by_lane": by_lane,
    }


def build_split_manifest(
    manifest: CorpusManifest,
    entries: tuple[CorpusEntry, ...],
    leakage_report: dict[str, object],
    split_seed: str,
) -> dict[str, object]:
    by_split_and_lane: dict[str, dict[str, int]] = {}
    for split_name in ("train", "val", "test"):
        by_split_and_lane[split_name] = dict(Counter(entry.lane for entry in entries if entry.split == split_name))

    return {
        "split_seed": split_seed,
        "by_split": manifest.by_split,
        "by_split_and_lane": by_split_and_lane,
        "zero_train_eval_leakage": bool(leakage_report.get("zero_train_eval_leakage", False)),
        "split_collision_count": int(leakage_report.get("split_collision_count", 0)),
    }


def build_transformation_log(
    build_context: dict[str, Any],
    leakage_report: dict[str, object],
    governance_report: dict[str, object],
    continuity_report: dict[str, object],
) -> dict[str, object]:
    return {
        "builder": {
            "name": build_context["name"],
            "version": build_context["version"],
            "split_seed": build_context["split_seed"],
        },
        "thresholds": {
            "min_quality_score": build_context["min_quality_score"],
            "min_safety_score": build_context["min_safety_score"],
        },
        "source_inventory": build_context["source_counters"],
        "row_processing": build_context["row_counters"],
        "deduplication": {
            "duplicate_events": leakage_report["duplicate_events"],
            "replaced_events": leakage_report["replaced_events"],
            "near_duplicate_events": leakage_report["near_duplicate_events"],
            "near_duplicate_replacements": leakage_report["near_duplicate_replacements"],
            "distinct_content_hashes": leakage_report["distinct_content_hashes"],
        },
        "continuity_checks": continuity_report,
        "release_gates": {
            "passed": governance_report["passed"],
            "blocking_issue_count": governance_report["blocking_issue_count"],
        },
    }


def build_data_card(
    sources: tuple[CorpusSource, ...],
    manifest: CorpusManifest,
    rubric_summary: dict[str, object],
    clinician_review_summary: dict[str, object],
    benchmark_summary: dict[str, object],
) -> dict[str, object]:
    kept_sources = [source for source in sources if source.inventory_decision == "keep"]
    source_family_counts = Counter(source.family for source in kept_sources)
    rights_summary = Counter(source.license_status for source in sources)

    return {
        "name": manifest.name,
        "version": manifest.version,
        "intended_use": (
            "Client-simulator-first training corpus for therapist practice, crisis rehearsal, "
            "and supervisor-aligned evaluation."
        ),
        "non_intended_use": [
            "Generic therapist-side assistant behavior",
            "Diagnostic decision support",
            "Identity mimicry from transcript-derived persona material",
            "Direct reuse of benchmark or evaluator traces in client simulation by default",
        ],
        "source_families": dict(source_family_counts),
        "provenance_method": (
            "Registry-backed source inventory with per-source lane decisions, rights status, "
            "and release gating tied to registry paths and local fixture resolution."
        ),
        "licensing_summary": dict(rights_summary),
        "inclusion_rules": [
            "Only keep sources routed through fresh lane-aware contracts.",
            "Require explicit keep decisions plus non-empty lane assignments.",
            "Admit severe scenarios only when provenance and privacy gates pass.",
        ],
        "exclusion_rules": [
            "Reject compiled legacy mixtures and unresolved raw forum bundles.",
            "Defer transcript-derived identity material until archetype extraction exists.",
            "Keep evaluator rubric traces out of simulation by default.",
        ],
        "annotation_and_rubric_process": {
            "rubric_entries": rubric_summary["entries_with_rubrics"],
            "rubric_items": rubric_summary["rubric_items"],
            "clinician_review_hooks": clinician_review_summary["entries_with_hooks"],
            "clinician_reviewed_entries": clinician_review_summary["reviewed_entries"],
            "lanes_with_rubrics": [
                lane_name
                for lane_name, lane_summary in rubric_summary["by_lane"].items()
                if lane_summary["entries_with_rubrics"] > 0
            ],
        },
        "benchmark_coverage": benchmark_summary,
        "known_biases_and_gaps": [
            "Transcript-derived persona material remains deferred to avoid identity mimicry risk.",
            "Multilingual coverage depends on benchmark-tagged examples rather than broad training inclusion.",
            "Rights-cleared per-source license expansion is still needed before a wider release.",
        ],
        "version_deltas": {
            "current_version": manifest.version,
            "previous_version": None,
            "summary": "Initial fresh-namespace release package for the experimental training corpus rewrite.",
        },
    }


def build_release_checklist(
    manifest: CorpusManifest,
    reports: ArtifactReportBundle,
    release_metrics: dict[str, dict[str, object]],
    data_card_path: Path,
    release_notes_path: Path,
) -> dict[str, object]:
    leakage_report = reports.leakage_report
    governance_report = reports.governance_report
    continuity_report = reports.continuity_report
    rubric_summary = release_metrics["rubric_summary"]
    benchmark_summary = release_metrics["benchmark_summary"]
    clinician_review_summary = release_metrics["clinician_review_summary"]
    checks = [
        {
            "name": "corpus_entries_present",
            "passed": manifest.total_entries > 0,
            "details": f"{manifest.total_entries} entries written.",
        },
        {
            "name": "zero_train_eval_leakage",
            "passed": bool(leakage_report["zero_train_eval_leakage"]),
            "details": f"{leakage_report['split_collision_count']} split collisions detected.",
        },
        {
            "name": "provenance_and_privacy_gates",
            "passed": bool(governance_report["passed"]),
            "details": f"{governance_report['blocking_issue_count']} blocking governance issues.",
        },
        {
            "name": "rubric_coverage_present",
            "passed": int(rubric_summary["entries_with_rubrics"]) > 0,
            "details": f"{rubric_summary['entries_with_rubrics']} rubric-backed entries.",
        },
        {
            "name": "benchmark_package_present",
            "passed": int(benchmark_summary["benchmark_entries"]) > 0,
            "details": f"{benchmark_summary['benchmark_entries']} benchmark entries emitted.",
        },
        {
            "name": "clinician_review_hooks_present",
            "passed": (
                int(rubric_summary["entries_with_rubrics"]) == 0
                or int(clinician_review_summary["entries_with_hooks"]) > 0
            ),
            "details": (
                f"{clinician_review_summary['entries_with_hooks']} clinician-review hooks across "
                "evaluator and benchmark lanes."
            ),
        },
        {
            "name": "continuity_checks_passed",
            "passed": bool(continuity_report["passed"]),
            "details": f"{continuity_report['continuity_issue_count']} long-running continuity issues.",
        },
        {
            "name": "release_docs_present",
            "passed": data_card_path.exists() and release_notes_path.exists(),
            "details": "Data card and release notes emitted.",
        },
    ]

    return {
        "passed": all(check["passed"] for check in checks),
        "checks": checks,
    }


def build_release_notes(
    manifest: CorpusManifest,
    leakage_report: dict[str, object],
    governance_report: dict[str, object],
    continuity_report: dict[str, object],
    benchmark_summary: dict[str, object],
) -> str:
    lines = [
        f"# {manifest.name} {manifest.version} Release Notes",
        "",
        "## Summary",
        (
            f"- Emitted {manifest.total_entries} entries across {len(manifest.by_lane)} lanes "
            f"from {len(manifest.by_corpus)} source inventories."
        ),
        f"- Benchmark package contains {benchmark_summary['benchmark_entries']} held-out entries.",
        (
            f"- Deduplication observed {leakage_report['duplicate_events']} duplicate events "
            f"with {leakage_report['replaced_events']} replacements and "
            f"{leakage_report['near_duplicate_events']} near-duplicate collisions."
        ),
        "",
        "## Release Gates",
        f"- Train/eval leakage clear: {bool(leakage_report['zero_train_eval_leakage'])}",
        f"- Governance gates passed: {bool(governance_report['passed'])}",
        f"- Blocking governance issues: {governance_report['blocking_issue_count']}",
        f"- Long-running continuity checks passed: {bool(continuity_report['passed'])}",
    ]
    return "\n".join(lines) + "\n"


def _artifact_paths(destination: Path) -> dict[str, Path]:
    return {
        "build_config": destination / "build_config.json",
        "continuity_report": destination / "continuity_report.json",
        "corpus": destination / "corpus.jsonl",
        "data_card": destination / "data_card.json",
        "benchmark_package": destination / "benchmark_package.json",
        "benchmark_summary": destination / "benchmark_summary.json",
        "leakage_report": destination / "leakage_report.json",
        "manifest": destination / "manifest.json",
        "package": destination / "package.json",
        "release_checklist": destination / "release_checklist.json",
        "release_notes": destination / "release_notes.md",
        "rubric_coverage_summary": destination / "rubric_coverage_summary.json",
        "clinician_review_summary": destination / "clinician_review_summary.json",
        "safety_governance_summary": destination / "safety_governance_summary.json",
        "source_inventory": destination / "source_inventory.json",
        "split_manifest": destination / "split_manifest.json",
        "transformation_log": destination / "transformation_log.json",
    }


def _as_json(entry: CorpusEntry) -> dict[str, object]:
    return {
        "entry_id": entry.entry_id,
        "source_id": entry.source_id,
        "stage": entry.stage,
        "lane": entry.lane,
        "prompt": entry.prompt,
        "response": entry.response,
        "split": entry.split,
        "source_family": entry.source_family,
        "source_type": entry.source_type,
        "attributes": entry.attributes,
    }


def _write_json(path: Path, payload: object) -> None:
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def _write_jsonl(path: Path, entries: tuple[CorpusEntry, ...]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(json.dumps(_as_json(entry), ensure_ascii=False) + "\n")


def _write_entry_partitions(
    split_dir: Path,
    lane_dir: Path,
    entries: tuple[CorpusEntry, ...],
) -> dict[str, dict[str, Path]]:
    for split_name in ("train", "val", "test"):
        _write_jsonl(split_dir / f"{split_name}.jsonl", tuple(entry for entry in entries if entry.split == split_name))

    lane_artifacts: dict[str, Path] = {}
    for lane_name in ("simulation", "policy", "evaluator", "benchmark"):
        lane_path = lane_dir / f"{lane_name}.jsonl"
        _write_jsonl(lane_path, tuple(entry for entry in entries if entry.lane == lane_name))
        lane_artifacts[lane_name] = lane_path
    return {"lanes": lane_artifacts}


def _write_benchmark_partitions(
    benchmark_dir: Path,
    entries: tuple[CorpusEntry, ...],
) -> dict[str, Path]:
    benchmark_artifacts: dict[str, Path] = {}
    for slice_name in (
        "benchmark_core",
        "benchmark_crisis",
        "benchmark_edge_cases",
        "benchmark_persona_texture",
        "benchmark_supervisor_rubrics",
        "benchmark_multilingual",
        "benchmark_long_running_continuity",
        "benchmark_specialized_domains",
    ):
        slice_path = benchmark_dir / f"{slice_name}.jsonl"
        _write_jsonl(
            slice_path,
            tuple(entry for entry in entries if benchmark_slice_name(entry) == slice_name),
        )
        benchmark_artifacts[slice_name] = slice_path
    return benchmark_artifacts


def write_artifacts(request: ArtifactWriteRequest) -> dict[str, Path]:
    destination = request.destination
    sources = request.sources
    entries = request.entries
    manifest = request.manifest
    reports = request.reports
    build_context = request.build_context
    destination.mkdir(parents=True, exist_ok=True)
    split_dir = destination / "splits"
    split_dir.mkdir(parents=True, exist_ok=True)
    lane_dir = destination / "lanes"
    lane_dir.mkdir(parents=True, exist_ok=True)
    benchmark_dir = destination / "benchmarks"
    benchmark_dir.mkdir(parents=True, exist_ok=True)
    artifact_paths = _artifact_paths(destination)

    _write_jsonl(artifact_paths["corpus"], entries)
    lane_artifacts = _write_entry_partitions(split_dir, lane_dir, entries)["lanes"]
    benchmark_artifacts = _write_benchmark_partitions(benchmark_dir, entries)

    _write_json(artifact_paths["source_inventory"], {"sources": inventory_rows(sources)})
    _write_json(artifact_paths["leakage_report"], reports.leakage_report)
    _write_json(artifact_paths["build_config"], build_context)

    rubric_summary = build_rubric_coverage_summary(entries)
    _write_json(artifact_paths["rubric_coverage_summary"], rubric_summary)

    clinician_review_summary = build_clinician_review_summary(entries)
    _write_json(artifact_paths["clinician_review_summary"], clinician_review_summary)
    _write_json(artifact_paths["safety_governance_summary"], reports.governance_report)
    _write_json(artifact_paths["continuity_report"], reports.continuity_report)

    benchmark_summary = build_benchmark_summary(entries)
    _write_json(artifact_paths["benchmark_summary"], benchmark_summary)

    split_manifest = build_split_manifest(
        manifest,
        entries,
        reports.leakage_report,
        str(build_context["split_seed"]),
    )
    _write_json(artifact_paths["split_manifest"], split_manifest)

    transformation_log = build_transformation_log(
        build_context,
        reports.leakage_report,
        reports.governance_report,
        reports.continuity_report,
    )
    _write_json(artifact_paths["transformation_log"], transformation_log)

    benchmark_package = {
        "benchmark_entries": benchmark_summary["benchmark_entries"],
        "slices": {name: str(path) for name, path in benchmark_artifacts.items()},
    }
    _write_json(artifact_paths["benchmark_package"], benchmark_package)

    data_card = build_data_card(
        sources,
        manifest,
        rubric_summary,
        clinician_review_summary,
        benchmark_summary,
    )
    _write_json(artifact_paths["data_card"], data_card)

    release_notes = build_release_notes(
        manifest,
        reports.leakage_report,
        reports.governance_report,
        reports.continuity_report,
        benchmark_summary,
    )
    artifact_paths["release_notes"].write_text(release_notes, encoding="utf-8")

    release_checklist = build_release_checklist(
        manifest,
        reports,
        release_metrics={
            "rubric_summary": rubric_summary,
            "benchmark_summary": benchmark_summary,
            "clinician_review_summary": clinician_review_summary,
        },
        data_card_path=artifact_paths["data_card"],
        release_notes_path=artifact_paths["release_notes"],
    )
    _write_json(artifact_paths["release_checklist"], release_checklist)

    _write_json(
        artifact_paths["manifest"],
        {
            "name": manifest.name,
            "version": manifest.version,
            "destination": str(manifest.destination),
            "total_entries": manifest.total_entries,
            "by_split": manifest.by_split,
            "by_stage": manifest.by_stage,
            "by_corpus": manifest.by_corpus,
            "by_lane": manifest.by_lane,
            "by_family": manifest.by_family,
        },
    )

    _write_json(
        artifact_paths["package"],
        {
            "corpus": str(artifact_paths["corpus"]),
            "manifest": str(artifact_paths["manifest"]),
            "source_inventory": str(artifact_paths["source_inventory"]),
            "leakage_report": str(artifact_paths["leakage_report"]),
            "split_manifest": str(artifact_paths["split_manifest"]),
            "transformation_log": str(artifact_paths["transformation_log"]),
            "build_config": str(artifact_paths["build_config"]),
            "rubric_coverage_summary": str(artifact_paths["rubric_coverage_summary"]),
            "clinician_review_summary": str(artifact_paths["clinician_review_summary"]),
            "safety_governance_summary": str(artifact_paths["safety_governance_summary"]),
            "continuity_report": str(artifact_paths["continuity_report"]),
            "benchmark_summary": str(artifact_paths["benchmark_summary"]),
            "benchmark_package": str(artifact_paths["benchmark_package"]),
            "data_card": str(artifact_paths["data_card"]),
            "release_checklist": str(artifact_paths["release_checklist"]),
            "release_notes": str(artifact_paths["release_notes"]),
            "splits": {
                "train": str(split_dir / "train.jsonl"),
                "val": str(split_dir / "val.jsonl"),
                "test": str(split_dir / "test.jsonl"),
            },
            "lanes": {lane: str(path) for lane, path in lane_artifacts.items()},
            "benchmarks": {name: str(path) for name, path in benchmark_artifacts.items()},
        },
    )

    return {
        **artifact_paths,
        **{f"lane_{lane}": path for lane, path in lane_artifacts.items()},
        **{f"benchmark_{name}": path for name, path in benchmark_artifacts.items()},
    }
