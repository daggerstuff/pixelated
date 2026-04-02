#!/usr/bin/env python3
"""
Process datasets/training_v3/ directory from S3
Organized by training stages for mental health AI
"""
import json
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from ai.pipelines.orchestrator.unified_preprocessing_pipeline import UnifiedPreprocessingPipeline


def main():

    # S3 paths for training_v3 datasets
    s3_datasets = [
        # Stage 1: Foundation
        "s3://pixel-data/datasets/training_v3/stage1_foundation/Amod_mental_health_counseling_conversations.jsonl",
        "s3://pixel-data/datasets/training_v3/stage1_foundation/heliosbrahma_mental_health_chatbot_dataset.jsonl",

        # Stage 2: Specialist
        "s3://pixel-data/datasets/training_v3/stage2_specialist_addiction/fadodr_mental_health_therapy.jsonl",
        "s3://pixel-data/datasets/training_v3/stage2_specialist_personality/Kanakmi_mental-disorders.jsonl",

        # Stage 4: Voice/Persona
        "s3://pixel-data/datasets/training_v3/stage4_voice_persona/NousResearch_CharacterCodex.jsonl",
        "s3://pixel-data/datasets/training_v3/stage4_voice_persona/google_Synthetic-Persona-Chat.jsonl",
        "s3://pixel-data/datasets/training_v3/stage4_voice_persona/hieunguyenminh_roleplay.jsonl",
        "s3://pixel-data/datasets/training_v3/stage4_voice_persona/nazlicanto_persona-based-chat.jsonl",
    ]


    pipeline = UnifiedPreprocessingPipeline(
        quality_threshold=0.6,
        enable_deduplication=True,
        enable_safety_checks=True
    )

    # Output path
    output_dir = Path("ai/training/ready_packages/datasets/cache/orchestrator_output")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "training_v3_combined.jsonl"

    # Process all datasets and combine
    total_processed = 0
    all_records = []

    for _i, s3_path in enumerate(s3_datasets, 1):
        s3_path.split("/")[-1].replace(".jsonl", "")

        try:
            # Process this S3 dataset
            result = pipeline.process_dataset_stream(s3_path)

            if result and "processed_records" in result:
                count = len(result["processed_records"])
                all_records.extend(result["processed_records"])
                total_processed += count
            else:
                pass

        except Exception:
            continue

    # Write combined output
    with open(output_path, "w") as f:
        for record in all_records:
            f.write(json.dumps(record) + "\n")


if __name__ == "__main__":
    main()
