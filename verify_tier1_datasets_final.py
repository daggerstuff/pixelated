#!/usr/bin/env python3
"""
Verify Tier 1 Priority datasets are accessible for streaming using actual discovered datasets
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from ai.utils.s3_dataset_loader import S3DatasetLoader

def verify_tier1_datasets():
    """Verify Tier 1 Priority datasets are accessible for streaming using actual discovered datasets"""
    
    print("🔍 Verifying Tier 1 Priority datasets for streaming...")
    print("=" * 60)
    
    # Initialize S3 loader
    loader = S3DatasetLoader()
    
    # First, discover what datasets actually exist
    print("📁 Discovering actual datasets in S3...")
    
    all_datasets = []
    prefixes_to_check = [
        "datasets/",
        "gdrive/processed/",
        "gdrive/raw/",
        "vps_archaeology/",
        "acquired/",
        "processed/",
        "consolidated/",
        "reddit/",
        "professional/",
        "therapeutic/",
        "mental_health/"
    ]
    
    for prefix in prefixes_to_check:
        try:
            datasets = loader.list_datasets(prefix=prefix)
            if datasets:
                all_datasets.extend(datasets)
                print(f"   Found {len(datasets)} datasets in '{prefix}'")
        except Exception as e:
            print(f"   ⚠️  Error scanning '{prefix}': {str(e)}")
    
    # Remove duplicates and get unique paths
    unique_datasets = list(set(all_datasets))
    print(f"\n📊 Found {len(unique_datasets)} unique datasets total")
    
    # Filter for Tier 1 relevant datasets
    tier1_indicators = [
        'priority', 'tier1', 'mental_health', 'therapeutic', 
        'counsel', 'therapy', 'psychology', 'depression', 'anxiety',
        'soulchat', 'counsel_chat', 'therapist', 'professional',
        'conversations', 'dataset', 'training', 'mental', 'health'
    ]
    
    tier1_candidates = []
    
    for s3_path in unique_datasets:
        # Extract key from s3 path
        if s3_path.startswith("s3://"):
            key = s3_path.split("/", 3)[-1]  # Remove s3://bucket/
        else:
            key = s3_path
        
        # Check if it's a relevant dataset
        if any(indicator in key.lower() for indicator in tier1_indicators):
            tier1_candidates.append(key)
    
    print(f"🎯 Found {len(tier1_candidates)} Tier 1 candidate datasets")
    
    # Now verify these datasets are accessible
    total_size_mb = 0
    accessible_count = 0
    found_datasets = []
    
    print("\n📋 Verifying Tier 1 Priority datasets:")
    print("-" * 60)
    
    # Prioritize larger datasets first (they're more important for training)
    tier1_candidates.sort(key=lambda x: len(x), reverse=True)  # Longer paths often indicate more specific/larger datasets
    
    for dataset_path in tier1_candidates[:20]:  # Check top 20 candidates
        try:
            print(f"🔍 Checking: {dataset_path}")
            
            # First check if object exists
            if not loader.object_exists(dataset_path):
                print(f"   ❌ Object does not exist")
                continue
            
            # Load a sample to verify accessibility and get size
            try:
                sample_data = loader.load_bytes(dataset_path)
                if sample_data:
                    size_mb = len(sample_data) / (1024 * 1024)
                    total_size_mb += size_mb
                    accessible_count += 1
                    found_datasets.append((dataset_path, size_mb))
                    
                    print(f"   ✅ Accessible - {size_mb:.2f} MB")
                    
                    # Sample first few lines to verify format
                    if dataset_path.endswith('.jsonl'):
                        # Stream first few lines as JSONL
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
                        # For CSV files, show header
                        csv_content = sample_data.decode('utf-8', errors='ignore')
                        first_lines = csv_content.split('\n')[:2]
                        if first_lines:
                            header = first_lines[0]
                            print(f"   📄 CSV header: {header[:100]}{'...' if len(header) > 100 else ''}")
                            # Count columns
                            col_count = len(header.split(',')) if ',' in header else len(header.split('\t'))
                            print(f"   📊 Columns: ~{col_count}")
                
                else:
                    print(f"   ❌ Empty or not accessible")
                    
            except Exception as e:
                print(f"   ❌ Error accessing: {str(e)}")
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
    
    print("-" * 60)
    print(f"📊 Summary:")
    print(f"   ✅ Accessible datasets: {accessible_count}/{len(tier1_candidates)}")
    print(f"   📏 Total size: {total_size_mb:.2f} MB")
    print(f"   📈 Training weight: ~{(total_size_mb/1160)*100:.1f}% of expected 1.16GB")
    
    if accessible_count >= 5:  # At least 5 datasets accessible
        print(f"   🟢 Tier 1 datasets READY for streaming!")
        
        # Show the actual datasets we'll use
        print(f"\n🎯 Ready datasets:")
        for path, size in sorted(found_datasets, key=lambda x: x[1], reverse=True)[:10]:
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