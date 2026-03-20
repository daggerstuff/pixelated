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

import argparse
import json
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from ai.data.sourcing import (
    HuggingFaceSource,
    JournalSource,
    EdgeCaseSource,
    VoiceSource,
    PromptCorpusSource,
)


def cmd_discover(args):
    """Discover available sources."""
    print("=== Dataset Discovery ===\n")

    if args.all or args.huggingface:
        print("HuggingFace:")
        source = HuggingFaceSource()
        for result in source.discover(limit=5):
            print(f"  {result['id']}: {result['downloads']:,} downloads")
        print()

    if args.all or args.journal:
        print("Journal Research:")
        source = JournalSource()
        for info in source.discover():
            print(f"  {info['category']}: {', '.join(info['queries'])}")
        print()

    if args.all or args.edge_case:
        print("Edge Case Generation:")
        source = EdgeCaseSource()
        for info in source.discover():
            print(f"  {info['category']}: {info['intensity']} intensity")
        print()

    if args.all or args.voice:
        print("Voice Sourcing:")
        source = VoiceSource()
        for info in source.discover():
            if 'persona_id' in info:
                print(f"  {info['persona_id']}: {info['style']}")
            else:
                print(f"  Transcripts: {info.get('transcript_count', 0)} files")
        print()

    if args.all or args.prompt_corpus:
        print("Prompt Corpus:")
        source = PromptCorpusSource()
        for info in source.discover():
            print(f"  {info['type']}: {info.get('category', info.get('source_path', 'unknown'))}")
        print()


def cmd_generate(args):
    """Generate samples from specified source."""
    print(f"=== Generating {args.samples} samples for {args.stage} ===\n")

    # Select source based on stage and args
    if args.source == 'huggingface':
        source = HuggingFaceSource()
        results = list(source.fill_gap(args.samples))
        for r in results:
            print(f"  Downloaded: {r['dataset_id']} ({r['samples']} samples)")

    elif args.source == 'journal':
        source = JournalSource()
        count = 0
        for record in source.fill_gap(args.samples):
            print(f"  Ingested: {record['source']}: {record.get('title', 'N/A')[:60]}...")
            count += 1
        results = [f"{count} abstracts"]

    elif args.source == 'edge_case':
        source = EdgeCaseSource()
        count = 0
        for record in source.fill_gap(args.samples):
            print(f"  Generated: [{record['metadata']['category']}] edge case")
            count += 1
        results = [f"{count} edge cases"]

    elif args.source == 'voice':
        source = VoiceSource()
        count = 0
        for record in source.fill_gap(args.samples):
            print(f"  Generated: [{record['metadata']['persona_id']}] voice sample")
            count += 1
        results = [f"{count} voice samples"]

    elif args.source == 'prompt_corpus':
        source = PromptCorpusSource()
        count = 0
        for record in source.fill_gap(args.samples):
            print(f"  Extracted: [{record['metadata']['category']}] prompt")
            count += 1
        results = [f"{count} prompts"]

    elif args.source == 'auto':
        # Auto-select based on stage
        if 'stage3' in args.stage or 'edge' in args.stage:
            print("Auto-selected: EdgeCaseSource")
            source = EdgeCaseSource()
        elif 'stage4' in args.stage or 'voice' in args.stage:
            print("Auto-selected: VoiceSource")
            source = VoiceSource()
        elif 'stage2' in args.stage:
            print("Auto-selected: JournalSource")
            source = JournalSource()
        else:
            print("Auto-selected: HuggingFaceSource")
            source = HuggingFaceSource()

        for record in source.fill_gap(args.samples):
            if 'metadata' in record:
                print(f"  Generated: {record['metadata']}")
            elif 'source' in record:
                print(f"  Sourced: {record['source']}")
        results = [f"{args.samples} samples"]

    else:
        print(f"Unknown source: {args.source}")
        return

    print(f"\n=== Generated {len(results)} records ===")


def cmd_status(args):
    """Show sourcing status."""
    print("=== Sourcing Status ===\n")

    # Check output directories
    output_dirs = {
        'HuggingFace': 'ai/data/acquired_datasets/huggingface',
        'Journal': 'ai/data/acquired_datasets/journal_research',
        'Edge Cases': 'ai/data/acquired_datasets/edge_cases',
        'Voice': 'ai/data/acquired_datasets/voice_samples',
        'Prompt Corpus': 'ai/data/acquired_datasets/prompt_corpus',
    }

    for name, path in output_dirs.items():
        p = Path(path)
        if p.exists():
            file_count = len(list(p.glob("*")))
            print(f"  {name}: {file_count} files in {path}")
        else:
            print(f"  {name}: Directory not created yet")

    print()


def main():
    parser = argparse.ArgumentParser(
        description='Dataset Sourcing CLI',
        prog='pixelated sourcing'
    )
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Discover command
    discover_parser = subparsers.add_parser('discover', help='Discover available sources')
    discover_parser.add_argument('--all', action='store_true', help='Show all sources')
    discover_parser.add_argument('--huggingface', action='store_true')
    discover_parser.add_argument('--journal', action='store_true')
    discover_parser.add_argument('--edge-case', action='store_true')
    discover_parser.add_argument('--voice', action='store_true')
    discover_parser.add_argument('--prompt-corpus', action='store_true')
    discover_parser.set_defaults(func=cmd_discover)

    # Generate command
    generate_parser = subparsers.add_parser('generate', help='Generate samples')
    generate_parser.add_argument('--stage', required=True, help='Target stage')
    generate_parser.add_argument('--source', default='auto',
                                choices=['auto', 'huggingface', 'journal', 'edge_case', 'voice', 'prompt_corpus'])
    generate_parser.add_argument('--samples', type=int, default=100, help='Number of samples')
    generate_parser.set_defaults(func=cmd_generate)

    # Status command
    status_parser = subparsers.add_parser('status', help='Show sourcing status')
    status_parser.set_defaults(func=cmd_status)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == '__main__':
    main()
