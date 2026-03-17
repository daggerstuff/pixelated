#!/usr/bin/env python3
"""
Modal Training Script - Retrain with Anti-Repetition Config
Uses the fixed training config (lora_alpha=16, lr=5e-6, dropout=0.1)
"""

import modal

# Create Modal app
app = modal.App("pixelated-retrain-v2")

# Define the training image with dependencies
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

# Volume for model outputs
MODELS_VOLUME = modal.Volume.from_name("pixel-merged-models", create_if_missing=True)


@app.function(
    image=TRAINING_IMAGE,
    gpu="A100",
    timeout=3600 * 4,  # 4 hours
    volumes={"/models": MODELS_VOLUME},
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("wandb-secret"),
    ],
)
def train_model(config_path: str = "ai/config/training_config_v2_antirepetition.json"):
    """Train the model with anti-repetition config"""
    import json
    import os
    from pathlib import Path

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

    # Load config
    with open(config_path) as f:
        config = json.load(f)

    print("=" * 60)
    print("PIXELATED V2 - ANTI-REPETITION RETRAINING")
    print("=" * 60)
    print(f"Base model: {config['model']['base_model']}")
    print(f"LoRA r={config['lora']['r']}, alpha={config['lora']['lora_alpha']}")
    print(f"Learning rate: {config['training']['learning_rate']}")
    print(f"Weight decay: {config['training']['weight_decay']}")
    print("=" * 60)

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(config["model"]["base_model"])
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load base model
    model = AutoModelForCausalLM.from_pretrained(
        config["model"]["base_model"],
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    # Apply LoRA with FIXED config
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=config["lora"]["r"],
        lora_alpha=config["lora"]["lora_alpha"],  # 16, not 32!
        lora_dropout=config["lora"]["lora_dropout"],  # 0.1, not 0!
        target_modules=config["lora"]["target_modules"],
    )

    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Load training data
    print(f"Loading training data from {config['data']['train_file']}...")
    train_data = []
    with open(config["data"]["train_file"]) as f:
        for line in f:
            if line.strip():
                train_data.append(json.loads(line))

    print(f"Loaded {len(train_data)} training samples")

    # Tokenize data
    def tokenize_function(examples):
        # Handle different data formats
        texts = []
        for item in examples:
            if "text" in item:
                texts.append(item["text"])
            elif "conversations" in item:
                # Convert conversations to text
                conv_text = ""
                for turn in item["conversations"]:
                    role = turn.get("role", "user")
                    content = turn.get("content", "")
                    conv_text += f"<|{role}|>{content}</|{role}|>\n"
                texts.append(conv_text)
            elif "prompt" in item and "response" in item:
                texts.append(
                    f"<|user|>{item['prompt']}</|user|>\n<|assistant|>{item['response']}</|assistant|>"
                )
            else:
                texts.append(str(item))

        return tokenizer(
            texts,
            truncation=True,
            max_length=config["data"]["max_seq_length"],
            padding="max_length",
            return_tensors="pt",
        )

    # Create dataset
    dataset = Dataset.from_list(train_data)
    tokenized_dataset = dataset.map(
        lambda x: tokenize_function([x]),
        batched=False,
        remove_columns=dataset.column_names,
    )

    # Split for validation
    split_dataset = tokenized_dataset.train_test_split(test_size=0.1)
    train_dataset = split_dataset["train"]
    eval_dataset = split_dataset["test"]

    print(f"Train: {len(train_dataset)}, Eval: {len(eval_dataset)}")

    # Training arguments
    training_args = TrainingArguments(
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

    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
    )

    # Initialize wandb
    wandb.init(
        project="pixelated-empathy-v2",
        name="antirepetition-retrain",
        config=config,
    )

    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
    )

    # Train
    print("Starting training...")
    train_result = trainer.train()

    # Save model
    output_dir = Path("/models/pixelated-v2-antirepetition")
    output_dir.mkdir(parents=True, exist_ok=True)

    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    # Save training config for reference
    with open(output_dir / "training_config_used.json", "w") as f:
        json.dump(config, f, indent=2)

    print(f"Model saved to {output_dir}")
    print(f"Final training loss: {train_result.training_loss}")

    # Commit volume
    MODELS_VOLUME.commit()

    wandb.finish()

    return {
        "status": "success",
        "final_loss": train_result.training_loss,
        "output_dir": str(output_dir),
        "samples_trained": len(train_dataset),
    }


@app.local_entrypoint()
def main(config_path: str = "ai/config/training_config_v2_antirepetition.json"):
    """Run training from local machine"""
    result = train_model.remote(config_path)
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print(f"Status: {result['status']}")
    print(f"Final loss: {result['final_loss']}")
    print(f"Samples trained: {result['samples_trained']}")
    print(f"Output: {result['output_dir']}")
    print("=" * 60)
