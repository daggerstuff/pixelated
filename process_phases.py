#!/usr/bin/env python3
"""
Phased processing pipeline - separates datasets for different training applications
"""

import json
from pathlib import Path
from process_pipeline import ChatMLProcessor

class PhasedProcessor(ChatMLProcessor):
    def __init__(self):
        super().__init__()
        self.phases_dir = Path("processed/phases")
        self.phases_dir.mkdir(exist_ok=True)
    
    def run_phased_pipeline(self):
        """Process datasets in separate phases"""
        
        # Backup consolidated
        consolidated_file = Path("processed/mental_health_chatml.jsonl")
        backup_file = Path("processed/mental_health_consolidated_backup.jsonl")
        if consolidated_file.exists():
            consolidated_file.rename(backup_file)
            print(f"Backed up consolidated to: {backup_file}")
        
        # Phase 1: Heartbreak/Relationship data
        print("Phase 1: Processing heartbreak/relationship data...")
        heartbreak_data = []
        heartbreak_files = list(self.input_dir.rglob("*heartbreak*.json")) + list(self.input_dir.rglob("*breakup*.json"))
        for file_path in heartbreak_files:
            data = self.process_heartbreak_data(file_path)
            heartbreak_data.extend(data)
        
        phase1_file = self.phases_dir / "phase1_heartbreak.jsonl"
        with open(phase1_file, 'w', encoding='utf-8') as f:
            for item in heartbreak_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        print(f"  Phase 1: {len(heartbreak_data)} conversations -> {phase1_file}")
        
        # Phase 2: CoT Reasoning data
        print("Phase 2: Processing CoT reasoning data...")
        cot_data = []
        consolidated_cot = Path("ai/pipelines/data/processed/phase_3_cot_reasoning/phase_3_cot_reasoning_consolidated.jsonl")
        if consolidated_cot.exists():
            cot_data = self.process_consolidated_cot(consolidated_cot)
        
        phase2_file = self.phases_dir / "phase2_cot_reasoning.jsonl"
        with open(phase2_file, 'w', encoding='utf-8') as f:
            for item in cot_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        print(f"  Phase 2: {len(cot_data)} conversations -> {phase2_file}")
        
        # Phase 3: Educational content (transcripts, markdown)
        print("Phase 3: Processing educational content...")
        edu_data = []
        
        # Whisper transcripts
        whisper_files = list(self.input_dir.rglob("*whisper*.jsonl"))
        for file_path in whisper_files:
            data = self.process_whisper_transcripts(file_path)
            edu_data.extend(data)
        
        # Markdown transcripts
        md_files = list(self.input_dir.rglob("*.md"))
        for file_path in md_files:
            if file_path.name != "README.md":
                data = self.process_markdown_transcripts(file_path)
                edu_data.extend(data)
        
        phase3_file = self.phases_dir / "phase3_educational.jsonl"
        with open(phase3_file, 'w', encoding='utf-8') as f:
            for item in edu_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        print(f"  Phase 3: {len(edu_data)} conversations -> {phase3_file}")
        
        # Phase 4: Priority conversations (Wayfarer data)
        print("Phase 4: Processing priority conversations...")
        priority_data = []
        priority_files = list(Path("ai/lightning/pixelated-training/processed/phase_1_priority_conversations").rglob("*.jsonl"))
        for file_path in priority_files:
            data = self.process_jsonl_file(file_path)
            priority_data.extend(data)
            print(f"    Processed {file_path.name}: {len(data)} conversations")
        
        phase4_file = self.phases_dir / "phase4_priority_wayfarer.jsonl"
        with open(phase4_file, 'w', encoding='utf-8') as f:
            for item in priority_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        print(f"  Phase 4: {len(priority_data)} conversations -> {phase4_file}")
        
        # Phase 5: Professional datasets
        print("Phase 5: Processing professional datasets...")
        prof_data = []
        prof_files = list(Path("ai/lightning/pixelated-training/processed/phase_2_professional_datasets").rglob("*.jsonl"))
        for file_path in prof_files:
            data = self.process_jsonl_file(file_path)
            prof_data.extend(data)
            print(f"    Processed {file_path.name}: {len(data)} conversations")
        
        phase5_file = self.phases_dir / "phase5_professional.jsonl"
        with open(phase5_file, 'w', encoding='utf-8') as f:
            for item in prof_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        print(f"  Phase 5: {len(prof_data)} conversations -> {phase5_file}")
        
        # Phase 6: Pixel voice data
        print("Phase 6: Processing Pixel voice data...")
        pixel_data = []
        pixel_files = list(Path("ai/models/Wendy/training_data").rglob("*pixelated*.jsonl"))
        for file_path in pixel_files:
            data = self.process_jsonl_file(file_path)
            pixel_data.extend(data)
            print(f"    Processed {file_path.name}: {len(data)} conversations")
        
        phase6_file = self.phases_dir / "phase6_pixel_voice.jsonl"
        with open(phase6_file, 'w', encoding='utf-8') as f:
            for item in pixel_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        print(f"  Phase 6: {len(pixel_data)} conversations -> {phase6_file}")
        
        # Create phase summary
        summary = {
            "phase1_heartbreak": len(heartbreak_data),
            "phase2_cot_reasoning": len(cot_data), 
            "phase3_educational": len(edu_data),
            "phase4_priority_wayfarer": len(priority_data),
            "phase5_professional": len(prof_data),
            "phase6_pixel_voice": len(pixel_data),
            "total": len(heartbreak_data) + len(cot_data) + len(edu_data) + len(priority_data) + len(prof_data) + len(pixel_data)
        }
        
        summary_file = self.phases_dir / "phases_summary.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)
        
        print(f"\nPhased processing complete:")
        print(f"  Phase 1 (Heartbreak): {summary['phase1_heartbreak']} conversations")
        print(f"  Phase 2 (CoT Reasoning): {summary['phase2_cot_reasoning']} conversations") 
        print(f"  Phase 3 (Educational): {summary['phase3_educational']} conversations")
        print(f"  Phase 4 (Priority/Wayfarer): {summary['phase4_priority_wayfarer']} conversations")
        print(f"  Phase 5 (Professional): {summary['phase5_professional']} conversations")
        print(f"  Phase 6 (Pixel Voice): {summary['phase6_pixel_voice']} conversations")
        print(f"  Total: {summary['total']} conversations")
        print(f"  Summary: {summary_file}")
    
    def process_jsonl_file(self, file_path: Path) -> list:
        """Process generic JSONL file"""
        results = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        if 'messages' in data:
                            results.append(data)
                        elif 'conversation' in data:
                            # Convert conversation format
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

if __name__ == "__main__":
    processor = PhasedProcessor()
    processor.run_phased_pipeline()
