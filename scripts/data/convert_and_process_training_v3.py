#!/usr/bin/env python3
"""
Convert training_v3 datasets from Context/Response format to messages format
Then save to processed/ directory for pipeline ingestion
"""
import sys
import os
import json
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from ai.utils.s3_dataset_loader import S3DatasetLoader

def convert_context_response_to_messages(record):
    """Convert {source, data: {Context, Response}} to {messages, metadata} format"""
    if 'data' not in record or 'Context' not in record['data'] or 'Response' not in record['data']:
        return None
    
    return {
        'messages': [
            {'role': 'user', 'content': record['data']['Context']},
            {'role': 'assistant', 'content': record['data']['Response']}
        ],
        'metadata': {
            'source': record.get('source', 'unknown'),
            'original_format': 'context_response'
        },
        '_source': record.get('source', 'unknown'),
        '_source_type': 'therapeutic_conversation'
    }

def main():
    print("=" * 80)
    print("🔄 Converting and Processing training_v3 Datasets")
    print("=" * 80)
    
    loader = S3DatasetLoader()
    
    # S3 datasets to convert
    datasets_to_convert = [
        ("stage1_foundation/Amod_mental_health_counseling_conversations.jsonl", "stage1_foundation_counseling"),
        ("stage1_foundation/heliosbrahma_mental_health_chatbot_dataset.jsonl", "stage1_foundation_chatbot"),
        ("stage2_specialist_addiction/fadodr_mental_health_therapy.jsonl", "stage2_addiction_therapy"),
        ("stage2_specialist_personality/Kanakmi_mental-disorders.jsonl", "stage2_mental_disorders"),
    ]
    
    # Output directory
    output_dir = Path("ai/training/ready_packages/datasets/cache/training_v3_converted")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    total_converted = 0
    
    for s3_suffix, output_name in datasets_to_convert:
        s3_path = f"s3://pixel-data/datasets/training_v3/{s3_suffix}"
        output_path = output_dir / f"{output_name}.jsonl"
        
        print(f"\n🔄 Converting: {s3_suffix}")
        print(f"   Output: {output_path}")
        
        converted_count = 0
        with open(output_path, 'w') as f_out:
            for record in loader.stream_jsonl(s3_path):
                converted = convert_context_response_to_messages(record)
                if converted:
                    f_out.write(json.dumps(converted) + '\n')
                    converted_count += 1
        
        print(f"   ✅ Converted {converted_count:,} records")
        total_converted += converted_count
    
    print("\n" + "=" * 80)
    print(f"🎉 COMPLETE: Converted {total_converted:,} total records")
    print(f"📁 Output directory: {output_dir}")
    print("=" * 80)
    
    print("\n💡 Next: Run unified pipeline on these converted files")

if __name__ == "__main__":
    main()
