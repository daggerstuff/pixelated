#!/usr/bin/env python3
"""
Build high-quality therapeutic QA pairs from original transcript files.

This script:
1. Reads original transcript markdown files
2. Extracts clean transcript text
3. Segments into logical passages by topic
4. Generates realistic therapeutic QA pairs
5. Validates quality
6. Outputs clean JSONL for training

Quality controls:
- Passages must be complete sentences (no mid-sentence breaks)
- QA pairs must have realistic therapeutic questions
- Output must be validated with clinical scorer
- Manual review samples before full run
"""

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Transcript:
    """Represents a cleaned transcript."""

    title: str
    channel: str
    content: str
    source_file: str


def clean_transcript(text: str) -> str:
    """Extract clean transcript text from markdown."""
    # Remove markdown headers
    text = re.sub(r"^#+ .*$", "", text, flags=re.MULTILINE)
    # Remove bold markers
    text = re.sub(r"\*\*", "", text)
    # Remove channel/source metadata lines
    text = re.sub(r"^\*\*Channel:.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\*\*Source:.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\*\*Date:.*$", "", text, flags=re.MULTILINE)
    # Remove "## Transcript" header
    text = re.sub(r"^## Transcript$", "", text, flags=re.MULTILINE)
    # Clean up extra whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def load_transcript(file_path: Path) -> Transcript | None:
    """Load and clean a transcript file."""
    try:
        content = file_path.read_text(encoding="utf-8")

        # Extract title from first header
        title_match = re.search(r"^# (.+)$", content, re.MULTILINE)
        title = title_match.group(1) if title_match else file_path.stem

        # Extract channel
        channel_match = re.search(r"\*\*Channel:\*\* (.+)$", content, re.MULTILINE)
        channel = channel_match.group(1).strip() if channel_match else "Unknown"

        # Clean the content
        clean_text = clean_transcript(content)

        return Transcript(title=title, channel=channel, content=clean_text, source_file=str(file_path))
    except Exception:
        return None


def segment_into_passages(text: str, min_words: int = 100, max_words: int = 500) -> list[str]:
    """Segment transcript into logical passages.

    Uses paragraph breaks and sentence boundaries to create
    coherent passages of complete thoughts.
    """
    # Split into paragraphs
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    passages = []
    current_passage = []
    current_word_count = 0

    for paragraph in paragraphs:
        words = paragraph.split()
        word_count = len(words)

        # If adding this paragraph would exceed max, save current and start new
        if current_word_count + word_count > max_words and current_passage:
            passages.append(" ".join(current_passage))
            current_passage = [paragraph]
            current_word_count = word_count
        else:
            current_passage.append(paragraph)
            current_word_count += word_count

        # If current passage is big enough, save it
        if current_word_count >= min_words:
            passages.append(" ".join(current_passage))
            current_passage = []
            current_word_count = 0

    # Don't forget the last passage
    if current_passage:
        final_text = " ".join(current_passage)
        if len(final_text.split()) >= min_words // 2:  # Allow shorter for last passage
            passages.append(final_text)

    return passages


def generate_qa_pair(passage: str, transcript: Transcript) -> dict | None:
    """Generate a therapeutic QA pair from a passage.

    Creates realistic therapeutic conversation based on the content.
    """
    # Simple extraction-based approach for now
    # In production, this would use an LLM for higher quality

    # Try to find a question in the passage
    sentences = re.split(r"(?<=[.!?])\s+", passage)
    questions = [s for s in sentences if "?" in s and len(s) > 20]

    if questions:
        # Use the first real question as instruction
        instruction = questions[0].strip()
        # Use surrounding context as output
        question_idx = sentences.index(questions[0])
        start_idx = max(0, question_idx - 2)
        end_idx = min(len(sentences), question_idx + 5)
        output = " ".join(sentences[start_idx:end_idx]).strip()

        # Clean up - remove the question from output if it's at the start
        if output.startswith(instruction):
            output = output[len(instruction) :].strip()
    else:
        # No question found - create a reflective prompt
        instruction = f"Reflect on the following insights about {transcript.channel.split()[0] if transcript.channel else 'therapeutic'} approaches:"
        output = passage[:800]  # Limit length

    # Validate minimum quality
    if len(output) < 100:
        return None

    return {
        "instruction": instruction,
        "output": output,
        " Conversational_context": {
            "source_title": transcript.title,
            "source_channel": transcript.channel,
            "source_file": transcript.source_file,
            "passage_length_words": len(passage.split()),
        },
        "generation_method": "transcript_extraction",
        "quality_score": 0.0,  # To be filled by scorer
    }


def main():
    parser = argparse.ArgumentParser(description="Build QA dataset from transcripts")
    parser.add_argument("--transcript-dir", type=Path, default=Path("ai/data/transcripts/ingested"))
    parser.add_argument("--output", type=Path, default=Path("ai/data/qa_pairs_proper.jsonl"))
    parser.add_argument("--sample", action="store_true", help="Generate small sample for review")
    parser.add_argument("--max-files", type=int, default=None, help="Limit files processed")
    args = parser.parse_args()

    # Find all transcript files
    transcript_files = list(args.transcript_dir.glob("*.md"))

    if args.max_files:
        transcript_files = transcript_files[: args.max_files]

    # Process transcripts
    all_pairs = []
    for i, file_path in enumerate(transcript_files):
        transcript = load_transcript(file_path)
        if not transcript:
            continue

        passages = segment_into_passages(transcript.content)
        for passage in passages:
            pair = generate_qa_pair(passage, transcript)
            if pair:
                all_pairs.append(pair)

        if (i + 1) % 10 == 0:
            pass

    # Write output
    with open(args.output, "w") as f:
        for pair in all_pairs:
            f.write(json.dumps(pair) + "\n")

    if args.sample and all_pairs:
        for i, pair in enumerate(all_pairs[:3], 1):
            pass


if __name__ == "__main__":
    main()
