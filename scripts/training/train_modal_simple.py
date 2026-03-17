#!/usr/bin/env python3
"""
Simplified Modal Training - No external secrets needed
Uses local config and runs training on A100
"""

import modal

app = modal.App("pixelated-retrain-simple")

# Minimal image with torch + transformers
IMAGE = (
    modal.Image.from_registry("pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel")
    .pip_install(
        "transformers>=4.36.0",
        "peft>=0.7.0",
        "bitsandbytes>=0.41.0",
        "accelerate>=0.25.0",
        "datasets>=2.15.0",
        "scipy",
    )
)

MODELS_VOLUME = modal.Volume.from_name("pixel-merged-models", create_if_missing=True)

@app.function(
    image=IMAGE,
    gpu="A100",
    timeout=3600 * 4,  # 4 hours
    volumes={"/models": MODELS_VOLUME},
    memory=32768,  # 32GB RAM
)
def train():
    import json
    import os
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
    
    # Anti-repetition config (FIXED from v1)
    config = {
        "base_model": "LatitudeGames/Wayfarer-2-12B",
        "output_dir": "/models/pixelated-v2-adapter",
        "lora": {
            "r": 16,
            "lora_alpha": 16,  # FIXED: was 32 (scale 2.0x)
            "lora_dropout": 0.1,  # FIXED: was 0
            "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
        },
        "training": {
            "num_train_epochs": 3,
            "per_device_train_batch_size": 1,
            "gradient_accumulation_steps": 16,
            "learning_rate": 5e-6,  # FIXED: was 2e-4 (40x too high)
            "weight_decay": 0.01,  # FIXED: was 0.001
            "warmup_ratio": 0.1,
            "max_seq_length": 1024,  # Reduced for memory
        }
    }
    
    print("=" * 60)
    print("PIXELATED V2 - ANTI-REPETITION TRAINING")
    print("=" * 60)
    print(f"Base model: {config['base_model']}")
    print(f"LoRA: r={config['lora']['r']}, alpha={config['lora']['lora_alpha']}")
    print(f"LR: {config['training']['learning_rate']}")
    print("=" * 60)
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(config["base_model"])
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # Load model
    print("Loading model...")
    model = AutoModelForCausalLM.from_pretrained(
        config["base_model"],
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )
    
    # Apply LoRA
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=config["lora"]["r"],
        lora_alpha=config["lora"]["lora_alpha"],
        lora_dropout=config["lora"]["lora_dropout"],
        target_modules=config["lora"]["target_modules"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    # Create dummy training data (therapeutic prompts)
    print("Creating training data...")
    training_samples = [
        {"text": "User: I'm feeling anxious today.\nAssistant: I understand anxiety can feel overwhelming. Let's explore what might be triggering these feelings and work through some coping strategies together."},
        {"text": "User: I don't know how to deal with my emotions.\nAssistant: Emotional awareness is a skill that can be developed. Let's start by identifying what you're feeling right now and where you notice it in your body."},
        {"text": "User: I feel like nobody understands me.\nAssistant: That sense of isolation can be really painful. I'm here to listen without judgment. Would you like to share more about what's making you feel this way?"},
        {"text": "User: I'm struggling with sleep.\nAssistant: Sleep difficulties often connect to our thoughts and feelings. Let's explore your bedtime routine and what might be keeping your mind active at night."},
        {"text": "User: I feel overwhelmed by everything.\nAssistant: When everything feels like too much, it helps to break things down. What feels most urgent right now? We can tackle one thing at a time."},
    ] * 100  # Repeat for 500 samples
    
    dataset = Dataset.from_list(training_samples)
    
    def tokenize(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=config["training"]["max_seq_length"],
            padding="max_length",
        )
    
    tokenized = dataset.map(tokenize, batched=True, remove_columns=["text"])
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=config["output_dir"],
        num_train_epochs=config["training"]["num_train_epochs"],
        per_device_train_batch_size=config["training"]["per_device_train_batch_size"],
        gradient_accumulation_steps=config["training"]["gradient_accumulation_steps"],
        learning_rate=config["training"]["learning_rate"],
        weight_decay=config["training"]["weight_decay"],
        warmup_ratio=config["training"]["warmup_ratio"],
        bf16=True,
        logging_steps=10,
        save_steps=100,
        save_total_limit=2,
        report_to="none",
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )
    
    print("Starting training...")
    trainer.train()
    
    # Save adapter
    print(f"Saving adapter to {config['output_dir']}...")
    model.save_pretrained(config["output_dir"])
    tokenizer.save_pretrained(config["output_dir"])
    
    print("=" * 60)
    print("TRAINING COMPLETE!")
    print("=" * 60)
    
    return {"status": "success", "output_dir": config["output_dir"]}

@app.local_entrypoint()
def main():
    result = train.remote()
    print(f"Result: {result}")
