"""LoRA fine-tuning on a Modal GPU.

    uv run modal run -m infra.modal.apps.train --dataset dataset/final_dataset.jsonl
    uv run modal run -m infra.modal.apps.train --dataset /datasets/out/train.jsonl --epochs 2

This is the "training" option target: the same corpus the dataset job produced
can be fine-tuned on a Modal GPU instead of a workstation or a notebook.

Rows are rendered to plain text with `infra.modal.shared.rows.render_text`, so
chat (`messages`) and completion (`text`) corpora both work. Adapters and the
run summary land in the `pixelated-training` volume; the base model is cached in
`pixelated-hf-cache`, so only the first run pays for the download.

The accelerator comes from `PIXELATED_MODAL_TRAIN_GPU`, falling back to
`PIXELATED_MODAL_GPU` and then `A100`. Hyperparameter defaults are deliberately
small so a first run is cheap; pass flags to scale up.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Sequence
from pathlib import Path
from typing import Any, cast

import modal
from infra.modal.shared.gpu import app_name, gpu_type
from infra.modal.shared.paths import REPO_DIR, resolve_repo_path, resolve_volume_path
from infra.modal.shared.rows import read_rows, render_text

APP_NAME = app_name("train")

REPO_ROOT = Path(__file__).resolve().parents[3]

CACHE_DIR = "/root/.cache/huggingface"

TRAIN_DIR = "/training"

DATASETS_DIR = "/datasets"

TRAIN_MODEL = os.environ.get("PIXELATED_MODAL_TRAIN_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install(
        "torch>=2.4",
        "transformers>=4.46",
        "datasets>=3.0",
        "peft>=0.13",
        "accelerate>=1.0",
        "trl>=0.13",
    )
    .env({"HF_HOME": CACHE_DIR})
    .add_local_dir(str(REPO_ROOT / "dataset"), f"{REPO_DIR}/dataset")
)

model_cache = modal.Volume.from_name("pixelated-hf-cache", create_if_missing=True)

training_volume = modal.Volume.from_name("pixelated-training", create_if_missing=True)

dataset_volume = modal.Volume.from_name("pixelated-datasets", create_if_missing=True)

app = modal.App(APP_NAME)

logger = logging.getLogger(__name__)


def output_name(model: str) -> str:
    """Return the volume-relative run directory for a model.

    Derived from the model name rather than a timestamp so repeated runs of the
    same model overwrite one directory instead of filling the volume.
    """
    slug = model.rsplit("/", 1)[-1].lower().replace(".", "-").replace("_", "-")
    return f"runs/{slug}"


def training_texts(rows: Sequence[dict[str, Any]]) -> list[str]:
    """Render canonical rows to the plain-text field the trainer consumes."""
    return [text for text in (render_text(row) for row in rows) if text]


@app.function(
    image=image,
    gpu=gpu_type(env_var="PIXELATED_MODAL_TRAIN_GPU", default="A100"),
    volumes={
        CACHE_DIR: model_cache,
        TRAIN_DIR: training_volume,
        DATASETS_DIR: dataset_volume,
    },
    timeout=6 * 3600,
)
def train(
    dataset: str,
    model: str,
    epochs: float,
    learning_rate: float,
    batch_size: int,
    out: str,
) -> dict[str, object]:
    """Fine-tune a LoRA adapter inside the container and persist it."""
    from datasets import Dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import SFTConfig, SFTTrainer

    source = resolve_repo_path(dataset)
    texts = training_texts(read_rows(source))
    if not texts:
        raise ValueError(f"no usable training rows in {source}")

    destination = resolve_volume_path(out or output_name(model), TRAIN_DIR)
    destination.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    base = AutoModelForCausalLM.from_pretrained(model)

    settings = SFTConfig(
        output_dir=str(destination),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=4,
        learning_rate=learning_rate,
        logging_steps=10,
        save_strategy="no",
        report_to=[],
        dataset_text_field="text",
        max_length=1024,
    )
    trainer = SFTTrainer(
        model=base,
        args=settings,
        train_dataset=Dataset.from_dict({"text": texts}),
        peft_config=LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules="all-linear",
        ),
    )

    result = trainer.train()
    trainer.save_model(str(destination))
    tokenizer.save_pretrained(str(destination))

    summary: dict[str, object] = {
        "app": APP_NAME,
        "model": model,
        "gpu": gpu_type(env_var="PIXELATED_MODAL_TRAIN_GPU", default="A100"),
        "rows": len(texts),
        "epochs": epochs,
        "learning_rate": learning_rate,
        "batch_size": batch_size,
        "train_loss": float(result.training_loss),
        "output": str(destination),
    }
    (destination / "training_summary.json").write_text(
        json.dumps(summary, indent=2) + "\n",
        encoding="utf-8",
    )
    training_volume.commit()
    return summary


@app.local_entrypoint()
def main(
    dataset: str = "dataset/final_dataset.jsonl",
    model: str = TRAIN_MODEL,
    epochs: float = 1.0,
    learning_rate: float = 2e-4,
    batch_size: int = 1,
    out: str = "",
) -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    target = out or output_name(model)
    logger.info(
        "app=%s model=%s gpu=%s dataset=%s out=%s",
        APP_NAME,
        model,
        gpu_type(env_var="PIXELATED_MODAL_TRAIN_GPU", default="A100"),
        dataset,
        target,
    )
    summary = train.remote(dataset, model, epochs, learning_rate, batch_size, out)
    logger.info("train_loss=%s output=%s", summary["train_loss"], summary["output"])
    logger.info("volume=%s", cast(str, summary["output"]).replace(TRAIN_DIR, "pixelated-training", 1))
