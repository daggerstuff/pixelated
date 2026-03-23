"""Tri-directional task sync coordinator for beads, Asana, Jira, and Linear."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

SYNC_BLOCK_START = "<!-- pixelated-sync"
SYNC_BLOCK_END = "-->"
SYNC_BLOCK_NAME = "pixelated-sync"
DEFAULT_PROVIDER_ORDER = ("beads", "asana", "jira", "linear")
SYNC_STATE_PATH = Path(".planning/task-sync-state.json")

STATUS_ALIASES = {
    "done": "closed",
    "closed": "closed",
    "resolved": "closed",
    "complete": "closed",
    "completed": "closed",
    "in progress": "in_progress",
    "doing": "in_progress",
    "active": "in_progress",
    "open": "open",
    "todo": "open",
    "backlog": "open",
}

PROVIDER_PRIORITY = {
    "beads": 4,
    "asana": 3,
    "jira": 2,
    "linear": 1,
}

SYNC_KEY_RE = re.compile(r"(?im)^\s*sync-key\s*:\s*(?P<value>[A-Za-z0-9._:-]+)\s*$")
SYNC_LINE_RE = re.compile(r"(?im)^\s*(?P<key>[a-z0-9_.-]+)\s*:\s*(?P<value>.+?)\s*$")


@dataclass(frozen=True)
class SyncMetadata:
    """Machine-readable sync footer embedded in task bodies."""

    key: str
    status: str
    source_provider: str
    source_id: str
    provider_ids: Mapping[str, str] = field(default_factory=dict)
    updated_at: str | None = None


@dataclass(frozen=True)
class TaskRecord:
    """Normalized task snapshot from a provider."""

    provider: str
    external_id: str
    title: str
    body: str
    status: str
    updated_at: datetime
    sync_key: str | None = None
    provider_ids: Mapping[str, str] = field(default_factory=dict)
    raw: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SyncAction:
    """A single upsert operation against a provider."""

    provider: str
    action: str
    sync_key: str
    source_provider: str
    source_id: str
    target_id: str | None
    title: str
    body: str
    status: str
    provider_ids: Mapping[str, str]


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-")


def normalize_status(value: str) -> str:
    normalized = value.strip().lower().replace("_", " ")
    return STATUS_ALIASES.get(normalized, normalized.replace(" ", "_"))


def parse_iso8601(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def task_body_without_sync_block(body: str) -> str:
    if SYNC_BLOCK_START not in body:
        return body.strip()

    lines: list[str] = []
    in_block = False
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith(SYNC_BLOCK_START):
            in_block = True
            continue
        if in_block and stripped == SYNC_BLOCK_END:
            in_block = False
            continue
        if not in_block:
            lines.append(line)
    return "\n".join(lines).strip()


def parse_sync_metadata(body: str) -> tuple[str, dict[str, str]]:
    clean_body = task_body_without_sync_block(body)
    if SYNC_BLOCK_START not in body:
        return clean_body, {}

    block_text = body.split(SYNC_BLOCK_START, 1)[1].split(SYNC_BLOCK_END, 1)[0]
    metadata: dict[str, str] = {}
    for line in block_text.splitlines():
        match = SYNC_LINE_RE.match(line)
        if match:
            metadata[match.group("key").strip()] = match.group("value").strip()
    return clean_body, metadata


def render_sync_metadata(metadata: SyncMetadata) -> str:
    lines = [
        SYNC_BLOCK_START,
        f"key: {metadata.key}",
        f"status: {metadata.status}",
        f"source-provider: {metadata.source_provider}",
        f"source-id: {metadata.source_id}",
    ]
    for provider, external_id in sorted(metadata.provider_ids.items()):
        lines.append(f"{provider}: {external_id}")
    if metadata.updated_at:
        lines.append(f"updated-at: {metadata.updated_at}")
    lines.append(SYNC_BLOCK_END)
    return "\n".join(lines)


def merge_body_with_sync_metadata(body: str, metadata: SyncMetadata) -> str:
    clean_body = task_body_without_sync_block(body)
    footer = render_sync_metadata(metadata)
    if not clean_body:
        return footer
    return f"{clean_body}\n\n{footer}"


def extract_sync_key(title: str, body: str) -> str:
    _, metadata = parse_sync_metadata(body)
    if metadata.get("key"):
        return metadata["key"].strip().lower()

    marker_match = SYNC_KEY_RE.search(body)
    if marker_match:
        return marker_match.group("value").strip().lower()

    return slugify(title)


def record_fingerprint(record: TaskRecord) -> str:
    digest = hashlib.sha256()
    digest.update(record.title.strip().encode("utf-8"))
    digest.update(b"\0")
    digest.update(task_body_without_sync_block(record.body).encode("utf-8"))
    digest.update(b"\0")
    digest.update(normalize_status(record.status).encode("utf-8"))
    return digest.hexdigest()


def provider_ids_match(existing: Mapping[str, str], expected: Mapping[str, str]) -> bool:
    return {
        provider: external_id
        for provider, external_id in existing.items()
        if external_id
    } == {
        provider: external_id
        for provider, external_id in expected.items()
        if external_id
    }


def records_are_in_sync(existing: TaskRecord, canonical: TaskRecord, provider_ids: Mapping[str, str]) -> bool:
    same_title = existing.title.strip() == canonical.title.strip()
    same_body = task_body_without_sync_block(existing.body) == task_body_without_sync_block(canonical.body)
    same_status = normalize_status(existing.status) == normalize_status(canonical.status)
    same_links = provider_ids_match(existing.provider_ids, provider_ids)
    return same_title and same_body and same_status and same_links


def select_canonical_record(records: Sequence[TaskRecord]) -> TaskRecord:
    if not records:
        raise ValueError("Cannot select a canonical record from an empty sequence")

    def sort_key(record: TaskRecord) -> tuple[datetime, int]:
        return (record.updated_at, PROVIDER_PRIORITY.get(record.provider, 0))

    return max(records, key=sort_key)


def group_records_by_key(records_by_provider: Mapping[str, Sequence[TaskRecord]]) -> dict[str, list[TaskRecord]]:
    grouped: dict[str, list[TaskRecord]] = {}
    for provider, records in records_by_provider.items():
        for record in records:
            key = (record.sync_key or extract_sync_key(record.title, record.body)).strip().lower()
            grouped.setdefault(key, []).append(
                TaskRecord(
                    provider=provider,
                    external_id=record.external_id,
                    title=record.title,
                    body=record.body,
                    status=record.status,
                    updated_at=record.updated_at,
                    sync_key=key,
                    provider_ids=record.provider_ids,
                    raw=record.raw,
                )
            )
    return grouped


def build_sync_action(
    *,
    provider: str,
    existing: TaskRecord | None,
    canonical: TaskRecord,
    sync_key: str,
    provider_ids: Mapping[str, str],
) -> SyncAction | None:
    if existing is not None and records_are_in_sync(existing, canonical, provider_ids):
        return None

    return SyncAction(
        provider=provider,
        action="create" if existing is None else "update",
        sync_key=sync_key,
        source_provider=canonical.provider,
        source_id=canonical.external_id,
        target_id=existing.external_id if existing else None,
        title=canonical.title,
        body=task_body_without_sync_block(canonical.body),
        status=normalize_status(canonical.status),
        provider_ids=provider_ids,
    )


def build_sync_plan(
    records_by_provider: Mapping[str, Sequence[TaskRecord]],
    enabled_providers: Sequence[str] = DEFAULT_PROVIDER_ORDER,
) -> list[SyncAction]:
    grouped = group_records_by_key(records_by_provider)
    enabled = tuple(enabled_providers)
    provider_index = {provider: index for index, provider in enumerate(enabled)}
    plan: list[SyncAction] = []

    for sync_key, records in sorted(grouped.items()):
        canonical = select_canonical_record(records)
        provider_lookup = {record.provider: record for record in records}
        provider_ids = {record.provider: record.external_id for record in records}

        for provider in enabled:
            action = build_sync_action(
                provider=provider,
                existing=provider_lookup.get(provider),
                canonical=canonical,
                sync_key=sync_key,
                provider_ids=provider_ids,
            )
            if action is not None:
                plan.append(action)

    plan.sort(key=lambda action: (action.sync_key, provider_index.get(action.provider, 99), action.action))
    return plan


def _run_command(command: Sequence[str], *, input_text: str | None = None) -> str:
    completed = subprocess.run(
        list(command),
        input=input_text,
        capture_output=True,
        check=True,
        text=True,
    )
    return completed.stdout.strip()


def normalize_beads_payload(payload: Mapping[str, Any]) -> TaskRecord | None:
    if payload.get("status") == "closed" and payload.get("type") == "memory":
        return None

    body = str(payload.get("description") or payload.get("notes") or "")
    _, metadata = parse_sync_metadata(body)
    updated_at = payload.get("updated_at") or payload.get("updatedAt") or payload.get("created_at") or payload.get("createdAt")
    if isinstance(updated_at, str):
        parsed_updated_at = parse_iso8601(updated_at)
    else:
        parsed_updated_at = datetime.now(timezone.utc)

    return TaskRecord(
        provider="beads",
        external_id=str(payload.get("id")),
        title=str(payload.get("title") or payload.get("name") or ""),
        body=body,
        status=normalize_status(str(payload.get("status") or payload.get("state") or "open")),
        updated_at=parsed_updated_at,
        sync_key=metadata.get("key"),
        provider_ids={k: v for k, v in metadata.items() if k in DEFAULT_PROVIDER_ORDER},
        raw=payload,
    )


def beads_export() -> list[TaskRecord]:
    output = _run_command(["bd", "export", "--no-memories", "--scrub"])
    records: list[TaskRecord] = []
    for line in output.splitlines():
        if not line.strip():
            continue
        payload = json.loads(line)
        record = normalize_beads_payload(payload)
        if record is not None:
            records.append(record)
    return records


def load_sync_state(path: Path = SYNC_STATE_PATH) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_sync_state(state: Mapping[str, Any], path: Path = SYNC_STATE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def summarize_plan(plan: Sequence[SyncAction]) -> dict[str, int]:
    summary = {"create": 0, "update": 0}
    for action in plan:
        summary[action.action] = summary.get(action.action, 0) + 1
    return summary


def plan_from_beads_only() -> list[SyncAction]:
    return build_sync_plan({"beads": beads_export()})


def main(argv: Sequence[str] | None = None) -> int:
    args = list(argv or os.sys.argv[1:])
    mode = args[0] if args else "plan"

    if mode not in {"plan", "dry-run"}:
        raise SystemExit("Usage: tri_sync.py [plan|dry-run]")

    plan = plan_from_beads_only()
    summary = summarize_plan(plan)
    print(json.dumps({"summary": summary, "actions": [dataclass_to_dict(action) for action in plan]}, indent=2))
    return 0


def dataclass_to_dict(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return {field_name: dataclass_to_dict(getattr(value, field_name)) for field_name in value.__dataclass_fields__}
    if isinstance(value, Mapping):
        return {key: dataclass_to_dict(item) for key, item in value.items()}
    if isinstance(value, list):
        return [dataclass_to_dict(item) for item in value]
    return value


if __name__ == "__main__":
    raise SystemExit(main())
