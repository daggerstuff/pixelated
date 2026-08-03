"""Build the release-candidate delta package over the wave-one overlay."""

from __future__ import annotations

import argparse
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from .builder import CorpusBuildConfig, CorpusBuilder, CorpusBuildResult
from .experiments import (
    DEFAULT_EXPERIMENT_REPORT_PATH,
    ExperimentVariant,
    PreparedSource,
    build_local_source_catalog,
    load_experiment_report,
    materialize_variant_registry,
    release_candidate_delta_source_limits_from_report,
)


@dataclass(frozen=True)
class ReleaseCandidateDeltaPackageConfig:
    experiment_report_path: Path = DEFAULT_EXPERIMENT_REPORT_PATH
    name: str = "pixelated-release-candidate-delta-over-wave1"
    version: str = "2026.04.09-rc-delta"
    verify_reproducibility: bool = True
    source_limits: Mapping[str, int] | None = None
    catalog: Mapping[str, PreparedSource] | None = None
    artifact_root: Path | None = None


def build_release_candidate_delta_corpus(
    output_dir: Path,
    *,
    config: ReleaseCandidateDeltaPackageConfig | None = None,
) -> CorpusBuildResult:
    resolved_config = config or ReleaseCandidateDeltaPackageConfig()
    resolved_catalog = (
        dict(resolved_config.catalog) if resolved_config.catalog is not None else build_local_source_catalog()
    )
    resolved_source_limits = (
        dict(resolved_config.source_limits)
        if resolved_config.source_limits is not None
        else release_candidate_delta_source_limits_from_report(
            load_experiment_report(resolved_config.experiment_report_path)
        )
    )
    variant = ExperimentVariant(
        family="RCD",
        variant_id="release_candidate_delta",
        description="Release-candidate delta with wave-one overlay removed",
        source_limits=resolved_source_limits,
    )
    resolved_artifact_root = resolved_config.artifact_root or output_dir.parent / f"inputs_{output_dir.name}"
    registry_path = materialize_variant_registry(resolved_artifact_root, resolved_catalog, variant)
    builder = CorpusBuilder(
        CorpusBuildConfig(
            name=resolved_config.name,
            version=resolved_config.version,
            registry_path=registry_path,
            destination=output_dir,
            verify_reproducibility=resolved_config.verify_reproducibility,
        )
    )
    return builder.build()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "output_dir",
        type=Path,
        help="Destination directory for the built release-candidate delta package",
    )
    parser.add_argument(
        "--experiment-report",
        type=Path,
        default=DEFAULT_EXPERIMENT_REPORT_PATH,
        help="Experiment matrix report used to derive the release-candidate winner mix",
    )
    parser.add_argument("--name", default="pixelated-release-candidate-delta-over-wave1")
    parser.add_argument("--version", default="2026.04.09-rc-delta")
    parser.add_argument(
        "--no-repro",
        action="store_true",
        help="Disable reproducibility verification for faster local iteration",
    )
    args = parser.parse_args()

    build_release_candidate_delta_corpus(
        args.output_dir,
        config=ReleaseCandidateDeltaPackageConfig(
            experiment_report_path=args.experiment_report,
            name=args.name,
            version=args.version,
            verify_reproducibility=not args.no_repro,
        ),
    )


if __name__ == "__main__":
    main()
