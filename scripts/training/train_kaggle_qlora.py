#!/usr/bin/env python3
"""
QLoRA Training Script for Kaggle T4 (16GB VRAM)
Retrains with anti-repetition config using 4-bit quantization

Usage:
1. Upload this script to Kaggle Notebook
2. Attach training data as Kaggle Dataset
3. Enable GPU accelerator (T4)
4. Run all cells
"""

import json
import os
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)

# ============================================================================
# Configuration - FIXED ANTI-REPETITION PARAMS
# ============================================================================
CONFIG = {
    "base_model": "LatitudeGames/Wayfarer-2-12B",
    "output_dir": "./checkpoints/pixelated-v2-qlora",
    "data_path": "/kaggle/input/pixelated-training-data",  # Update with your dataset path
    # QLoRA Config
    "qlora": {
        "bits": 4,
        "quant_type": "nf4",
        "double_quant": True,
    },
    # LoRA Config - FIXED from v1 issues
    "lora": {
        "r": 16,
        "lora_alpha": 16,  # FIXED: was 32 (scale 2.0x), now 16 (scale 1.0x)
        "lora_dropout": 0.1,  # FIXED: was 0, now 0.1
        "target_modules": [
            "q_proj",
            "v_proj",
            "k_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    },
    # Training Config - FIXED for stability
    "training": {
        "num_train_epochs": 3,
        "per_device_train_batch_size": 1,  # Small for 12B on 16GB
        "gradient_accumulation_steps": 16,  # Effective batch = 16
        "learning_rate": 5e-6,  # FIXED: was 2e-4 (40x too high)
        "weight_decay": 0.01,  # FIXED: was 0.001 (10x too low)
        "warmup_ratio": 0.1,  # FIXED: was 0.03
        "lr_scheduler_type": "cosine",
        "max_seq_length": 2048,
        "logging_steps": 10,
        "save_steps": 250,
        "save_total_limit": 2,
    },
}


def load_model_and_tokenizer():
    """Load model with 4-bit quantization for QLoRA"""

    print(f"Loading base model: {CONFIG['base_model']}")

    # BitsAndBytes config for 4-bit
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type=CONFIG["qlora"]["quant_type"],
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=CONFIG["qlora"]["double_quant"],
    )

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(CONFIG["base_model"])
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load model with 4-bit quantization
    model = AutoModelForCausalLM.from_pretrained(
        CONFIG["base_model"],
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )

    # Prepare for k-bit training
    model = prepare_model_for_kbit_training(model)

    # Apply LoRA with FIXED config
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=CONFIG["lora"]["r"],
        lora_alpha=CONFIG["lora"]["lora_alpha"],
        lora_dropout=CONFIG["lora"]["lora_dropout"],
        target_modules=CONFIG["lora"]["target_modules"],
    )

    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    return model, tokenizer


def load_training_data(data_path: str):
    """Load and prepare training data with validation"""

    print(f"Loading training data from: {data_path}")

    all_data = []
    data_path = Path(data_path)

    # Validate path exists
    if not data_path.exists():
        raise FileNotFoundError(f"Data path does not exist: {data_path}")

    # Handle directory with multiple jsonl files
    if data_path.is_dir():
        jsonl_files = list(data_path.glob("*.jsonl"))
        if not jsonl_files:
            raise ValueError(f"No .jsonl files found in {data_path}")
        print(f"Found {len(jsonl_files)} JSONL files")
    else:
        # Single file
        if not data_path.suffix == ".jsonl":
            raise ValueError(f"Expected .jsonl file, got {data_path.suffix}")
        jsonl_files = [data_path]

    # Load data from files
    total_lines = 0
    errors = 0
    for jsonl_file in jsonl_files:
        try:
            with open(jsonl_file) as f:
                for line_num, line in enumerate(f, 1):
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        all_data.append(data)
                        total_lines += 1
                    except json.JSONDecodeError as e:
                        errors += 1
                        if errors <= 5:  # Show first 5 errors only
                            print(f"  ⚠️  Line {line_num} in {jsonl_file.name}: {e}")
        except Exception as e:
            print(f"  ❌ Error reading {jsonl_file}: {e}")
            raise

    if errors > 5:
        print(f"  ... and {errors - 5} more JSON parsing errors")

    print(f"✅ Loaded {total_lines} training samples (from {len(jsonl_files)} files)")
    if not all_data:
        raise ValueError("No valid training data loaded")

    return all_data


