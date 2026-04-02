#!/usr/bin/env python3
"""
Resumable S3 Data Ingestion with File-Level Checkpointing
Processes ALL 103.97 GB of JSONL data from S3 bucket in 4 prioritized phases.
Saves checkpoint after each file to enable safe resume.
"""

import sys

sys.path.insert(0, "/home/vivi/pixelated/ai")

import argparse
import json
import os
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from utils.s3_dataset_loader import S3DatasetLoader

# S3 Configuration
_ovh_access = os.getenv("OVH_S3_ACCESS_KEY")
_ovh_secret = os.getenv("OVH_S3_SECRET_KEY")
if not _ovh_access or not _ovh_secret:
    raise OSError(
        "OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY must be set in the environment. "
        "Export them from your .env file before running this script."
    )
os.environ["AWS_ACCESS_KEY_ID"] = _ovh_access
os.environ["AWS_SECRET_ACCESS_KEY"] = _ovh_secret
os.environ["OVH_S3_ENDPOINT"] = "https://s3.us-east-va.io.cloud.ovh.us"
os.environ["OVH_S3_BUCKET"] = "pixel-data"


class CheckpointManager:
    """Manages checkpointing for resumable processing."""

    def __init__(self, checkpoint_dir: Path):
        self.checkpoint_dir = checkpoint_dir
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.checkpoint_file = self.checkpoint_dir / ".checkpoint.json"

    def load(self) -> dict[str, Any]:
        """Load checkpoint state."""
        if self.checkpoint_file.exists():
            with open(self.checkpoint_file) as f:
                return json.load(f)
        return {"processed_files": {}, "phase_stats": {}}

    def save(self, state: dict[str, Any]):
        """Save checkpoint state."""
        with open(self.checkpoint_file, "w") as f:
            json.dump(state, f, indent=2)

    def mark_file_processed(self, phase: int, s3_path: str, record_count: int):
        """Mark a file as processed."""
        state = self.load()
        phase_key = f"phase_{phase}"

        if phase_key not in state["processed_files"]:
            state["processed_files"][phase_key] = {}

        state["processed_files"][phase_key][s3_path] = {
            "records": record_count,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }

        self.save(state)

    def is_file_processed(self, phase: int, s3_path: str) -> bool:
        """Check if a file has been processed."""
        state = self.load()
        phase_key = f"phase_{phase}"
        return s3_path in state.get("processed_files", {}).get(phase_key, {})

    def get_phase_stats(self, phase: int) -> tuple:
        """Get statistics for a phase."""
        state = self.load()
        phase_key = f"phase_{phase}"
        files = state.get("processed_files", {}).get(phase_key, {})
        total_records = sum(f["records"] for f in files.values())
        return len(files), total_records


def stream_and_convert_s3_file(loader: S3DatasetLoader, s3_path: str) -> Iterator[dict]:
    """Stream and convert S3 JSONL file to standard format."""
    try:
        for record in loader.stream_jsonl(s3_path):
            # Check if already in correct format
            if "messages" in record:
                yield record
            # Convert Context/Response format
            elif "data" in record and isinstance(record["data"], dict):
                data = record["data"]
                if "Context" in data and "Response" in data:
                    yield {
                        "messages": [
                            {"role": "user", "content": data["Context"]},
                            {"role": "assistant", "content": data["Response"]},
                        ],
                        "metadata": {"source": record.get("source", "unknown")},
                    }
            # Other formats - pass through if has content
            elif any(k in record for k in ["text", "content", "conversation"]):
                yield record
    except Exception:
        pass


def process_phase(
    phase_num: int,
    phase_config: dict,
    loader: S3DatasetLoader,
    output_file: Path,
    checkpoint_mgr: CheckpointManager,
) -> tuple:
    """Process a single phase with checkpointing."""

    # Check if we have existing progress
    files_done, records_done = checkpoint_mgr.get_phase_stats(phase_num)
    if files_done > 0:
        pass

    total_records = records_done
    total_files = files_done

    # Open output file in append mode
    with open(output_file, "a") as out:
        for prefix in phase_config["prefixes"]:
            try:
                s3_files = loader.list_datasets(prefix=prefix)
                s3_files = [f for f in s3_files if f.endswith(".jsonl")]

                for s3_file in s3_files:
                    # Skip if already processed
                    s3_path = (
                        s3_file if s3_file.startswith("s3://") else f"s3://pixel-data/{s3_file}"
                    )

                    if checkpoint_mgr.is_file_processed(phase_num, s3_path):
                        continue

                    try:
                        file_records = 0

                        for record in stream_and_convert_s3_file(loader, s3_path):
                            out.write(json.dumps(record) + "\n")
                            file_records += 1
                            total_records += 1

                            if total_records % 10000 == 0:
                                pass

                        if file_records > 0:
                            total_files += 1

                            # Save checkpoint after each file
                            checkpoint_mgr.mark_file_processed(phase_num, s3_path, file_records)

                    except Exception:
                        continue

            except Exception:
                continue

    return total_records, total_files


def main():
    parser = argparse.ArgumentParser(description="Process all S3 data with resumability")
    parser.add_argument("--phase", type=int, choices=[1, 2, 3, 4], help="Process single phase")
    parser.add_argument("--all-phases", action="store_true", help="Process all phases")
    args = parser.parse_args()

    # Setup
    loader = S3DatasetLoader()
    output_dir = Path("ai/training/ready_packages/datasets/cache/s3_complete_ingestion")
    output_dir.mkdir(parents=True, exist_ok=True)

    checkpoint_mgr = CheckpointManager(output_dir)

    # Phase definitions
    phases = {
        1: {
            "name": "ai/training_ready/ - ULTIMATE_FINAL_DATASET",
            "priority": "CRITICAL",
            "est_size": "11.1 GB",
            "prefixes": ["ai/training_ready/"],
            "output": output_dir / "phase_1_critical.jsonl",
        },
        2: {
            "name": "archive/gdrive/ + vps_archaeology/",
            "priority": "HIGH",
            "est_size": "56.9 GB",
            "prefixes": ["archive/gdrive/", "vps_archaeology/"],
            "output": output_dir / "phase_2_high.jsonl",
        },
        3: {
            "name": "legacy_local_backup/ + datasets/consolidated/",
            "priority": "MEDIUM",
            "est_size": "10.3 GB",
            "prefixes": ["legacy_local_backup/", "datasets/consolidated/"],
            "output": output_dir / "phase_3_medium.jsonl",
        },
        4: {
            "name": "Specialized & Remainder",
            "priority": "STANDARD",
            "est_size": "25.7 GB",
            "prefixes": [
                "datasets/training_v3/",
                "processed/",
                "datasets/production/",
                "ai/data/",
                "datasets/specialized/",
                "training/",
            ],
            "output": output_dir / "phase_4_standard.jsonl",
        },
    }

    # Process phases
    grand_total_records = 0
    grand_total_files = 0

    for phase_num, phase in phases.items():
        if args.phase and phase_num != args.phase:
            continue

        records, files = process_phase(phase_num, phase, loader, phase["output"], checkpoint_mgr)
        grand_total_records += records
        grand_total_files += files


if __name__ == "__main__":
    main()
