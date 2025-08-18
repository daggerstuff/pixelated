#!/usr/bin/env python3
"""
Merge a PEFT adapter into the base model and push the merged model to Hugging Face Hub.

Usage:
  python scripts/push_hf_merged.py \
    --base LatitudeGames/Harbinger-24B \
    --adapter-dir ai/training/checkpoints/harbinger24b-difficult-client-qlora \
    --out-dir ai/training/checkpoints/harbinger24b-difficult-client-merged \
    --repo-id your-username/harbinger24b-difficult-client-merged \
    [--private]

Requirements:
  - huggingface_hub
  - transformers
  - peft

Auth:
  export HF_TOKEN=...  # or use `huggingface-cli login`
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import torch
from huggingface_hub import HfApi, create_repo, upload_folder, whoami
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True)
    p.add_argument("--adapter-dir", required=True, type=Path)
    p.add_argument("--out-dir", required=True, type=Path)
    p.add_argument("--repo-id", required=True)
    p.add_argument("--private", action="store_true")
    args = p.parse_args()

    adapter_dir: Path = args.adapter_dir
    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    if not adapter_dir.exists():
        raise FileNotFoundError(f"Adapter dir not found: {adapter_dir}")

    tok = AutoTokenizer.from_pretrained(args.base, use_fast=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float16
    base_model = AutoModelForCausalLM.from_pretrained(
        args.base,
        torch_dtype=dtype,
        device_map="auto",
        trust_remote_code=True,
    )

    peft_model = PeftModel.from_pretrained(base_model, adapter_dir)
    merged = peft_model.merge_and_unload()

    merged.save_pretrained(out_dir)
    tok.save_pretrained(out_dir)

    token = os.environ.get("HF_TOKEN")
    if not token:
        print("WARN: HF_TOKEN not set; relying on cached CLI auth if available.")

    api = HfApi()
    try:
        user = whoami(token=token)
        print(f"Authenticated to HF Hub as: {user.get('name') or user.get('email')}")
    except Exception as e:
        print(f"Unable to verify HF auth: {e}")

    create_repo(args.repo_id, private=args.private, exist_ok=True, token=token)

    print(f"Uploading merged model from: {out_dir} -> {args.repo_id}")
    upload_folder(
        folder_path=str(out_dir),
        repo_id=args.repo_id,
        repo_type="model",
        token=token,
        allow_patterns=None,
        ignore_patterns=["*.pt", "*.bin"],
    )
    print("Upload complete.")


if __name__ == "__main__":
    main()
