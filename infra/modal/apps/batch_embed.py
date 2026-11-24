"""Batch text embeddings on a Modal GPU.

    uv run modal run -m infra.modal.apps.batch_embed --texts "first|second"
    uv run modal run -m infra.modal.apps.batch_embed --dataset data/snippets.jsonl

Inputs come from `--texts` (pipe-separated) and/or a JSONL dataset whose rows
carry a `text` or `content` field. Vectors are written to `--out` as JSONL, so
the output drops straight into the repo's embedding pipelines.

Model weights are cached in the `pixelated-hf-cache` volume: only the first run
pays for the download. Override the model with `PIXELATED_MODAL_EMBED_MODEL` and
the accelerator with `PIXELATED_MODAL_GPU` (default `L4`).
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import modal
from infra.modal.shared.gpu import app_name, gpu_type

APP_NAME = app_name("embed")

MODEL = os.environ.get("PIXELATED_MODAL_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

CACHE_DIR = "/root/.cache/huggingface"

BATCH_SIZE = 64

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install("sentence-transformers>=2.7.0")
    .env({"HF_HOME": CACHE_DIR, "PIXELATED_MODAL_EMBED_MODEL": MODEL})
)

model_cache = modal.Volume.from_name("pixelated-hf-cache", create_if_missing=True)

app = modal.App(APP_NAME)

logger = logging.getLogger(__name__)


@app.cls(image=image, gpu=gpu_type(), volumes={CACHE_DIR: model_cache}, timeout=900)
class Embedder:
    """Loads the model once per container and embeds batches on the GPU."""

    @modal.enter()
    def load(self) -> None:
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(MODEL)

    @modal.method()
    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = self.model.encode(texts, normalize_embeddings=True)
        return [vector.tolist() for vector in vectors]


def _read_inputs(*, texts: str, dataset: str) -> list[str]:
    """Collect input strings from `--texts` and/or a JSONL dataset file."""
    collected = [part.strip() for part in texts.split("|") if part.strip()]
    if not dataset:
        return collected

    source = Path(dataset)
    if not source.is_file():
        raise FileNotFoundError(f"dataset not found: {source}")

    for raw in source.read_text(encoding="utf-8").splitlines():
        entry = raw.strip()
        if entry.startswith("{"):
            payload = json.loads(entry)
            entry = str(payload.get("text") or payload.get("content") or "").strip()
        if entry:
            collected.append(entry)
    return collected


@app.local_entrypoint()
def main(texts: str = "", dataset: str = "", out: str = "embeddings.jsonl") -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    inputs = _read_inputs(texts=texts, dataset=dataset)
    if not inputs:
        raise SystemExit("nothing to embed: pass --texts or --dataset")

    logger.info(
        "model=%s gpu=%s inputs=%d batch_size=%d",
        MODEL,
        gpu_type(),
        len(inputs),
        BATCH_SIZE,
    )

    embedder = Embedder()
    rows: list[dict[str, object]] = []
    dimensions = 0
    for start in range(0, len(inputs), BATCH_SIZE):
        batch = inputs[start : start + BATCH_SIZE]
        vectors = embedder.embed.remote(batch)
        dimensions = len(vectors[0]) if vectors else dimensions
        rows.extend({"text": text, "embedding": vector} for text, vector in zip(batch, vectors, strict=True))
        logger.info("embedded %d/%d", len(rows), len(inputs))

    destination = Path(out)
    destination.write_text(
        "\n".join(json.dumps(row) for row in rows) + "\n",
        encoding="utf-8",
    )
    logger.info("wrote %d vectors (%d dims) to %s", len(rows), dimensions, destination)
