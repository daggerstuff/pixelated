#!/usr/bin/env python3
"""
Complete S3 Data Ingestion Processor
Processes ALL 103.97 GB of JSONL data from S3 bucket in 4 prioritized phases.
"""

import sys
sys.path.insert(0, '/home/vivi/pixelated/ai')

import os
import json
import argparse
import pickle
from pathlib import Path
from datetime import datetime
from typing import Iterator
from utils.s3_dataset_loader import S3DatasetLoader

# S3 Configuration
os.environ['AWS_ACCESS_KEY_ID'] = 'b6939e6b65ef4252b20338499421a5f0'
os.environ['AWS_SECRET_ACCESS_KEY'] = '4a7e939381c6467c88f81a5024672a96'
os.environ['OVH_S3_ENDPOINT'] = 'https://s3.us-east-va.io.cloud.ovh.us'
os.environ['OVH_S3_BUCKET'] = 'pixel-data'

# Output configuration
OUTPUT_BASE = Path("ai/training/ready_packages/datasets/cache/s3_complete_ingestion")
OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

# Phase definitions (from the plan)
PHASES = {
    1: {
        "name": "ai/training_ready/ - ULTIMATE_FINAL_DATASET",
        "prefixes": ["ai/training_ready/"],
        "priority": "CRITICAL",
        "est_size_gb": 11.1
    },
    2: {
        "name": "archive/ - Historical datasets",
        "prefixes": ["archive/gdrive/", "archive/vps_archaeology/"],
        "priority": "HIGH",
        "est_size_gb": 56.9
    },
    3: {
        "name": "legacy_local_backup/ + datasets/consolidated/",
        "prefixes": ["legacy_local_backup/", "datasets/consolidated/"],
        "priority": "MEDIUM",
        "est_size_gb": 10.3
    },
    4: {
        "name": "Specialized + remainder",
        "prefixes": [
            "ai/data/", "datasets/training_v3/", "processed/",
            "training/", "knowledge/", "datasets/",
            "ai/datasets/", "ai/lightning/"
        ],
        "priority": "STANDARD",
        "est_size_gb": 25.7
    }
}


def normalize_record(record: dict) -> dict:
    """Normalize different record formats to standard messages format."""
    
    # Already in correct format
    if "messages" in record:
        return record
    
    # Handle Context/Response format
    if "data" in record and isinstance(record["data"], dict):
        data = record["data"]
        if "Context" in data and "Response" in data:
            return {
                "messages": [
                    {"role": "user", "content": data["Context"]},
                    {"role": "assistant", "content": data["Response"]}
                ],
                "metadata": {
                    "source": record.get("source", "unknown"),
                    "original_format": "context_response"
                }
            }
    
    # Handle direct conversation format
    if "conversation" in record:
        return {"messages": record["conversation"]}
    
    # Handle text/response pairs
    if "text" in record and "response" in record:
        return {
            "messages": [
                {"role": "user", "content": record["text"]},
                {"role": "assistant", "content": record["response"]}
            ]
        }
    
    # Skip records we can't normalize
    return None


def stream_and_convert_s3_file(loader: S3DatasetLoader, s3_path: str) -> Iterator[dict]:
    """Stream a JSONL file from S3 and yield normalized records."""
    try:
        for record in loader.stream_jsonl(s3_path):
            normalized = normalize_record(record)
            if normalized:
                yield normalized
    except Exception as e:
        print(f"⚠️  Error streaming {s3_path}: {e}")


