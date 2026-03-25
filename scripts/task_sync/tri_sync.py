"""Tri-directional task sync coordinator for beads, Asana, Jira, and Linear."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SYNC_BLOCK_START = "<!-- pixelated-sync"
SYNC_BLOCK_END = "-->"
SYNC_BLOCK_NAME = "pixelated-sync"
DEFAULT_PROVIDER_ORDER = ("beads", "asana", "jira")
SYNC_STATE_PATH = Path(".agent/internal/task-sync-state.json")
PROVIDER_EXPORT_ENV_VARS = {
    "asana": "PIXELATED_ASANA_EXPORT_PATH",
    "jira": "PIXELATED_JIRA_EXPORT_PATH",
    "linear": "PIXELATED_LINEAR_EXPORT_PATH",
}

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


def _string_or_empty(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _nested_value(payload: Mapping[str, Any], *path: str) -> Any:
    current: Any = payload
    for key in path:
        if not isinstance(current, Mapping) or key not in current:
            return None
        current = current[key]
    return current


def _first_present(payload: Mapping[str, Any], *paths: str) -> Any:
    for path in paths:
        value = _nested_value(payload, *path.split("."))
        if value is not None:
            return value
    return None


def _parse_updated_at(payload: Mapping[str, Any], *paths: str) -> datetime:
    updated_at = _first_present(payload, *paths)
    if isinstance(updated_at, str) and updated_at.strip():
        return parse_iso8601(updated_at)
    return datetime.now(timezone.utc)


def _parse_provider_ids(metadata: Mapping[str, str]) -> dict[str, str]:
    return {
        provider: external_id
        for provider, external_id in metadata.items()
        if provider in DEFAULT_PROVIDER_ORDER
    }


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
    return {provider: external_id for provider, external_id in existing.items() if external_id} == {
        provider: external_id for provider, external_id in expected.items() if external_id
    }


def records_are_in_sync(
    existing: TaskRecord, canonical: TaskRecord, provider_ids: Mapping[str, str]
) -> bool:
    same_title = existing.title.strip() == canonical.title.strip()
    same_body = task_body_without_sync_block(existing.body) == task_body_without_sync_block(
        canonical.body
    )
    same_status = normalize_status(existing.status) == normalize_status(canonical.status)
    same_links = provider_ids_match(existing.provider_ids, provider_ids)
    return same_title and same_body and same_status and same_links


def select_canonical_record(records: Sequence[TaskRecord]) -> TaskRecord:
    if not records:
        raise ValueError("Cannot select a canonical record from an empty sequence")

    def sort_key(record: TaskRecord) -> tuple[datetime, int]:
        return (record.updated_at, PROVIDER_PRIORITY.get(record.provider, 0))

    return max(records, key=sort_key)


def group_records_by_key(
    records_by_provider: Mapping[str, Sequence[TaskRecord]],
) -> dict[str, list[TaskRecord]]:
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

    known_provider_ids = dict(provider_ids)
    if existing is not None:
        known_provider_ids[provider] = existing.external_id

    merged_body = merge_body_with_sync_metadata(
        task_body_without_sync_block(canonical.body),
        SyncMetadata(
            key=sync_key,
            status=normalize_status(canonical.status),
            source_provider=canonical.provider,
            source_id=canonical.external_id,
            provider_ids=known_provider_ids,
            updated_at=canonical.updated_at.astimezone(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
        ),
    )

    return SyncAction(
        provider=provider,
        action="create" if existing is None else "update",
        sync_key=sync_key,
        source_provider=canonical.provider,
        source_id=canonical.external_id,
        target_id=existing.external_id if existing else None,
        title=canonical.title,
        body=merged_body,
        status=normalize_status(canonical.status),
        provider_ids=known_provider_ids,
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

    plan.sort(
        key=lambda action: (action.sync_key, provider_index.get(action.provider, 99), action.action)
    )
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
    return TaskRecord(
        provider="beads",
        external_id=str(payload.get("id")),
        title=str(payload.get("title") or payload.get("name") or ""),
        body=body,
        status=normalize_status(str(payload.get("status") or payload.get("state") or "open")),
        updated_at=_parse_updated_at(payload, "updated_at", "updatedAt", "created_at", "createdAt"),
        sync_key=metadata.get("key"),
        provider_ids=_parse_provider_ids(metadata),
        raw=payload,
    )


def normalize_asana_payload(payload: Mapping[str, Any]) -> TaskRecord | None:
    body = _string_or_empty(_first_present(payload, "notes", "description", "body", "html_notes"))
    _, metadata = parse_sync_metadata(body)
    completed = _first_present(payload, "completed", "is_completed")
    raw_status = _first_present(
        payload,
        "status",
        "status.name",
        "custom_fields.status",
        "resource_subtype",
    )
    status = (
        "closed" if completed is True else normalize_status(_string_or_empty(raw_status) or "open")
    )

    return TaskRecord(
        provider="asana",
        external_id=_string_or_empty(_first_present(payload, "gid", "id")),
        title=_string_or_empty(_first_present(payload, "name", "title")),
        body=body,
        status=status,
        updated_at=_parse_updated_at(
            payload,
            "modified_at",
            "updated_at",
            "completed_at",
            "created_at",
        ),
        sync_key=_string_or_empty(_first_present(payload, "sync_key")) or metadata.get("key"),
        provider_ids=_parse_provider_ids(metadata),
        raw=payload,
    )


def normalize_jira_payload(payload: Mapping[str, Any]) -> TaskRecord | None:
    fields = _first_present(payload, "fields")
    body = _string_or_empty(_first_present(payload, "description", "fields.description", "body"))
    _, metadata = parse_sync_metadata(body)
    raw_status = _first_present(payload, "status", "fields.status.name", "fields.status")
    status = normalize_status(_string_or_empty(raw_status) or "open")

    return TaskRecord(
        provider="jira",
        external_id=_string_or_empty(_first_present(payload, "key", "id", "issueKey")),
        title=_string_or_empty(_first_present(payload, "title", "fields.summary", "summary")),
        body=body,
        status=status,
        updated_at=_parse_updated_at(
            payload,
            "updated",
            "updated_at",
            "fields.updated",
            "created",
            "fields.created",
        ),
        sync_key=_string_or_empty(_first_present(payload, "sync_key", "external_ref"))
        or metadata.get("key"),
        provider_ids=_parse_provider_ids(metadata),
        raw=fields if isinstance(fields, Mapping) else payload,
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


def _iter_export_payloads(path: Path) -> Iterable[Mapping[str, Any]]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []

    if path.suffix == ".jsonl":
        payloads: list[Mapping[str, Any]] = []
        for line in text.splitlines():
            if not line.strip():
                continue
            decoded = json.loads(line)
            if isinstance(decoded, Mapping):
                payloads.append(decoded)
        return payloads

    decoded = json.loads(text)
    if isinstance(decoded, list):
        return [item for item in decoded if isinstance(item, Mapping)]
    if isinstance(decoded, Mapping):
        for key in ("data", "items", "issues", "tasks", "results"):
            value = decoded.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, Mapping)]
        return [decoded]
    return []


def export_records_from_path(provider: str, path: Path) -> list[TaskRecord]:
    normalizers = {
        "asana": normalize_asana_payload,
        "jira": normalize_jira_payload,
        "beads": normalize_beads_payload,
    }
    try:
        normalize_payload = normalizers[provider]
    except KeyError as exc:
        raise ValueError(f"Unsupported provider export: {provider}") from exc

    records: list[TaskRecord] = []
    for payload in _iter_export_payloads(path):
        record = normalize_payload(payload)
        if record is not None:
            records.append(record)
    return records


def collect_records(
    enabled_providers: Sequence[str] = DEFAULT_PROVIDER_ORDER,
    export_paths: Mapping[str, Path | str] | None = None,
) -> dict[str, list[TaskRecord]]:
    export_paths = export_paths or {}
    records_by_provider: dict[str, list[TaskRecord]] = {}

    for provider in enabled_providers:
        if provider == "beads":
            records_by_provider[provider] = beads_export()
            continue

        explicit_path = export_paths.get(provider)
        configured_path = (
            explicit_path or os.getenv(PROVIDER_EXPORT_ENV_VARS.get(provider, ""), "").strip()
        )
        if not configured_path:
            continue

        path = Path(configured_path)
        if not path.exists():
            raise FileNotFoundError(f"{provider} export path does not exist: {path}")
        records_by_provider[provider] = export_records_from_path(provider, path)

    return records_by_provider


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


def plan_from_sources(
    *,
    enabled_providers: Sequence[str] = DEFAULT_PROVIDER_ORDER,
    export_paths: Mapping[str, Path | str] | None = None,
) -> list[SyncAction]:
    return build_sync_plan(
        collect_records(enabled_providers=enabled_providers, export_paths=export_paths),
        enabled_providers=enabled_providers,
    )


def main(argv: Sequence[str] | None = None) -> int:
    args = list(argv or sys.argv[1:])
    mode = args[0] if args else "plan"

    if mode not in {"plan", "dry-run"}:
        raise SystemExit("Usage: tri_sync.py [plan|dry-run]")

    plan = plan_from_sources()
    summary = summarize_plan(plan)
    print(json.dumps(summary, indent=2))
    return 0


def dataclass_to_dict(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return {
            field_name: dataclass_to_dict(getattr(value, field_name))
            for field_name in value.__dataclass_fields__
        }
    if isinstance(value, Mapping):
        return {key: dataclass_to_dict(item) for key, item in value.items()}
    if isinstance(value, list):
        return [dataclass_to_dict(item) for item in value]
    return value


if __name__ == "__main__":
    raise SystemExit(main())
