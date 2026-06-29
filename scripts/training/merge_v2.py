"""
Merge pixelated-v2-adapter (anti-repetition trained) with base model.
"""

import modal

app = modal.App("merge-v2")
volume = modal.Volume.from_name("pixel-merged-models")

image = modal.Image.debian_slim(python_version="3.13").pip_install(
    "torch", "transformers", "peft", "accelerate", "safetensors"
)


@app.function(
    gpu="A100",
    image=image,
    volumes={"/models": volume},
    timeout=3600,  # 1 hour timeout
    memory=65536,  # 64GB memory
)
def merge_v2_adapter():
    import os
    import time

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    base_model_name = "LatitudeGames/Wayfarer-2-12B"
    # Use correct adapter path from train_modal_v2.py
    adapter_path = "/models/pixelated-v2-adapter"
    output_path = "/models/merged-v2"

    start_time = time.time()

    tokenizer = AutoTokenizer.from_pretrained(
        base_model_name,
        use_fast=True,
    )

    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        dtype=torch.float16,
        device_map="auto",
    )

    model = PeftModel.from_pretrained(base_model, adapter_path)

    merged_model = model.merge_and_unload()

    os.makedirs(output_path, exist_ok=True)
    merged_model.save_pretrained(output_path, safe_serialization=True)
    tokenizer.save_pretrained(output_path)

    # Commit to volume
    volume.commit()

    total_time = time.time() - start_time

    return {"status": "success", "output_path": output_path, "time_seconds": total_time}


@app.local_entrypoint()
def main():
    merge_v2_adapter.remote()
