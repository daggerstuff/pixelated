#!/usr/bin/env python3
"""Inspect large S3 datasets to determine format and count."""

import sys
import json
sys.path.insert(0, '/home/vivi/pixelated/ai')

from utils.s3_dataset_loader import S3DatasetLoader

def main():
    loader = S3DatasetLoader()
    
    # Check the ultimate final dataset and other large files
    datasets_to_check = [
        's3://pixel-data/ai/training_ready/data/ULTIMATE_FINAL_DATASET_cleaned.jsonl',
        's3://pixel-data/ai/data/lightning_h100/train.json',
        's3://pixel-data/ai/data/compress/processed/mental_health_clean.jsonl',
        's3://pixel-data/ai/training_ready/data/generated/edge_case_expanded/crisis_detection_cleaned.jsonl',
    ]
    
    for s3_path in datasets_to_check:
        name = s3_path.split('/')[-1]
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
                    print(f'Schema: {list(record.keys())}')
                    if 'messages' in record:
                        print('✅ Has messages format')
                        print(f'  First message: {record["messages"][0] if record["messages"] else "empty"}')
                    else:
                        print(f'Sample: {json.dumps(record, indent=2)[:400]}...')
                if count >= 1000:  # Sample 1000 records
                    break
            print(f'Sampled: {count} records')
        except Exception as e:
            print(f'❌ Error: {e}')

if __name__ == '__main__':
    main()
