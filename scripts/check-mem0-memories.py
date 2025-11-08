#!/usr/bin/env python3
"""
Check and preview your Mem0/OpenMemory data before migration

Usage:
    python scripts/check-mem0-memories.py --source mem0 --api-key YOUR_KEY
"""

import argparse
import sys
from collections import Counter

import requests


def check_mem0(api_key: str):
    """Check Mem0 Platform memories"""
    print("🔍 Checking Mem0 Platform...\n")

    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "application/json",
    }

    all_memories = []
    page = 1

    while True:
        try:
            # Use v2 endpoint with wildcard filter to match all memories
            # According to docs: "*" wildcard character matches everything
            response = requests.post(
                "https://api.mem0.ai/v2/memories/",
                headers=headers,
                json={"filters": {"user_id": "*"}},  # Wildcard to match all users
                params={"page": page, "page_size": 100},
            )

            response.raise_for_status()
            data = response.json()
            memories = data.get("results", data) if isinstance(data, dict) else data

            if not memories:
                break

            all_memories.extend(memories)
            print(f"  Fetched page {page}: {len(memories)} memories")

            if len(memories) < 100:
                break
            page += 1

        except requests.exceptions.RequestException as e:
            print(f"❌ Error: {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"Response body: {e.response.text}")
            sys.exit(1)

    print(f"\n📊 Total Memories: {len(all_memories)}")

    # Analyze categories
    categories = []
    for mem in all_memories:
        cats = mem.get("categories")
        if cats and isinstance(cats, list):
            categories.extend(cats)

    if categories:
        print("\n📁 Categories:")
        for cat, count in Counter(categories).most_common(10):
            print(f"  - {cat}: {count}")

    # Analyze users
    users = [m.get("user_id") for m in all_memories if m.get("user_id")]
    if users:
        print(f"\n👥 Unique Users: {len(set(users))}")

    # Analyze agents
    agents = [m.get("agent_id") for m in all_memories if m.get("agent_id")]
    if agents:
        print(f"🤖 Unique Agents: {len(set(agents))}")

    # Date range
    dates = [m.get("created_at") for m in all_memories if m.get("created_at")]
    if dates:
        dates_sorted = sorted(dates)
        print("\n📅 Date Range:")
        print(f"  Oldest: {dates_sorted[0]}")
        print(f"  Newest: {dates_sorted[-1]}")

    # Sample memories
    print("\n📝 Sample Memories (first 5):")
    for idx, mem in enumerate(all_memories[:5], 1):
        content = mem.get("memory", "")[:100]
        cats_list = mem.get("categories")
        if cats_list and isinstance(cats_list, list):
            cats = ", ".join(cats_list[:3])
        else:
            cats = ""
        print(f"\n  {idx}. {content}...")
        if cats:
            print(f"     Categories: {cats}")

    # Estimate ByteRover sections
    section_mapping = {
        "Common Errors": 0,
        "Best Practices": 0,
        "Architecture": 0,
        "Testing": 0,
        "Strategies": 0,
        "Lessons Learned": 0,
    }

    for mem in all_memories:
        cats_raw = mem.get("categories")
        cats = [c.lower() for c in cats_raw] if cats_raw and isinstance(cats_raw, list) else []

        if any("error" in c or "bug" in c for c in cats):
            section_mapping["Common Errors"] += 1
        elif any("best" in c or "practice" in c for c in cats):
            section_mapping["Best Practices"] += 1
        elif any("architecture" in c or "design" in c for c in cats):
            section_mapping["Architecture"] += 1
        elif any("test" in c for c in cats):
            section_mapping["Testing"] += 1
        elif any("strategy" in c or "approach" in c for c in cats):
            section_mapping["Strategies"] += 1
        else:
            section_mapping["Lessons Learned"] += 1

    print("\n🗂️  Estimated ByteRover Section Distribution:")
    for section, count in section_mapping.items():
        if count > 0:
            print(f"  - {section}: {count}")

    print("\n✅ Ready to migrate!")
    print("\nNext steps:")
    print("  1. Run dry-run: python scripts/migrate_mem0_to_byterover.py --source mem0 --api-key YOUR_KEY --dry-run")
    print("  2. Actual migration: python scripts/migrate_mem0_to_byterover.py --source mem0 --api-key YOUR_KEY")


def check_openmemory(api_key: str = None, url: str = "http://localhost:8765"):
    """Check OpenMemory"""
    print(f"🔍 Checking OpenMemory at {url}...\n")

    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        response = requests.get(f"{url}/memories", headers=headers)
        response.raise_for_status()
        memories = response.json()

        print(f"📊 Total Memories: {len(memories)}")

        # Sample memories
        print("\n📝 Sample Memories (first 5):")
        for idx, mem in enumerate(memories[:5], 1):
            content = mem.get("content", mem.get("memory", ""))[:100]
            print(f"\n  {idx}. {content}...")

        print("\n✅ Ready to migrate!")
        print("\nNext steps:")
        print(f"  1. Run dry-run: python scripts/migrate_mem0_to_byterover.py --source openmemory --url {url} --dry-run")
        print(f"  2. Actual migration: python scripts/migrate_mem0_to_byterover.py --source openmemory --url {url}")

    except requests.exceptions.RequestException as e:
        print(f"❌ Error: {e}")
        print("\nMake sure OpenMemory is running:")
        print("  docker ps | grep openmemory")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Check Mem0/OpenMemory data before migration"
    )
    parser.add_argument(
        "--source",
        required=True,
        choices=["mem0", "openmemory", "openmemory-local"],
        help="Source type",
    )
    parser.add_argument("--api-key", help="API key for Mem0 or OpenMemory")
    parser.add_argument(
        "--url",
        default="http://localhost:8765",
        help="Custom URL for local OpenMemory",
    )

    args = parser.parse_args()

    if args.source == "mem0":
        if not args.api_key:
            print("❌ --api-key is required for Mem0", file=sys.stderr)
            sys.exit(1)
        check_mem0(args.api_key)
    else:
        check_openmemory(args.api_key, args.url)


if __name__ == "__main__":
    main()
