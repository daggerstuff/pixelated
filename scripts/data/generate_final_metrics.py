#!/usr/bin/env python3
"""Generate comprehensive metrics report for all processed S3 data."""

import json
import sys
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime

sys.path.insert(0, '/home/vivi/pixelated/ai')

def analyze_dataset(file_path: Path) -> dict:
    """Analyze a single dataset file."""
    print(f"📊 Analyzing: {file_path.name}")
    
    stats = {
        'total_records': 0,
        'sample_keys': set(),
        'message_counts': [],
        'has_metadata': 0,
        'has_quality_score': 0,
        'categories': Counter(),
        'sources': Counter(),
    }
    
    with open(file_path, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            
            try:
                record = json.loads(line)
                stats['total_records'] += 1
                
                # Collect keys
                stats['sample_keys'].update(record.keys())
                
                # Count messages
                if 'messages' in record:
                    stats['message_counts'].append(len(record['messages']))
                
                # Check metadata
                if 'metadata' in record:
                    stats['has_metadata'] += 1
                    metadata = record['metadata']
                    
                    # Category
                    if 'category' in metadata:
                        stats['categories'][metadata['category']] += 1
                    
                    # Source
                    if 'source' in metadata:
                        stats['sources'][metadata['source']] += 1
                    
                    # Quality score
                    if 'quality_score' in metadata:
                        stats['has_quality_score'] += 1
                
            except json.JSONDecodeError:
                continue
    
    stats['sample_keys'] = list(stats['sample_keys'])
    stats['avg_messages'] = sum(stats['message_counts']) / len(stats['message_counts']) if stats['message_counts'] else 0
    
    return stats

def main():
    datasets = [
        ('Tier1 Priority Curated', Path('ai/training/ready_packages/datasets/cache/orchestrator_output/processed_s3_tier_datasets.jsonl')),
        ('Mental Health Clean', Path('ai/training/ready_packages/datasets/cache/s3_direct/mental_health_clean.jsonl')),
        ('Training V3 - Counseling', Path('ai/training/ready_packages/datasets/cache/training_v3_converted/stage1_foundation_counseling.jsonl')),
        ('Training V3 - Helios', Path('ai/training/ready_packages/datasets/cache/training_v3_converted/heliosbrahma_converted.jsonl')),
    ]
    
    print("="*80)
    print("🎯 COMPREHENSIVE S3 DATA PROCESSING METRICS")
    print("="*80)
    print()
    
    all_stats = {}
    total_records = 0
    
    for name, path in datasets:
        if path.exists() and path.stat().st_size > 0:
            stats = analyze_dataset(path)
            all_stats[name] = stats
            total_records += stats['total_records']
            print(f"  ✅ {stats['total_records']:,} records | {path.stat().st_size / 1024 / 1024:.1f} MB")
        else:
            print(f"  ⚠️  Skipped (empty or not found): {name}")
        print()
    
    print("="*80)
    print(f"📊 TOTAL PROCESSED RECORDS: {total_records:,}")
    print("="*80)
    print()
    
    # Category breakdown
    print("📂 CATEGORY BREAKDOWN:")
    all_categories = Counter()
    for name, stats in all_stats.items():
        all_categories.update(stats['categories'])
    
    for category, count in all_categories.most_common(10):
        print(f"  • {category}: {count:,}")
    
    print()
    
    # Source breakdown
    print("📍 SOURCE BREAKDOWN:")
    all_sources = Counter()
    for name, stats in all_stats.items():
        all_sources.update(stats['sources'])
    
    for source, count in all_sources.most_common(10):
        print(f"  • {source}: {count:,}")
    
    print()
    
    # PRD Target Comparison
    print("="*80)
    print("🎯 PRD TARGET COMPARISON")
    print("="*80)
    
    targets = {
        'Therapeutic Samples': (10000, all_categories.get('therapeutic', 0) + all_categories.get('counseling', 0)),
        'Bias Detection Samples': (5000, all_categories.get('bias', 0)),
        'Grounded Conversations': (5000, all_categories.get('grounded', 0)),
        'Total Dataset Size': (20000, total_records),
    }
    
    for metric, (target, actual) in targets.items():
        percentage = (actual / target * 100) if target > 0 else 0
        status = "✅" if actual >= target else "⚠️"
        print(f"{status} {metric}:")
        print(f"    Target: {target:,} | Actual: {actual:,} | {percentage:.1f}%")
    
    print()
    print("="*80)
    
    # Save detailed report
    output_file = Path('metrics/final_s3_processing_report.json')
    output_file.parent.mkdir(exist_ok=True)
    
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_records': total_records,
        'datasets': {name: {
            'records': stats['total_records'],
            'categories': dict(stats['categories']),
            'sources': dict(stats['sources']),
            'avg_messages': stats['avg_messages'],
        } for name, stats in all_stats.items()},
        'aggregated': {
            'categories': dict(all_categories),
            'sources': dict(all_sources),
        },
        'prd_comparison': {k: {'target': v[0], 'actual': v[1]} for k, v in targets.items()}
    }
    
    with open(output_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"💾 Detailed report saved: {output_file}")
    print()

if __name__ == '__main__':
    main()
