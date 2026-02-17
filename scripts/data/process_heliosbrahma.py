#!/usr/bin/env python3
"""Convert and process heliosbrahma mental health chatbot dataset."""

import sys
import json
from pathlib import Path

sys.path.insert(0, '/home/vivi/pixelated/ai')

from utils.s3_dataset_loader import S3DatasetLoader
from pipelines.orchestrator.unified_preprocessing_pipeline import UnifiedPreprocessingPipeline

def convert_heliosbrahma_to_messages(record):
    """Convert heliosbrahma format to messages format."""
    # Based on inspection, adapt as needed
    if 'messages' in record:
        return record  # Already in correct format
    
    if 'data' in record and isinstance(record['data'], dict):
        data = record['data']
        messages = []
        
        # Handle <HUMAN>/<ASSISTANT> text format
        if 'text' in data and '<HUMAN>' in data['text'] and '<ASSISTANT>' in data['text']:
            text = data['text']
            # Split by <HUMAN> and <ASSISTANT> markers
            parts = text.split('<ASSISTANT>:')
            if len(parts) >= 2:
                user_text = parts[0].replace('<HUMAN>:', '').strip()
                assistant_text = parts[1].strip()
                messages = [
                    {"role": "user", "content": user_text},
                    {"role": "assistant", "content": assistant_text}
                ]
        # Handle Context/Response format
        elif 'Context' in data and 'Response' in data:
            messages = [
                {"role": "user", "content": data['Context']},
                {"role": "assistant", "content": data['Response']}
            ]
        # Handle question/answer format
        elif 'question' in data and 'answer' in data:
            messages = [
                {"role": "user", "content": data['question']},
                {"role": "assistant", "content": data['answer']}
            ]
        
        if messages:
            return {
                'messages': messages,
                'metadata': {
                    'source': record.get('source', 'heliosbrahma_mental_health_chatbot'),
                    'original_format': 'data_dict'
                }
            }
    
    return None

def main():
    loader = S3DatasetLoader()
    s3_path = 's3://pixel-data/datasets/training_v3/stage1_foundation/heliosbrahma_mental_health_chatbot_dataset.jsonl'
    
    output_dir = Path('ai/training/ready_packages/datasets/cache/training_v3_converted')
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / 'heliosbrahma_converted.jsonl'
    
    print(f'📥 Streaming from: {s3_path}')
    print(f'📤 Output to: {output_file}')
    print('='*80)
    
    converted_count = 0
    skipped_count = 0
    
    with open(output_file, 'w') as out:
        for record in loader.stream_jsonl(s3_path):
            converted = convert_heliosbrahma_to_messages(record)
            if converted:
                out.write(json.dumps(converted) + '\n')
                converted_count += 1
            else:
                skipped_count += 1
            
            if (converted_count + skipped_count) % 100 == 0:
                print(f'  Processed: {converted_count + skipped_count}, Converted: {converted_count}, Skipped: {skipped_count}')
    
    print('='*80)
    print(f'✅ Conversion complete!')
    print(f'   Converted: {converted_count}')
    print(f'   Skipped: {skipped_count}')
    print(f'   Output: {output_file}')

if __name__ == '__main__':
    main()
