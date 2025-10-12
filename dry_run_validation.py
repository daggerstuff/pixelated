#!/usr/bin/env python3

import json
import sys
from pathlib import Path

def validate_dataset_format(file_path, sample_size=100):
    """Validate dataset format and structure"""
    errors = []
    valid_count = 0
    
    try:
        with open(file_path, 'r') as f:
            for i, line in enumerate(f):
                if i >= sample_size:
                    break
                    
                try:
                    data = json.loads(line)
                    
                    # Check required fields
                    if not isinstance(data, dict):
                        errors.append(f"Line {i+1}: Not a dict")
                        continue
                    
                    # Check for conversation structure
                    if 'messages' in data:
                        messages = data['messages']
                        if not isinstance(messages, list):
                            errors.append(f"Line {i+1}: messages not a list")
                            continue
                        
                        for j, msg in enumerate(messages):
                            if not isinstance(msg, dict):
                                errors.append(f"Line {i+1}, msg {j}: Not a dict")
                                continue
                            if 'role' not in msg or 'content' not in msg:
                                errors.append(f"Line {i+1}, msg {j}: Missing role/content")
                                continue
                    
                    valid_count += 1
                    
                except json.JSONDecodeError as e:
                    errors.append(f"Line {i+1}: JSON decode error - {e}")
                except Exception as e:
                    errors.append(f"Line {i+1}: Validation error - {e}")
    
    except Exception as e:
        errors.append(f"File error: {e}")
    
    return valid_count, errors

def dry_run_validation():
    """Run validation on the mini pipeline dataset"""
    
    pipeline_dir = Path("/root/pixelated/processed/mini_pipeline")
    
    if not pipeline_dir.exists():
        print("❌ Mini pipeline directory not found. Run setup_mini_pipeline.py first.")
        return False
    
    files_to_check = [
        pipeline_dir / "combined_dataset.jsonl",
        pipeline_dir / "splits" / "train.jsonl",
        pipeline_dir / "splits" / "val.jsonl", 
        pipeline_dir / "splits" / "test.jsonl"
    ]
    
    print("🔍 Running dry run validation...")
    
    all_valid = True
    
    for file_path in files_to_check:
        if not file_path.exists():
            print(f"❌ {file_path.name}: File not found")
            all_valid = False
            continue
        
        print(f"\n📁 Validating {file_path.name}...")
        
        # Get file size
        size_mb = file_path.stat().st_size / (1024 * 1024)
        print(f"   Size: {size_mb:.1f} MB")
        
        # Count total lines
        with open(file_path, 'r') as f:
            total_lines = sum(1 for _ in f)
        print(f"   Total conversations: {total_lines:,}")
        
        # Validate format
        valid_count, errors = validate_dataset_format(file_path, sample_size=50)
        
        if errors:
            print(f"   ❌ Found {len(errors)} errors in sample:")
            for error in errors[:5]:  # Show first 5 errors
                print(f"      - {error}")
            if len(errors) > 5:
                print(f"      ... and {len(errors) - 5} more")
            all_valid = False
        else:
            print(f"   ✅ Sample validation passed ({valid_count}/50 valid)")
    
    # Check summary file
    summary_file = pipeline_dir / "pipeline_summary.json"
    if summary_file.exists():
        with open(summary_file, 'r') as f:
            summary = json.load(f)
        print(f"\n📊 Pipeline Summary:")
        print(f"   Total conversations: {summary['total_conversations']:,}")
        print(f"   Train: {summary['train_size']:,}")
        print(f"   Val: {summary['val_size']:,}")
        print(f"   Test: {summary['test_size']:,}")
    
    # Memory estimation
    if all_valid:
        print(f"\n💾 Memory Estimation:")
        combined_size = (pipeline_dir / "combined_dataset.jsonl").stat().st_size
        print(f"   Dataset size: {combined_size / (1024**3):.2f} GB")
        print(f"   Estimated RAM needed: {combined_size / (1024**3) * 2:.2f} GB")
    
    print(f"\n{'✅ Dry run PASSED' if all_valid else '❌ Dry run FAILED'}")
    return all_valid

if __name__ == "__main__":
    success = dry_run_validation()
    sys.exit(0 if success else 1)
