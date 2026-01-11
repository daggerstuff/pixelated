#!/usr/bin/env python3
"""
Discover actual datasets in S3 bucket and create a mapping for Tier 1 Priority datasets
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from ai.utils.s3_dataset_loader import S3DatasetLoader

def discover_datasets():
    """Discover actual datasets in S3 and map them to Tier 1 categories"""
    
    print("🔍 Discovering actual datasets in S3 bucket...")
    print("=" * 60)
    
    # Initialize S3 loader
    loader = S3DatasetLoader()
    
    # List datasets from different prefixes
    all_datasets = []
    
    prefixes_to_check = [
        "gdrive/processed/",
        "gdrive/raw/",
        "vps_archaeology/",
        "acquired/",
        "datasets/",
        "processed/",
        "consolidated/",
        "reddit/",
        "professional/",
        "therapeutic/",
        "mental_health/"
    ]
    
    print("📁 Scanning S3 bucket prefixes...")
    
    for prefix in prefixes_to_check:
        try:
            datasets = loader.list_datasets(prefix=prefix)
            if datasets:
                all_datasets.extend(datasets)
                print(f"   Found {len(datasets)} datasets in '{prefix}'")
        except Exception as e:
            print(f"   ⚠️  Error scanning '{prefix}': {str(e)}")
    
    # Remove duplicates
    unique_datasets = list(set(all_datasets))
    
    print(f"\n📊 Found {len(unique_datasets)} unique datasets:")
    
    # Categorize by size and type
    large_files = []  # > 10MB
    medium_files = []  # 1-10MB
    small_files = []   # < 1MB
    
    tier1_candidates = []
    
    for s3_path in unique_datasets:
        try:
            # Get object info (size, etc.)
            # Extract key from s3 path
            if s3_path.startswith("s3://"):
                key = s3_path.split("/", 3)[-1]  # Remove s3://bucket/
            else:
                key = s3_path
            
            # Check if object exists and get size
            if loader.object_exists(key):
                # Load a small sample to verify accessibility
                try:
                    sample_data = loader.load_bytes(key)
                    size_mb = len(sample_data) / (1024 * 1024)
                    
                    # Categorize by size
                    if size_mb > 10:
                        large_files.append((key, size_mb))
                    elif size_mb > 1:
                        medium_files.append((key, size_mb))
                    else:
                        small_files.append((key, size_mb))
                    
                    # Look for Tier 1 indicators in filename/path
                    tier1_indicators = [
                        'priority', 'tier1', 'mental_health', 'therapeutic', 
                        'counsel', 'therapy', 'psychology', 'depression', 'anxiety',
                        'soulchat', 'counsel_chat', 'therapist', 'professional',
                        'conversations', 'dataset', 'training'
                    ]
                    
                    if any(indicator in key.lower() for indicator in tier1_indicators):
                        tier1_candidates.append((key, size_mb))
                    
                except Exception as e:
                    print(f"   ⚠️  Error accessing {key}: {str(e)}")
            
        except Exception as e:
            print(f"   ⚠️  Error processing {s3_path}: {str(e)}")
    
    # Sort by size (largest first)
    large_files.sort(key=lambda x: x[1], reverse=True)
    medium_files.sort(key=lambda x: x[1], reverse=True)
    tier1_candidates.sort(key=lambda x: x[1], reverse=True)
    
    print(f"\n📈 Dataset Analysis:")
    print(f"   Large files (>10MB): {len(large_files)}")
    print(f"   Medium files (1-10MB): {len(medium_files)}")
    print(f"   Small files (<1MB): {len(small_files)}")
    print(f"   Tier 1 candidates: {len(tier1_candidates)}")
    
    print(f"\n🎯 Top Tier 1 Priority Candidates:")
    for i, (path, size) in enumerate(tier1_candidates[:15]):
        print(f"   {i+1}. {path} ({size:.1f} MB)")
    
    print(f"\n💾 Largest Files:")
    for i, (path, size) in enumerate(large_files[:5]):
        print(f"   {i+1}. {path} ({size:.1f} MB)")
    
    # Create a mapping for verification
    tier1_mapping = {}
    
    # Map priority conversations
    priority_files = [f for f, _ in tier1_candidates if 'priority' in f.lower()]
    if priority_files:
        tier1_mapping['priority_conversations'] = priority_files
    
    # Map mental health datasets
    mental_health_files = [f for f, _ in tier1_candidates if 'mental_health' in f.lower() or 'mental' in f.lower()]
    if mental_health_files:
        tier1_mapping['mental_health'] = mental_health_files
    
    # Map therapeutic/professional datasets
    therapeutic_files = [f for f, _ in tier1_candidates if any(term in f.lower() for term in ['therapeutic', 'therapy', 'counsel', 'professional', 'therapist'])]
    if therapeutic_files:
        tier1_mapping['therapeutic'] = therapeutic_files
    
    # Map soulchat/counsel chat
    chat_files = [f for f, _ in tier1_candidates if any(term in f.lower() for term in ['soulchat', 'counsel_chat', 'counselchat'])]
    if chat_files:
        tier1_mapping['chat_datasets'] = chat_files
    
    # Map conversations
    conversation_files = [f for f, _ in tier1_candidates if 'conversations' in f.lower()]
    if conversation_files:
        tier1_mapping['conversations'] = conversation_files
    
    return tier1_mapping

def main():
    """Main function"""
    try:
        tier1_mapping = discover_datasets()
        
        if tier1_mapping:
            print(f"\n✅ Dataset discovery complete!")
            print(f"🎯 Tier 1 categories found:")
            for category, files in tier1_mapping.items():
                print(f"   📁 {category}: {len(files)} files")
            
            # Save the mapping for verification
            import json
            with open('tier1_dataset_mapping.json', 'w') as f:
                json.dump(tier1_mapping, f, indent=2)
            
            print(f"\n💾 Mapping saved to 'tier1_dataset_mapping.json'")
            return True
        else:
            print(f"\n❌ No datasets discovered")
            return False
            
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)