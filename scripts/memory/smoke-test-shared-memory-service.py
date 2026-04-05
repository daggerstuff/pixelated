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
    return "\n".join(
        [actor_id, user_id, method.upper(), target, body_hash, timestamp, nonce]
    )


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


def main() -> int:
    args = build_parser().parse_args()
    if not args.actor_id or not args.actor_secret:
        raise SystemExit(
            "SUBCONSCIOUS_MEMORY_ACTOR_ID and SUBCONSCIOUS_MEMORY_ACTOR_SECRET are required"
        )

    marker = uuid.uuid4().hex[:12]
    content = f"shared memory smoke test marker {marker}"
    target = f"/v1/default/banks/{args.bank_id}/memories"

    health_status, health_payload = request_json(
        base_url=args.base_url,
        path="/health",
        method="GET",
        actor_id=args.actor_id,
        actor_secret=args.actor_secret,
        user_id=args.user_id,
    )
    if health_status != 200:
        raise RuntimeError(f"Memory service health check failed: {health_payload}")

    retain_status, retain_payload = request_json(
        base_url=args.base_url,
        path=target,
        method="POST",
        actor_id=args.actor_id,
        actor_secret=args.actor_secret,
        user_id=args.user_id,
        payload={
            "items": [
                {
                    "content": content,
                    "context": json.dumps(
                        {"project_id": "pixelated", "category": "operational-smoke-test"}
                    ),
                    "tags": ["smoke-test", marker],
                }
            ]
        },
    )
    if retain_status not in {200, 201}:
        raise RuntimeError(f"Memory retain failed: {retain_payload}")

    results = []
    if isinstance(retain_payload, dict):
        raw_results = retain_payload.get("results")
        if isinstance(raw_results, list):
            results = raw_results
    if not results:
        raise RuntimeError(f"Memory retain returned no results: {retain_payload}")

    document_id = str(results[0].get("id", "")).strip()
    if not document_id:
        raise RuntimeError(f"Memory retain did not return a document id: {retain_payload}")

    recall_status, recall_payload = request_json(
        base_url=args.base_url,
        path=f"{target}/recall",
        method="POST",
        actor_id=args.actor_id,
        actor_secret=args.actor_secret,
        user_id=args.user_id,
        payload={
            "query": marker,
            "limit": 5,
            "tags": ["smoke-test"],
            "tags_match": "any",
        },
    )
    if recall_status != 200:
        raise RuntimeError(f"Memory recall failed: {recall_payload}")

    recall_results = []
    if isinstance(recall_payload, dict):
        raw_recall_results = recall_payload.get("results")
        if isinstance(raw_recall_results, list):
            recall_results = raw_recall_results
    if not any(
        marker in json.dumps(item) for item in recall_results if isinstance(item, dict)
    ):
        raise RuntimeError("Stored memory was not recalled by the shared service")

    delete_status, delete_payload = request_json(
        base_url=args.base_url,
        path=f"/v1/default/banks/{args.bank_id}/documents/{document_id}",
        method="DELETE",
        actor_id=args.actor_id,
        actor_secret=args.actor_secret,
        user_id=args.user_id,
    )
    if delete_status not in {200, 204}:
        raise RuntimeError(f"Memory delete failed: {delete_payload}")

    print(
        f"Shared memory service smoke test passed for {args.base_url} "
        f"(bank={args.bank_id}, user={args.user_id})"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
