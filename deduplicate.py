#!/usr/bin/env python3
"""
Data deduplication and cleaning script
Removes duplicates, low-quality, and dead weight data
"""

import json
import hashlib
from pathlib import Path
from typing import List, Dict, Set
import re

class DataCleaner:
    def __init__(self, input_file: str = "processed/mental_health_chatml.jsonl"):
        self.input_file = Path(input_file)
        self.seen_hashes: Set[str] = set()
        self.stats = {
            'total': 0,
            'duplicates': 0,
            'too_short': 0,
            'low_quality': 0,
            'kept': 0
        }
    
    def hash_conversation(self, conv: Dict) -> str:
        """Create hash of user+assistant content"""
        messages = conv['messages']
        content = ""
        for msg in messages:
            if msg['role'] in ['user', 'assistant']:
                content += msg['content'].strip().lower()
        return hashlib.md5(content.encode()).hexdigest()
    
    def is_low_quality(self, conv: Dict) -> bool:
        """Check if conversation is low quality"""
        messages = conv['messages']
        
        for msg in messages:
            content = msg['content'].strip()
            
            # Too short
            if msg['role'] in ['user', 'assistant'] and len(content) < 20:
                return True
            
            # Repetitive patterns
            if len(set(content.split())) < len(content.split()) * 0.3:
                return True
            
            # Mostly punctuation/symbols
            if len(re.sub(r'[^a-zA-Z0-9\s]', '', content)) < len(content) * 0.5:
                return True
            
            # Generic/template responses
            generic_phrases = [
                'i am an ai', 'as an ai', 'i cannot', 'i\'m sorry but',
                'lorem ipsum', 'test test', 'example example'
            ]
            if any(phrase in content.lower() for phrase in generic_phrases):
                return True
        
        return False
    
    def clean_data(self) -> int:
        """Clean and deduplicate data"""
        output_file = self.input_file.parent / "mental_health_clean.jsonl"
        
        with open(self.input_file, 'r', encoding='utf-8') as infile, \
             open(output_file, 'w', encoding='utf-8') as outfile:
            
            for line in infile:
                if not line.strip():
                    continue
                
                conv = json.loads(line)
                self.stats['total'] += 1
                
                # Check for duplicates
                conv_hash = self.hash_conversation(conv)
                if conv_hash in self.seen_hashes:
                    self.stats['duplicates'] += 1
                    continue
                
                # Check conversation length
                total_length = sum(len(msg['content']) for msg in conv['messages'] 
                                 if msg['role'] in ['user', 'assistant'])
                if total_length < 50:
                    self.stats['too_short'] += 1
                    continue
                
                # Check quality
                if self.is_low_quality(conv):
                    self.stats['low_quality'] += 1
                    continue
                
                # Keep this conversation
                self.seen_hashes.add(conv_hash)
                self.stats['kept'] += 1
                outfile.write(json.dumps(conv, ensure_ascii=False) + '\n')
        
        print(f"Cleaning complete:")
        print(f"  Total: {self.stats['total']}")
        print(f"  Duplicates removed: {self.stats['duplicates']}")
        print(f"  Too short removed: {self.stats['too_short']}")
        print(f"  Low quality removed: {self.stats['low_quality']}")
        print(f"  Kept: {self.stats['kept']}")
        print(f"  Cleaned data saved to: {output_file}")
        
        return self.stats['kept']

if __name__ == "__main__":
    cleaner = DataCleaner()
    cleaner.clean_data()
