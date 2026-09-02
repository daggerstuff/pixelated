#!/usr/bin/env python3
"""Lightweight model registry CLI — tag, list, and rollback training checkpoints.

Usage:
    uv run python scripts/devops/model-registry.py list
    uv run python scripts/devops/model-registry.py tag --run-id grpo-20260613 --base-model Mistral-Nemo-Instruct-2407
    uv run python scripts/devops/model-registry.py tag --run-id grpo-20260613 \
        --base-model Mistral-Nemo-Instruct-2407 --dataset-version v2 \
        --clinical-validity-score 0.75
    uv run python scripts/devops/model-registry.py rollback grpo-20260613
    uv run python scripts/devops/model-registry.py show grpo-20260613
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("model_registry")

REGISTRY_PATH = Path(__file__).resolve().parent.parent.parent / "ai" / "training" / "registry" / "models.json"
DEFAULT_CHECKPOINT_DIR = Path("/tmp/pixelated-checkpoints")  # override via PIX_CHECKPOINT_DIR


def _load_manifest() -> dict:
    """Load the registry manifest from disk, returning a default if missing."""
    if not REGISTRY_PATH.exists():
        return {"schema_version": "1.0", "active_run_id": None, "checkpoints": []}
    with open(REGISTRY_PATH, encoding="utf-8") as f:
        return json.load(f)


def _save_manifest(manifest: dict) -> None:
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def cmd_list(args: argparse.Namespace) -> None:
    manifest = _load_manifest()
    checkpoints = manifest.get("checkpoints", [])
    active = manifest.get("active_run_id")

    if not checkpoints:
        print("No checkpoints registered.")
        return

    for cp in sorted(checkpoints, key=lambda x: x.get("timestamp", ""), reverse=True):
        marker = "*" if cp["run_id"] == active else " "
        print(
            f"{marker} {cp['run_id']}  {cp.get('base_model', '?')}  "
            f"dataset={cp.get('dataset_version', '?')}  "
            f"score={cp.get('clinical_validity_score', 0.0)}  "
            f"{cp.get('timestamp', '')}"
        )


def cmd_tag(args: argparse.Namespace) -> None:
    manifest = _load_manifest()

    new_entry: dict = {
        "run_id": args.run_id,
        "base_model": args.base_model,
        "dataset_version": args.dataset_version,
        "clinical_validity_score": args.clinical_validity_score,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if args.metrics:
        try:
            new_entry["metrics"] = json.loads(args.metrics)
        except json.JSONDecodeError as e:
            logger.error("Invalid --metrics JSON: %s", e)
            sys.exit(1)

    manifest.setdefault("checkpoints", [])

    duplicate = [cp for cp in manifest["checkpoints"] if cp["run_id"] == args.run_id]
    if duplicate and not args.force:
        logger.error(
            "Run ID %r already exists. Use --force to overwrite.",
            args.run_id,
        )
        sys.exit(1)

    if duplicate:
        manifest["checkpoints"] = [cp for cp in manifest["checkpoints"] if cp["run_id"] != args.run_id]

    manifest["checkpoints"].append(new_entry)

    if args.set_active:
        manifest["active_run_id"] = args.run_id

    _save_manifest(manifest)


def cmd_rollback(args: argparse.Namespace) -> None:
    manifest = _load_manifest()
    run_id = args.run_id

    matching = [cp for cp in manifest.get("checkpoints", []) if cp["run_id"] == run_id]
    if not matching:
        logger.error("Run ID %r not found in registry.", run_id)
        sys.exit(1)

    manifest["active_run_id"] = run_id
    _save_manifest(manifest)

    checkpoint_dir = args.checkpoint_dir / run_id
    dest = DEFAULT_CHECKPOINT_DIR / "active"
    if checkpoint_dir.exists():
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(checkpoint_dir, dest)
    else:
        logger.warning(
            "Manifest updated but checkpoint directory %s not found locally. Pull from S3 first.",
            checkpoint_dir,
        )


def cmd_show(args: argparse.Namespace) -> None:
    manifest = _load_manifest()
    run_id = args.run_id

    matching = [cp for cp in manifest.get("checkpoints", []) if cp["run_id"] == run_id]
    if not matching:
        logger.error("Run ID %r not found in registry.", run_id)
        sys.exit(1)

    cp = matching[0]
    print(json.dumps(cp, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Model registry — tag, list, and rollback training checkpoints.",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")

    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List all registered checkpoints")

    tag = sub.add_parser("tag", help="Register a new checkpoint")
    tag.add_argument("--run-id", required=True)
    tag.add_argument("--base-model", default="Mistral-Nemo-Instruct-2407")
    tag.add_argument("--dataset-version", default="v1")
    tag.add_argument("--clinical-validity-score", type=float, default=0.0)
    tag.add_argument("--metrics", help="JSON string of evaluation metrics")
    tag.add_argument("--force", action="store_true", help="Overwrite existing entry")
    tag.add_argument("--set-active", action="store_true", help="Set as active checkpoint")

    roll = sub.add_parser("rollback", help="Rollback to a specific checkpoint")
    roll.add_argument("run_id")
    roll.add_argument(
        "--checkpoint-dir",
        type=Path,
        default=DEFAULT_CHECKPOINT_DIR,
        help="Directory containing checkpoint subdirectories named by run_id",
    )

    show = sub.add_parser("show", help="Show details of a specific checkpoint")
    show.add_argument("run_id")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=level, format="%(levelname)s: %(message)s")

    if args.command == "list":
        cmd_list(args)
    elif args.command == "tag":
        cmd_tag(args)
    elif args.command == "rollback":
        cmd_rollback(args)
    elif args.command == "show":
        cmd_show(args)


if __name__ == "__main__":
    main()
