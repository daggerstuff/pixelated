#!/usr/bin/env python3
"""
Build high-quality therapeutic QA pairs from original transcript files.
"""

import argparse
import json
import re
from pathlib import Path


def parse_transcript_file(file_path: Path) -> dict | None:
    """Parse a transcript markdown file into structured data."""
    try:
        content = file_path.read_text(encoding="utf-8")
        lines = content.split("\n")

        # Extract title from first line
        title = lines[0].replace("# ", "").strip() if lines else file_path.stem

        # Extract channel - look for "**Channel:**" pattern
        channel = "Unknown"
        for line in lines[:10]:  # Check first 10 lines
            if "**Channel:**" in line:
                # Extract text between "**Channel:**" and "**Source:**"
                match = re.search(r"\*\*Channel:\*\*\s*([^*]+)", line)
                if match:
                    channel = match.group(1).strip()
                break

        # Find the transcript section
        transcript_start = None
        for i, line in enumerate(lines):
            if line.strip() == "## Transcript":
                transcript_start = i + 1
                break

        if transcript_start is None:
            # Try to find where actual content starts (after metadata)
            for i, line in enumerate(lines):
                if line.strip().startswith("Well ") or line.strip().startswith("So "):
                    transcript_start = i
                    break

        if transcript_start is None:
            return None

        # Extract transcript text
        transcript_lines = []
        for line in lines[transcript_start:]:
            stripped = line.strip()
            if not stripped:
                continue
            # Skip remaining markdown
            if stripped.startswith("#") or stripped.startswith("**Source:") or stripped.startswith("**Date:"):
                continue
            transcript_lines.append(stripped)

        transcript_text = " ".join(transcript_lines)
        # Clean up extra whitespace
        transcript_text = re.sub(r"\s+", " ", transcript_text)

        return {"title": title, "channel": channel, "content": transcript_text, "source_file": str(file_path)}
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return None


def create_passages(text: str, min_words: int = 200, max_words: int = 800) -> list[str]:
    """Create coherent passages from transcript text."""
    # Split into sentences
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip() and len(s) > 10]

    passages = []
    current_passage = []
    current_word_count = 0

    for sentence in sentences:
        word_count = len(sentence.split())

        if current_word_count + word_count > max_words and current_passage:
            passages.append(" ".join(current_passage))
            current_passage = [sentence]
            current_word_count = word_count
        else:
            current_passage.append(sentence)
            current_word_count += word_count

        if current_word_count >= min_words:
            passages.append(" ".join(current_passage))
            current_passage = []
            current_word_count = 0

    # Add remaining
    if current_passage:
        text = " ".join(current_passage)
        if len(text.split()) >= min_words // 3:
            passages.append(text)

    return passages


def generate_qa_pair(passage: str, transcript: dict) -> dict | None:
    """Generate a QA pair from a passage."""
    if len(passage) < 150:
        return None

    return {
        "instruction": f"Based on insights from {transcript['channel']}, reflect on the following therapeutic perspective:",
        "output": passage,
        "source": {"title": transcript["title"], "channel": transcript["channel"], "file": transcript["source_file"]},
        "metadata": {"passage_length_words": len(passage.split()), "generation_method": "transcript_extraction_v3"},
    }


def main():
    parser = argparse.ArgumentParser(description="Build QA dataset from transcripts")
    parser.add_argument("--transcript-dir", type=Path, default=Path("ai/data/transcripts/ingested"))
    parser.add_argument("--output", type=Path, default=Path("data/qa_pairs_v3.jsonl"))
    parser.add_argument("--sample", action="store_true")
    parser.add_argument("--max-files", type=int, default=None)
    args = parser.parse_args()

    transcript_files = list(args.transcript_dir.glob("*.md"))
    print(f"Found {len(transcript_files)} transcript files")

    if args.max_files:
        transcript_files = transcript_files[: args.max_files]

    all_pairs = []
    for i, file_path in enumerate(transcript_files):
        transcript = parse_transcript_file(file_path)
        if not transcript or not transcript["content"].strip():
            print(f"Skipping {file_path.name} - no content")
            continue

        passages = create_passages(transcript["content"])
        for passage in passages:
            pair = generate_qa_pair(passage, transcript)
            if pair:
                all_pairs.append(pair)

        if (i + 1) % 10 == 0 or (args.sample and i < 5):
            print(f"Processed {i + 1}/{len(transcript_files)} files, {len(all_pairs)} pairs")
            if args.sample and i >= 4:
                break

    # Write output
    with open(args.output, "w") as f:
        for pair in all_pairs:
            f.write(json.dumps(pair) + "\n")

    print(f"\nGenerated {len(all_pairs)} QA pairs")
    print(f"Saved to {args.output}")

    if args.sample and all_pairs:
        print("\n=== SAMPLE ===")
        for i, pair in enumerate(all_pairs[:3], 1):
            print(f"\nPair {i}:")
            print(f"  Channel: {pair['source']['channel']}")
            print(f"  Instruction: {pair['instruction']}")
            print(f"  Output (first 300 chars): {pair['output'][:300]}")


if __name__ == "__main__":
    main()
