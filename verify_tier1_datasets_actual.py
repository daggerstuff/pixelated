#!/usr/bin/env python3
"""
Verify Tier 1 Priority datasets are accessible for streaming using actual S3 paths
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
    """Verify Tier 1 Priority datasets are accessible for streaming using actual paths"""
    
    print("🔍 Verifying Tier 1 Priority datasets for streaming...")
    print("=" * 60)
    
    # Initialize S3 loader
    loader = S3DatasetLoader()
    
    # Define Tier 1 Priority datasets based on actual S3 listing
    # These are the actual files that exist in the bucket
    tier1_datasets = [
        # Priority conversations (from vps_archaeology consolidated)
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_1_priority_conversations/task_5_1_priority_1/priority_1_conversations.jsonl",
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_1_priority_conversations/task_5_2_priority_2/priority_2_conversations.jsonl",
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_1_priority_conversations/task_5_3_priority_3/priority_3_conversations.jsonl",
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_1_priority_conversations/task_5_6_unified_priority/unified_priority_conversations.jsonl",
        
        # Merged mental health dataset
        "datasets/vps_archaeology/datasets/consolidated/reddit/merged_mental_health_dataset.jsonl",
        
        # Professional therapeutic datasets (Tier 1 equivalent)
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_2_professional_datasets/task_5_9_soulchat/soulchat_2_0_conversations.jsonl",
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_2_professional_datasets/task_5_10_counsel_chat/counsel_chat_conversations.jsonl",
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_2_professional_datasets/task_5_11_llama3_mental_counseling/llama3_mental_counseling_conversations.jsonl",
        "datasets/vps_archaeology/datasets/consolidated/processed/phase_2_professional_datasets/task_5_12_therapist_sft/therapist_sft_conversations.jsonl",
        
        # Therapist SFT format (large CSV)
        "datasets/vps_archaeology/datasets/consolidated/professional/therapist-sft-format/train.csv",
        
        # Alternative paths from gdrive structure
        "datasets/gdrive/processed/phase_1_priority_conversations/task_5_1_priority_1/priority_1_conversations.jsonl",
        "datasets/gdrive/processed/phase_1_priority_conversations/task_5_2_priority_2/priority_2_conversations.jsonl",
        "datasets/gdrive/processed/phase_1_priority_conversations/task_5_3_priority_3/priority_3_conversations.jsonl",
        "datasets/gdrive/processed/phase_1_priority_conversations/task_5_6_unified_priority/unified_priority_conversations.jsonl",
        
        # Professional datasets from gdrive
        "datasets/gdrive/processed/phase_2_professional_datasets/task_5_9_soulchat/soulchat_2_0_conversations.jsonl",
        "datasets/gdrive/processed/phase_2_professional_datasets/task_5_10_counsel_chat/counsel_chat_conversations.jsonl",
        "datasets/gdrive/processed/phase_2_professional_datasets/task_5_11_llama3_mental_counseling/llama3_mental_counseling_conversations.jsonl",
        "datasets/gdrive/processed/phase_2_professional_datasets/task_5_12_therapist_sft/therapist_sft_conversations.jsonl",
    ]
    
    total_size_mb = 0
    accessible_count = 0
    found_datasets = []
    
    print("📋 Checking Tier 1 Priority datasets:")
    print("-" * 60)
    
    for dataset_path in tier1_datasets:
        try:
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
                found_datasets.append((dataset_path, size_mb))
                
                print(f"   ✅ Accessible - {size_mb:.2f} MB")
                
                # Sample first few lines to verify format
                if dataset_path.endswith('.jsonl'):
                    # Load first few lines as JSONL
                    sample_lines = []
                    for i, item in enumerate(loader.stream_jsonl(dataset_path)):
                        if i >= 2:  # Sample first 2 items
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
                    first_lines = csv_content.split('\n')[:2]
                    if first_lines:
                        header = first_lines[0]
                        print(f"   📄 CSV header: {header[:100]}{'...' if len(header) > 100 else ''}")
                        # Count columns
                        col_count = len(header.split(',')) if ',' in header else len(header.split('\t'))
                        print(f"   📊 Columns: ~{col_count}")
                
            else:
                print(f"   ❌ Not accessible or empty")
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
    
    print("-" * 60)
    print(f"📊 Summary:")
    print(f"   ✅ Accessible datasets: {accessible_count}/{len(tier1_datasets)}")
    print(f"   📏 Total size: {total_size_mb:.2f} MB")
    print(f"   📈 Training weight: ~{(total_size_mb/1160)*100:.1f}% of expected 1.16GB")
    
    if accessible_count >= 5:  # At least 50% of datasets accessible
        print(f"   🟢 Tier 1 datasets READY for streaming!")
        
        # Show the actual datasets we'll use
        print(f"\n🎯 Ready datasets:")
        for path, size in found_datasets:
            print(f"   📁 {path} ({size:.1f} MB)")
        
        return True
    else:
        print(f"   🔴 Tier 1 datasets NOT ready - insufficient accessible datasets")
        return False

def main():
    """Main function"""
    try:
        success = verify_tier1_datasets()
        
        if success:
            print("\n✅ Tier 1 Priority datasets are ready for streaming!")
            print("🚀 Training pipeline can proceed with on-demand streaming.")
            sys.exit(0)
        else:
            print("\n❌ Insufficient Tier 1 datasets accessible.")
            print("🔧 Please check the dataset paths and S3 configuration.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()