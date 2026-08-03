"""Build a canonical corpus package from the wave-two synthesis assets."""

from __future__ import annotations

import argparse
from pathlib import Path

from .builder import CorpusBuildResult
from .seed_package import build_seed_corpus
from .synthesis import DEFAULT_WAVE2_REGISTRY_PATH, DEFAULT_WAVE2_SEED_PACK_PATH


def build_wave2_seed_corpus(
    output_dir: Path,
    *,
    registry_path: Path = DEFAULT_WAVE2_REGISTRY_PATH,
    name: str = "pixelated-wave2-seed-corpus",
    version: str = "2026.04.09-wave2",
    verify_reproducibility: bool = True,
) -> CorpusBuildResult:
    return build_seed_corpus(
        output_dir,
        pack_id="wave2",
        seed_pack_path=DEFAULT_WAVE2_SEED_PACK_PATH,
        registry_path=registry_path,
        name=name,
        version=version,
        verify_reproducibility=verify_reproducibility,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path, help="Destination directory for the built wave-two corpus")
    parser.add_argument("--name", default="pixelated-wave2-seed-corpus")
    parser.add_argument("--version", default="2026.04.09-wave2")
    parser.add_argument(
        "--no-repro",
        action="store_true",
        help="Disable reproducibility verification for faster local iteration",
    )
    args = parser.parse_args()

    build_wave2_seed_corpus(
        args.output_dir,
        name=args.name,
        version=args.version,
        verify_reproducibility=not args.no_repro,
    )


if __name__ == "__main__":
    main()
