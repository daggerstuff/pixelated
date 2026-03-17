#!/usr/bin/env python3
"""
Modal Training Script - Retrain with Anti-Repetition Config.

Uses the fixed training config (lora_alpha=16, lr=5e-6, dropout=0.1).
"""

import contextlib
import json
import logging
import traceback
from pathlib import Path

import modal
import torch
import wandb
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

app = modal.App("pixelated-retrain-v2")

TRAINING_IMAGE = (
    modal.Image.from_registry("pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel")
    .pip_install(
        "transformers>=4.36.0",
        "peft>=0.7.0",
        "bitsandbytes>=0.41.0",
        "accelerate>=0.25.0",
        "datasets>=2.15.0",
        "scipy",
        "wandb",
    )
    .run_commands("pip install flash-attn --no-build-isolation")
)

MODELS_VOLUME = modal.Volume.from_name("pixel-merged-models", create_if_missing=True)


def _load_config(config_path: str) -> dict:
    """Load and validate the training config file."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(path) as handle:
        return json.load(handle)


def _extract_training_text(item: dict) -> str | None:
    """Convert supported training sample formats into a single text string."""
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
    """Load JSONL training samples with parse validation."""
    path = Path(data_path)
    if not path.exists():
        raise FileNotFoundError(f"Training data file not found: {path}")

    samples: list[dict] = []
    parse_errors = 0
    with open(path) as handle:
        for line_num, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                parse_errors += 1
                if parse_errors <= 3:
                    logger.warning(f"  ⚠️  Line {line_num}: {exc}")
                continue

            if isinstance(item, dict):
                samples.append(item)

    if parse_errors > 3:
        logger.warning(f"  ... and {parse_errors - 3} more JSON errors")

    if not samples:
        raise ValueError("No valid training data loaded")

    return samples


def _build_tokenize_function(tokenizer, max_seq_length: int):
    """Create a datasets.map tokenizer callback."""

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


def _load_model_and_tokenizer(config: dict):
    """Load the base model/tokenizer and attach the LoRA adapter."""
    logger.info("\n[1/5] Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(config["model"]["base_model"])
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    logger.info("✅ Tokenizer loaded")

    logger.info("[2/5] Loading base model (this may take a few minutes)...")
    model = AutoModelForCausalLM.from_pretrained(
        config["model"]["base_model"],
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )
    logger.info("✅ Base model loaded")

    logger.info("[3/5] Applying LoRA adapter...")
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=config["lora"]["r"],
        lora_alpha=config["lora"]["lora_alpha"],
        lora_dropout=config["lora"]["lora_dropout"],
        target_modules=config["lora"]["target_modules"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    logger.info("✅ LoRA adapter applied")

    return model, tokenizer


def _prepare_datasets(config: dict, tokenizer):
    """Load raw samples, tokenize, and split train/eval datasets."""
    logger.info("[4/5] Loading training data...")
    train_data = _load_training_samples(config["data"]["train_file"])
    logger.info(f"✅ Loaded {len(train_data)} training samples")

    logger.info("\n[5/5] Preparing datasets...")
    dataset = Dataset.from_list([{"_raw_item": item} for item in train_data])
    tokenized_dataset = dataset.map(
        _build_tokenize_function(tokenizer, config["data"]["max_seq_length"]),
        batched=True,
        remove_columns=dataset.column_names,
    )

    if len(tokenized_dataset) == 0:
        raise ValueError("Tokenization produced no training rows")

    if len(tokenized_dataset) < 2:
        logger.warning("⚠️  Dataset too small, using single dataset for train and eval")
        train_dataset = tokenized_dataset
        eval_dataset = tokenized_dataset
    else:
        split_dataset = tokenized_dataset.train_test_split(test_size=0.1)
        train_dataset = split_dataset["train"]
        eval_dataset = split_dataset["test"]

    logger.info(f"✅ Train: {len(train_dataset)}, Eval: {len(eval_dataset)}")
    return train_dataset, eval_dataset


def _build_training_arguments(config: dict) -> TrainingArguments:
    """Construct Hugging Face training arguments from config."""
    logger.info("\nSetting up training arguments...")
    return TrainingArguments(
        output_dir="/tmp/pixelated-v2-output",
        num_train_epochs=config["training"]["num_train_epochs"],
        per_device_train_batch_size=config["training"]["per_device_train_batch_size"],
        per_device_eval_batch_size=config["training"]["per_device_eval_batch_size"],
        gradient_accumulation_steps=config["training"]["gradient_accumulation_steps"],
        learning_rate=config["training"]["learning_rate"],
        weight_decay=config["training"]["weight_decay"],
        warmup_ratio=config["training"]["warmup_ratio"],
        lr_scheduler_type=config["training"]["lr_scheduler_type"],
        logging_steps=config["training"]["logging_steps"],
        eval_strategy="steps",
        eval_steps=config["training"]["eval_steps"],
        save_steps=config["training"]["save_steps"],
        save_total_limit=config["training"]["save_total_limit"],
        load_best_model_at_end=config["training"]["load_best_model_at_end"],
        metric_for_best_model=config["training"]["metric_for_best_model"],
        greater_is_better=config["training"]["greater_is_better"],
        bf16=config["system"]["bf16"],
        gradient_checkpointing=config["system"]["gradient_checkpointing"],
        report_to=config["training"]["report_to"],
        run_name=config["training"]["run_name"],
    )


def _save_adapter(model, tokenizer, config: dict) -> Path:
    """Save the trained LoRA adapter and config into the Modal volume."""
    logger.info("\nSaving LoRA adapter...")
    adapter_output_dir = Path("/models/pixelated-v2-adapter")
    adapter_output_dir.mkdir(parents=True, exist_ok=True)

    model.save_pretrained(str(adapter_output_dir))
    tokenizer.save_pretrained(str(adapter_output_dir))
    with open(adapter_output_dir / "training_config_used.json", "w") as handle:
        json.dump(config, handle, indent=2)

    MODELS_VOLUME.commit()
    return adapter_output_dir


@app.function(
    image=TRAINING_IMAGE,
    gpu="A100",
    timeout=3600 * 4,
    volumes={"/models": MODELS_VOLUME},
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("wandb-secret"),
    ],
)
def train_model(config_path: str = "ai/config/training_config_v2_antirepetition.json"):
    """Train the model with anti-repetition config."""
    try:
        logger.info(f"Loading config from {config_path}...")
        config = _load_config(config_path)

        logger.info("=" * 60)
        logger.info("PIXELATED V2 - ANTI-REPETITION RETRAINING")
        logger.info("=" * 60)
        logger.info(f"Base model: {config['model']['base_model']}")
        logger.info(f"LoRA r={config['lora']['r']}, alpha={config['lora']['lora_alpha']}")
        logger.info(f"Learning rate: {config['training']['learning_rate']}")
        logger.info(f"Weight decay: {config['training']['weight_decay']}")
        logger.info("=" * 60)

        model, tokenizer = _load_model_and_tokenizer(config)
        train_dataset, eval_dataset = _prepare_datasets(config, tokenizer)
        training_args = _build_training_arguments(config)
        data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

        wandb.init(
            project="pixelated-empathy-v2",
            name="antirepetition-retrain",
            config=config,
        )

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            data_collator=data_collator,
        )

        logger.info("\nStarting training...")
        train_result = trainer.train()

        adapter_output_dir = _save_adapter(model, tokenizer, config)
        logger.info(f"✅ LoRA adapter saved to {adapter_output_dir}")
        logger.info(f"Final training loss: {train_result.training_loss}")

        wandb.finish()
        return {
            "status": "success",
            "final_loss": train_result.training_loss,
            "adapter_path": str(adapter_output_dir),
            "samples_trained": len(train_dataset),
        }
    except Exception as exc:
        logger.error(f"\n❌ ERROR: {exc}")
        logger.error(traceback.format_exc())
        with contextlib.suppress(Exception):
            wandb.finish()
        raise


@app.local_entrypoint()
def main(config_path: str = "ai/config/training_config_v2_antirepetition.json"):
    """Run training from the local machine."""
    result = train_model.remote(config_path)
    logger.info("\n" + "=" * 60)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Status: {result['status']}")
    logger.info(f"Final loss: {result['final_loss']}")
    logger.info(f"Samples trained: {result['samples_trained']}")
    logger.info(f"Adapter saved to: {result['adapter_path']}")
    logger.info("=" * 60)
