#!/usr/bin/env python3
"""
Process ALL S3 datasets through full pipeline and write back to S3.
Processes all 589 JSONL files (103.97 GB, ~50-100M records).
"""

import sys
sys.path.insert(0, '/home/vivi/pixelated/ai')
sys.path.insert(0, '/home/vivi/pixelated')

import json
import os
from pathlib import Path
from utils.s3_dataset_loader import S3DatasetLoader
from pipelines.orchestrator.unified_preprocessing_pipeline import (
    UnifiedPreprocessingPipeline,
    ProcessingConfig,
    DataSource
)

def main():
    print("="*80)
    print("🚀 FULL S3 PIPELINE PROCESSING - ALL DATA")
    print("="*80)
    print("")
    
    # Initialize
    loader = S3DatasetLoader()
    config = ProcessingConfig(
        target_quality_threshold=0.7,
        deduplication_enabled=True,
        safety_filtering_enabled=True,
        validation_enabled=True
    )
    pipeline = UnifiedPreprocessingPipeline(config)
    
    # Get ALL JSONL files from S3
    print("📋 Discovering all JSONL files in S3...")
    all_files = []
    
    # List all files recursively
    s3_client = loader.s3_client
    bucket = loader.bucket
    paginator = s3_client.get_paginator('list_objects_v2')
    
    for page in paginator.paginate(Bucket=bucket):
        if 'Contents' not in page:
            continue
        for obj in page['Contents']:
            key = obj['Key']
            if key.endswith('.jsonl'):
                all_files.append({
                    'key': key,
                    'size': obj['Size']
                })
    
    print(f"✅ Found {len(all_files)} JSONL files")
    total_size_gb = sum(f['size'] for f in all_files) / (1024**3)
    print(f"📊 Total size: {total_size_gb:.2f} GB")
    print("")
    
    # Process each file
    total_processed = 0
    total_output = 0
    
    for idx, file_info in enumerate(all_files, 1):
        s3_key = file_info['key']
        s3_path = f"s3://{bucket}/{s3_key}"
        size_mb = file_info['size'] / (1024**1024)
        
        print(f"\n[{idx}/{len(all_files)}] Processing: {s3_key} ({size_mb:.1f} MB)")
        
        try:
            # Create DataSource
            source = DataSource(
                name=Path(s3_key).stem,
                path=s3_path,
                format="jsonl",
                size_bytes=file_info['size']
            )
            
            # Process through pipeline
            processed_records = pipeline.process_dataset(source)
            
            if not processed_records:
                print(f"   ⚠️  No records passed pipeline filtering")
                continue
            
            # Write to S3
            output_key = f"processed_ready/{Path(s3_key).stem}_processed.jsonl"
            temp_file = Path(f"/tmp/temp_batch_{idx}.jsonl")
            
            with open(temp_file, 'w') as f:
                for record in processed_records:
                    f.write(json.dumps(record) + '\n')
                    total_output += 1
            
            loader.upload_file(temp_file, output_key)
            temp_file.unlink()
            
            total_processed += len(processed_records)
            print(f"   ✅ Processed: {len(processed_records):,} records → s3://{bucket}/{output_key}")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            continue
    
    print("\n" + "="*80)
    print("✅ PROCESSING COMPLETE!")
    print(f"   Files processed: {len(all_files)}")
    print(f"   Total records output: {total_output:,}")
    print(f"   Output location: s3://{bucket}/processed_ready/")
    print("="*80)

if __name__ == "__main__":
    main()
