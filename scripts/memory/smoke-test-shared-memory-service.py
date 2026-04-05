from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Smoke test the shared memory service.")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("SUBCONSCIOUS_MEMORY_BASE_URL", "http://127.0.0.1:54321"),
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


def canonical_request(
    *,
    actor_id: str,
    user_id: str,
    method: str,
    target: str,
    body: bytes,
    timestamp: str,
    nonce: str,
) -> str:
    body_hash = hashlib.sha256(body).hexdigest()
    return "\n".join([actor_id, user_id, method.upper(), target, body_hash, timestamp, nonce])


def signed_headers(
    *,
    actor_id: str,
    actor_secret: str,
    user_id: str,
    method: str,
    target: str,
    body: bytes,
) -> dict[str, str]:
    timestamp = str(int(time.time()))
    nonce = uuid.uuid4().hex
    signature = hmac.new(
        actor_secret.encode("utf-8"),
        canonical_request(
            actor_id=actor_id,
            user_id=user_id,
            method=method,
            target=target,
            body=body,
            timestamp=timestamp,
            nonce=nonce,
        ).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "Content-Type": "application/json",
        "X-Memory-Actor-Id": actor_id,
        "X-Memory-User-Id": user_id,
        "X-Memory-Timestamp": timestamp,
        "X-Memory-Nonce": nonce,
        "X-Memory-Signature": signature,
    }


def request_json(
    *,
    base_url: str,
    path: str,
    method: str,
    actor_id: str,
    actor_secret: str,
    user_id: str,
    payload: dict | None = None,
) -> tuple[int, dict | list | str]:
    body = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=body if method.upper() in {"POST", "PUT", "PATCH"} else None,
        headers=signed_headers(
            actor_id=actor_id,
            actor_secret=actor_secret,
            user_id=user_id,
            method=method,
            target=path,
            body=body if method.upper() in {"POST", "PUT", "PATCH"} else b"",
        ),
        method=method.upper(),
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else ""
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else raw
        except json.JSONDecodeError:
            parsed = raw
        return exc.code, parsed


class DiagnosticClient:
    """Client for service health monitoring and diagnostics."""

    def __init__(
        self,
        base_url: str,
        actor_id: str,
        actor_secret: str,
        user_id: str,
    ):
        self.base_url = base_url.rstrip("/")
        self.actor_id = actor_id
        self.actor_secret = actor_secret
        self.user_id = user_id

    def health_check(self) -> tuple[int, dict | list | str]:
        """Check if the memory service is healthy."""
        return request_json(
            base_url=self.base_url,
            path="/health",
            method="GET",
            actor_id=self.actor_id,
            actor_secret=self.actor_secret,
            user_id=self.user_id,
            payload=None,
        )


class MemoryRepository:
    """Repository for memory CRUD operations."""

    def __init__(
        self,
        base_url: str,
        bank_id: str,
        actor_id: str,
        actor_secret: str,
        user_id: str,
    ):
        self.base_url = base_url.rstrip("/")
        self.bank_id = bank_id
        self.actor_id = actor_id
        self.actor_secret = actor_secret
        self.user_id = user_id

    def _make_request(
        self,
        path: str,
        method: str,
        payload: dict | None = None,
    ) -> tuple[int, dict | list | str]:
        """Make an authenticated request to the memory service."""
        return request_json(
            base_url=self.base_url,
            path=path,
            method=method,
            actor_id=self.actor_id,
            actor_secret=self.actor_secret,
            user_id=self.user_id,
            payload=payload,
        )

    def retain(self, content: str, context: str, tags: list) -> tuple[int, dict | list | str]:
        """Store a memory in the shared service."""
        target = f"/v1/default/banks/{self.bank_id}/memories"
        return self._make_request(
            target,
            "POST",
            payload={
                "items": [
                    {
                        "content": content,
                        "context": context,
                        "tags": tags,
                    }
                ]
            },
        )

    def recall(self, query: str, limit: int, tags: list, tags_match: str = "any") -> tuple[int, dict | list | str]:
        """Recall memories from the shared service."""
        target = f"/v1/default/banks/{self.bank_id}/memories/recall"
        return self._make_request(
            target,
            "POST",
            payload={
                "query": query,
                "limit": limit,
                "tags": tags,
                "tags_match": tags_match,
            },
        )

    def delete_document(self, document_id: str) -> tuple[int, dict | list | str]:
        """Delete a document from the shared service."""
        target = f"/v1/default/banks/{self.bank_id}/documents/{document_id}"
        return self._make_request(target, "DELETE")


def main() -> int:
    """Run smoke tests using the memory service client."""
    args = build_parser().parse_args()

    if not args.actor_id or not args.actor_secret:
        print("Error: --actor-id and --actor-secret are required", file=sys.stderr)
        return 1

    diagnostic_client = DiagnosticClient(
        base_url=args.base_url,
        actor_id=args.actor_id,
        actor_secret=args.actor_secret,
        user_id=args.user_id,
    )

    memory_repo = MemoryRepository(
        base_url=args.base_url,
        bank_id=args.bank_id,
        actor_id=args.actor_id,
        actor_secret=args.actor_secret,
        user_id=args.user_id,
    )

    print(f"Smoke testing memory service at {args.base_url}")
    print(f"Bank: {args.bank_id}, User: {args.user_id}")
    print("-" * 50)

    print("\n[1/4] Testing health endpoint...")
    status, response = diagnostic_client.health_check()
    if status != 200:
        print(f"  ✗ Health check failed: HTTP {status}", file=sys.stderr)
        return 1
    print(f"  ✓ Health check passed: {response}")

    print("\n[2/4] Testing memory retention...")
    test_content = f"Smoke test memory created at {time.strftime('%Y-%m-%d %H:%M:%S')}"
    status, response = memory_repo.retain(
        content=test_content,
        context="smoke-test",
        tags=["test", "smoke-test", "automated"],
    )
    if status not in (200, 201):
        print(f"  ✗ Memory retention failed: HTTP {status}", file=sys.stderr)
        return 1
    print(f"  ✓ Memory retained successfully")

    document_id = None
    if isinstance(response, dict):
        if "id" in response:
            document_id = response["id"]
        elif "document_id" in response:
            document_id = response["document_id"]
        elif "items" in response and len(response["items"]) > 0:
            document_id = response["items"][0].get("id")

    if not document_id:
        print(f"  ✗ Failed to extract document ID from retention response", file=sys.stderr)
        return 1

    print("\n[3/4] Testing memory recall...")
    status, response = memory_repo.recall(
        query="smoke-test",
        limit=10,
        tags=["smoke-test"],
        tags_match="any",
    )
    if status != 200:
        print(f"  ✗ Memory recall failed: HTTP {status}", file=sys.stderr)
        return 1
    print(f"  ✓ Memory recall successful")
    if isinstance(response, dict) and "items" in response:
        print(f"  Found {len(response['items'])} matching memories")

    if document_id:
        print("\n[4/4] Testing document deletion...")
        status, response = memory_repo.delete_document(document_id)
        if status not in (200, 204):
            print(f"  ✗ Document deletion failed: HTTP {status}", file=sys.stderr)
            return 1
        print(f"  ✓ Document deleted successfully")
    else:
        print("\n[4/4] Skipping deletion (no document ID received)")

    print("\n" + "=" * 50)
    print("All smoke tests passed!")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
