#!/usr/bin/env python3
"""
Aggressive repetition cleaner for training data.

Removes samples containing ANY repetition patterns:
- Consecutive repeated words (word word word)
- Consecutive repeated phrases (phrase, phrase, phrase)
- Synonym sequences that look mechanical
- Character repetition patterns
- N-gram loops within samples

Usage:
    python clean_repetitions_aggressive.py <input_file> <output_file> [--report]
"""

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


def detect_word_repetition(text: str) -> tuple[bool, str]:
    """Detect consecutive word repetition (e.g., 'and and and')."""
    words = text.lower().split()

    # Check for same word repeated 3+ times consecutively
    for i in range(len(words) - 2):
        if words[i] == words[i + 1] == words[i + 2]:
            return True, f"Word repetition: '{words[i]}' x3"

    # Check for same word appearing 5+ times within 10-word window
    word_positions = {}
    for i, word in enumerate(words):
        if word not in word_positions:
            word_positions[word] = []
        word_positions[word].append(i)

        # Check if this word appears 5+ times
        if len(word_positions[word]) >= 5:
            positions = word_positions[word]
            if positions[-1] - positions[0] <= 15:  # Within 15-word span
                return True, f"Word cluster: '{word}' appears {len(positions)} times in short span"

    return False, ""


def detect_phrase_repetition(text: str) -> tuple[bool, str]:
    """Detect phrase repetition (e.g., 'it is important to know that it is important to know')."""
    words = text.lower().split()

    # Check 3-grams through 6-grams
    for n in range(3, 7):
        for i in range(len(words) - n):
            phrase = " ".join(words[i : i + n])

            # Count occurrences of this phrase
            phrase_text = " ".join(words[i:])
            count = phrase_text.count(phrase)

            if count >= 2:
                return True, f"Phrase repetition: '{phrase}' x{count}"

    return False, ""


def detect_synonym_sequence(text: str) -> tuple[bool, str]:
    """
    Detect mechanical synonym sequences that look like model degeneration.
    e.g., 'crystallize separate segregate purify'
    """
    words = text.lower().split()

    # Look for patterns of 3+ similar-length words in sequence with no connecting words
    # This catches "validate verify ensure confirm" type patterns

    for i in range(len(words) - 3):
        # Check if we have 4+ consecutive words of similar length (4-10 chars)
        # that could be synonyms/related terms
        segment = words[i : i + 4]
        lengths = [len(w) for w in segment]

        # All similar length (within 2 chars)
        if max(lengths) - min(lengths) <= 2 and min(lengths) >= 4:
            # Check if these appear as a repeated pattern
            segment_str = " ".join(segment)
            if text.lower().count(segment_str) >= 2:
                return True, f"Synonym sequence: '{segment_str}'"

    # Check for repeated word sequences like "specially specially specially"
    for i in range(len(words) - 3):
        if words[i] == words[i + 1] or words[i] == words[i + 2]:
            return True, f"Word sequence repetition: '{words[i]}'"

    return False, ""


def detect_character_repetition(text: str) -> tuple[bool, str]:
    """Detect character repetition patterns (e.g., 'ssss ssss')."""

    # Single character repeated 4+ times
    if re.search(r"\b(\w)\1{3,}\b", text):
        match = re.search(r"\b(\w)\1{3,}\b", text)
        return True, f"Character repetition: '{match.group()}'"

    # Same character sequence repeated
    if re.search(r"\b(\w{2,4})\s+\1\s+\1\b", text):
        match = re.search(r"\b(\w{2,4})\s+\1\s+\1\b", text)
        return True, f"Sequence repetition: '{match.group()}'"

    return False, ""


def detect_ngram_loop(text: str) -> tuple[bool, str]:
    """Detect n-gram loops within the text."""

    # Split into sentences
    sentences = re.split(r"[.!?]\s*", text)

    # Check for repeated sentence patterns
    if len(sentences) >= 3:
        sentence_counts = Counter([s.lower().strip() for s in sentences if len(s.strip()) > 10])
        for sentence, count in sentence_counts.items():
            if count >= 2:
                return True, f"Sentence repetition: '{sentence[:50]}...' x{count}"

    # Check for repeated clause patterns
    clauses = re.split(r"[,;:]\s*", text)
    if len(clauses) >= 4:
        clause_counts = Counter([c.lower().strip() for c in clauses if len(c.strip()) > 15])
        for clause, count in clause_counts.items():
            if count >= 2:
                return True, f"Clause repetition: '{clause[:40]}...' x{count}"

    return False, ""


