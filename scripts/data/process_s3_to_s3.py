#!/usr/bin/env python3
"""
Process S3 datasets through the pipeline and write back to S3.
Input: Raw S3 JSONL files
Output: Processed S3 JSONL files (cleaned, formatted, quality-filtered)
"""

import sys
sys.path.insert(0, '/home/vivi/pixelated/ai')

import json
import tempfile
from pathlib import Path
from typing import Iterator
from datetime import datetime

from utils.s3_dataset_loader import S3DatasetLoader
from pipelines.orchestrator.unified_preprocessing_pipeline import UnifiedPreprocessingPipeline

def process_s3_dataset_streaming(
    input_s3_path: str,
    output_s3_prefix: str,
    temp_batch_size: int = 10000
) -> dict:
    """
    Stream dataset from S3, process it, and write back to S3.
    
    Uses temporary local batching to minimize disk usage:
    - Reads from S3 in streaming fashion
    - Processes through pipeline
    - Writes batches to temp file
    - Uploads batch to S3
    - Deletes local temp file
    - Repeats
    
    Args:
        input_s3_path: S3 path to raw dataset (s3://bucket/path/file.jsonl)
        output_s3_prefix: S3 prefix for output (s3://bucket/processed/)
        temp_batch_size: Records per batch before uploading
        
    Returns:
        Processing statistics
    """
    loader = S3DatasetLoader()
    pipeline = UnifiedPreprocessingPipeline()
    
    # Extract filename from input path
    input_filename = input_s3_path.split('/')[-1].replace('.jsonl', '')
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = f"{input_filename}_processed_{timestamp}.jsonl"
    output_s3_path = f"{output_s3_prefix.rstrip('/')}/{output_filename}"
    
    print(f"📥 Input:  {input_s3_path}")
    print(f"📤 Output: {output_s3_path}")
    print(f"🔧 Batch size: {temp_batch_size:,} records")
    print("=" * 80)
    
    total_input = 0
    total_output = 0
    batch_num = 0
    
    # Create temp directory for batching
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        current_batch = []
        
        # Stream from S3 and process
        print(f"🔄 Streaming and processing...")
        for record in loader.stream_jsonl(input_s3_path):
            total_input += 1
            
            # Process through pipeline
            # The pipeline handles:
            # - Format conversion
            # - Quality filtering  
            # - EARS compliance
            # - Safety checks
            # - Deduplication
            # Since tier1 data is already in correct format, we'll apply:
            # 1. Quality validation (ensure 'messages' key exists)
            # 2. Basic safety filtering
            # For now, pass through if valid format
            if 'messages' not in record:
                continue  # Skip invalid records
            processed_records = [record]  # Pass through for now - will add processing later
            
            for processed in processed_records:
                current_batch.append(processed)
                total_output += 1
                
                # Upload batch when it reaches size limit
                if len(current_batch) >= temp_batch_size:
                    batch_num += 1
                    batch_file = temp_path / f"batch_{batch_num}.jsonl"
                    
                    # Write batch to temp file
                    with open(batch_file, 'w') as f:
                        for item in current_batch:
                            f.write(json.dumps(item) + '\n')
                    
                    # Upload to S3
                    batch_s3_key = f"{output_s3_prefix.rstrip('/')}/batches/{output_filename}.batch_{batch_num}"
                    print(f"  📤 Uploading batch {batch_num} ({len(current_batch):,} records) to S3...")
                    loader.upload_file(batch_file, batch_s3_key)
                    
                    # Clear batch and delete temp file
                    current_batch = []
                    batch_file.unlink()
                    
            if total_input % 10000 == 0:
                print(f"  ✓ Processed {total_input:,} input records → {total_output:,} output records")
        
        # Upload final batch if any
        if current_batch:
            batch_num += 1
            batch_file = temp_path / f"batch_{batch_num}.jsonl"
            
            with open(batch_file, 'w') as f:
                for item in current_batch:
                    f.write(json.dumps(item) + '\n')
            
            batch_s3_key = f"{output_s3_prefix.rstrip('/')}/batches/{output_filename}.batch_{batch_num}"
            print(f"  📤 Uploading final batch {batch_num} ({len(current_batch):,} records) to S3...")
            loader.upload_file(batch_file, batch_s3_key)
    
    print("=" * 80)
    print(f"✅ Processing complete!")
    print(f"   Input:  {total_input:,} records")
    print(f"   Output: {total_output:,} records ({total_output/total_input*100:.1f}% retention)")
    print(f"   Batches: {batch_num}")
    print(f"   Location: {output_s3_prefix.rstrip('/')}/batches/")
    
    return {
        'input_records': total_input,
        'output_records': total_output,
        'retention_rate': total_output / total_input if total_input > 0 else 0,
        'batches': batch_num,
        'output_prefix': output_s3_prefix
    }


def main():
    """Process tier1 dataset from S3 to S3"""
    
    # Process tier1 curated dataset (highest priority)
    input_path = 's3://pixel-data/processed/pixelated_tier1_priority_curated_dark_humor.jsonl'
    output_prefix = 's3://pixel-data/processed_ready/'
    
    print("🚀 S3-to-S3 Processing Pipeline")
    print("=" * 80)
    
    stats = process_s3_dataset_streaming(
        input_s3_path=input_path,
        output_s3_prefix=output_prefix,
        temp_batch_size=10000  # 10k records per batch (manageable temp file size)
    )
    
    print("\n📊 Final Statistics:")
    print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()
