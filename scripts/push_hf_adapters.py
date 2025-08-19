#!/usr/bin/env python3
"""
Push a trained PEFT adapter (and tokenizer) to the Hugging Face Hub.

Usage:
  python scripts/push_hf_adapters.py \
    --adapter-dir ai/training/checkpoints/harbinger24b-difficult-client-qlora \
    --repo-id your-username/harbinger24b-difficult-client-qlora-adapter \
    [--private]

Requirements:
  - huggingface_hub
  - transformers

Auth:
  export HF_TOKEN=...  # or use `huggingface-cli login`
"""
from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path

from huggingface_hub import create_repo, upload_folder, whoami


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--adapter-dir", required=True, type=Path)
    p.add_argument("--repo-id", required=True)
    p.add_argument("--private", action="store_true")
    args = p.parse_args()

    adapter_dir: Path = args.adapter_dir
    if not adapter_dir.exists():
        raise FileNotFoundError(f"Adapter dir not found: {adapter_dir}")

    # Basic sanity: expect adapter_config.json & adapter_model.safetensors
    expected = [
        adapter_dir / "adapter_config.json",
        adapter_dir / "adapter_model.safetensors",
    ]
    missing = [str(p) for p in expected if not p.exists()]
    if missing:
        raise FileNotFoundError(
            "Missing expected adapter files: " + ", ".join(missing)
        )

    # Configure logging for the script
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(levelname)s:%(name)s:%(message)s",
    )
    logger = logging.getLogger("push_hf_adapters")

    token = os.environ.get("HF_TOKEN")
    if not token:
        logger.warning("HF_TOKEN not set; relying on cached CLI auth if available.")

    try:
        user = whoami(token=token)
        logger.info(
            "Authenticated to HF Hub as: %s",
            user.get("name") or user.get("email"),
        )
    except Exception as e:
        logger.warning("Unable to verify HF auth: %s", e, exc_info=True)

    # Create repo if it doesn't exist
    create_repo(args.repo_id, private=args.private, exist_ok=True, token=token)

    # Upload adapter folder with tokenizer files if present
    logger.info("Uploading folder: %s -> %s", adapter_dir, args.repo_id)
    upload_folder(
        folder_path=str(adapter_dir),
        repo_id=args.repo_id,
        repo_type="model",
        token=token,
        # By default uses LFS for large files; allow overwrites for re-push
        allow_patterns=None,
        ignore_patterns=["*.pt", "*.bin"],
    )
    logger.info("Upload complete.")


if __name__ == "__main__":
    main()
