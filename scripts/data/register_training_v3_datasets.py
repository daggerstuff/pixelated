#!/usr/bin/env python3
"""
Register datasets/training_v3/ S3 datasets to the dataset registry
So the unified preprocessing pipeline can discover and process them
"""
import json
from pathlib import Path

def main():
    registry_path = Path("ai/data/dataset_registry.json")
    
    # Load existing registry
    with open(registry_path) as f:
        registry = json.load(f)
    
    # S3 datasets to add
    training_v3_datasets = {
        "stage1_foundation_mental_health_counseling": {
            "path": "s3://pixel-data/datasets/training_v3/stage1_foundation/Amod_mental_health_counseling_conversations.jsonl",
            "stage": "stage1_foundation",
            "category": "therapeutic",
            "enabled": True,
            "priority": "high"
        },
        "stage1_foundation_chatbot": {
            "path": "s3://pixel-data/datasets/training_v3/stage1_foundation/heliosbrahma_mental_health_chatbot_dataset.jsonl",
            "stage": "stage1_foundation",
            "category": "therapeutic",
            "enabled": True,
            "priority": "high"
        },
        "stage2_specialist_addiction_therapy": {
            "path": "s3://pixel-data/datasets/training_v3/stage2_specialist_addiction/fadodr_mental_health_therapy.jsonl",
            "stage": "stage2_specialist",
            "category": "therapeutic",
            "enabled": True,
            "priority": "medium"
        },
        "stage2_specialist_mental_disorders": {
            "path": "s3://pixel-data/datasets/training_v3/stage2_specialist_personality/Kanakmi_mental-disorders.jsonl",
            "stage": "stage2_specialist",
            "category": "therapeutic",
            "enabled": True,
            "priority": "medium"
        },
        "stage4_voice_character_codex": {
            "path": "s3://pixel-data/datasets/training_v3/stage4_voice_persona/NousResearch_CharacterCodex.jsonl",
            "stage": "stage4_voice",
            "category": "persona",
            "enabled": True,
            "priority": "low"
        },
        "stage4_voice_synthetic_persona": {
            "path": "s3://pixel-data/datasets/training_v3/stage4_voice_persona/google_Synthetic-Persona-Chat.jsonl",
            "stage": "stage4_voice",
            "category": "persona",
            "enabled": True,
            "priority": "low"
        },
        "stage4_voice_roleplay": {
            "path": "s3://pixel-data/datasets/training_v3/stage4_voice_persona/hieunguyenminh_roleplay.jsonl",
            "stage": "stage4_voice",
            "category": "persona",
            "enabled": True,
            "priority": "low"
        },
        "stage4_voice_persona_chat": {
            "path": "s3://pixel-data/datasets/training_v3/stage4_voice_persona/nazlicanto_persona-based-chat.jsonl",
            "stage": "stage4_voice",
            "category": "persona",
            "enabled": True,
            "priority": "low"
        },
    }
    
    # Add to registry under appropriate category
    if "datasets" not in registry:
        registry["datasets"] = {}
    if "training_v3" not in registry["datasets"]:
        registry["datasets"]["training_v3"] = {}
    
    # Merge new datasets
    registry["datasets"]["training_v3"].update(training_v3_datasets)
    
    # Save updated registry
    with open(registry_path, 'w') as f:
        json.dump(registry, f, indent=2)
    
    print(f"✅ Registered {len(training_v3_datasets)} training_v3 datasets")
    print(f"📄 Registry updated: {registry_path}")
    print(f"\nTotal datasets in registry: {sum(len(v) if isinstance(v, dict) else 0 for v in registry.get('datasets', {}).values())}")

if __name__ == "__main__":
    main()
