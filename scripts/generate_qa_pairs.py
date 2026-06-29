#!/usr/bin/env python3
"""
Convert chunked transcript data into high-quality therapeutic QA pairs.

Strategy:
1. Group transcript chunks by source video/topic
2. Reconstruct longer passages from chunks
3. Generate realistic therapeutic QA pairs using structured prompts
4. Validate quality with clinical validity scorer
5. Deduplicate and package

This is NOT a quick batch job - it requires careful processing and review.
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path


def load_transcript_data(data_dir: Path) -> dict[str, list[dict]]:
    """Load all transcript chunks grouped by channel."""
    channel_data = defaultdict(list)

    for jsonl_file in data_dir.glob("*.jsonl"):
        channel_name = jsonl_file.stem
        with open(jsonl_file) as f:
            for line in f:
                if line.strip():
                    try:
                        record = json.loads(line)
                        channel_data[channel_name].append(record)
                    except json.JSONDecodeError:
                        continue

    return dict(channel_data)


def reconstruct_passages(records: list[dict], max_words: int = 500) -> list[str]:
    """Reconstruct longer passages from chunked records."""
    # Sort by chunk index if available
    sorted_records = sorted(records, key=lambda x: x.get("provenance", {}).get("metadata", {}).get("chunk_index", 0))

    passages = []
    current_passage = []
    current_word_count = 0

    for record in sorted_records:
        text = record.get("output", "").strip()
        if not text:
            continue

        word_count = len(text.split())

        if current_word_count + word_count > max_words and current_passage:
            # Save current passage and start new one
            passages.append(" ".join(current_passage))
            current_passage = [text]
            current_word_count = word_count
        else:
            current_passage.append(text)
            current_word_count += word_count

    # Don't forget the last passage
    if current_passage:
        passages.append(" ".join(current_passage))

    return passages


def generate_qa_pair(passage: str, channel_name: str) -> dict | None:
    """Generate小龙Generate a therapeutic QA pair from a passage.

    This is a placeholder - in production, this would use an LLM
    to generate realistic therapeutic conversations.
    """
    # For now, create a simple extraction-based pair
    # In production, replace with LLM call

    # Simple heuristic: if passage contains a question, use it
    sentences = passage.split(". ")
    questions = [s for s in sentences if "?" in s]

    if questions:
        instruction = questions[0].strip() + "?"
        # Use the rest as output
        output = passage[len(instruction) :].strip()
        if len(output) < 50:
            return None
    else:
        # Create a generic therapeutic question based on content
        instruction = f"Based on insights from {channel_name}, what therapeutic approach might help someone dealing with similar challenges?"
        output = passage

    return {
        "instruction": instruction,
        "output": output,
        "source_channel": channel_name,
        "source_passage": passage[:200] + "..." if len(passage) > 200 else passage,
        "generation_method": "extraction_heuristic",
        "quality_score": 0.0,  # To be filled by scorer
    }


def main():
    parser = argparse.ArgumentParser(description="Generate QA pairs from transcript data")
    parser.add_argument("--input-dir", type=Path, default=Path("data/therapeutic"))
    parser.add_argument("--output", type=Path, default=Path("data/qa_pairs.jsonl"))
    parser.add_argument("--max-pairs", type=int, default=1000, help="Maximum pairs to generate (for testing)")
    parser.add_argument("--sample", action="store_true", help="Generate a small sample for review")
    args = parser.parse_args()

    channel_data = load_transcript_data(args.input_dir)

    sum(len(records) for records in channel_data.values())

    if args.sample:
        # Generate a small sample for review
        sample_pairs = []
        for channel_name, records in list(channel_data.items())[:3]:
            passages = reconstruct_passages(records[:100])  # Limit for sample
            for passage in passages[:5]:  # 5 passages per channel
                pair = generate_qa_pair(passage, channel_name)
                if pair:
                    sample_pairs.append(pair)

        output_path = args.output.parent / "qa_pairs_sample.jsonl"
        with open(output_path, "w") as f:
            for pair in sample_pairs:
                f.write(json.dumps(pair) + "\n")

    else:
        # Full generation
        all_pairs = []
        for channel_name, records in channel_data.items():
            passages = reconstruct_passages(records)
            for passage in passages:
                pair = generate_qa_pair(passage, channel_name)
                if pair:
                    all_pairs.append(pair)

                if len(all_pairs) >= args.max_pairs:
                    break

            if len(all_pairs) >= args.max_pairs:
                break

        with open(args.output, "w") as f:
            for pair in all_pairs:
                f.write(json.dumps(pair) + "\n")


if __name__ == "__main__":
    main()
