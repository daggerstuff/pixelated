"""Build a canonical corpus package from any synthesis seed pack."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .builder import CorpusBuildConfig, CorpusBuilder, CorpusBuildResult
from .synthesis import (
    DEFAULT_SYNTHESIS_ASSET_DIR,
    build_seed_registry,
    ensure_seed_pack_registry_materialized,
    ensure_seed_pack_sources_materialized,
)


def build_seed_corpus(output_dir: Path, **kwargs: Any) -> CorpusBuildResult:
    pack_id = kwargs.pop("pack_id", None)
    seed_pack_path = kwargs.pop("seed_pack_path", None)
    registry_path = kwargs.pop("registry_path", None)
    output_dir_for_assets = kwargs.pop("output_dir_for_assets", DEFAULT_SYNTHESIS_ASSET_DIR)
    assets_dir = kwargs.pop("assets_dir", output_dir_for_assets)
    name = kwargs.pop("name", None)
    version = kwargs.pop("version", None)
    verify_reproducibility = kwargs.pop("verify_reproducibility", True)
    if kwargs:
        unexpected_keys = ", ".join(sorted(str(key) for key in kwargs))
        raise TypeError(f"Unsupported seed corpus build arguments: {unexpected_keys}")

    if not isinstance(pack_id, str):
        raise ValueError("pack_id is required to build a seed corpus.")
    if not isinstance(seed_pack_path, Path):
        raise ValueError("seed_pack_path is required to build a seed corpus.")
    if registry_path is not None and not isinstance(registry_path, Path):
        raise ValueError("registry_path must be a Path when provided.")
    if not isinstance(assets_dir, Path):
        raise ValueError("assets_dir must be a Path.")
    if name is not None and not isinstance(name, str):
        raise ValueError("name must be a string when provided.")
    if version is not None and not isinstance(version, str):
        raise ValueError("version must be a string when provided.")
    if not isinstance(verify_reproducibility, bool):
        raise ValueError("verify_reproducibility must be a boolean.")

    normalized_pack_id = pack_id.strip()
    if not normalized_pack_id:
        raise ValueError("pack_id is required to build a seed corpus.")

    prefix = f"{normalized_pack_id}_seed"
    if registry_path is None:
        resolved_registry = ensure_seed_pack_registry_materialized(
            seed_pack_path=seed_pack_path,
            output_dir=assets_dir,
            prefix=prefix,
        )
    else:
        source_paths = ensure_seed_pack_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_dir=assets_dir,
            prefix=prefix,
        )
        registry_payload = build_seed_registry(source_paths, prefix=prefix)
        registry_path.parent.mkdir(parents=True, exist_ok=True)
        registry_path.write_text(f"{json.dumps(registry_payload, indent=2)}\n", encoding="utf-8")
        resolved_registry = registry_path

    builder = CorpusBuilder(
        CorpusBuildConfig(
            name=name or f"pixelated-{normalized_pack_id}-seed-corpus",
            version=version or f"2026.04.09-{normalized_pack_id}",
            registry_path=resolved_registry,
            destination=output_dir,
            verify_reproducibility=verify_reproducibility,
        )
    )
    return builder.build()


def build_seed_pack_corpus(
    seed_pack_path: Path,
    output_dir: Path,
    *,
    pack_id: str,
    assets_dir: Path = DEFAULT_SYNTHESIS_ASSET_DIR,
    verify_reproducibility: bool = True,
) -> CorpusBuildResult:
    return build_seed_corpus(
        output_dir,
        pack_id=pack_id,
        seed_pack_path=seed_pack_path,
        assets_dir=assets_dir,
        verify_reproducibility=verify_reproducibility,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pack_id", help="Pack identifier such as wave5 or expansion_queue")
    parser.add_argument("seed_pack_path", type=Path, help="Path to the synthesis seed pack JSON")
    parser.add_argument("output_dir", type=Path, help="Destination directory for the built corpus package")
    parser.add_argument(
        "--assets-dir",
        type=Path,
        default=DEFAULT_SYNTHESIS_ASSET_DIR,
        help="Directory for generated JSONL, manifest, and registry artifacts",
    )
    parser.add_argument(
        "--no-repro",
        action="store_true",
        help="Disable reproducibility verification for faster local iteration",
    )
    args = parser.parse_args()

    build_seed_corpus(
        args.output_dir,
        pack_id=args.pack_id,
        seed_pack_path=args.seed_pack_path,
        assets_dir=args.assets_dir,
        verify_reproducibility=not args.no_repro,
    )


if __name__ == "__main__":
    main()
