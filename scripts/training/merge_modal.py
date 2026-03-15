import os
import modal

# Define the Modal App
app = modal.App("pixelated-lora-merge")

# Use a standard image with necessary LoRA/Merge dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "transformers",
        "peft",
        "accelerate",
        "safetensors",
        "huggingface_hub"
    )
    # Add the local adapter directory directly to the image
    .add_local_dir(
        "./checkpoints/final_model", 
        remote_path="/root/adapter"
    )
)

# Persistent volume to store the merged model
volume = modal.Volume.from_name("pixel-merged-models", create_if_missing=True)

@app.function(
    image=image,
    gpu="A100",           # High RAM (80GB) to handle 12B model merge comfortably
    timeout=3600,         # 1 hour timeout
    volumes={"/root/models": volume},
    secrets=[
        modal.Secret.from_dict({"HF_TOKEN": os.environ.get("HF_TOKEN", "")})
    ] if os.environ.get("HF_TOKEN") else []
)
def merge_lora_task(base_model_name: str, output_dir_name: str):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    from pathlib import Path

    print("🚀 Starting merge task on Modal GPU...")
    print(f"Base Model: {base_model_name}")
    print("Adapter directory: /root/adapter")

    output_path = Path("/root/models") / output_dir_name
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"📥 Loading base model '{base_model_name}' into VRAM...")
    # Loading in float16 to match the training/inference setup
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True
    )

    print("✅ Base model loaded.")

    print("📥 Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)

    print("📥 Applying LoRA adapter from /root/adapter...")
    model = PeftModel.from_pretrained(
        base_model,
        "/root/adapter",
        is_trainable=False
    )

    print("🔄 Merging LoRA weights into base model...")
    merged_model = model.merge_and_unload()

    print(f"💾 Saving merged model to {output_path}...")
    merged_model.save_pretrained(
        str(output_path),
        safe_serialization=True
    )
    tokenizer.save_pretrained(str(output_path))

    # Commit changes to Volume to ensure persistence and visibility for download
    volume.commit()
    
    print(f"✅ Merge complete! Merged model is available in Modal Volume at: {output_path}")
    return str(output_path)

@app.local_entrypoint()
def main(base_model: str = "LatitudeGames/Wayfarer-2-12B", output_dir: str = "merged-pixel-merged"):
    """
    Local entrypoint to trigger the Modal merge.
    Usage: uv run modal run merge_modal.py --base-model ... --output-dir ...
    """
    print(f"📡 Triggering remote merge for {base_model}...")
    remote_path = merge_lora_task.remote(base_model, output_dir)
    print(f"🎉 Success! The merged model is stored at {remote_path} in your Modal volume.")
    print(f"To download it, you can use: modal volume get pixel-merged-models {output_dir}/ ./{output_dir}")
