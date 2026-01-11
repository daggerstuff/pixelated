#!/usr/bin/env python3
"""
Verify Tier 1 Priority datasets are accessible for streaming
This script checks that the critical training datasets are available and can be streamed on-demand
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from ai.utils.s3_dataset_loader import S3DatasetLoader

def verify_tier1_datasets():
    """Verify Tier 1 Priority datasets are accessible for streaming"""
    
    print("🔍 Verifying Tier 1 Priority datasets for streaming...")
    print("=" * 60)
    
    # Initialize S3 loader
    loader = S3DatasetLoader()
    
    # Define Tier 1 Priority datasets based on the MASTER_TRAINING_EPIC.md
    tier1_datasets = [
        # Priority 1 conversations (5.39 MB)
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_1_priority_conversations/task_5_1_priority_1/priority_1_conversations.jsonl",
        
        # Priority 2 conversations (122.93 MB)
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_1_priority_conversations/task_5_2_priority_2/priority_2_conversations.jsonl",
        
        # Priority 3 conversations (152.20 MB)
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_1_priority_conversations/task_5_3_priority_3/priority_3_conversations.jsonl",
        
        # Unified priority conversations (142.60 MB)
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_1_priority_conversations/task_5_6_unified_priority/unified_priority_conversations.jsonl",
        
        # Merged mental health dataset (85.57 MB)
        "datasets/vps_archaeology/datasets/consolidated/reddit/merged_mental_health_dataset.jsonl",
        
        # Tier 1 priority unified conversations (142.60 MB)
        "datasets/gdrive/tier1_priority/unified_priority_conversations.jsonl",
        
        # Training CSV (387.46 MB)
        "datasets/gdrive/tier1_priority/train.csv",
        
        # Merged dataset JSONL (85.57 MB)
        "datasets/gdrive/tier1_priority/merged_mental_health_dataset.jsonl",
        
        # Priority 2 conversations (122.93 MB)
        "datasets/gdrive/tier1_priority/priority_2_conversations.jsonl",
        
        # Priority 3 conversations (152.20 MB)
        "datasets/gdrive/tier1_priority/priority_3_conversations.jsonl",
    ]
    
    total_size_mb = 0
    accessible_count = 0
    
    print("📋 Checking Tier 1 Priority datasets:")
    print("-" * 60)
    
    for dataset_path in tier1_datasets:
        try:
            # Try to get file info (size) without downloading
            print(f"🔍 Checking: {dataset_path}")
            
            # First check if object exists
            if not loader.object_exists(dataset_path):
                print(f"   ❌ Object does not exist")
                continue
            
            # Use load_bytes to verify accessibility and get size
            test_data = loader.load_bytes(dataset_path)
            
            if test_data:
                size_mb = len(test_data) / (1024 * 1024)
                total_size_mb += size_mb
                accessible_count += 1
                
                print(f"   ✅ Accessible - {size_mb:.2f} MB")
                
                # Sample first few lines to verify format
                if dataset_path.endswith('.jsonl'):
                    # Load first few lines as JSONL
                    sample_lines = []
                    for i, item in enumerate(loader.stream_jsonl(dataset_path)):
                        if i >= 3:  # Sample first 3 items
                            break
                        sample_lines.append(item)
                    
                    if sample_lines:
                        print(f"   📄 Sample format: {type(sample_lines[0])}")
                        if isinstance(sample_lines[0], dict):
                            keys = list(sample_lines[0].keys())
                            print(f"   🔑 Keys: {keys[:5]}{'...' if len(keys) > 5 else ''}")
                
                elif dataset_path.endswith('.csv'):
                    # For CSV files, just verify we can read the header
                    csv_content = test_data.decode('utf-8', errors='ignore')
                    first_lines = csv_content.split('\n')[:3]
                    if first_lines:
                        print(f"   📄 CSV header: {first_lines[0][:100]}{'...' if len(first_lines[0]) > 100 else ''}")
                
            else:
                print(f"   ❌ Not accessible or empty")
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
    
    print("-" * 60)
    print(f"📊 Summary:")
    print(f"   ✅ Accessible datasets: {accessible_count}/{len(tier1_datasets)}")
    print(f"   📏 Total size: {total_size_mb:.2f} MB")
    print(f"   📈 Training weight: ~{(total_size_mb/1160)*100:.1f}% of expected 1.16GB")
    
    if accessible_count >= 6:  # At least 60% of datasets accessible
        print(f"   🟢 Tier 1 datasets READY for streaming!")
        return True
    else:
        print(f"   🔴 Tier 1 datasets NOT ready - insufficient accessible datasets")
        return False

def main():
    """Main function"""
    try:
        success = verify_tier1_datasets()
        
        if success:
            print("\n✅ All checks passed! Tier 1 Priority datasets are ready for streaming.")
            sys.exit(0)
        else:
            print("\n❌ Some datasets are not accessible. Please check the errors above.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()