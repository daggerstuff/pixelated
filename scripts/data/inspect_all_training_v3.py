#!/usr/bin/env python3
"""Inspect all training_v3 datasets to determine format and viability."""

import sys
import json
sys.path.insert(0, '/home/vivi/pixelated/ai')

from utils.s3_dataset_loader import S3DatasetLoader

def main():
    loader = S3DatasetLoader()
    
    # All training_v3 files we registered
    datasets = [
        'datasets/training_v3/stage1_foundation/counselchat-data.jsonl',
        'datasets/training_v3/stage1_foundation/mpst_mental_health_conversations.jsonl',
        'datasets/training_v3/stage2_specialist/hellaswag_mental_health_adapted.jsonl',
        'datasets/training_v3/stage2_specialist/mental_health_reddit_posts.jsonl',
        'datasets/training_v3/stage2_specialist/PsyQA_mental_health_qa.jsonl',
        'datasets/training_v3/stage3_voice_persona/combined_mental_health_conversations.jsonl',
        'datasets/training_v3/stage3_voice_persona/reddit_mental_health_conversations.jsonl',
    ]
    
    results = []
    
    for dataset in datasets:
        s3_path = f's3://pixel-data/{dataset}'
        name = dataset.split('/')[-1]
        print('\n' + '='*80)
        print(f'📄 {name}')
        print('='*80)
        
        try:
            count = 0
            sample = None
            for record in loader.stream_jsonl(s3_path):
                count += 1
                if count == 1:
                    sample = record
                if count >= 100:  # Sample first 100
                    break
            
            print(f'✅ Streamable: {count} records sampled')
            
            format_type = 'unknown'
            if sample:
                print(f'📋 Schema: {list(sample.keys())}')
                
                # Check format
                if 'messages' in sample:
                    format_type = 'messages'
                    print('✅ Already in messages format')
                elif 'data' in sample and isinstance(sample.get('data'), dict):
                    data_keys = list(sample['data'].keys())
                    format_type = f'data/{",".join(data_keys)}'
                    print(f'⚠️  Needs conversion - data keys: {data_keys}')
                elif 'conversations' in sample:
                    format_type = 'conversations'
                    print('⚠️  Has conversations field')
                else:
                    format_type = f'custom/{",".join(list(sample.keys())[:3])}'
                    print(f'⚠️  Unknown format - top-level keys: {list(sample.keys())}')
                    print(f'Sample: {json.dumps(sample, indent=2)[:500]}')
            
            results.append({
                'name': name,
                'path': dataset,
                'count': count,
                'format': format_type,
                'status': 'viable' if count > 0 else 'empty'
            })
            
        except Exception as e:
            print(f'❌ Error: {e}')
            results.append({
                'name': name,
                'path': dataset,
                'error': str(e),
                'status': 'error'
            })
    
    print('\n\n' + '='*80)
    print('📊 SUMMARY')
    print('='*80)
    for r in results:
        status_emoji = '✅' if r['status'] == 'viable' else '❌'
        print(f"{status_emoji} {r['name']}: {r.get('count', 0)} records, format: {r.get('format', 'N/A')}")

if __name__ == '__main__':
    main()
