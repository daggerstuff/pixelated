#!/usr/bin/env python3

import json
import os
from pathlib import Path
import pandas as pd

def setup_mini_pipeline():
    """Setup mini pipeline with merged dataset and Google Drive data"""
    
    # Paths
    processed_dir = Path("/root/pixelated/processed")
    downloads_dir = Path("/root/pixelated/downloads")
    output_dir = processed_dir / "mini_pipeline"
    output_dir.mkdir(exist_ok=True)
    
    print("Setting up mini pipeline...")
    
    # 1. Load merged dataset
    merged_file = processed_dir / "mental_health_clean.jsonl"
    if merged_file.exists():
        print(f"Loading merged dataset: {merged_file}")
        conversations = []
        with open(merged_file, 'r') as f:
            for line in f:
                conversations.append(json.loads(line))
        print(f"Loaded {len(conversations)} conversations from merged dataset")
    else:
        print("No merged dataset found")
        conversations = []
    
    # 2. Process Google Drive priority folders
    priority_folders = [
        "priority_1_mental_health_data",
        "priority_2_counseling_data", 
        "priority_3_psychology_data",
        "priority_4_training_data"
    ]
    
    additional_data = []
    for folder in priority_folders:
        folder_path = downloads_dir / folder
        if folder_path.exists():
            print(f"Processing {folder}...")
            # Look for JSON/JSONL files
            for file_path in folder_path.rglob("*.json*"):
                try:
                    if file_path.suffix == '.jsonl':
                        with open(file_path, 'r') as f:
                            for line in f:
                                additional_data.append(json.loads(line))
                    else:
                        with open(file_path, 'r') as f:
                            data = json.load(f)
                            if isinstance(data, list):
                                additional_data.extend(data)
                            else:
                                additional_data.append(data)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
    
    # 3. Process CoT datasets from fifth_folder and secondary_1_additional_data
    cot_folders = [
        downloads_dir / "fifth_folder",
        downloads_dir / "secondary_1_additional_data"
    ]
    
    cot_data = []
    for cot_folder in cot_folders:
        if cot_folder.exists():
            print(f"Processing CoT data from {cot_folder}...")
            for subfolder in cot_folder.iterdir():
                if subfolder.is_dir():
                    for file_path in subfolder.rglob("*.json*"):
                        try:
                            if file_path.suffix == '.jsonl':
                                with open(file_path, 'r') as f:
                                    for line in f:
                                        cot_data.append(json.loads(line))
                            else:
                                with open(file_path, 'r') as f:
                                    data = json.load(f)
                                    if isinstance(data, list):
                                        cot_data.extend(data)
                                    else:
                                        cot_data.append(data)
                        except Exception as e:
                            print(f"Error processing {file_path}: {e}")
    
    # 4. Combine all data
    total_conversations = len(conversations) + len(additional_data) + len(cot_data)
    print(f"\nDataset Summary:")
    print(f"- Merged dataset: {len(conversations)} conversations")
    print(f"- Priority folders: {len(additional_data)} conversations")
    print(f"- CoT datasets: {len(cot_data)} conversations")
    print(f"- Total: {total_conversations} conversations")
    
    # 5. Save combined dataset
    combined_data = conversations + additional_data + cot_data
    
    # Save as JSONL
    output_file = output_dir / "combined_dataset.jsonl"
    with open(output_file, 'w') as f:
        for item in combined_data:
            f.write(json.dumps(item) + '\n')
    
    # 6. Create train/val/test splits
    import random
    random.shuffle(combined_data)
    
    total = len(combined_data)
    train_size = int(0.8 * total)
    val_size = int(0.1 * total)
    
    train_data = combined_data[:train_size]
    val_data = combined_data[train_size:train_size + val_size]
    test_data = combined_data[train_size + val_size:]
    
    # Save splits
    splits_dir = output_dir / "splits"
    splits_dir.mkdir(exist_ok=True)
    
    with open(splits_dir / "train.jsonl", 'w') as f:
        for item in train_data:
            f.write(json.dumps(item) + '\n')
    
    with open(splits_dir / "val.jsonl", 'w') as f:
        for item in val_data:
            f.write(json.dumps(item) + '\n')
    
    with open(splits_dir / "test.jsonl", 'w') as f:
        for item in test_data:
            f.write(json.dumps(item) + '\n')
    
    # 7. Create summary
    summary = {
        "total_conversations": total,
        "train_size": len(train_data),
        "val_size": len(val_data),
        "test_size": len(test_data),
        "sources": {
            "merged_dataset": len(conversations),
            "priority_folders": len(additional_data),
            "cot_datasets": len(cot_data)
        },
        "output_files": {
            "combined": str(output_file),
            "train": str(splits_dir / "train.jsonl"),
            "val": str(splits_dir / "val.jsonl"),
            "test": str(splits_dir / "test.jsonl")
        }
    }
    
    with open(output_dir / "pipeline_summary.json", 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\nMini pipeline setup complete!")
    print(f"Output directory: {output_dir}")
    print(f"Combined dataset: {output_file}")
    print(f"Train/Val/Test splits saved to: {splits_dir}")
    
    return summary

if __name__ == "__main__":
    setup_mini_pipeline()
