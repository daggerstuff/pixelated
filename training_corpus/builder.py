"""Fresh corpus assembly entrypoint with no dependency on the deleted pipelines tree."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass, replace
from pathlib import Path
from tempfile import TemporaryDirectory

from .governance import build_governance_report
from .model import CorpusEntry, CorpusManifest, CorpusSource
from .normalize import make_entry
from .quality import (
    build_continuity_report,
    build_leakage_report,
    choose_preferred_entry,
    deduplicate_near_duplicates,
)
from .source_inventory import build_source_inventory
from .sources import load_records
from .writer import ArtifactReportBundle, ArtifactWriteRequest, build_manifest, write_artifacts


@dataclass(frozen=True)
class CorpusBuildConfig:
    name: str
    version: str
    registry_path: Path
    destination: Path
    split_seed: str = "pixelated-corpus-v1"
    min_quality_score: float = 0.7
    min_safety_score: float = 0.5
    enforce_release_gates: bool = True
    verify_reproducibility: bool = False


@dataclass(frozen=True)
class CorpusBuildResult:
    sources: tuple[CorpusSource, ...]
    entries: tuple[CorpusEntry, ...]
    manifest: CorpusManifest
    artifacts: dict[str, Path]


class CorpusBuilder:
    """Build a trainable corpus from registry-backed local sources."""

    def __init__(self, config: CorpusBuildConfig):
        self.config = config

    def build(self) -> CorpusBuildResult:
        build_result = self._build_once(self.config)
        reproducibility_report = {"enabled": False, "verified": False, "compared_files": []}
        if self.config.verify_reproducibility:
            reproducibility_report = self._verify_reproducibility(build_result)

        reproducibility_path = self.config.destination / "reproducibility_report.json"
        reproducibility_path.write_text(
            f"{json.dumps(reproducibility_report, indent=2)}\n",
            encoding="utf-8",
        )
        return CorpusBuildResult(
            sources=build_result.sources,
            entries=build_result.entries,
            manifest=build_result.manifest,
            artifacts={
                **build_result.artifacts,
                "reproducibility_report": reproducibility_path,
            },
        )

    def _build_once(self, config: CorpusBuildConfig) -> CorpusBuildResult:
        sources = build_source_inventory(config.registry_path)
        by_content_hash: dict[str, CorpusEntry] = {}
        duplicate_events = 0
        replaced_events = 0
        source_counters: Counter[str] = Counter()
        row_counters: Counter[str] = Counter()

        for source in sources:
            source_counters["total"] += 1
            if source.inventory_decision != "keep":
                source_counters["skipped_inventory"] += 1
                continue
            if source.default_lane is None:
                source_counters["skipped_lane"] += 1
                continue
            if not source.locator.exists() or not source.locator.is_file():
                source_counters["missing_locator"] += 1
                continue
            source_counters["ingested"] += 1
            for raw in load_records(source):
                row_counters["raw_rows"] += 1
                entry = make_entry(source, raw, config.split_seed)
                if entry is None:
                    row_counters["dropped_invalid"] += 1
                    continue
                rejection_reason = self._rejection_reason(entry, config)
                if rejection_reason is not None:
                    row_counters[rejection_reason] += 1
                    continue
                row_counters["accepted_rows"] += 1
                content_id = str(entry.attributes.get("content_hash", ""))
                existing = by_content_hash.get(content_id)
                if existing is None:
                    by_content_hash[content_id] = entry
                    continue
                duplicate_events += 1
                preferred = choose_preferred_entry(existing, entry)
                if preferred is not existing:
                    by_content_hash[content_id] = preferred
                    replaced_events += 1

        exact_deduped_entries = tuple(sorted(by_content_hash.values(), key=lambda entry: entry.entry_id))
        entry_tuple, near_duplicate_report = deduplicate_near_duplicates(exact_deduped_entries)
        manifest = build_manifest(
            name=config.name,
            version=config.version,
            destination=config.destination,
            entries=entry_tuple,
        )
        leakage_report = build_leakage_report(
            entry_tuple,
            duplicate_events=duplicate_events,
            replaced_events=replaced_events,
            near_duplicate_report=near_duplicate_report,
        )
        continuity_report = build_continuity_report(entry_tuple)
        governance_report = build_governance_report(
            tuple(
                source for source in sources if source.inventory_decision == "keep" and source.default_lane is not None
            ),
            entry_tuple,
        )
        if config.enforce_release_gates and (
            not bool(governance_report["passed"]) or not bool(continuity_report["passed"])
        ):
            raise ValueError(
                f"Training corpus release gates failed: governance={governance_report} continuity={continuity_report}"
            )
        artifacts = write_artifacts(
            ArtifactWriteRequest(
                destination=config.destination,
                sources=tuple(sources),
                entries=entry_tuple,
                manifest=manifest,
                reports=ArtifactReportBundle(
                    leakage_report=leakage_report,
                    governance_report=governance_report,
                    continuity_report=continuity_report,
                ),
                build_context={
                    "name": config.name,
                    "version": config.version,
                    "registry_path": str(config.registry_path),
                    "destination": str(config.destination),
                    "split_seed": config.split_seed,
                    "min_quality_score": config.min_quality_score,
                    "min_safety_score": config.min_safety_score,
                    "source_counters": dict(source_counters),
                    "row_counters": dict(row_counters),
                },
            )
        )
        return CorpusBuildResult(
            sources=tuple(sources),
            entries=entry_tuple,
            manifest=manifest,
            artifacts=artifacts,
        )

    def _verify_reproducibility(self, build_result: CorpusBuildResult) -> dict[str, object]:
        with TemporaryDirectory(prefix="training-corpus-repro-") as temp_dir:
            comparison_config = replace(
                self.config,
                destination=Path(temp_dir),
                verify_reproducibility=False,
            )
            comparison_result = self._build_once(comparison_config)

            compared_files: list[dict[str, object]] = []
            mismatches = 0
            for artifact_name, artifact_path in sorted(build_result.artifacts.items()):
                comparison_path = comparison_result.artifacts.get(artifact_name)
                if comparison_path is None or not artifact_path.exists() or not comparison_path.exists():
                    mismatches += 1
                    compared_files.append(
                        {
                            "artifact": artifact_name,
                            "match": False,
                            "reason": "missing_artifact",
                        }
                    )
                    continue
                left_hash = self._artifact_hash(artifact_path, self.config.destination)
                right_hash = self._artifact_hash(comparison_path, comparison_config.destination)
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

    @staticmethod
    def _artifact_hash(path: Path, destination_root: Path) -> str:
        digest = hashlib.sha256()
        text = path.read_text(encoding="utf-8")
        normalized = text.replace(str(destination_root), "<DESTINATION>")
        digest.update(normalized.encode("utf-8"))
        return digest.hexdigest()

    def _rejection_reason(self, entry: CorpusEntry, config: CorpusBuildConfig) -> str | None:
        quality_score = entry.attributes.get("quality_score")
        if isinstance(quality_score, (int, float)) and quality_score < config.min_quality_score:
            return "dropped_quality"

        safety_score = entry.attributes.get("safety_score")
        if isinstance(safety_score, (int, float)) and safety_score < config.min_safety_score:
            return "dropped_safety"

        if not entry.prompt.strip() or not entry.response.strip():
            return "dropped_empty"

        return None
