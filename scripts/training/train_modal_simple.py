#!/usr/bin/env python3
"""
Simplified Modal Training - No external secrets needed
Uses local config and runs training on A100 without external secrets.
"""

import json
import logging
from pathlib import Path

import modal
import torch
from datasets import Dataset
from peft import LoraConfig, TaskType, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

app = modal.App("pixelated-retrain-simple")

# Minimal image with torch + transformers
IMAGE = modal.Image.from_registry("pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel").pip_install(
    "transformers>=4.36.0",
    "peft>=0.7.0",
    "bitsandbytes>=0.41.0",
    "accelerate>=0.25.0",
    "datasets>=2.15.0",
    "scipy",
)

MODELS_VOLUME = modal.Volume.from_name("pixel-merged-models", create_if_missing=True)


def _extract_training_text(item: dict) -> str | None:
    """Convert supported dataset formats into a single training string."""
    if "text" in item:
        text = item["text"]
        return text if isinstance(text, str) and text.strip() else None

    if "messages" in item and isinstance(item["messages"], list):
        parts = []
        for message in item["messages"]:
            if not isinstance(message, dict):
                continue
            role = message.get("role", "user")
            content = message.get("content", "")
            if isinstance(content, str) and content.strip():
                parts.append(f"<|{role}|>{content}</|{role}|>")
        return "\n".join(parts) if parts else None

    if "conversations" in item and isinstance(item["conversations"], list):
        parts = []
        for turn in item["conversations"]:
            if not isinstance(turn, dict):
                continue
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if isinstance(content, str) and content.strip():
                parts.append(f"<|{role}|>{content}</|{role}|>")
        return "\n".join(parts) if parts else None

    if "prompt" in item and "response" in item:
        prompt = item["prompt"]
        response = item["response"]
        if isinstance(prompt, str) and isinstance(response, str):
            return f"<|user|>{prompt}</|user|>\n<|assistant|>{response}</|assistant|>"

    return None


def _load_training_samples(data_path: str) -> list[dict]:
    """Load JSONL samples from a file or directory with validation."""
    path = Path(data_path)
    if not path.exists():
        raise FileNotFoundError(f"Training data path not found: {path}")

    if path.is_dir():
        jsonl_files = sorted(path.glob("*.jsonl"))
        if not jsonl_files:
            raise ValueError(f"No .jsonl files found in {path}")
    else:
        if path.suffix != ".jsonl":
            raise ValueError(f"Expected a .jsonl file, got {path}")
        jsonl_files = [path]

    samples: list[dict] = []
    parse_errors = 0
    for jsonl_file in jsonl_files:
        with open(jsonl_file) as handle:
            for line_num, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError as exc:
                    parse_errors += 1
                    if parse_errors <= 3:
                        logger.warning(f"  ⚠️  {jsonl_file.name}:{line_num}: {exc}")
                    continue

                if isinstance(item, dict):
                    samples.append(item)

    if not samples:
        raise ValueError("No valid training samples loaded")

    return samples


def _build_tokenize_function(tokenizer, max_seq_length: int):
    """Create a tokenizer wrapper for Hugging Face datasets.map."""

    def tokenize(batch: dict) -> dict:
        texts = []
        for item in batch.get("_raw_item", []):
            if not isinstance(item, dict):
                continue
            text = _extract_training_text(item)
            if text:
                texts.append(text)

        if not texts:
            return {"input_ids": [], "attention_mask": []}

        return tokenizer(
            texts,
            truncation=True,
            max_length=max_seq_length,
            padding="max_length",
        )

    return tokenize


@app.function(
    image=IMAGE,
    gpu="A100",
    timeout=3600 * 4,  # 4 hours
    volumes={"/models": MODELS_VOLUME},
    memory=32768,  # 32GB RAM
)
def train(config_path: str = "ai/config/training_config_v2_antirepetition.json"):
    """Train a LoRA adapter on Modal without external secrets."""
    if not Path(config_path).exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path) as handle:
        config = json.load(handle)

    logger.info("=" * 60)
    logger.info("PIXELATED V2 - SIMPLE MODAL TRAINING")
    logger.info("=" * 60)
    logger.info(f"Base model: {config['model']['base_model']}")
    logger.info(f"LoRA: r={config['lora']['r']}, alpha={config['lora']['lora_alpha']}")
    logger.info(f"LR: {config['training']['learning_rate']}")
    logger.info("=" * 60)

    tokenizer = AutoTokenizer.from_pretrained(config["model"]["base_model"])
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    logger.info("Loading model...")
    model = AutoModelForCausalLM.from_pretrained(
        config["model"]["base_model"],
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=config["lora"]["r"],
        lora_alpha=config["lora"]["lora_alpha"],
        lora_dropout=config["lora"]["lora_dropout"],
        target_modules=config["lora"]["target_modules"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    logger.info("Loading real training data...")
    training_samples = _load_training_samples(config["data"]["train_file"])
    dataset = Dataset.from_list([{"_raw_item": item} for item in training_samples])
    tokenized = dataset.map(
        _build_tokenize_function(tokenizer, config["data"]["max_seq_length"]),
        batched=True,
        remove_columns=dataset.column_names,
    )

    if len(tokenized) == 0:
        raise ValueError("Tokenization produced no training rows")

    training_args = TrainingArguments(
        output_dir="/tmp/pixelated-v2-simple-output",
        num_train_epochs=config["training"]["num_train_epochs"],
        per_device_train_batch_size=min(1, config["training"]["per_device_train_batch_size"]),
        gradient_accumulation_steps=max(16, config["training"]["gradient_accumulation_steps"]),
        learning_rate=config["training"]["learning_rate"],
        weight_decay=config["training"]["weight_decay"],
        warmup_ratio=config["training"]["warmup_ratio"],
        lr_scheduler_type=config["training"]["lr_scheduler_type"],
        bf16=True,
        gradient_checkpointing=config["system"]["gradient_checkpointing"],
        logging_steps=config["training"]["logging_steps"],
        save_steps=config["training"]["save_steps"],
        save_total_limit=2,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )

    logger.info("Starting training...")
    train_result = trainer.train()

    adapter_path = Path("/models/pixelated-v2-simple-adapter")
    adapter_path.mkdir(parents=True, exist_ok=True)

    logger.info(f"Saving adapter to {adapter_path}...")
    model.save_pretrained(str(adapter_path))
    tokenizer.save_pretrained(str(adapter_path))
    with open(adapter_path / "training_config_used.json", "w") as handle:
        json.dump(config, handle, indent=2)

    MODELS_VOLUME.commit()

    logger.info("=" * 60)
    logger.info("TRAINING COMPLETE!")
    logger.info("=" * 60)

    return {
        "status": "success",
        "adapter_path": str(adapter_path),
        "final_loss": train_result.training_loss,
        "samples_trained": len(tokenized),
    }


@app.local_entrypoint()
def main(config_path: str = "ai/config/training_config_v2_antirepetition.json"):
    """Run the simplified Modal trainer from the local machine."""
    result = train.remote(config_path)
    logger.info(f"Result: {result}")
