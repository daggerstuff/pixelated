#!/usr/bin/env python3
"""
Download Tier 1 Priority datasets for mental health model training.
This script downloads the critical datasets needed for the training pipeline.
"""

import os
import sys
from pathlib import Path
from ai.utils.s3_dataset_loader import S3DatasetLoader

def download_tier1_datasets():
    """Download Tier 1 Priority datasets (1.16GB, 40% training weight) - CRITICAL"""
    
    loader = S3DatasetLoader()
    
    # Tier 1 Priority datasets based on actual S3 structure discovered
    tier1_datasets = [
        {
            's3_key': 'datasets/synthetic_conversations_priority_1.json',
            'local_path': 'data/training/tier1_priority_1_synthetic.json',
            'description': 'Tier 1 Priority 1 Synthetic Conversations'
        },
        {
            's3_key': 'datasets/synthetic_conversations_priority_2.json',
            'local_path': 'data/training/tier1_priority_2_synthetic.json',
            'description': 'Tier 1 Priority 2 Synthetic Conversations'
        },
        {
            's3_key': 'datasets/synthetic_conversations_priority_3.json',
            'local_path': 'data/training/tier1_priority_3_synthetic.json',
            'description': 'Tier 1 Priority 3 Synthetic Conversations'
        },
        {
            's3_key': 'datasets/training_data.jsonl',
            'local_path': 'data/training/tier1_main_training_data.jsonl',
            'description': 'Tier 1 Main Training Data (ChatML format)'
        },
        {
            's3_key': 'datasets/reddit_mental_health.jsonl',
            'local_path': 'data/training/tier1_reddit_mental_health.jsonl',
            'description': 'Tier 1 Reddit Mental Health Data'
        }
    ]
    
    total_downloaded = 0
    successful_downloads = []
    
    print("🎯 Downloading Tier 1 Priority Datasets (CRITICAL for training)...")
    print("=" * 60)
    
    for dataset in tier1_datasets:
        try:
            # Create local directory if it doesn't exist
            local_path = Path(dataset['local_path'])
            local_path.parent.mkdir(parents=True, exist_ok=True)
            
            print(f"📥 Downloading: {dataset['description']}")
            print(f"   S3 Key: {dataset['s3_key']}")
            print(f"   Local: {dataset['local_path']}")
            
            # Download the file using load_bytes method
            try:
                print(f"   📥 Downloading bytes from S3...")
                data = loader.load_bytes(dataset['s3_key'])
                
                # Write to local file
                with open(local_path, 'wb') as f:
                    f.write(data)
                
                file_size_mb = len(data) / (1024 * 1024)
                total_downloaded += file_size_mb
                successful_downloads.append(dataset)
                print(f"   ✅ SUCCESS: {file_size_mb:.2f} MB downloaded")
                
            except Exception as download_error:
                print(f"   ❌ FAILED: {str(download_error)}")
                
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
        
        print()
    
    # Summary
    print("=" * 60)
    print(f"📊 TIER 1 DOWNLOAD SUMMARY:")
    print(f"   ✅ Successfully downloaded: {len(successful_downloads)}/{len(tier1_datasets)} files")
    print(f"   📦 Total size: {total_downloaded:.2f} MB")
    print(f"   🎯 Target: 1.16 GB (40% training weight)")
    
    if len(successful_downloads) == len(tier1_datasets):
        print("   🎉 ALL TIER 1 DATASETS DOWNLOADED SUCCESSFULLY!")
        return True
    else:
        print("   ⚠️  Some downloads failed. Check logs above.")
        return False

if __name__ == "__main__":
    success = download_tier1_datasets()
    sys.exit(0 if success else 1)