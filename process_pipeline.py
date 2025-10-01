#!/usr/bin/env python3
"""
Mental Health Dataset Processing Pipeline
Converts various formats to ChatML for training
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any
import pandas as pd
import re

class ChatMLProcessor:
    def __init__(self, input_dir: str = "downloads", output_dir: str = "processed"):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
    def to_chatml(self, system: str, user: str, assistant: str) -> Dict[str, Any]:
        """Convert to ChatML format"""
        return {
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
                {"role": "assistant", "content": assistant}
            ]
        }
    
    def process_heartbreak_data(self, file_path: Path) -> List[Dict]:
        """Process heartbreak/breakup Q&A data"""
        results = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                for item in data:
                    if 'question' in item and 'answer' in item:
                        results.append(self.to_chatml(
                            "You are a compassionate mental health counselor specializing in relationship issues and emotional support. Provide empathetic, evidence-based guidance.",
                            item['question'],
                            item['answer']
                        ))
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
        
        return results
    
    def process_whisper_transcripts(self, file_path: Path) -> List[Dict]:
        """Process Whisper transcription data"""
        results = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        if 'text' in data and 'audio_file' in data:
                            # Extract meaningful content from transcript
                            text = data['text'].strip()
                            if len(text) > 100:  # Only process substantial content
                                # Create educational content from transcript
                                results.append(self.to_chatml(
                                    "You are a mental health educator providing insights about complex trauma and healing. Share knowledge in an accessible, supportive way.",
                                    f"Can you explain the key concepts from this mental health content: {data['audio_file']}?",
                                    text[:2000] + "..." if len(text) > 2000 else text
                                ))
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
        
        return results
    
    def process_markdown_transcripts(self, file_path: Path) -> List[Dict]:
        """Process markdown transcript files"""
        results = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if len(content) > 200:
                # Extract title from filename
                title = file_path.stem.replace('_', ' ').replace('-', ' ')
                
                # Clean up content
                content = re.sub(r'\n+', '\n', content)
                content = content.strip()
                
                results.append(self.to_chatml(
                    "You are a mental health professional providing education about trauma and healing. Explain concepts clearly and compassionately.",
                    f"Please explain the key insights about {title}",
                    content[:3000] + "..." if len(content) > 3000 else content
                ))
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
        
        return results
    
    def process_counseling_conversations(self, file_path: Path) -> List[Dict]:
        """Process mental health counseling conversation data"""
        results = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                for item in data:
                    # Handle various conversation formats
                    if 'conversations' in item:
                        messages = []
                        system_msg = {"role": "system", "content": "You are a professional mental health counselor providing empathetic, evidence-based support."}
                        messages.append(system_msg)
                        
                        for conv in item['conversations']:
                            if conv.get('from') == 'human':
                                messages.append({"role": "user", "content": conv['value']})
                            elif conv.get('from') in ['gpt', 'assistant']:
                                messages.append({"role": "assistant", "content": conv['value']})
                        
                        if len(messages) > 1:
                            results.append({"messages": messages})
                    
                    elif 'input' in item and 'output' in item:
                        results.append(self.to_chatml(
                            "You are a mental health counselor providing professional support and guidance.",
                            item['input'],
                            item['output']
                        ))
                    
                    elif 'instruction' in item and 'response' in item:
                        results.append(self.to_chatml(
                            "You are a mental health professional providing therapeutic support.",
                            item['instruction'],
                            item['response']
                        ))
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
        
        return results
    
    def process_consolidated_cot(self, file_path: Path) -> List[Dict]:
        """Process consolidated CoT reasoning dataset"""
        results = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        if 'conversation' in data and len(data['conversation']) >= 2:
                            # Convert conversation format to ChatML without adding system prompt
                            messages = []
                            
                            for turn in data['conversation']:
                                if turn['role'] == 'client':
                                    messages.append({"role": "user", "content": turn['content']})
                                elif turn['role'] == 'therapist':
                                    messages.append({"role": "assistant", "content": turn['content']})
                            
                            if len(messages) >= 2:
                                results.append({"messages": messages})
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
        return results

    def process_cot_datasets(self, cot_dir: Path) -> List[Dict]:
        """Process CoT reasoning datasets"""
        results = []
        try:
            with open(cot_dir / "cot_examples.jsonl", 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        if 'problem_statement' in data and 'conclusion' in data:
                            # Convert CoT format to ChatML
                            reasoning = ""
                            if 'reasoning_chain' in data:
                                reasoning = "\n".join([f"• {step}" for step in data['reasoning_chain']])
                                reasoning = f"\n\nReasoning:\n{reasoning}\n\n"
                            
                            results.append(self.to_chatml(
                                "You are a mental health counselor providing thoughtful, evidence-based guidance using chain-of-thought reasoning.",
                                data['problem_statement'],
                                f"{reasoning}{data['conclusion']}"
                            ))
        except Exception as e:
            print(f"Error processing {cot_dir}: {e}")
        return results

    def run_pipeline(self):
        """Execute the full processing pipeline"""
        all_data = []
        
        print("Processing Mental Health Dataset...")
        
        # Process heartbreak/breakup data
        heartbreak_files = list(self.input_dir.rglob("*heartbreak*.json")) + list(self.input_dir.rglob("*breakup*.json"))
        for file_path in heartbreak_files:
            data = self.process_heartbreak_data(file_path)
            all_data.extend(data)
            print(f"  Processed {file_path.name}: {len(data)} conversations")
        
        # Process CoT datasets - use consolidated file with 64k conversations
        consolidated_cot = Path("ai/pipelines/data/processed/phase_3_cot_reasoning/phase_3_cot_reasoning_consolidated.jsonl")
        if consolidated_cot.exists():
            data = self.process_consolidated_cot(consolidated_cot)
            all_data.extend(data)
            print(f"  Processed consolidated CoT reasoning: {len(data)} conversations")
        else:
            # Fallback to individual CoT datasets
            cot_base_dir = Path("ai/dataset_pipeline/cot_datasets")
            if cot_base_dir.exists():
                for cot_dir in cot_base_dir.iterdir():
                    if cot_dir.is_dir() and (cot_dir / "cot_examples.jsonl").exists():
                        data = self.process_cot_datasets(cot_dir)
                        all_data.extend(data)
                        print(f"  Processed {cot_dir.name}: {len(data)} conversations")
        
        # Process Whisper transcripts
        whisper_files = list(self.input_dir.rglob("*whisper*.jsonl"))
        for file_path in whisper_files:
            data = self.process_whisper_transcripts(file_path)
            all_data.extend(data)
            print(f"  Processed {file_path.name}: {len(data)} conversations")
        
        # Process markdown transcripts
        md_files = list(self.input_dir.rglob("*.md"))
        for file_path in md_files:
            if file_path.name != "README.md":  # Skip README files
                data = self.process_markdown_transcripts(file_path)
                all_data.extend(data)
                print(f"  Processed {file_path.name}: {len(data)} conversations")
        
        # Process counseling conversation data
        counseling_files = list(self.input_dir.rglob("*counseling*.json")) + list(self.input_dir.rglob("*mental_health*.json"))
        for file_path in counseling_files:
            data = self.process_counseling_conversations(file_path)
            all_data.extend(data)
            print(f"  Processed {file_path.name}: {len(data)} conversations")
        
        # Process any remaining JSON files that might contain conversation data
        other_json_files = []
        for json_file in self.input_dir.rglob("*.json"):
            # Skip files we've already processed and info files
            if (json_file not in heartbreak_files and 
                json_file not in counseling_files and
                not json_file.name.endswith('.info.json') and
                json_file.name not in ['dataset_info.json', 'dataset_summary.json']):
                other_json_files.append(json_file)
        
        for file_path in other_json_files:
            data = self.process_counseling_conversations(file_path)
            all_data.extend(data)
            if len(data) > 0:
                print(f"  Processed {file_path.name}: {len(data)} conversations")
        
        # Save processed data
        output_file = self.output_dir / "mental_health_chatml.jsonl"
        with open(output_file, 'w', encoding='utf-8') as f:
            for item in all_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        print(f"\nPipeline complete!")
        print(f"Total conversations: {len(all_data)}")
        print(f"Output saved to: {output_file}")
        
        # Create a sample file for inspection
        if len(all_data) > 0:
            sample_file = self.output_dir / "sample_conversations.json"
            with open(sample_file, 'w', encoding='utf-8') as f:
                json.dump(all_data[:5], f, indent=2, ensure_ascii=False)
            print(f"Sample conversations saved to: {sample_file}")
        
        return len(all_data)

if __name__ == "__main__":
    processor = ChatMLProcessor()
    processor.run_pipeline()
