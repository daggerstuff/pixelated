#!/usr/bin/env python3

import json
from pathlib import Path


def analyze_datasets():
    """Analyze all datasets used in the training set"""

    processed_dir = Path("/root/pixelated/processed")
    downloads_dir = Path("/root/pixelated/downloads")

    print("📊 DATASET ANALYSIS FOR TRAINING SET")
    print("=" * 50)

    datasets_used = []

    # 1. Merged dataset (from conversation summary)
    merged_file = processed_dir / "mental_health_clean.jsonl"
    if merged_file.exists():
        with open(merged_file) as f:
            merged_count = sum(1 for _ in f)

        datasets_used.append({
            "name": "Mental Health Consolidated Dataset",
            "source": "Previously processed and merged data",
            "original_count": "~220,063 (from summary)",
            "used_count": merged_count,
            "notes": "Deduplicated and cleaned from 6 specialized phases"
        })

    # 2. Priority folders from Google Drive
    priority_folders = [
        ("priority_1_mental_health_data", "Priority 1: Mental Health Data"),
        ("priority_2_counseling_data", "Priority 2: Counseling Data"),
        ("priority_3_psychology_data", "Priority 3: Psychology Data"),
        ("priority_4_training_data", "Priority 4: Training Data")
    ]

    total_priority = 0
    for folder_name, display_name in priority_folders:
        folder_path = downloads_dir / folder_name
        if folder_path.exists():
            count = 0
            for file_path in folder_path.rglob("*.json*"):
                try:
                    if file_path.suffix == ".jsonl":
                        with open(file_path) as f:
                            count += sum(1 for _ in f)
                    else:
                        with open(file_path) as f:
                            data = json.load(f)
                            if isinstance(data, list):
                                count += len(data)
                            else:
                                count += 1
                except:
                    pass

            if count > 0:
                datasets_used.append({
                    "name": display_name,
                    "source": f"Google Drive downloads/{folder_name}",
                    "original_count": "Unknown",
                    "used_count": count,
                    "notes": "Additional priority training data"
                })
                total_priority += count

    # 3. CoT (Chain-of-Thought) datasets
    cot_datasets = {}
    cot_folders = [
        (downloads_dir / "fifth_folder", "Fifth Folder CoT"),
        (downloads_dir / "secondary_1_additional_data", "Secondary CoT Data")
    ]

    total_cot = 0
    for cot_folder, folder_label in cot_folders:
        if cot_folder.exists():
            for subfolder in cot_folder.iterdir():
                if subfolder.is_dir():
                    count = 0
                    for file_path in subfolder.rglob("*.json*"):
                        try:
                            if file_path.suffix == ".jsonl":
                                with open(file_path) as f:
                                    count += sum(1 for _ in f)
                            else:
                                with open(file_path) as f:
                                    data = json.load(f)
                                    if isinstance(data, list):
                                        count += len(data)
                                    else:
                                        count += 1
                        except:
                            pass

                    if count > 0:
                        dataset_name = f"CoT: {subfolder.name.replace('_', ' ')}"
                        if dataset_name not in cot_datasets:
                            cot_datasets[dataset_name] = 0
                        cot_datasets[dataset_name] += count
                        total_cot += count

    # Add CoT datasets to list
    for name, count in cot_datasets.items():
        datasets_used.append({
            "name": name,
            "source": "Chain-of-Thought reasoning datasets",
            "original_count": "Unknown",
            "used_count": count,
            "notes": "Specialized reasoning and dialogue data"
        })

    # Print results
    print("\n🗂️  DATASETS INCLUDED:")
    print("-" * 50)

    total_used = 0
    for i, dataset in enumerate(datasets_used, 1):
        print(f"{i}. {dataset['name']}")
        print(f"   Source: {dataset['source']}")
        print(f"   Original: {dataset['original_count']}")
        print(f"   Used: {dataset['used_count']:,} conversations")
        print(f"   Notes: {dataset['notes']}")
        print()

        if isinstance(dataset["used_count"], int):
            total_used += dataset["used_count"]

    # Summary
    print("📈 SUMMARY:")
    print("-" * 50)
    print(f"Total datasets: {len(datasets_used)}")
    print(f"Total conversations used: {total_used:,}")
    print("Main sources:")
    print(f"  • Merged dataset: {merged_count:,} conversations")
    print(f"  • Priority folders: {total_priority:,} conversations")
    print(f"  • CoT datasets: {total_cot:,} conversations")

    # Load pipeline summary for verification
    summary_file = processed_dir / "mini_pipeline" / "pipeline_summary.json"
    if summary_file.exists():
        with open(summary_file) as f:
            summary = json.load(f)
        print(f"\n✅ Verification: Pipeline shows {summary['total_conversations']:,} total conversations")

    return datasets_used

if __name__ == "__main__":
    analyze_datasets()