def detect_generated_artifacts(text: str) -> tuple[bool, str]:
    """Detect generated artifacts that indicate model degeneration."""

    artifacts = [
        # Repeated nonsense words
        (r"\b(\w{5,})\s+\1\s+\1\b", "Generated artifact: repeated word"),
        # Number/word patterns
        (r"\b\d+\s+\w+\s+\d+\s+\w+\s+\d+\s+\w+\b", "Number-word pattern"),
        # Punctuation repetition
        (r"([.!?]){3,}", "Punctuation repetition"),
        # Bracket artifacts
        (r"\[\s*\]|\(\s*\)|\{\s*\}", "Empty brackets"),
        # Citation-like artifacts
        (r"\[\d+\]\s*\[\d+\]\s*\[\d+\]", "Citation artifacts"),
    ]

    for pattern, message in artifacts:
        if re.search(pattern, text):
            match = re.search(pattern, text)
            return True, f"{message}: '{match.group()}'"

    return False, ""


def clean_sample(sample: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Check if a sample should be removed.

    Returns:
        (should_remove: bool, reasons: List[str])
    """
    # Get text from sample (handle various formats)
    text = ""
    if isinstance(sample, dict):
        text = sample.get("text", "") or sample.get("content", "") or sample.get("response", "")
        # Also check conversation format
        if "conversations" in sample:
            text = " ".join([c.get("value", "") for c in sample["conversations"]])
    elif isinstance(sample, str):
        text = sample

    if not text or len(text) < 20:
        return False, []

    reasons = []

    # Run all detectors
    detectors = [
        detect_word_repetition,
        detect_phrase_repetition,
        detect_synonym_sequence,
        detect_character_repetition,
        detect_ngram_loop,
        detect_generated_artifacts,
    ]

    for detector in detectors:
        has_issue, reason = detector(text)
        if has_issue:
            reasons.append(reason)

    return len(reasons) > 0, reasons


def clean_file(input_path: str, output_path: str, report_path: str = None) -> dict:
    """
    Clean a training data file.

    Returns stats dict with:
        - total: Total samples processed
        - removed: Samples removed
        - kept: Samples kept
        - reasons: Counter of removal reasons
    """
    print(f"\nProcessing: {input_path}")

    # Load data
    with open(input_path, "r") as f:
        if input_path.endswith(".jsonl"):
            data = [json.loads(line) for line in f if line.strip()]
        else:
            data = json.load(f)

    print(f"  Loaded {len(data)} samples")

    # Clean
    cleaned = []
    removed_samples = []
    reason_counter = Counter()

    for i, sample in enumerate(data):
        should_remove, reasons = clean_sample(sample)

        if should_remove:
            removed_samples.append({"index": i, "sample": sample, "reasons": reasons})
            for r in reasons:
                reason_counter[r.split(":")[0]] += 1
        else:
            cleaned.append(sample)

    # Save cleaned
    with open(output_path, "w") as f:
        if output_path.endswith(".jsonl"):
            for sample in cleaned:
                f.write(json.dumps(sample) + "\n")
        else:
            json.dump(cleaned, f, indent=2)

    # Save report
    if report_path:
        report = {
            "input_file": input_path,
            "output_file": output_path,
            "total": len(data),
            "removed": len(removed_samples),
            "kept": len(cleaned),
            "removal_rate": len(removed_samples) / len(data) * 100 if data else 0,
            "reasons": dict(reason_counter),
            "removed_samples": removed_samples[:20],  # First 20 for review
        }
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

    stats = {
        "total": len(data),
        "removed": len(removed_samples),
        "kept": len(cleaned),
        "reasons": dict(reason_counter),
    }

    print(f"  Removed: {stats['removed']} ({stats['removed'] / stats['total'] * 100:.1f}%)")
    print(f"  Kept: {stats['kept']}")
    if stats["reasons"]:
        print(f"  Top reasons: {stats['reasons']}")

    return stats


def main():
    parser = argparse.ArgumentParser(description="Aggressive repetition cleaner")
    parser.add_argument("input", help="Input file or directory")
    parser.add_argument("output", help="Output file or directory")
    parser.add_argument("--report", help="Report output file")
    parser.add_argument(
        "--dry-run", action="store_true", help="Show what would be removed without saving"
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if input_path.is_dir():
        # Process all JSON/JSONL files in directory
        output_path.mkdir(parents=True, exist_ok=True)

        total_stats = {"total": 0, "removed": 0, "kept": 0}

        for file in input_path.glob("*.json*"):
            out_file = output_path / f"{file.stem}_cleaned{file.suffix}"
            report_file = output_path / f"{file.stem}_report.json" if args.report else None

            stats = clean_file(str(file), str(out_file), report_file)

            total_stats["total"] += stats["total"]
            total_stats["removed"] += stats["removed"]
            total_stats["kept"] += stats["kept"]

        print(f"\n{'=' * 60}")
        print(f"TOTAL: {total_stats['total']} samples")
        print(
            f"Removed: {total_stats['removed']} ({total_stats['removed'] / total_stats['total'] * 100:.1f}%)"
        )
        print(f"Kept: {total_stats['kept']}")

    else:
        # Process single file
        clean_file(str(input_path), str(output_path), args.report)


if __name__ == "__main__":
    main()
