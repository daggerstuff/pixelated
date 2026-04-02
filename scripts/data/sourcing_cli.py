#!/usr/bin/env python3
"""
Dataset Sourcing CLI.

Active sourcing of NEW, BETTER content from:
- HuggingFace (academic datasets)
- Journal research (DOAJ, ClinicalTrials)
- Edge case generation (synthetic)
- Voice pipeline (transcript processing)
- Prompt corpus (knowledge base extraction)

Usage:
    pixelated sourcing discover --all
    pixelated sourcing generate --stage stage3_edge_stress_test --samples 1000
    pixelated sourcing generate --stage stage2_therapeutic_expertise --source journal --samples 500
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import argparse

from ai.data.sourcing import (
    EdgeCaseSource,
    HuggingFaceSource,
    JournalSource,
    PromptCorpusSource,
    VoiceSource,
)


def cmd_discover(args):
    """Discover available sources."""

    if args.all or args.huggingface:
        source = HuggingFaceSource()
        for _result in source.discover(limit=5):
            pass

    if args.all or args.journal:
        source = JournalSource()
        for _info in source.discover():
            pass

    if args.all or args.edge_case:
        source = EdgeCaseSource()
        for _info in source.discover():
            pass

    if args.all or args.voice:
        source = VoiceSource()
        for _info in source.discover():
            if "persona_id" in _info:
                pass
            else:
                pass

    if args.all or args.prompt_corpus:
        source = PromptCorpusSource()
        for _info in source.discover():
            pass


def cmd_generate(args):  # noqa: PLR0912
    """Generate samples from specified source."""

    # Select source based on stage and args
    if args.source == "huggingface":
        source = HuggingFaceSource()
        results = list(source.fill_gap(args.samples))
        for _r in results:
            pass

    elif args.source == "journal":
        source = JournalSource()
        count = 0
        for _record in source.fill_gap(args.samples):
            count += 1
        results = [f"{count} abstracts"]

    elif args.source == "edge_case":
        source = EdgeCaseSource()
        count = 0
        for _record in source.fill_gap(args.samples):
            count += 1
        results = [f"{count} edge cases"]

    elif args.source == "voice":
        source = VoiceSource()
        count = 0
        for _record in source.fill_gap(args.samples):
            count += 1
        results = [f"{count} voice samples"]

    elif args.source == "prompt_corpus":
        source = PromptCorpusSource()
        count = 0
        for _record in source.fill_gap(args.samples):
            count += 1
        results = [f"{count} prompts"]

    elif args.source == "auto":
        # Auto-select based on stage
        if "stage3" in args.stage or "edge" in args.stage:
            source = EdgeCaseSource()
        elif "stage4" in args.stage or "voice" in args.stage:
            source = VoiceSource()
        elif "stage2" in args.stage:
            source = JournalSource()
        else:
            source = HuggingFaceSource()

        for _record in source.fill_gap(args.samples):
            if "metadata" in _record or "source" in _record:
                pass
        results = [f"{args.samples} samples"]

    else:
        return


def cmd_status(_args):
    """Show sourcing status."""

    # Check output directories
    output_dirs = {
        "HuggingFace": "ai/data/acquired_datasets/huggingface",
        "Journal": "ai/data/acquired_datasets/journal_research",
        "Edge Cases": "ai/data/acquired_datasets/edge_cases",
        "Voice": "ai/data/acquired_datasets/voice_samples",
        "Prompt Corpus": "ai/data/acquired_datasets/prompt_corpus",
    }

    for _name, path in output_dirs.items():
        p = Path(path)
        if p.exists():
            len(list(p.glob("*")))
        else:
            pass


def main():
    parser = argparse.ArgumentParser(description="Dataset Sourcing CLI", prog="pixelated sourcing")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Discover command
    discover_parser = subparsers.add_parser("discover", help="Discover available sources")
    discover_parser.add_argument("--all", action="store_true", help="Show all sources")
    discover_parser.add_argument("--huggingface", action="store_true")
    discover_parser.add_argument("--journal", action="store_true")
    discover_parser.add_argument("--edge-case", action="store_true")
    discover_parser.add_argument("--voice", action="store_true")
    discover_parser.add_argument("--prompt-corpus", action="store_true")
    discover_parser.set_defaults(func=cmd_discover)

    # Generate command
    generate_parser = subparsers.add_parser("generate", help="Generate samples")
    generate_parser.add_argument("--stage", required=True, help="Target stage")
    generate_parser.add_argument(
        "--source",
        default="auto",
        choices=["auto", "huggingface", "journal", "edge_case", "voice", "prompt_corpus"],
    )
    generate_parser.add_argument("--samples", type=int, default=100, help="Number of samples")
    generate_parser.set_defaults(func=cmd_generate)

    # Status command
    status_parser = subparsers.add_parser("status", help="Show sourcing status")
    status_parser.set_defaults(func=cmd_status)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
