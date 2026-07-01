#!/usr/bin/env python3
"""
Data cleaning script to detect and remove repetitive samples from training data.

Repetitive patterns in training data can cause the model to learn degenerate
repetition loops during inference. This script detects and removes such samples.

Usage:
    uv run python scripts/training/clean_repetitions.py \
        --input ai/training/ready_packages/datasets/cache/training_v3_converted/stage1_foundation_counseling.jsonl \
        --output ai/training/ready_packages/datasets/cleaned_training_data.jsonl \
        --verbose
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


def detect_ngram_repetitions(text: str, n: int = 3, threshold: int = 3) -> tuple[bool, list[str]]:
    """
    Detect if text has n-gram repeated threshold+ times.

    Args:
        text: Text to analyze
        n: Size of n-gram (default 3 = trigram)
        threshold: Number of consecutive repeats to flag (default 3)

    Returns:
        Tuple of (has_repetition: bool, repeated_phrases: List[str])
    """
    words = text.split()
    if len(words) < n:
        return False, []

    repeated_phrases = set()

    # Check for consecutive repeated n-grams
    for i in range(len(words) - n * threshold):
        ngram = " ".join(words[i : i + n])
        # Check if this ngram repeats consecutively
        pattern = (ngram + " ") * threshold
        if pattern.strip() in text:
            repeated_phrases.add(ngram)

    # Also check with regex for more flexibility
    # Pattern: word sequence repeated 3+ times
    pattern = r"\b((?:\w+\s+){2,5})\1{2,}"
    matches = re.findall(pattern, text, re.IGNORECASE)
    for match in matches:
        repeated_phrases.add(match.strip())

    return len(repeated_phrases) > 0, list(repeated_phrases)


def detect_char_repetitions(text: str, min_len: int = 4, threshold: int = 5) -> tuple[bool, list[str]]:
    """
    Detect repeated character sequences (e.g., "aaaaaa", "!!!!!!").

    Args:
        text: Text to analyze
        min_len: Minimum length of repeated sequence
        threshold: Minimum number of repeats

    Returns:
        Tuple of (has_repetition: bool, sequences: List[str])
    """
    sequences = []

    # Single character repeats
    pattern = r"(.)\1{" + str(threshold) + r",}"
    matches = re.findall(pattern, text)
    if matches:
        sequences.extend(matches)

    # Multi-character repeats (e.g., "haha haha haha")
    pattern = r"(\b\w{2,}\b)(?:\s+\1){2,}"
    matches = re.findall(pattern, text, re.IGNORECASE)
    if matches:
        sequences.extend(matches)

    return len(sequences) > 0, sequences


def detect_word_repetitions(text: str, threshold: int = 4) -> tuple[bool, list[str]]:
    """
    Detect same word repeated many times consecutively.

    Args:
        text: Text to analyze
        threshold: Minimum number of consecutive repeats

    Returns:
        Tuple of (has_repetition: bool, words: List[str])
    """
    words = text.split()
    repeated_words = []

    current_word = None
    count = 0

    for word in words:
        word_lower = word.lower().strip('.,!?;:"')
        if word_lower == current_word:
            count += 1
        else:
            if count >= threshold:
                repeated_words.append(current_word)
            current_word = word_lower
            count = 1

    # Check last sequence
    if count >= threshold:
        repeated_words.append(current_word)

    return len(repeated_words) > 0, repeated_words


def analyze_sample(sample: dict[str, Any]) -> dict[str, Any]:
    """
    Analyze a training sample for repetition issues.

    Args:
        sample: Training sample dict with 'messages' key

    Returns:
        Dict with analysis results
    """
    result = {
        "has_repetitions": False,
        "issues": [],
        "sample_preview": None,
    }

    # Extract text from messages format
    if "messages" in sample:
        texts = []
        for msg in sample["messages"]:
            if "content" in msg:
                texts.append(msg["content"])
        text = " ".join(texts)
    elif "text" in sample:
        text = sample["text"]
    elif "content" in sample:
        text = sample["content"]
    elif "dialog" in sample:
        text = sample["dialog"]
    else:
        return result

    # Truncate for preview
    result["sample_preview"] = text[:200] + "..." if len(text) > 200 else text

    # Check n-gram repetitions
    has_ngram, ngrams = detect_ngram_repetitions(text)
    if has_ngram:
        result["has_repetitions"] = True
        result["issues"].append(
            {
                "type": "ngram_repetition",
                "details": ngrams[:5],  # Limit to first 5
            }
        )

    # Check character repetitions
    has_char, chars = detect_char_repetitions(text)
    if has_char:
        result["has_repetitions"] = True
        result["issues"].append({"type": "char_repetition", "details": chars[:5]})

    # Check word repetitions
    has_word, words = detect_word_repetitions(text)
    if has_word:
        result["has_repetitions"] = True
        result["issues"].append({"type": "word_repetition", "details": words[:5]})

    return result


def clean_jsonl_file(
    input_path: str, output_path: str, verbose: bool = False, dry_run: bool = False
) -> tuple[int, int, list[dict]]:
    """
    Clean a JSONL file by removing samples with repetitions.

    Args:
        input_path: Path to input JSONL file
        output_path: Path to output JSONL file
        verbose: Print detailed progress
        dry_run: Don't write output, just report

    Returns:
        Tuple of (kept_count, removed_count, removed_samples)
    """
    input_file = Path(input_path)
    output_file = Path(output_path)

    if not input_file.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Create output directory
    output_file.parent.mkdir(parents=True, exist_ok=True)

    cleaned = []
    removed = []
    removed_samples = []

    with open(input_file) as f:
        lines = f.readlines()

    total = len(lines)

    for i, line in enumerate(lines):
        if not line.strip():
            continue

        try:
            sample = json.loads(line)
        except json.JSONDecodeError:
            if verbose:
                pass
            continue

        analysis = analyze_sample(sample)

        if analysis["has_repetitions"]:
            removed.append(sample)
            removed_samples.append({"line": i + 1, "preview": analysis["sample_preview"], "issues": analysis["issues"]})
            if verbose:
                pass
        else:
            cleaned.append(sample)

    # Write output
    if not dry_run:
        with open(output_file, "w") as f:
            for sample in cleaned:
                f.write(json.dumps(sample) + "\n")

        # Also write removed samples report
        report_file = output_file.with_suffix(".removed.json")
        with open(report_file, "w") as f:
            json.dump(
                {
                    "total_samples": total,
                    "kept": len(cleaned),
                    "removed": len(removed),
                    "removed_samples": removed_samples,
                },
                f,
                indent=2,
            )

    return len(cleaned), len(removed), removed_samples


def main():
    parser = argparse.ArgumentParser(description="Clean training data by removing repetitive samples")
    parser.add_argument("--input", "-i", required=True, help="Input JSONL file path")
    parser.add_argument("--output", "-o", default="cleaned_output.jsonl", help="Output JSONL file path")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print detailed progress")
    parser.add_argument("--dry-run", action="store_true", help="Don't write output, just report statistics")
    parser.add_argument("--analyze-only", action="store_true", help="Only analyze and report, don't clean")

    args = parser.parse_args()

    if args.analyze_only:
        # Just analyze and report
        input_file = Path(args.input)
        if not input_file.exists():
            sys.exit(1)

        with open(input_file) as f:
            lines = f.readlines()

        issues_found = 0
        for _i, line in enumerate(lines):
            if not line.strip():
                continue
            try:
                sample = json.loads(line)
                analysis = analyze_sample(sample)
                if analysis["has_repetitions"]:
                    issues_found += 1
                    for _issue in analysis["issues"]:
                        pass
            except json.JSONDecodeError:
                pass

        return

    # Clean the file
    _kept, _removed_count, removed = clean_jsonl_file(
        args.input, args.output, verbose=args.verbose, dry_run=args.dry_run
    )

    if not args.dry_run:
        pass

    if removed and args.verbose:
        for _r in removed[:5]:
            pass


if __name__ == "__main__":
    main()
