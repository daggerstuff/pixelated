#!/usr/bin/env python3
"""
Run the orchestrator on S3 processed/ tier datasets.

This script processes the curated S3 datasets and generates train/val/test splits.
"""
import os
import sys
from pathlib import Path

# Set up environment
os.environ.setdefault('AWS_ACCESS_KEY_ID', 'b6939e6b65ef4252b20338499421a5f0')
os.environ.setdefault('AWS_SECRET_ACCESS_KEY', '4a7e939381c6467c88f81a5024672a96')
os.environ.setdefault('OVH_S3_ENDPOINT', 'https://s3.us-east-va.io.cloud.ovh.us')
os.environ.setdefault('OVH_S3_BUCKET', 'pixel-data')

# Add ai/ to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'ai'))

from pipelines.orchestrator.unified_preprocessing_pipeline import (
    UnifiedPreprocessingPipeline,
    ProcessingConfig,
    DataSource
)

def main():
    print("🚀 Starting Orchestrator with S3 Processed Tier Datasets")
    print("=" * 80)
    
    # Create pipeline with production config
    config = ProcessingConfig(
        target_quality_threshold=0.7,  # Lower threshold for diverse data
        deduplication_enabled=True,
        validation_enabled=True,
        safety_filtering_enabled=True,
        psychology_integration_enabled=False,  # Disable for speed
        youtube_rag_integration_enabled=False,  # Disable for speed
        scrub_pii_enabled=True,
        normalize_text_enabled=True,
        convert_chatml_enabled=True,
    )
    
    pipeline = UnifiedPreprocessingPipeline(config)
    
    # Manually register S3 processed/ tier datasets (start with smaller ones for testing)
    processed_datasets = [
        # Start with tier2 (994KB) for quick validation
        ('pixelated_tier2_professional_therapeutic', 
         's3://pixel-data/processed/pixelated_tier2_professional_therapeutic_dark_humor.jsonl',
         994000, 'stage2_therapeutic_expertise'),
        
        # Then tier3 (332KB)
        ('pixelated_tier3_clinical_cot', 
         's3://pixel-data/processed/pixelated_tier3_clinical_cot_dark_humor.jsonl',
         332000, 'stage2_therapeutic_expertise'),
        
        # Finally tier1 (1.2GB) - will take longer
        ('pixelated_tier1_priority_curated', 
         's3://pixel-data/processed/pixelated_tier1_priority_curated_dark_humor.jsonl',
         1200000000, 'stage1_foundation'),
    ]
    
    for name, path, size, stage in processed_datasets:
        source = DataSource(
            name=name,
            path=path,
            format='jsonl',
            size_bytes=size,
            source_type='curated_training',
            stage=stage,
            metadata={'s3_streaming': True}
        )
        pipeline.register_data_source(source)
    
    print(f"\n✅ Registered {len(pipeline.data_sources)} S3 datasets:")
    for ds in pipeline.data_sources:
        size_mb = ds.size_bytes / (1024 * 1024)
        print(f"  - {ds.name} ({size_mb:.1f} MB, {ds.stage})")
    
    print("\n" + "=" * 80)
    print("📥 Starting S3 streaming and processing...")
    print("=" * 80 + "\n")
    
    # Process all datasets
    all_records = []
    for source in pipeline.data_sources:
        print(f"\n🔄 Processing: {source.name}")
        if pipeline.validate_data_source(source):
            records = pipeline.process_dataset(source)
            all_records.extend(records)
            print(f"✅ Extracted {len(records):,} records from {source.name}")
        else:
            print(f"❌ Validation failed for {source.name}")
    
    print(f"\n📊 Total records before deduplication: {len(all_records):,}")
    
    # Apply deduplication
    print("\n🔄 Deduplicating records...")
    deduplicated = pipeline.deduplicate_records(all_records)
    print(f"✅ Records after deduplication: {len(deduplicated):,}")
    
    # Apply safety filtering
    print("\n🔄 Applying safety filtering...")
    safe_records = pipeline.apply_safety_filtering(deduplicated)
    print(f"✅ Records after safety filtering: {len(safe_records):,}")
    
    # Save processed records
    output_dir = Path('ai/training/ready_packages/datasets/cache/orchestrator_output')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = output_dir / 'processed_s3_tier_datasets.jsonl'
    print(f"\n💾 Saving to: {output_file}")
    
    import json
    with open(output_file, 'w') as f:
        for record in safe_records:
            f.write(json.dumps(record) + '\n')
    
    print(f"✅ Saved {len(safe_records):,} records")
    
    # Generate summary
    print("\n" + "=" * 80)
    print("📈 PROCESSING SUMMARY")
    print("=" * 80)
    print(f"Total input records:     {len(all_records):,}")
    print(f"After deduplication:     {len(deduplicated):,} ({len(deduplicated)/len(all_records)*100:.1f}%)")
    print(f"After safety filtering:  {len(safe_records):,} ({len(safe_records)/len(all_records)*100:.1f}%)")
    print(f"Output file:             {output_file}")
    print(f"Output size:             {output_file.stat().st_size / (1024*1024):.1f} MB")
    print("=" * 80)
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
