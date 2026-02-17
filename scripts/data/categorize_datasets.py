#!/usr/bin/env python3
"""Categorize all processed datasets by extracting embedded category metadata."""

import json
import sys
from pathlib import Path
from collections import Counter
from datetime import datetime

def categorize_record(record: dict) -> str:
    """Attempt to categorize a record from various metadata sources."""
    
    # Check nested metadata.original_data.category (tier1 format)
    if 'metadata' in record:
        metadata = record['metadata']
        
        # Nested in original_data
        if 'original_data' in metadata and 'category' in metadata['original_data']:
            return metadata['original_data']['category']
        
        # Direct in metadata
        if 'category' in metadata:
            return metadata['category']
    
    # Infer from source name
    if 'metadata' in record and 'original_data' in record['metadata']:
        source = record['metadata']['original_data'].get('source', '')
        if 'counseling' in source.lower():
            return 'therapeutic_conversation'
        elif 'mental_health' in source.lower():
            return 'mental_health_support'
    
    # Infer from message content
    if 'messages' in record and len(record['messages']) > 0:
        first_msg = record['messages'][0].get('content', '').lower()
        
        # Therapeutic indicators
        therapeutic_keywords = ['therapy', 'counseling', 'depression', 'anxiety', 'trauma', 'ptsd', 'abuse']
        if any(kw in first_msg for kw in therapeutic_keywords):
            return 'therapeutic_conversation'
        
        # Crisis indicators
        crisis_keywords = ['suicide', 'kill myself', 'end my life', 'worthless']
        if any(kw in first_msg for kw in crisis_keywords):
            return 'crisis_support'
    
    return 'uncategorized'

def analyze_dataset(file_path: Path) -> dict:
    """Analyze and categorize a dataset."""
    print(f"📊 Categorizing: {file_path.name}")
    
    categories = Counter()
    sources = Counter()
    total = 0
    
    with open(file_path, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            
            try:
                record = json.loads(line)
                total += 1
                
                # Categorize
                category = categorize_record(record)
                categories[category] += 1
                
                # Extract source
                if 'metadata' in record and 'original_data' in record['metadata']:
                    source = record['metadata']['original_data'].get('source', 'unknown')
                    sources[source] += 1
                
            except json.JSONDecodeError:
                continue
    
    return {
        'total': total,
        'categories': dict(categories),
        'sources': dict(sources)
    }

def main():
    datasets = [
        ('Tier1 Priority', Path('ai/training/ready_packages/datasets/cache/orchestrator_output/processed_s3_tier_datasets.jsonl')),
        ('Mental Health Clean', Path('ai/training/ready_packages/datasets/cache/s3_direct/mental_health_clean.jsonl')),
        ('Counseling', Path('ai/training/ready_packages/datasets/cache/training_v3_converted/stage1_foundation_counseling.jsonl')),
        ('Helios', Path('ai/training/ready_packages/datasets/cache/training_v3_converted/heliosbrahma_converted.jsonl')),
    ]
    
    print("="*80)
    print("🎯 DATASET CATEGORIZATION REPORT")
    print("="*80)
    print()
    
    all_categories = Counter()
    total_records = 0
    
    for name, path in datasets:
        if path.exists() and path.stat().st_size > 0:
            stats = analyze_dataset(path)
            total_records += stats['total']
            all_categories.update(stats['categories'])
            
            print(f"\n{name}:")
            for cat, count in sorted(stats['categories'].items(), key=lambda x: -x[1]):
                print(f"  • {cat}: {count:,}")
        print()
    
    print("="*80)
    print(f"📊 AGGREGATE CATEGORIES (Total: {total_records:,})")
    print("="*80)
    
    for cat, count in all_categories.most_common():
        pct = (count / total_records * 100) if total_records > 0 else 0
        print(f"  • {cat}: {count:,} ({pct:.1f}%)")
    
    print()
    print("="*80)
    print("🎯 PRD TARGET COMPARISON")
    print("="*80)
    
    # Map categories to PRD requirements
    therapeutic_count = (
        all_categories.get('therapeutic_conversation', 0) +
        all_categories.get('mental_health_support', 0) +
        all_categories.get('crisis_support', 0)
    )
    
    targets = {
        'Therapeutic Samples': (10000, therapeutic_count),
        'Total Dataset Size': (20000, total_records),
    }
    
    for metric, (target, actual) in targets.items():
        percentage = (actual / target * 100) if target > 0 else 0
        status = "✅" if actual >= target else "⚠️"
        print(f"{status} {metric}: {actual:,} / {target:,} ({percentage:.1f}%)")
    
    print()
    
    # Save report
    output = {
        'timestamp': datetime.now().isoformat(),
        'total_records': total_records,
        'categories': dict(all_categories),
        'prd_comparison': {k: {'target': v[0], 'actual': v[1]} for k, v in targets.items()}
    }
    
    output_file = Path('metrics/categorization_report.json')
    output_file.parent.mkdir(exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"💾 Saved: {output_file}")

if __name__ == '__main__':
    main()
