from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid

from ai.memory.v3.provider import SharedMemoryServiceProvider


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Smoke test the shared memory service.")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("SUBCONSCIOUS_MEMORY_BASE_URL", "http://127.0.0.1:5003"),
    )
    parser.add_argument(
        "--bank-id",
        default=os.environ.get("HINDSIGHT_BANK_ID", "pixelated"),
    )
    parser.add_argument(
        "--actor-id",
        default=os.environ.get("SUBCONSCIOUS_MEMORY_ACTOR_ID", ""),
    )
    parser.add_argument(
        "--actor-secret",
        default=os.environ.get("SUBCONSCIOUS_MEMORY_ACTOR_SECRET", ""),
    )
    parser.add_argument(
        "--user-id",
        default=os.environ.get("SMOKE_TEST_MEMORY_USER_ID", "service-smoke"),
    )
    return parser


async def main() -> int:
    args = build_parser().parse_args()
    if not args.actor_id or not args.actor_secret:
        raise SystemExit(
            "SUBCONSCIOUS_MEMORY_ACTOR_ID and SUBCONSCIOUS_MEMORY_ACTOR_SECRET are required"
        )

    provider = SharedMemoryServiceProvider(
        base_url=args.base_url,
        bank_id=args.bank_id,
        actor_id=args.actor_id,
        actor_secret=args.actor_secret,
    )

    marker = uuid.uuid4().hex[:12]
    content = f"shared memory smoke test marker {marker}"

    try:
        if not await provider.health_check():
            raise RuntimeError("Memory service health check failed")

        stored = await provider.store(
            content,
            args.user_id,
            {"project_id": "pixelated", "category": "operational-smoke-test"},
        )
        recalled = await provider.recall(marker, args.user_id, limit=5)
        if not any(memory.id == stored.id for memory in recalled):
            raise RuntimeError("Stored memory was not recalled by the shared service")
        deleted = await provider.delete(stored.id, args.user_id)
        if not deleted:
            raise RuntimeError("Stored memory could not be deleted by the shared service")
    finally:
        await provider.close()

    print(
        f"Shared memory service smoke test passed for {args.base_url} "
        f"(bank={args.bank_id}, user={args.user_id})"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        raise SystemExit(130)
