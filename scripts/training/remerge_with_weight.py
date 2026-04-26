#!/usr/bin/env python3
"""
Re-merge LoRA with reduced adapter weight.

The original merge used full adapter weight (scale = lora_alpha/lora_r = 32/16 = 2.0x).
This script allows merging with a custom scale factor to reduce overfitting effects.

Usage:
    uv run python scripts/training/remerge_with_weight.py \
        --base LatitudeGames/Wayfarer-2-12B \
        --adapter checkpoints/final_model/ \
        --output checkpoints/merged_reduced/ \
        --scale 0.5
"""

import argparse
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def scale_adapter_weights(model: PeftModel, scale: float) -> PeftModel:
    """
    Scale LoRA adapter weights by a factor.

    Args:
        model: PeftModel with LoRA adapter
        scale: Factor to multiply adapter weights (0.5 = half strength)

    Returns:
        PeftModel with scaled weights
    """
    print(f"Scaling adapter weights by factor: {scale}")

    with torch.no_grad():
        for name, param in model.named_parameters():
            if "lora_" in name and param.requires_grad:
                param.data.mul_(scale)
                print(f"  Scaled: {name}")

    return model


def merge_with_custom_weight(
    base_model_name: str,
    adapter_path: str,
    output_path: str,
    scale: float = 1.0,
    torch_dtype: str = "float16",
    device: str = "auto",
):
    """
    Merge LoRA adapter into base model with custom weight scaling.

    Args:
        base_model_name: HuggingFace model name or path
        adapter_path: Path to LoRA adapter
        output_path: Output directory for merged model
        scale: Weight scaling factor (default 1.0 = full strength)
        torch_dtype: Data type for model
        device: Device map
    """
    print("=" * 60)
    print("LoRA Re-Merge with Custom Weight")
    print("=" * 60)
    print(f"Base model: {base_model_name}")
    print(f"Adapter: {adapter_path}")
    print(f"Output: {output_path}")
    print(f"Scale factor: {scale}")
    print("=" * 60)

    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)

    dtype = getattr(torch, torch_dtype)

    # Load base model
    print("\n[1/5] Loading base model...")
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=dtype,
        device_map=device,
        trust_remote_code=True,
        low_cpu_mem_usage=True,
    )
    print(f"✅ Base model loaded")

    # Load tokenizer
    print("\n[2/5] Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    print(f"✅ Tokenizer loaded. Vocab size: {len(tokenizer)}")

    # Load adapter
    print("\n[3/5] Loading LoRA adapter...")
    model = PeftModel.from_pretrained(
        base_model,
        adapter_path,
        is_trainable=False,
    )

    # Print original scale
    adapter_config = model.peft_config["default"]
    original_scale = adapter_config.lora_alpha / adapter_config.r
    print(f"  Original lora_alpha: {adapter_config.lora_alpha}")
    print(f"  Original lora_r: {adapter_config.r}")
    print(f"  Original effective scale: {original_scale:.2f}x")

    # Scale weights if needed
    if scale != 1.0:
        print(f"\n[4/5] Scaling adapter weights by {scale}...")
        model = scale_adapter_weights(model, scale)
        new_effective_scale = original_scale * scale
        print(f"  New effective scale: {new_effective_scale:.2f}x")
    else:
        print("\n[4/5] No scaling applied (scale=1.0)")

    # Merge and unload
    print("\n[5/5] Merging and saving...")
    merged_model = model.merge_and_unload(safe_merge=True)

    merged_model.save_pretrained(
        str(output_path),
        safe_serialization=True,
        max_shard_size="10GB",
    )
    tokenizer.save_pretrained(str(output_path))

    print("\n" + "=" * 60)
    print("MERGE COMPLETE")
    print("=" * 60)
    print(f"Output directory: {output_path}")
    print(f"Model files:")
    for file in sorted(output_path.glob("*")):
        if file.is_file():
            size_gb = file.stat().st_size / (1024**3)
            print(f"  - {file.name}: {size_gb:.2f} GB")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Re-merge LoRA with custom weight")
    parser.add_argument(
        "--base", type=str, default="LatitudeGames/Wayfarer-2-12B", help="Base model name or path"
    )
    parser.add_argument(
        "--adapter", type=str, default="checkpoints/final_model/", help="Path to LoRA adapter"
    )
    parser.add_argument(
        "--output", type=str, default="checkpoints/merged_reduced/", help="Output directory"
    )
    parser.add_argument(
        "--scale", type=float, default=0.5, help="Weight scaling factor (0.5 = half strength)"
    )
    parser.add_argument("--torch-dtype", type=str, default="float16", help="Torch dtype")
    parser.add_argument("--device", type=str, default="auto", help="Device map")

    args = parser.parse_args()

    merge_with_custom_weight(
        base_model_name=args.base,
        adapter_path=args.adapter,
        output_path=args.output,
        scale=args.scale,
        torch_dtype=args.torch_dtype,
        device=args.device,
    )


if __name__ == "__main__":
    main()
