#!/usr/bin/env python3
"""
Test script to verify S3 connection and list available datasets
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

from ai.utils.s3_dataset_loader import S3DatasetLoader, get_s3_dataset_path

def main():
    print("🔍 Testing S3 connection and dataset availability...")
    print("=" * 60)
    
    # Check environment variables
    print("Environment variables:")
    print(f"  OVH_S3_ACCESS_KEY: {'SET' if os.environ.get('OVH_S3_ACCESS_KEY') else 'NOT_SET'}")
    print(f"  OVH_S3_SECRET_KEY: {'SET' if os.environ.get('OVH_S3_SECRET_KEY') else 'NOT_SET'}")
    print(f"  OVH_S3_ENDPOINT: {os.environ.get('OVH_S3_ENDPOINT', 'NOT_SET')}")
    print(f"  OVH_S3_BUCKET: {os.environ.get('OVH_S3_BUCKET', 'NOT_SET')}")
    print()
    
    try:
        # Initialize S3 loader
        loader = S3DatasetLoader()
        print("✅ S3 connection successful!")
        print()
        
        # List datasets in different categories
        categories = [
            "gdrive/processed/",
            "gdrive/raw/",
            "final_dataset/",
            "voice/",
            "acquired/"
        ]
        
        for category in categories:
            print(f"📁 Checking {category}...")
            try:
                datasets = loader.list_datasets(prefix=category)
                if datasets:
                    print(f"  Found {len(datasets)} datasets:")
                    for dataset in datasets[:5]:  # Show first 5
                        print(f"    - {dataset}")
                    if len(datasets) > 5:
                        print(f"    ... and {len(datasets) - 5} more")
                else:
                    print("  No datasets found")
            except Exception as e:
                print(f"  Error: {e}")
            print()
        
        # Test specific dataset paths from MASTER_TRAINING_EPIC.md
        test_datasets = [
            ("therapeutic_dialogues.jsonl", "professional_therapeutic"),
            ("mental_health_qa.jsonl", "professional_therapeutic"),
            ("empathy_training.jsonl", "empathy_training"),
            ("cot_reasoning.jsonl", "cot_reasoning"),
            ("reddit_mental_health.jsonl", "social_media"),
        ]
        
        print("🔍 Testing specific dataset paths...")
        for dataset_name, category in test_datasets:
            try:
                path = get_s3_dataset_path(dataset_name, category)
                exists = loader.object_exists(path)
                print(f"  {dataset_name} ({category}): {'✅ EXISTS' if exists else '❌ NOT_FOUND'}")
                print(f"    Path: {path}")
            except Exception as e:
                print(f"  {dataset_name} ({category}): ❌ ERROR - {e}")
        
    except Exception as e:
        print(f"❌ S3 connection failed: {e}")
        print("\nTroubleshooting:")
        print("1. Check your .env file contains OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY")
        print("2. Verify the credentials are correct")
        print("3. Check network connectivity to OVH S3 endpoint")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())