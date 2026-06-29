#!/usr/bin/env python3
"""
Build high-quality therapeutic QA pairs from original transcript files.
"""

import argparse
import json
import re
from pathlib import Path


def extract_transcript_text(content: str) -> str:
    """Extract clean transcript text from markdown file."""
    lines = content.split("\n")
    in_transcript = False
    transcript_lines = []

    for line in lines:
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            continue

        # Skip markdown headers
        if stripped.startswith("#"):
            # Check if this is the transcript section header
            if "transcript" in stripped.lower():
                in_transcript = True
            continue

        # Skip metadata lines
        if stripped.startswith(("**Channel:**", "**Source:**", "**Date:**")):
            continue

        # Skip bold markers
        stripped = stripped.replace("**", "")

        # If we haven't hit the transcript section yet, skip
        if not in_transcript and "transcript" not in stripped.lower():
            continue

        # Skip lines that are just URLs or file paths
        if stripped.startswith(("local://", "http")):
            continue

        transcript_lines.append(stripped)

    return "\n".join(transcript_lines)


def load_and_clean_transcript(file_path: Path) -> dict | None:
    """Load and clean a transcript file."""
    try:
        content = file_path.read_text(encoding="utf-8")

        # Extract title from first header
        title_match = re.search(r"^# (.+)$", content, re.MULTILINE)
        title = title_match.group(1) if title_match else file_path.stem

        # Extract channel from metadata
        channel_match = re.search(r"\*\*Channel:\*\* (.+)$", content, re.MULTILINE)
        channel = channel_match.group(1).strip() if channel_match else "Unknown"

        # Extract clean text
        clean_text = extract_transcript_text(content)

        return {"title": title, "channel": channel, "content": clean_text, "source_file": str(file_path)}
    except Exception:
        return None


def create_passages(text: str, min_words: int = 150, max_words: int = 600) -> list[str]:
    """Create coherent passages from transcript text."""
    # Split into sentences
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

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

    # Add remaining sentences
    if current_passage:
        text = " ".join(current_passage)
        if len(text.split()) >= min_words // 3:
            passages.append(text)

    return passages


def generate_qa_pair(passage: str, transcript: dict) -> dict | None:
    """Generate a QA pair from a passage."""
    # Simple approach: create a reflective therapeutic prompt
    # In production, this would use an LLM for better quality

    # Extract key themes from first few sentences
    sentences = re.split(r"(?<=[.!?])\s+", passage)
    " ".join(sentences[:3]) if len(sentences) >= 3 else passage

    # Create instruction based on content
    instruction = f"Based on insights from {transcript['channel']}, reflect on the following therapeutic perspective:"

    # Validate quality
    if len(passage) < 100:
        return None

    return {
        "instruction": instruction,
        "output": passage,
        "source": {"title": transcript["title"], "channel": transcript["channel"], "file": transcript["source_file"]},
        "metadata": {"passage_length_words": len(passage.split()), "generation_method": "transcript_extraction_v2"},
    }


def main():
    parser = argparse.ArgumentParser(description="Build QA dataset from transcripts")
    parser.add_argument("--transcript-dir", type=Path, default=Path("ai/data/transcripts/ingested"))
    parser.add_argument("--output", type=Path, default=Path("data/qa_pairs_v2.jsonl"))
    parser.add_argument("--sample", action="store_true", help="Show sample output")
    parser.add_argument("--max-files", type=int, default=None)
    args = parser.parse_args()

    transcript_files = list(args.transcript_dir.glob("*.md"))

    if args.max_files:
        transcript_files = transcript_files[: args.max_files]

    all_pairs = []
    for i, file_path in enumerate(transcript_files):
        transcript = load_and_clean_transcript(file_path)
        if not transcript or not transcript["content"].strip():
            continue

        passages = create_passages(transcript["content"])
        for passage in passages:
            pair = generate_qa_pair(passage, transcript)
            if pair:
                all_pairs.append(pair)

        if ((i + 1) % 10 == 0 or args.sample) and args.sample:
            break

    # Write output
    with open(args.output, "w") as f:
        for pair in all_pairs:
            f.write(json.dumps(pair) + "\n")

    if args.sample and all_pairs:
        for i, pair in enumerate(all_pairs[:2], 1):
            pass


if __name__ == "__main__":
    main()