def tokenize_data(examples, tokenizer, max_length=2048):
    """Tokenize training examples with validation"""

    texts = []
    for item in examples:
        if not isinstance(item, dict):
            print(f"⚠️  Skipping non-dict item: {type(item)}")
            continue

        text = None

        # Handle different data formats
        if "text" in item:
            # Raw text format
            text = item["text"]
        elif "messages" in item:
            # Messages format (current training data format)
            messages = item.get("messages", [])
            if messages and isinstance(messages, list):
                conv_text = ""
                for msg in messages:
                    if isinstance(msg, dict):
                        role = msg.get("role", "user")
                        content = msg.get("content", "")
                        conv_text += f"<|{role}|>{content}</|{role}|>\n"
                if conv_text:
                    text = conv_text
        elif "conversations" in item:
            # Conversations format
            conv_text = ""
            for turn in item["conversations"]:
                if not isinstance(turn, dict):
                    continue
                role = turn.get("role", "user")
                content = turn.get("content", "")
                conv_text += f"<|{role}|>{content}</|{role}|>\n"
            if conv_text:
                text = conv_text
        elif "prompt" in item and "response" in item:
            # Prompt/response format
            text = (
                f"<|user|>{item['prompt']}</|user|>\n<|assistant|>{item['response']}</|assistant|>"
            )
        else:
            # Fallback to string representation
            text = str(item)

        if text and text.strip():
            texts.append(text)

    if not texts:
        # Return empty result to avoid errors
        return {
            "input_ids": [],
            "attention_mask": [],
        }

    return tokenizer(
        texts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
        return_tensors=None,
    )


def main():
    """Main training function"""

    print("=" * 60)
    print("PIXELATED V2 - QLORA ANTI-REPETITION TRAINING")
    print("=" * 60)
    print(f"Base model: {CONFIG['base_model']}")
    print(f"LoRA r={CONFIG['lora']['r']}, alpha={CONFIG['lora']['lora_alpha']}")
    print(f"Learning rate: {CONFIG['training']['learning_rate']}")
    print(f"Weight decay: {CONFIG['training']['weight_decay']}")
    print("=" * 60)

    try:
        # Load model
        print("\n[1/5] Loading model and tokenizer...")
        model, tokenizer = load_model_and_tokenizer()

        # Load data with error handling
        print("\n[2/5] Loading training data...")
        raw_data = load_training_data(CONFIG["data_path"])
        if not raw_data:
            raise ValueError("No training data loaded successfully")

        # Create dataset
        print(f"\n[3/5] Preparing dataset ({len(raw_data)} samples)...")
        dataset = Dataset.from_list(raw_data)

        # Tokenize
        def tokenize_fn(batch):
            return tokenize_data([batch], tokenizer, CONFIG["training"]["max_seq_length"])

        tokenized_dataset = dataset.map(
            tokenize_fn,
            batched=False,
            remove_columns=dataset.column_names,
        )

        # Split for validation
        if len(tokenized_dataset) < 2:
            print("⚠️  Dataset too small for proper train/eval split, using single split")
            train_dataset = tokenized_dataset
            eval_dataset = tokenized_dataset
        else:
            split_dataset = tokenized_dataset.train_test_split(test_size=0.05)
            train_dataset = split_dataset["train"]
            eval_dataset = split_dataset["test"]

        print(f"✅ Train: {len(train_dataset)}, Eval: {len(eval_dataset)}")

        # Training arguments
        print("\n[4/5] Setting up training...")
        training_args = TrainingArguments(
            output_dir=CONFIG["output_dir"],
            num_train_epochs=CONFIG["training"]["num_train_epochs"],
            per_device_train_batch_size=CONFIG["training"]["per_device_train_batch_size"],
            gradient_accumulation_steps=CONFIG["training"]["gradient_accumulation_steps"],
            learning_rate=CONFIG["training"]["learning_rate"],
            weight_decay=CONFIG["training"]["weight_decay"],
            warmup_ratio=CONFIG["training"]["warmup_ratio"],
            lr_scheduler_type=CONFIG["training"]["lr_scheduler_type"],
            logging_steps=CONFIG["training"]["logging_steps"],
            save_steps=CONFIG["training"]["save_steps"],
            save_total_limit=CONFIG["training"]["save_total_limit"],
            bf16=True,
            gradient_checkpointing=True,
            optim="paged_adamw_8bit",
            report_to="none",
            run_name="pixelated-v2-qlora",
        )

        # Data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=tokenizer,
            mlm=False,
        )

        # Trainer
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            data_collator=data_collator,
        )

        # Train
        print("\n[5/5] Starting training...")
        train_result = trainer.train()

        # Save LoRA adapter (not full model)
        print("\n[Final] Saving LoRA adapter...")
        output_dir = Path(CONFIG["output_dir"])
        output_dir.mkdir(parents=True, exist_ok=True)

        model.save_pretrained(str(output_dir))
        tokenizer.save_pretrained(str(output_dir))

        # Save config for reference
        with open(output_dir / "training_config_used.json", "w") as f:
            json.dump(CONFIG, f, indent=2)

        print(f"\n{'=' * 60}")
        print("TRAINING COMPLETE")
        print(f"{'=' * 60}")
        print(f"Final loss: {train_result.training_loss}")
        print(f"Adapter saved to: {output_dir}")

        # Print next steps
        print(f"\n{'=' * 60}")
        print("NEXT STEPS")
        print(f"{'=' * 60}")
        print("1. Download the adapter from:", output_dir)
        print("2. Merge with base model using scripts/training/merge_lora.py")
        print("3. Run evaluation with modal run ai/deployment/modal_app.py")
        print("4. Verify repetition rate < 5%")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()
