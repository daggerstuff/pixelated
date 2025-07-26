#!/usr/bin/env python3
"""
Validate and filter conversational datasets using the ai/dataset_pipeline.

- Loads a dataset of conversations (JSONL or JSON)
- Runs quality assessment (emotional authenticity, therapeutic accuracy, language quality)
- Applies configurable thresholds and deduplication
- Outputs a filtered, validated dataset and a report

Usage:
    python scripts/validate_dataset.py --input input.jsonl --output output.jsonl --report report.json
"""

import argparse
import json
from pathlib import Path

from ai.dataset_pipeline.conversation_schema import Conversation
from ai.dataset_pipeline.deduplication import deduplicate_conversations
from ai.dataset_pipeline.quality_filter import filter_conversations


def load_conversations(path: Path) -> list[Conversation]:
    conversations = []
    if path.suffix == ".jsonl":
        with open(path, encoding="utf-8") as f:
            for line in f:
                data = json.loads(line)
                conversations.append(Conversation(**data))
    elif path.suffix == ".json":
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                conversations.append(Conversation(**item))
    else:
        raise ValueError("Input file must be .jsonl or .json")
    return conversations


def save_conversations(convs: list[Conversation], path: Path):
    with open(path, "w", encoding="utf-8") as f:
        for conv in convs:
            f.write(json.dumps(conv.dict(), ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Validate and filter conversational datasets.")
    parser.add_argument(
        "--input", type=str, required=True, help="Input dataset file (.jsonl or .json)"
    )
    parser.add_argument(
        "--output", type=str, required=True, help="Output filtered dataset (.jsonl)"
    )
    parser.add_argument("--report", type=str, required=True, help="Output report file (.json)")
    parser.add_argument(
        "--emotional-threshold", type=float, default=0.5, help="Emotional authenticity threshold"
    )
    parser.add_argument(
        "--therapeutic-threshold", type=float, default=0.5, help="Therapeutic accuracy threshold"
    )
    parser.add_argument(
        "--language-threshold", type=float, default=0.5, help="Language quality threshold"
    )
    parser.add_argument(
        "--dedup-threshold", type=float, default=0.9, help="Deduplication similarity threshold"
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    report_path = Path(args.report)

    conversations = load_conversations(input_path)
    print(f"Loaded {len(conversations)} conversations from {input_path}")

    # Deduplicate
    unique_convs, duplicates = deduplicate_conversations(
        conversations, similarity_threshold=args.dedup_threshold
    )
    print(f"Deduplicated: {len(conversations) - len(unique_convs)} duplicates removed")

    # Filter by quality
    thresholds = {
        "emotional": args.emotional_threshold,
        "therapeutic": args.therapeutic_threshold,
        "language": args.language_threshold,
    }
    results = filter_conversations(unique_convs, thresholds)
    passed = [r["conversation"] for r in results if r["passed"]]
    print(f"Filtered: {len(passed)} conversations passed quality thresholds")

    # Save filtered dataset
    save_conversations(passed, output_path)
    print(f"Saved filtered dataset to {output_path}")

    # Save report
    report = {
        "input_count": len(conversations),
        "unique_count": len(unique_convs),
        "filtered_count": len(passed),
        "duplicates": duplicates,
        "filter_results": [
            {
                "idx": i,
                "emotional_score": r["emotional_score"],
                "therapeutic_score": r["therapeutic_score"],
                "language_score": r["language_score"],
                "passed": r["passed"],
                "issues": r["issues"],
            }
            for i, r in enumerate(results)
        ],
    }
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Saved validation report to {report_path}")


if __name__ == "__main__":
    main()
