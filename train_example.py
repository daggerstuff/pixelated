#!/usr/bin/env python3
"""
Example training script for mental health ChatML data
This demonstrates how to load and use the processed data for training
"""

import json
from pathlib import Path
from typing import List, Dict, Any
import random

def load_chatml_data(file_path: str) -> List[Dict[str, Any]]:
    """Load ChatML formatted data from JSONL file"""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
    return data

def format_for_training(conversation: Dict[str, Any]) -> str:
    """Format a conversation for training (example format)"""
    messages = conversation['messages']
    formatted = ""
    
    for msg in messages:
        role = msg['role']
        content = msg['content']
        
        if role == 'system':
            formatted += f"<|im_start|>system\n{content}<|im_end|>\n"
        elif role == 'user':
            formatted += f"<|im_start|>user\n{content}<|im_end|>\n"
        elif role == 'assistant':
            formatted += f"<|im_start|>assistant\n{content}<|im_end|>\n"
    
    return formatted

def create_training_splits(data: List[Dict], train_ratio: float = 0.8, val_ratio: float = 0.1):
    """Split data into train/validation/test sets"""
    random.shuffle(data)
    
    total = len(data)
    train_size = int(total * train_ratio)
    val_size = int(total * val_ratio)
    
    train_data = data[:train_size]
    val_data = data[train_size:train_size + val_size]
    test_data = data[train_size + val_size:]
    
    return train_data, val_data, test_data

def main():
    """Main training preparation function"""
    # Load processed data
    data_file = "processed/mental_health_chatml.jsonl"
    
    if not Path(data_file).exists():
        print(f"Data file {data_file} not found. Run process_pipeline.py first.")
        return
    
    print("Loading ChatML data...")
    conversations = load_chatml_data(data_file)
    print(f"Loaded {len(conversations)} conversations")
    
    # Split data
    print("Creating train/val/test splits...")
    train_data, val_data, test_data = create_training_splits(conversations)
    
    print(f"Train: {len(train_data)} conversations")
    print(f"Validation: {len(val_data)} conversations") 
    print(f"Test: {len(test_data)} conversations")
    
    # Save splits
    output_dir = Path("processed/splits")
    output_dir.mkdir(exist_ok=True)
    
    # Save as JSONL files
    for split_name, split_data in [("train", train_data), ("val", val_data), ("test", test_data)]:
        output_file = output_dir / f"{split_name}.jsonl"
        with open(output_file, 'w', encoding='utf-8') as f:
            for conversation in split_data:
                f.write(json.dumps(conversation, ensure_ascii=False) + '\n')
        print(f"Saved {split_name} split to {output_file}")
    
    # Save formatted examples for inspection
    examples_file = output_dir / "formatted_examples.txt"
    with open(examples_file, 'w', encoding='utf-8') as f:
        f.write("=== FORMATTED TRAINING EXAMPLES ===\n\n")
        for i, conversation in enumerate(train_data[:5]):
            f.write(f"--- Example {i+1} ---\n")
            f.write(format_for_training(conversation))
            f.write("\n" + "="*50 + "\n\n")
    
    print(f"Saved formatted examples to {examples_file}")
    
    # Print statistics
    print("\n=== DATASET STATISTICS ===")
    print(f"Total conversations: {len(conversations)}")
    
    # Count by system message type
    system_types = {}
    for conv in conversations:
        system_msg = conv['messages'][0]['content']
        key = system_msg[:50] + "..." if len(system_msg) > 50 else system_msg
        system_types[key] = system_types.get(key, 0) + 1
    
    print("\nSystem message types:")
    for sys_type, count in sorted(system_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  {count:5d}: {sys_type}")
    
    print(f"\nData ready for training! Use files in {output_dir}")

if __name__ == "__main__":
    main()
