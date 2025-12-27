#!/usr/bin/env python3
"""
Phased processing pipeline - separates datasets for different training applications
"""

import json
from pathlib import Path
from typing import Optional

from process_pipeline import ChatMLProcessor


class PhasedProcessor(ChatMLProcessor):
    def __init__(self):
        super().__init__()
        self.phases_dir = Path("processed/phases")
        self.phases_dir.mkdir(exist_ok=True)

    def _backup_consolidated_file(self):
        """Backup consolidated file if it exists"""
        consolidated_file = Path("processed/mental_health_chatml.jsonl")
        backup_file = Path("processed/mental_health_consolidated_backup.jsonl")
        if consolidated_file.exists():
            consolidated_file.rename(backup_file)
            print(f"Backed up consolidated to: {backup_file}")

    def _process_phase_data(self, phase_name: str, data: list, output_file: Path):
        """Process and save phase data"""
        with open(output_file, "w", encoding="utf-8") as f:
            for item in data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"  {phase_name}: {len(data)} conversations -> {output_file}")

    def _process_heartbreak_phase(self) -> list:
        """Process Phase 1: Heartbreak/Relationship data"""
        print("Phase 1: Processing heartbreak/relationship data...")
        heartbreak_data = []
        heartbreak_files = list(self.input_dir.rglob("*heartbreak*.json")) + list(self.input_dir.rglob("*breakup*.json"))
        for file_path in heartbreak_files:
            data = self.process_heartbreak_data(file_path)
            heartbreak_data.extend(data)
        return heartbreak_data

    def _process_cot_phase(self) -> list:
        """Process Phase 2: CoT Reasoning data"""
        print("Phase 2: Processing CoT reasoning data...")
        consolidated_cot = Path("ai/pipelines/data/processed/phase_3_cot_reasoning/phase_3_cot_reasoning_consolidated.jsonl")
        if consolidated_cot.exists():
            return self.process_consolidated_cot(consolidated_cot)
        return []

    def _process_educational_phase(self) -> list:
        """Process Phase 3: Educational content"""
        print("Phase 3: Processing educational content...")
        edu_data = []

        whisper_files = list(self.input_dir.rglob("*whisper*.jsonl"))
        for file_path in whisper_files:
            data = self.process_whisper_transcripts(file_path)
            edu_data.extend(data)

        md_files = list(self.input_dir.rglob("*.md"))
        for file_path in md_files:
            if file_path.name != "README.md":
                data = self.process_markdown_transcripts(file_path)
                edu_data.extend(data)

        return edu_data

    def _process_priority_phase(self) -> list:
        """Process Phase 4: Priority conversations"""
        print("Phase 4: Processing priority conversations...")
        priority_data = []
        priority_files = list(Path("ai/lightning/pixelated-training/processed/phase_1_priority_conversations").rglob("*.jsonl"))
        for file_path in priority_files:
            data = self.process_jsonl_file(file_path)
            priority_data.extend(data)
            print(f"    Processed {file_path.name}: {len(data)} conversations")
        return priority_data

    def _process_professional_phase(self) -> list:
        """Process Phase 5: Professional datasets"""
        print("Phase 5: Processing professional datasets...")
        prof_data = []
        prof_files = list(Path("ai/lightning/pixelated-training/processed/phase_2_professional_datasets").rglob("*.jsonl"))
        for file_path in prof_files:
            data = self.process_jsonl_file(file_path)
            prof_data.extend(data)
            print(f"    Processed {file_path.name}: {len(data)} conversations")
        return prof_data

    def _process_pixel_voice_phase(self) -> list:
        """Process Phase 6: Pixel voice data"""
        print("Phase 6: Processing Pixel voice data...")
        pixel_data = []
        pixel_files = list(Path("ai/models/Wendy/training_data").rglob("*pixelated*.jsonl"))
        for file_path in pixel_files:
            data = self.process_jsonl_file(file_path)
            pixel_data.extend(data)
            print(f"    Processed {file_path.name}: {len(data)} conversations")
        return pixel_data

    def _create_phase_summary(self, phase_data: dict) -> dict:
        """Create summary of all phases"""
        return {
            "phase1_heartbreak": len(phase_data["heartbreak"]),
            "phase2_cot_reasoning": len(phase_data["cot"]),
            "phase3_educational": len(phase_data["educational"]),
            "phase4_priority_wayfarer": len(phase_data["priority"]),
            "phase5_professional": len(phase_data["professional"]),
            "phase6_pixel_voice": len(phase_data["pixel_voice"]),
            "total": sum(len(data) for data in phase_data.values())
        }

    def _save_phase_summary(self, summary: dict) -> Path:
        """Save phase summary to file"""
        summary_file = self.phases_dir / "phases_summary.json"
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        return summary_file

    def _print_phase_summary(self, summary: dict, summary_file: Path):
        """Print phase summary"""
        print("\nPhased processing complete:")
        print(f"  Phase 1 (Heartbreak): {summary['phase1_heartbreak']} conversations")
        print(f"  Phase 2 (CoT Reasoning): {summary['phase2_cot_reasoning']} conversations")
        print(f"  Phase 3 (Educational): {summary['phase3_educational']} conversations")
        print(f"  Phase 4 (Priority/Wayfarer): {summary['phase4_priority_wayfarer']} conversations")
        print(f"  Phase 5 (Professional): {summary['phase5_professional']} conversations")
        print(f"  Phase 6 (Pixel Voice): {summary['phase6_pixel_voice']} conversations")
        print(f"  Total: {summary['total']} conversations")
        print(f"  Summary: {summary_file}")

    def run_phased_pipeline(self):
        """Process datasets in separate phases"""
        self._backup_consolidated_file()

        # Process all phases
        heartbreak_data = self._process_heartbreak_phase()
        self._process_phase_data("Phase 1", heartbreak_data, self.phases_dir / "phase1_heartbreak.jsonl")

        cot_data = self._process_cot_phase()
        self._process_phase_data("Phase 2", cot_data, self.phases_dir / "phase2_cot_reasoning.jsonl")

        edu_data = self._process_educational_phase()
        self._process_phase_data("Phase 3", edu_data, self.phases_dir / "phase3_educational.jsonl")

        priority_data = self._process_priority_phase()
        self._process_phase_data("Phase 4", priority_data, self.phases_dir / "phase4_priority_wayfarer.jsonl")

        prof_data = self._process_professional_phase()
        self._process_phase_data("Phase 5", prof_data, self.phases_dir / "phase5_professional.jsonl")

        pixel_data = self._process_pixel_voice_phase()
        self._process_phase_data("Phase 6", pixel_data, self.phases_dir / "phase6_pixel_voice.jsonl")

        # Create and save summary
        phase_data = {
            "heartbreak": heartbreak_data,
            "cot": cot_data,
            "educational": edu_data,
            "priority": priority_data,
            "professional": prof_data,
            "pixel_voice": pixel_data
        }
        summary = self._create_phase_summary(phase_data)
        summary_file = self._save_phase_summary(summary)
        self._print_phase_summary(summary, summary_file)

    def _convert_conversation_format(self, conversation_data: dict) -> Optional[dict]:
        """Convert conversation format to messages format"""
        messages = []
        for turn in conversation_data.get("conversation", []):
            role = turn.get("role", "")
            if role == "client":
                messages.append({"role": "user", "content": turn["content"]})
            elif role == "therapist":
                messages.append({"role": "assistant", "content": turn["content"]})

        if len(messages) >= 2:
            return {"messages": messages}
        return None

    def process_jsonl_file(self, file_path: Path) -> list:
        """Process generic JSONL file"""
        results = []
        try:
            with open(file_path, encoding="utf-8") as f:
                for line in f:
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    if "messages" in data:
                        results.append(data)
                    elif "conversation" in data:
                        converted = self._convert_conversation_format(data)
                        if converted:
                            results.append(converted)
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
        return results

if __name__ == "__main__":
    processor = PhasedProcessor()
    processor.run_phased_pipeline()
