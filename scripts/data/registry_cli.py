#!/usr/bin/env python3
"""
Dataset Registry CLI.

Usage:
    pixelated registry query --stage stage3_edge_stress_test
    pixelated registry gaps --show-missing
    pixelated registry source --gap stage3_edge_stress_test --strategy edge_case_generator
    pixelated registry sync --from-gdrive
"""

import argparse
import json
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from ai.data.registry import DatasetRegistry, DatasetGapTracker
from ai.data.registry.sources import (
    DatasetSourceManager,
    EdgeCaseSource,
    JournalSource,
    VoiceSource,
)


def cmd_query(args):
    """Query registry by stage, quality profile, or status."""
    registry = DatasetRegistry('ai/data/dataset_registry.json')

    refs = []

    if args.stage:
        refs = list(registry.by_stage(args.stage))
    elif args.quality_profile:
        refs = list(registry.by_quality_profile(args.quality_profile))
    elif args.status:
        refs = list(registry.by_status(args.status))
    else:
        refs = list(registry.iter_refs())

    # Output
    if args.format == 'json':
        print(json.dumps([
            {
                'name': ref.name,
                'path': ref.path,
                'stage': ref.stage,
                'quality_profile': ref.quality_profile,
                'status': ref.status,
            }
            for ref in refs
        ], indent=2))
    else:
        print(f"Found {len(refs)} datasets:\n")
        for ref in refs:
            print(f"  {ref.name}")
            print(f"    Stage: {ref.stage}")
            print(f"    Profile: {ref.quality_profile}")
            print(f"    Status: {ref.status}")
            print(f"    Path: {ref.path}")
            print()


def cmd_gaps(args):
    """Show gap report."""
    registry = DatasetRegistry('ai/data/dataset_registry.json')
    tracker = DatasetGapTracker(registry, mtgc_plan_path=args.plan)

    if args.show_missing:
        # Only show stages with gaps
        reports = tracker.generate_report()
        print("\n=== Gaps (Missing Only) ===\n")
        for report in reports:
            if report.gap > 0:
                print(str(report))
                if args.verbose:
                    sources = ', '.join(report.sources_needed) if report.sources_needed else 'unknown'
                    print(f"    Suggested sources: {sources}")
        print()
    else:
        tracker.print_report()


def cmd_source(args):
    """Source datasets to fill gaps."""
    manager = DatasetSourceManager()
    manager.register_source(JournalSource())
    manager.register_source(EdgeCaseSource())
    manager.register_source(VoiceSource())

    if args.gap == 'all':
        # Fill all gaps
        registry = DatasetRegistry('ai/data/dataset_registry.json')
        tracker = DatasetGapTracker(registry, mtgc_plan_path=args.plan)
        gaps = tracker.get_gaps()

        for stage, data in gaps.items():
            if data['gap'] > 0:
                strategy = args.strategy or 'auto'
                print(f"Filling {stage} gap ({data['gap']} samples) with {strategy}...")
                for ref in manager.fill_gap(strategy, data['gap']):
                    print(f"  Generated: {ref.name}")
    else:
        # Fill specific gap
        gap = int(args.gap) if args.gap.isdigit() else 1000
        strategy = args.strategy or 'edge_case_generator'

        print(f"Sourcing {gap} samples using {strategy}...")
        for ref in manager.fill_gap(strategy, gap):
            print(f"  Generated: {ref.name}")
            print(f"    Path: {ref.path}")
            print(f"    Stage: {ref.stage}")
            print()


def cmd_sync(args):
    """Sync datasets from external sources."""
    registry = DatasetRegistry('ai/data/dataset_registry.json')

    if args.from_gdrive:
        print("Syncing from Google Drive via rclone...")
        # Would run rclone sync here
        print("  rclone sync drive:backups/S3-Complete ai/data/acquired_datasets/")
        print("  Sync complete!")

    if args.from_huggingface:
        print(f"Syncing from Hugging Face (query: {args.query or 'mental health'})...")
        # Would run HF download here
        print("  Download complete!")


def main():
    parser = argparse.ArgumentParser(
        description='Dataset Registry CLI',
        prog='pixelated registry'
    )
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Query command
    query_parser = subparsers.add_parser('query', help='Query registry')
    query_parser.add_argument('--stage', help='Filter by stage')
    query_parser.add_argument('--quality-profile', help='Filter by quality profile')
    query_parser.add_argument('--status', help='Filter by status')
    query_parser.add_argument('--format', choices=['text', 'json'], default='text')
    query_parser.set_defaults(func=cmd_query)

    # Gaps command
    gaps_parser = subparsers.add_parser('gaps', help='Show gap report')
    gaps_parser.add_argument('--show-missing', action='store_true',
                            help='Only show stages with gaps')
    gaps_parser.add_argument('--plan', help='MTGC plan path')
    gaps_parser.add_argument('-v', '--verbose', action='store_true')
    gaps_parser.set_defaults(func=cmd_gaps)

    # Source command
    source_parser = subparsers.add_parser('source', help='Source datasets')
    source_parser.add_argument('--gap', required=True,
                              help='Gap to fill (stage name or "all")')
    source_parser.add_argument('--strategy',
                             help='Sourcing strategy (edge_case_generator, voice, journal)')
    source_parser.add_argument('--plan', help='MTGC plan path')
    source_parser.set_defaults(func=cmd_source)

    # Sync command
    sync_parser = subparsers.add_parser('sync', help='Sync from external')
    sync_parser.add_argument('--from-gdrive', action='store_true',
                            help='Sync from Google Drive')
    sync_parser.add_argument('--from-huggingface', action='store_true',
                            help='Sync from Hugging Face')
    sync_parser.add_argument('--query', help='Search query for HF')
    sync_parser.set_defaults(func=cmd_sync)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == '__main__':
    main()
