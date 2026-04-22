#!/usr/bin/env python3
"""
Merge LoRA adapter into base model.

Usage:
    python merge_lora.py \
        --base LatitudeGames/Wayfarer-2-12B \
        --adapter checkpoints/final_model/ \
        --output merged-pixel-merged
"""

import argparse
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def main():
    parser = argparse.ArgumentParser(description="Merge LoRA adapter into base model")
    parser.add_argument("--base", type=str, required=True,
                       help="Base model name or path")
    parser.add_argument("--adapter", type=str, required=True,
                       help="LoRA adapter path")
    parser.add_argument("--output", type=str, required=True,
                       help="Output directory for merged model")
    parser.add_argument("--device", type=str, default="auto",
                       help="Device map (auto, cpu, cuda)")
    parser.add_argument("--torch-dtype", type=str, default="float16",
                       help="torch dtype (float16, bfloat16, float32)")
    parser.add_argument("--trust-remote-code", action="store_true",
                       help="Whether to trust remote code when loading models")
    parser.add_argument("--skip-verification", action="store_true",
                       help="Skip verification load after merging")
    args = parser.parse_args()

    print("=" * 60)
    print("LoRA Merge Configuration")
    print("=" * 60)
    print(f"Base model: {args.base}")
    print(f"Adapter: {args.adapter}")
    print(f"Output: {args.output}")
    print(f"Device: {args.device}")
    print(f"Torch dtype: {args.torch_dtype}")
    print(f"Trust remote code: {args.trust_remote_code}")
    print("=" * 60)

    # Create output directory
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    # Load base model
    print(f"\n[1/4] Loading base model '{args.base}'...")
    torch_dtype = getattr(torch, args.torch_dtype)

    base_model = AutoModelForCausalLM.from_pretrained(
        args.base,
        torch_dtype=torch_dtype,
        device_map=args.device,
        trust_remote_code=args.trust_remote_code,
        low_cpu_mem_usage=True   # Load in stages to save RAM
    )
    # Handle device map display
    device_map = getattr(base_model, "hf_device_map", {"": str(base_model.device)})
    print(f"✅ Base model loaded. Device map: {device_map}")

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.base, trust_remote_code=args.trust_remote_code)
    print(f"✅ Tokenizer loaded. Vocab size: {len(tokenizer)}")

    # Load adapter
    print(f"\n[2/4] Loading LoRA adapter '{args.adapter}'...")
    model_with_adapter = PeftModel.from_pretrained(
        base_model,
        args.adapter,
        device_map=args.device,
        is_trainable=False  # We're merging, not training
    )
    print("✅ Adapter loaded and applied to base model")

    # Merge weights
    print(f"\n[3/4] Merging LoRA weights into base...")
    merged_model = model_with_adapter.merge_and_unload()
    print("✅ Merge complete")

    # Save merged model
    print(f"\n[4/4] Saving merged model to '{args.output}'...")
    merged_model.save_pretrained(
        args.output,
        safe_serialization=True,  # Save as safetensors (recommended)
        max_shard_size="10GB"  # Split into 10GB chunks
    )
    tokenizer.save_pretrained(args.output)
    print("✅ Model and tokenizer saved")

    # Summary
    print("\n" + "=" * 60)
    print("MERGE COMPLETE")
    print("=" * 60)
    print(f"Output directory: {args.output}")
    print(f"Model files:")
    for file in sorted(output_path.glob("*")):
        if file.is_file():
            size_gb = file.stat().st_size / (1024**3)
            print(f"  - {file.name}: {size_gb:.2f} GB")
    print("=" * 60)

    # Verification (Optional but recommended in the guide)
    if not args.skip_verification:
        print("\n[Verification] Testing load of merged model...")
        try:
            AutoModelForCausalLM.from_pretrained(
                args.output,
                torch_dtype=torch_dtype,
                device_map="cpu",  # Load on CPU for test to save VRAM
                low_cpu_mem_usage=True,
                trust_remote_code=args.trust_remote_code
            )
            print("✅ Verification successful - merged model loads correctly")
        except Exception as e:
            print(f"❌ Verification failed: {e}")
    else:
        print("\n[Verification] Skipped as requested")

if __name__ == "__main__":
    main()
