"""Build a corpus package by merging two component package artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from .builder import CorpusBuildResult
from .governance import build_governance_report
from .model import CorpusEntry, CorpusSource
from .quality import build_continuity_report, build_leakage_report, deduplicate_near_duplicates
from .writer import ArtifactReportBundle, ArtifactWriteRequest, build_manifest, write_artifacts

DEFAULT_WAVE1_PACKAGE_ROOT = (
    Path(__file__).resolve().parents[2] / ".agent/internal/research/training_corpus_wave1_seed_build_2026-04-09"
)
DEFAULT_DELTA_PACKAGE_ROOT = (
    Path(__file__).resolve().parents[2] / ".agent/internal/research/training_corpus_release_delta_over_wave1_2026-04-09"
)


@dataclass(frozen=True)
class MergePackageConfig:
    base_root: Path = DEFAULT_WAVE1_PACKAGE_ROOT
    overlay_root: Path = DEFAULT_DELTA_PACKAGE_ROOT
    name: str = "pixelated-training-corpus-release-candidate-from-packages"
    version: str = "2026.04.09-rc-from-components"
    verify_reproducibility: bool = True


def build_merged_corpus_package(
    output_dir: Path,
    *,
    config: MergePackageConfig | None = None,
) -> CorpusBuildResult:
    resolved_config = config or MergePackageConfig()
    build_result = _build_merged_once(output_dir, resolved_config)
    reproducibility_report = {"enabled": False, "verified": False, "compared_files": []}
    if resolved_config.verify_reproducibility:
        reproducibility_report = _verify_reproducibility(build_result, resolved_config)
    reproducibility_path = output_dir / "reproducibility_report.json"
    reproducibility_path.write_text(
        f"{json.dumps(reproducibility_report, indent=2)}\n",
        encoding="utf-8",
    )
    return CorpusBuildResult(
        sources=build_result.sources,
        entries=build_result.entries,
        manifest=build_result.manifest,
        artifacts={**build_result.artifacts, "reproducibility_report": reproducibility_path},
    )


def _build_merged_once(output_dir: Path, config: MergePackageConfig) -> CorpusBuildResult:
    base_sources = _load_package_sources(config.base_root)
    overlay_sources = _load_package_sources(config.overlay_root)
    merged_sources = _merge_sources(base_sources, overlay_sources)

    base_entries = _load_package_entries(config.base_root)
    overlay_entries = _load_package_entries(config.overlay_root)
    overlap_ids = sorted({entry.entry_id for entry in base_entries} & {entry.entry_id for entry in overlay_entries})
    if overlap_ids:
        raise ValueError(f"Component packages contain overlapping entries: {', '.join(overlap_ids[:10])}")

    combined_entries = tuple(sorted((*base_entries, *overlay_entries), key=lambda entry: entry.entry_id))
    merged_entries, near_duplicate_report = deduplicate_near_duplicates(combined_entries)
    leakage_report = build_leakage_report(
        merged_entries,
        duplicate_events=0,
        replaced_events=0,
        near_duplicate_report=near_duplicate_report,
    )
    continuity_report = build_continuity_report(merged_entries)
    governance_report = build_governance_report(merged_sources, merged_entries)

    manifest = build_manifest(
        name=config.name,
        version=config.version,
        destination=output_dir,
        entries=merged_entries,
    )
    artifacts = write_artifacts(
        ArtifactWriteRequest(
            destination=output_dir,
            sources=merged_sources,
            entries=merged_entries,
            manifest=manifest,
            reports=ArtifactReportBundle(
                leakage_report=leakage_report,
                governance_report=governance_report,
                continuity_report=continuity_report,
            ),
            build_context={
                "name": config.name,
                "version": config.version,
                "registry_path": "<MERGED_PACKAGE_COMPONENTS>",
                "destination": str(output_dir),
                "split_seed": "pixelated-corpus-v1",
                "min_quality_score": 0.7,
                "min_safety_score": 0.5,
                "source_counters": {
                    "base_sources": len(base_sources),
                    "overlay_sources": len(overlay_sources),
                    "merged_sources": len(merged_sources),
                },
                "row_counters": {
                    "base_entries": len(base_entries),
                    "overlay_entries": len(overlay_entries),
                    "merged_entries": len(merged_entries),
                    "overlap_entries": len(overlap_ids),
                    "near_duplicate_events": int(near_duplicate_report["near_duplicate_events"]),
                },
                "component_packages": {
                    "base_root": str(config.base_root),
                    "overlay_root": str(config.overlay_root),
                },
            },
        )
    )
    return CorpusBuildResult(
        sources=merged_sources,
        entries=merged_entries,
        manifest=manifest,
        artifacts=artifacts,
    )


def _verify_reproducibility(
    build_result: CorpusBuildResult,
    config: MergePackageConfig,
) -> dict[str, object]:
    with TemporaryDirectory(prefix="training-corpus-merge-repro-") as temp_dir:
        comparison_result = _build_merged_once(
            Path(temp_dir),
            MergePackageConfig(
                base_root=config.base_root,
                overlay_root=config.overlay_root,
                name=config.name,
                version=config.version,
                verify_reproducibility=False,
            ),
        )
        compared_files: list[dict[str, object]] = []
        mismatches = 0
        for artifact_name, artifact_path in sorted(build_result.artifacts.items()):
            comparison_path = comparison_result.artifacts.get(artifact_name)
            if comparison_path is None or not artifact_path.exists() or not comparison_path.exists():
                mismatches += 1
                compared_files.append({"artifact": artifact_name, "match": False, "reason": "missing_artifact"})
                continue
            left_hash = _artifact_hash(artifact_path, build_result.manifest.destination)
            right_hash = _artifact_hash(comparison_path, comparison_result.manifest.destination)
            match = left_hash == right_hash
            if not match:
                mismatches += 1
            compared_files.append(
                {
                    "artifact": artifact_name,
                    "match": match,
                    "primary_sha256": left_hash,
                    "rebuild_sha256": right_hash,
                }
            )
    return {
        "enabled": True,
        "verified": mismatches == 0,
        "mismatch_count": mismatches,
        "compared_files": compared_files,
    }


def _artifact_hash(path: Path, destination_root: Path) -> str:
    digest = hashlib.sha256()
    text = path.read_text(encoding="utf-8")
    normalized = text.replace(str(destination_root), "<DESTINATION>")
    digest.update(normalized.encode("utf-8"))
    return digest.hexdigest()


def _load_package_sources(root: Path) -> tuple[CorpusSource, ...]:
    payload = _read_json(root / "source_inventory.json")
    rows = payload.get("sources")
    if not isinstance(rows, list):
        raise ValueError(f"Expected source list at {root / 'source_inventory.json'}")
    sources: list[CorpusSource] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        sources.append(
            CorpusSource(
                source_id=str(row["source_id"]),
                registry_group=str(row["registry_group"]),
                family=str(row["family"]),
                stage=str(row["stage"]),
                locator=Path(str(row["locator"])),
                source_type=str(row["source_type"]),
                quality_profile=_optional_string(row.get("quality_profile")),
                focus=_optional_string(row.get("focus")),
                inventory_decision=str(row["inventory_decision"]),
                rights_status=str(row["rights_status"]),
                license_status=str(row["license_status"]),
                provenance_status=str(row["provenance_status"]),
                benchmark_role=str(row["benchmark_role"]),
                allowed_lanes=tuple(lane for lane in row.get("allowed_lanes", []) if isinstance(lane, str)),
                default_lane=_optional_string(row.get("default_lane")),
                notes=tuple(note for note in row.get("notes", []) if isinstance(note, str)),
                provenance=row.get("provenance", {}) if isinstance(row.get("provenance"), dict) else {},
            )
        )
    return tuple(sorted(sources, key=lambda source: source.source_id))


def _load_package_entries(root: Path) -> tuple[CorpusEntry, ...]:
    rows = _read_jsonl(root / "corpus.jsonl")
    entries: list[CorpusEntry] = []
    for row in rows:
        attributes = row.get("attributes", {})
        entries.append(
            CorpusEntry(
                entry_id=str(row["entry_id"]),
                source_id=str(row["source_id"]),
                stage=str(row["stage"]),
                lane=str(row["lane"]),
                prompt=str(row["prompt"]),
                response=str(row["response"]),
                split=str(row["split"]),
                source_family=str(row["source_family"]),
                source_type=str(row["source_type"]),
                attributes=attributes if isinstance(attributes, dict) else {},
            )
        )
    return tuple(sorted(entries, key=lambda entry: entry.entry_id))


def _merge_sources(
    base_sources: tuple[CorpusSource, ...],
    overlay_sources: tuple[CorpusSource, ...],
) -> tuple[CorpusSource, ...]:
    merged = {source.source_id: source for source in (*base_sources, *overlay_sources)}
    return tuple(sorted(merged.values(), key=lambda source: source.source_id))


def _optional_string(value: Any) -> str | None:
    return str(value) if isinstance(value, str) and value else None


def _read_json(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object at {path}")
    return payload


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            payload = json.loads(stripped)
            if isinstance(payload, dict):
                rows.append(payload)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--base-root", type=Path, default=DEFAULT_WAVE1_PACKAGE_ROOT)
    parser.add_argument("--overlay-root", type=Path, default=DEFAULT_DELTA_PACKAGE_ROOT)
    parser.add_argument("--name", default="pixelated-training-corpus-release-candidate-from-packages")
    parser.add_argument("--version", default="2026.04.09-rc-from-components")
    args = parser.parse_args()

    build_merged_corpus_package(
        args.output_dir,
        config=MergePackageConfig(
            base_root=args.base_root,
            overlay_root=args.overlay_root,
            name=args.name,
            version=args.version,
        ),
    )


if __name__ == "__main__":
    main()
