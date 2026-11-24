"""Dataset creation on Modal: normalize, dedupe, filter and split a JSONL corpus.

    uv run modal run -m infra.modal.apps.dataset --inputs dataset/final_dataset.jsonl
    uv run modal run -m infra.modal.apps.dataset --inputs /datasets/in/a.jsonl,/datasets/in/b.jsonl \\
        --val-fraction 0.1 --min-chars 80

Inputs are read inside the container. Two locations resolve out of the box:

* `dataset/...` — the repo's checked-in corpus, baked into the image.
* `/datasets/...` — the `pixelated-datasets` volume, for corpora too large for git.

Outputs (`train.jsonl`, `val.jsonl`, `manifest.json`) are written to the
`pixelated-datasets` volume; a relative `--out` is resolved inside it, so
nothing silently lands in an ephemeral container filesystem.

Row handling lives in `infra.modal.shared.rows`, so this job and the training
job agree on what a canonical row is.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Sequence
from pathlib import Path
from typing import Any, cast

import modal
from infra.modal.shared.gpu import app_name
from infra.modal.shared.paths import REPO_DIR, resolve_repo_path, resolve_volume_path
from infra.modal.shared.rows import (
    dedupe,
    filter_min_chars,
    read_rows,
    split_rows,
    write_jsonl,
)

APP_NAME = app_name("dataset")

REPO_ROOT = Path(__file__).resolve().parents[3]

VOLUME_DIR = "/datasets"

VOLUME_NAME = "pixelated-datasets"

image = modal.Image.debian_slim(python_version="3.12").add_local_dir(str(REPO_ROOT / "dataset"), f"{REPO_DIR}/dataset")

dataset_volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

app = modal.App(APP_NAME)

logger = logging.getLogger(__name__)


def resolve_input(source: str) -> Path:
    """Resolve an input path inside the container (repo-relative or absolute)."""
    return resolve_repo_path(source)


def resolve_output(out: str) -> Path:
    """Resolve an output directory, defaulting relative paths into the volume."""
    return resolve_volume_path(out, VOLUME_DIR)


def _digest(path: Path) -> str:
    """Return the SHA-256 of a written artifact, for the manifest."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_corpus(
    inputs: Sequence[Path],
    out_dir: Path,
    *,
    val_fraction: float = 0.0,
    seed: int = 13,
    min_chars: int = 1,
) -> dict[str, object]:
    """Build the corpus and return the manifest. Pure filesystem work, no Modal."""
    rows: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []
    for source in inputs:
        loaded = read_rows(source)
        sources.append({"path": str(source), "rows": len(loaded)})
        rows.extend(loaded)

    kept = dedupe(filter_min_chars(rows, min_chars))
    train, val = split_rows(kept, val_fraction=val_fraction, seed=seed)

    train_path = out_dir / "train.jsonl"
    val_path = out_dir / "val.jsonl"
    write_jsonl(train, train_path)
    write_jsonl(val, val_path)

    manifest: dict[str, object] = {
        "inputs": sources,
        "rows": {
            "read": len(rows),
            "kept": len(kept),
            "dropped": len(rows) - len(kept),
            "train": len(train),
            "val": len(val),
        },
        "filter": {"min_chars": min_chars},
        "split": {"val_fraction": val_fraction, "seed": seed},
        "outputs": {
            "train": {"path": str(train_path), "sha256": _digest(train_path)},
            "val": {"path": str(val_path), "sha256": _digest(val_path)},
        },
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


@app.function(image=image, volumes={VOLUME_DIR: dataset_volume}, timeout=1800)
def build(
    inputs: list[str],
    out: str,
    val_fraction: float,
    seed: int,
    min_chars: int,
) -> dict[str, object]:
    """Run the corpus build inside the container and persist it to the volume."""
    manifest = build_corpus(
        [resolve_input(source) for source in inputs],
        resolve_output(out),
        val_fraction=val_fraction,
        seed=seed,
        min_chars=min_chars,
    )
    dataset_volume.commit()
    return manifest


@app.local_entrypoint()
def main(
    inputs: str = "dataset/final_dataset.jsonl",
    out: str = "out",
    val_fraction: float = 0.0,
    seed: int = 13,
    min_chars: int = 1,
) -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    selected = [part.strip() for part in inputs.split(",") if part.strip()]
    if not selected:
        raise SystemExit("nothing to build: pass --inputs with one or more JSONL paths")

    logger.info("app=%s inputs=%d out=%s", APP_NAME, len(selected), out)
    manifest = build.remote(selected, out, val_fraction, seed, min_chars)
    rows = cast(dict[str, int], manifest["rows"])
    logger.info(
        "read=%d kept=%d dropped=%d train=%d val=%d",
        rows["read"],
        rows["kept"],
        rows["dropped"],
        rows["train"],
        rows["val"],
    )
    logger.info("manifest=%s", Path(resolve_output(out)) / "manifest.json")
