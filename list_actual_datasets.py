#!/usr/bin/env python3
"""
List actual datasets in the S3 bucket to find the correct paths
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

from ai.utils.s3_dataset_loader import S3DatasetLoader

def main():
    print("🔍 Listing actual datasets in S3 bucket...")
    print("=" * 60)
    
    try:
        # Initialize S3 loader
        loader = S3DatasetLoader()
        print("✅ S3DatasetLoader initialized successfully!")
        print()
        
        # List all objects in the bucket
        print("📋 Listing all objects in bucket...")
        try:
            paginator = loader.s3_client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=loader.bucket)
            
            all_objects = []
            for page in pages:
                if "Contents" in page:
                    all_objects.extend(page["Contents"])
            
            print(f"Found {len(all_objects)} total objects")
            print()
            
            # Group by prefix
            prefixes = {}
            for obj in all_objects:
                key = obj['Key']
                size_mb = obj['Size'] / (1024 * 1024)
                
                # Group by first directory
                if '/' in key:
                    prefix = key.split('/')[0]
                    if prefix not in prefixes:
                        prefixes[prefix] = []
                    prefixes[prefix].append((key, size_mb))
                else:
                    if 'root' not in prefixes:
                        prefixes['root'] = []
                    prefixes['root'].append((key, size_mb))
            
            print("📁 Objects grouped by prefix:")
            for prefix, objects in sorted(prefixes.items()):
                total_size = sum(size for _, size in objects)
                print(f"\n📂 {prefix}/ ({len(objects)} objects, {total_size:.2f} MB total):")
                for key, size in sorted(objects)[:10]:  # Show first 10
                    print(f"  - {key} ({size:.2f} MB)")
                if len(objects) > 10:
                    print(f"  ... and {len(objects) - 10} more")
            
            # Look specifically for training datasets
            print("\n" + "="*60)
            print("🔍 Looking for training-related datasets...")
            
            training_files = []
            for obj in all_objects:
                key = obj['Key']
                size_mb = obj['Size'] / (1024 * 1024)
                
                # Look for files that might be training datasets
                if any(ext in key.lower() for ext in ['.json', '.jsonl', '.txt', '.csv']):
                    if any(term in key.lower() for term in ['train', 'synthetic', 'conversation', 'mental', 'reddit', 'therapeutic']):
                        training_files.append((key, size_mb))
            
            print(f"Found {len(training_files)} potential training datasets:")
            for key, size in sorted(training_files):
                print(f"  - {key} ({size:.2f} MB)")
                
        except Exception as e:
            print(f"  Error listing objects: {e}")
            import traceback
            traceback.print_exc()
        
    except Exception as e:
        print(f"❌ S3DatasetLoader initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())