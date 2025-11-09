#!/usr/bin/env python3
"""
Extract all OpenMemory memories directly using the access token.
This script fetches all memories from the API and saves them to a JSON file.
"""

import argparse
import json
import sys
import time
from typing import Any, Dict, List

import requests


def extract_all_memories(access_token: str, output_file: str = "openmemory_memories_export.json") -> List[Dict[str, Any]]:
    """Extract all memories from OpenMemory API."""
    all_memories = []
    page = 1
    page_size = 10  # API seems to limit to 10 per page
    total_pages = None

    print(f"📥 Extracting memories from OpenMemory API...")
    print(f"   Using access token: {access_token[:20]}...")

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_token}'
    }

    while True:
        try:
            print(f"   Fetching page {page}...", end='\r')

            response = requests.post(
                'https://api.openmemory.dev/api/v1/memories/filter',
                headers=headers,
                json={
                    'page': page,
                    'page_size': page_size,
                    'sort_by': 'created_at',
                    'sort_direction': 'desc'
                },
                timeout=30
            )

            if not response.ok:
                print(f"\n❌ Error on page {page}: {response.status_code}")
                if response.status_code == 401:
                    print("   Token expired or invalid")
                    break
                page += 1
                continue

            data = response.json()
            memories = data.get('items', [])

            if not memories:
                print(f"\n✅ No more memories at page {page}")
                break

            all_memories.extend(memories)

            # Update total pages
            if data.get('pages'):
                total_pages = data['pages']

            if page % 50 == 0:
                print(f"\n   Progress: {page}/{total_pages or '?'} pages ({len(all_memories)} memories)")

            # Check if we've reached the last page
            if total_pages and page >= total_pages:
                print(f"\n✅ Reached last page ({total_pages})")
                break

            page += 1

            # Rate limiting
            time.sleep(0.1)

        except requests.exceptions.RequestException as e:
            print(f"\n❌ Error fetching page {page}: {e}")
            page += 1
            time.sleep(0.5)
            continue

    print(f"\n📊 Total memories extracted: {len(all_memories)}")

    # Save to file
    export_data = {
        'success': True,
        'totalMemories': len(all_memories),
        'extractedAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'memories': all_memories
    }

    with open(output_file, 'w') as f:
        json.dump(export_data, f, indent=2, default=str)

    print(f"📥 Saved to {output_file}")
    return all_memories


def main():
    parser = argparse.ArgumentParser(
        description="Extract all memories from OpenMemory API"
    )
    parser.add_argument(
        "--token",
        help="OpenMemory access token (from browser localStorage)",
        required=True
    )
    parser.add_argument(
        "--output",
        help="Output file (default: openmemory_memories_export.json)",
        default="openmemory_memories_export.json"
    )

    args = parser.parse_args()

    memories = extract_all_memories(args.token, args.output)

    if not memories:
        print("❌ No memories extracted")
        sys.exit(1)

    print(f"\n✅ Successfully extracted {len(memories)} memories")
    print(f"\nNext step: Import to ByteRover CLI")
    print(f"  uv run python scripts/migrate_openmemory_to_byterover.py --import-file {args.output}")


if __name__ == "__main__":
    main()