def process_phase(phase_num: int, loader: S3DatasetLoader, dry_run: bool = False):
    """Process a single phase of the ingestion plan."""
    phase = PHASES[phase_num]
    print(f"\n{'='*100}")
    print(f"🚀 PHASE {phase_num}: {phase['name']}")
    print(f"   Priority: {phase['priority']} | Est. Size: {phase['est_size_gb']} GB")
    print(f"{'='*100}\n")
    
    output_file = OUTPUT_BASE / f"phase_{phase_num}_{phase['priority'].lower()}.jsonl"
    
    if dry_run:
        print(f"[DRY RUN] Would process prefixes: {phase['prefixes']}")
        return
    
    total_records = 0
    total_files = 0
    
    with open(output_file, 'w') as out:
        for prefix in phase['prefixes']:
            print(f"\n📂 Processing prefix: {prefix}")
            
            try:
                # List all JSONL files under this prefix
                s3_files = [f for f in loader.list_datasets(prefix=prefix) if f.endswith('.jsonl')]
                print(f"   Found {len(s3_files)} JSONL files")
                
                for s3_file in s3_files:
                    try:
                        # s3_file already contains the full path from list_datasets
                        s3_path = s3_file if s3_file.startswith('s3://') else f"s3://pixel-data/{s3_file}"
                        file_records = 0
                        
                        for record in stream_and_convert_s3_file(loader, s3_path):
                            out.write(json.dumps(record) + '\n')
                            file_records += 1
                            total_records += 1
                            
                            if total_records % 10000 == 0:
                                print(f"     ✓ {total_records:,} records processed...", flush=True)
                        
                        total_files += 1
                        if file_records > 0:
                            print(f"   ✅ {s3_file}: {file_records:,} records", flush=True)
                        
                    except Exception as e:
                        print(f"   ⚠️  Skipped {s3_file}: {e}")
                        continue
                        
            except Exception as e:
                print(f"   ⚠️  Error listing prefix {prefix}: {e}")
                continue
    
    print(f"\n{'='*100}")
    print(f"✅ PHASE {phase_num} COMPLETE")
    print(f"   Files: {total_files:,} | Records: {total_records:,}")
    print(f"   Output: {output_file}")
    print(f"   Size: {output_file.stat().st_size / 1024 / 1024:.2f} MB")
    print(f"{'='*100}\n")
    
    return total_records, total_files


def save_checkpoint(phase_num, file_idx, processed_files):
    """Save checkpoint state."""
    checkpoint_file = Path('ai/training/ready_packages/datasets/cache/s3_complete_ingestion/.checkpoint.pkl')
    checkpoint_file.parent.mkdir(parents=True, exist_ok=True)
    with open(checkpoint_file, 'wb') as f:
        pickle.dump({
            'phase': phase_num,
            'file_index': file_idx,
            'processed_files': processed_files,
            'timestamp': datetime.now().isoformat()
        }, f)

def load_checkpoint():
    """Load checkpoint state if exists."""
    checkpoint_file = Path('ai/training/ready_packages/datasets/cache/s3_complete_ingestion/.checkpoint.pkl')
    if checkpoint_file.exists():
        with open(checkpoint_file, 'rb') as f:
            return pickle.load(f)
    return None

def main():
    parser = argparse.ArgumentParser(description='Process all S3 data')
    parser.add_argument('--phase', type=int, choices=[1,2,3,4], help='Process single phase')
    parser.add_argument('--all-phases', action='store_true', help='Process all phases')
    parser.add_argument('--dry-run', action='store_true', help='Dry run (no actual processing)')
    args = parser.parse_args()
    
    if not args.phase and not args.all_phases:
        parser.error("Must specify --phase N or --all-phases")
    
    loader = S3DatasetLoader()
    start_time = datetime.now()
    
    print(f"\n{'='*100}")
    print(f"🎯 COMPLETE S3 DATA INGESTION")
    print(f"   Started: {start_time}")
    print(f"   Target: 103.97 GB | 589 files | ~50-100M records")
    print(f"{'='*100}\n")
    
    grand_total_records = 0
    grand_total_files = 0
    
    phases_to_run = [args.phase] if args.phase else [1, 2, 3, 4]
    
    for phase_num in phases_to_run:
        records, files = process_phase(phase_num, loader, dry_run=args.dry_run)
        grand_total_records += records
        grand_total_files += files
    
    end_time = datetime.now()
    duration = end_time - start_time
    
    print(f"\n{'='*100}")
    print(f"🎉 COMPLETE S3 INGESTION FINISHED!")
    print(f"   Duration: {duration}")
    print(f"   Total Files: {grand_total_files:,}")
    print(f"   Total Records: {grand_total_records:,}")
    print(f"   Output: {OUTPUT_BASE}")
    print(f"{'='*100}\n")


if __name__ == "__main__":
    main()
