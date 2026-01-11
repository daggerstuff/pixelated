#!/usr/bin/env python3
"""
Test script to check S3 access and list available datasets
"""

import os
import sys
from pathlib import Path

# Add the ai directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "ai"))

try:
    from utils.s3_dataset_loader import S3DatasetLoader
    
    print("Testing S3 connection...")
    
    # Try to initialize the loader - this will test credentials
    loader = S3DatasetLoader()
    print(f"✓ S3 client initialized successfully")
    print(f"  Bucket: {loader.bucket}")
    print(f"  Endpoint: {loader.endpoint_url}")
    
    # Try to list datasets
    print("\nListing available datasets...")
    datasets = loader.list_datasets()
    
    if datasets:
        print(f"✓ Found {len(datasets)} datasets:")
        for dataset in datasets[:10]:  # Show first 10
            print(f"  - {dataset}")
        if len(datasets) > 10:
            print(f"  ... and {len(datasets) - 10} more")
    else:
        print("✗ No datasets found in S3")
        
    # Try to list specific categories mentioned in the epic
    print("\nChecking for specific dataset categories...")
    categories = ["professional_therapeutic", "cot_reasoning", "reddit_data", "edge_cases", "cptsd"]
    
    for category in categories:
        try:
            category_datasets = loader.list_datasets(f"gdrive/processed/{category}/")
            if category_datasets:
                print(f"✓ {category}: {len(category_datasets)} datasets")
                for ds in category_datasets[:3]:  # Show first 3
                    print(f"    - {ds.split('/')[-1]}")
            else:
                print(f"- {category}: No datasets found")
        except Exception as e:
            print(f"✗ {category}: Error - {e}")
    
except ImportError as e:
    print(f"✗ Import error: {e}")
    print("Make sure boto3 is installed: pip install boto3")
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()