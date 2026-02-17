#!/usr/bin/env python3
"""
Comprehensive S3 Dataset Metrics Measurement
Inventories pixel-data bucket and counts actual training samples
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import boto3
from botocore.exceptions import ClientError

# S3 Configuration from .env
S3_ENDPOINT = os.getenv('OVH_S3_ENDPOINT', 'https://s3.us-east-va.io.cloud.ovh.us')
S3_REGION = os.getenv('OVH_S3_REGION', 'us-east-va')
S3_BUCKET = os.getenv('OVH_S3_BUCKET', 'pixel-data')
S3_ACCESS_KEY = os.getenv('OVH_S3_ACCESS_KEY', 'b6939e6b65ef4252b20338499421a5f0')
S3_SECRET_KEY = os.getenv('OVH_S3_SECRET_KEY', '4a7e939381c6467c88f81a5024672a96')

def create_s3_client():
    """Create S3 client with OVH credentials"""
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION
    )

def count_jsonl_lines(s3_client, bucket: str, key: str) -> int:
    """Count lines in a JSONL file in S3"""
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read().decode('utf-8')
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        return len(lines)
    except Exception as e:
        print(f"⚠️  Error reading {key}: {e}", file=sys.stderr)
        return 0

def inventory_s3_directory(s3_client, bucket: str, prefix: str) -> Dict[str, Any]:
    """Inventory a directory in S3"""
    print(f"📂 Scanning {prefix}...")
    
    result = {
        'prefix': prefix,
        'total_files': 0,
        'total_size': 0,
        'jsonl_files': [],
        'json_files': [],
        'csv_files': [],
        'other_files': [],
        'total_samples': 0
    }
    
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
        
        for page in pages:
            if 'Contents' not in page:
                continue
                
            for obj in page['Contents']:
                key = obj['Key']
                size = obj['Size']
                
                result['total_files'] += 1
                result['total_size'] += size
                
                if key.endswith('.jsonl'):
                    samples = count_jsonl_lines(s3_client, bucket, key)
                    result['jsonl_files'].append({
                        'key': key,
                        'size': size,
                        'samples': samples
                    })
                    result['total_samples'] += samples
                elif key.endswith('.json'):
                    result['json_files'].append({'key': key, 'size': size})
                elif key.endswith('.csv'):
                    result['csv_files'].append({'key': key, 'size': size})
                else:
                    result['other_files'].append({'key': key, 'size': size})
    
    except ClientError as e:
        print(f"❌ Error accessing {prefix}: {e}", file=sys.stderr)
    
    return result

def format_size(bytes_size: int) -> str:
    """Format bytes to human-readable size"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f} PB"

def main():
    print("=" * 80)
    print("🔍 S3 DATASET METRICS MEASUREMENT")
    print("=" * 80)
    print(f"Bucket: {S3_BUCKET}")
    print(f"Endpoint: {S3_ENDPOINT}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)
    print()
    
    s3_client = create_s3_client()
    
    # Directories to scan
    directories = [
        'datasets/',
        'training/',
        'processed/',
        'acquired/',
        'ai/',
        'knowledge/'
    ]
    
    all_results = {}
    total_samples = 0
    total_size = 0
    
    for directory in directories:
        result = inventory_s3_directory(s3_client, S3_BUCKET, directory)
        all_results[directory] = result
        total_samples += result['total_samples']
        total_size += result['total_size']
        
        print(f"\n{'=' * 80}")
        print(f"📊 {directory}")
        print(f"{'=' * 80}")
        print(f"  Total Files: {result['total_files']:,}")
        print(f"  Total Size: {format_size(result['total_size'])}")
        print(f"  JSONL Files: {len(result['jsonl_files'])}")
        print(f"  JSON Files: {len(result['json_files'])}")
        print(f"  CSV Files: {len(result['csv_files'])}")
        print(f"  📝 Total Samples (JSONL): {result['total_samples']:,}")
        
        if result['jsonl_files']:
            print(f"\n  Top JSONL files:")
            sorted_jsonl = sorted(result['jsonl_files'], key=lambda x: x['samples'], reverse=True)[:5]
            for f in sorted_jsonl:
                print(f"    • {Path(f['key']).name}: {f['samples']:,} samples ({format_size(f['size'])})")
    
    print(f"\n{'=' * 80}")
    print("🎯 OVERALL SUMMARY")
    print(f"{'=' * 80}")
    print(f"📝 Total Training Samples (JSONL): {total_samples:,}")
    print(f"💾 Total Data Size: {format_size(total_size)}")
    print(f"{'=' * 80}")
    
    # Save detailed report
    output_dir = Path('metrics')
    output_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    json_path = output_dir / f's3_dataset_metrics_{timestamp}.json'
    md_path = output_dir / f's3_dataset_report_{timestamp}.md'
    
    # Save JSON
    report_data = {
        'timestamp': datetime.now().isoformat(),
        'bucket': S3_BUCKET,
        'endpoint': S3_ENDPOINT,
        'total_samples': total_samples,
        'total_size': total_size,
        'directories': all_results
    }
    
    with open(json_path, 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print(f"\n✅ Detailed JSON report: {json_path}")
    print(f"✅ Markdown report: {md_path}")

if __name__ == '__main__':
    main()
