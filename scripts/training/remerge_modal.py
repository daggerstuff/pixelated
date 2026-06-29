"""
Re-merge LoRA on Modal GPU with reduced adapter weight.

Usage:
    modal run scripts/training/remerge_modal.py --scale 0.5
"""

import modal

app = modal.App("pixelated-remerge")

# Image with adapter included
image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install(
        "torch",
        "transformers",
        "peft",
        "accelerate",
        "safetensors",
    )
    .add_local_dir("checkpoints/final_model", remote_path="/root/adapter")
)

# Volume for output
volume = modal.Volume.from_name("pixel-merged-models", create_if_missing=True)


@app.function(
    image=image,
    gpu="A100",
    timeout=3600,
    volumes={"/root/models": volume},
)
def remerge_with_scale(scale: float = 0.5):
    """Re-merge LoRA with scaled adapter weights."""
    from pathlib import Path

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    base_model_name = "LatitudeGames/Wayfarer-2-12B"
    output_name = f"merged-scale-{scale}"

    # Load base model
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)

    # Load adapter
    model = PeftModel.from_pretrained(
        base_model,
        "/root/adapter",
        is_trainable=False,
    )

    # Get original scale
    config = model.peft_config["default"]
    orig_alpha = getattr(config, "lora_alpha", 32)
    orig_r = getattr(config, "r", 16)
    orig_alpha / orig_r

    # Scale weights
    if scale != 1.0:
        with torch.no_grad():
            for name, param in model.named_parameters():
                if "lora_" in name:
                    param.data.mul_(scale)

    # Merge
    merged = model.merge_and_unload(safe_merge=True)

    # Save to volume
    output_path = Path(f"/root/models/{output_name}")
    output_path.mkdir(parents=True, exist_ok=True)

    merged.save_pretrained(str(output_path), safe_serialization=True)
    tokenizer.save_pretrained(str(output_path))

    # Commit volume
    volume.commit()

    return str(output_path)


@app.local_entrypoint()
def main(scale: float = 0.5):
    """Run re-merge with specified scale factor."""
    remerge_with_scale.remote(scale)
