"""
Merge pixelated-v2-adapter (anti-repetition trained) with base model.
"""

import modal

app = modal.App("merge-v2")
volume = modal.Volume.from_name("pixel-merged-models")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
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
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    import os
    import time

    base_model_name = "LatitudeGames/Wayfarer-2-12B"
    # Use correct adapter path from train_modal_v2.py
    adapter_path = "/models/pixelated-v2-adapter"
    output_path = "/models/merged-v2"

    start_time = time.time()

    print("=" * 60)
    print("PIXELATED V2 MERGE")
    print("=" * 60)
    print(f"Base: {base_model_name}")
    print(f"Adapter: {adapter_path}")
    print(f"Output: {output_path}")
    print("=" * 60)

    print("\n[1/4] Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        base_model_name,
        use_fast=True,
    )
    print("  ✅ Tokenizer loaded")

    print("\n[2/4] Loading base model (this takes a few minutes)...")
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        dtype=torch.float16,
        device_map="auto",
    )
    print(f"  ✅ Base model loaded ({time.time() - start_time:.1f}s)")

    print("\n[3/4] Loading and merging LoRA adapter...")
    model = PeftModel.from_pretrained(base_model, adapter_path)
    print("  ✅ Adapter loaded")

    merged_model = model.merge_and_unload()
    print("  ✅ Merged and unloaded")

    print("\n[4/4] Saving merged model...")
    os.makedirs(output_path, exist_ok=True)
    merged_model.save_pretrained(output_path, safe_serialization=True)
    tokenizer.save_pretrained(output_path)
    print(f"  ✅ Saved to {output_path}")

    # Commit to volume
    print("\nCommitting to volume...")
    volume.commit()

    total_time = time.time() - start_time
    print("=" * 60)
    print(f"✅ MERGE COMPLETE in {total_time:.1f}s")
    print("=" * 60)

    return {"status": "success", "output_path": output_path, "time_seconds": total_time}


@app.local_entrypoint()
def main():
    result = merge_v2_adapter.remote()
    print(f"Result: {result}")
