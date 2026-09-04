"""Tri-directional task sync coordinator for Asana, Jira, GitHub, GitLab, and Linear."""

from __future__ import annotations

import hashlib
import importlib
import json
import os
import re
import shutil
import subprocess
import sys
from collections.abc import Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from scripts.task_sync.provider_bridge import (
    export_asana_tasks,
    export_github_issues,
    export_jira_issues,
    export_linear_issues,
)

SYNC_BLOCK_START = "<!-- pixelated-sync"
SYNC_BLOCK_END = "-->"
SYNC_BLOCK_NAME = "pixelated-sync"
DEFAULT_PROVIDER_ORDER: tuple[str, ...] = ("asana", "github", "gitlab", "linear", "jira")
SYNC_STATE_PATH = Path(".agent/internal/task-sync-state.json")
PROVIDER_EXPORT_ENV_VARS = {
    "asana": "PIXELATED_ASANA_EXPORT_PATH",
    "jira": "PIXELATED_JIRA_EXPORT_PATH",
    "github": "PIXELATED_GITHUB_EXPORT_PATH",
    "linear": "PIXELATED_LINEAR_EXPORT_PATH",
}
PROVIDER_APPLY_COMMAND_ENV_VARS = {
    "asana": "PIXELATED_ASANA_APPLY_COMMAND",
    "jira": "PIXELATED_JIRA_APPLY_COMMAND",
    "github": "PIXELATED_GITHUB_APPLY_COMMAND",
    "linear": "PIXELATED_LINEAR_APPLY_COMMAND",
}
DEFAULT_APPLY_MAX_WORKERS = 10
DEFAULT_APPLY_MAX_PASSES = 2

STATUS_ALIASES = {
    "done": "closed",
    "closed": "closed",
    "resolved": "closed",
    "complete": "closed",
    "completed": "closed",
    "cancelled": "closed",
    "canceled": "closed",
    "in progress": "in_progress",
    "under review": "in_progress",
    "in review": "review",
    "review": "review",
    "doing": "in_progress",
    "active": "in_progress",
    "open": "open",
    "todo": "open",
    "to do": "open",
    "backlog": "open",
    "triage": "triage",
}

# Per-project status workflow overrides.
# Key: project name (case-insensitive)
# Value: dict mapping canonical statuses to allowed Linear state names
PROJECT_STATUS_WORKFLOWS: dict[str, dict[str, set[str]]] = {
    "discovery & backlog": {
        "open": {"Backlog", "Todo"},
        "triage": set(),
        "in_progress": set(),
        "review": set(),
        "closed": {"Done", "Duplicate"},
    },
    "churnmeon reliability": {
        "open": {"Backlog"},
        "triage": set(),
        "in_progress": set(),
        "review": set(),
        "closed": set(),
    },
    "autoreview workflow improvements": {
        "open": {"Backlog", "Triage"},
        "in_progress": {"In Progress"},
        "review": set(),
        "closed": {"Done"},
    },
    "memory may-hem expansion": {
        "open": {"Todo", "Triage"},
        "in_progress": set(),
        "review": set(),
        "closed": {"Done", "Duplicate"},
    },
}

# Linear numeric priority → canonical priority label
LINEAR_PRIORITY_MAP: dict[int | None, str] = {
    0: "urgent",
    1: "high",
    2: "medium",
    3: "low",
    4: "none",
    None: "none",
}

# Canonical priority → Jira ADHD priority name
PRIORITY_TO_JIRA: dict[str, str] = {
    "urgent": "Highest",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "none": "Lowest",
}

# Jira ADHD priority name → canonical priority
JIRA_PRIORITY_TO_CANONICAL: dict[str, str] = {
    "Highest": "urgent",
    "High": "high",
    "Medium": "medium",
    "Low": "low",
    "Lowest": "none",
    "None": "none",
}


PROVIDER_PRIORITY = {
    "asana": 3,
    "github": 2,
    "gitlab": 2,
    "linear": 2,
    "jira": 1,
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
    clean_body: str | None = None
    raw: Mapping[str, Any] = field(default_factory=dict)
    priority_label: str | None = None
    labels: tuple[str, ...] = field(default_factory=tuple)


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
    priority_label: str | None = None
    labels: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class SyncExecutionResult:
    """Result of applying a sync action."""

    provider: str
    action: str
    sync_key: str
    target_id: str | None
    success: bool
    stdout: str = ""
    stderr: str = ""


def normalize_status(value: str) -> str:
    # If value is a dict-like string from Linear (e.g. "{'id': '...', 'name': 'todo', ...}"), extract name
    if value.startswith("{") and "'name'" in value:
        m = re.search(r"'name'\s*:\s*'([^']*)'", value)
        if m:
            value = m.group(1)
    normalized = value.strip().lower().replace("_", " ")
    return STATUS_ALIASES.get(normalized, normalized.replace(" ", "_"))


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-")


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


def _parse_updated_at(payload: Mapping[str, Any], *paths: str) -> datetime | None:
    updated_at = _first_present(payload, *paths)
    if not isinstance(updated_at, str):
        return None
    return parse_iso8601(updated_at.strip())


def _parse_provider_ids(metadata: Mapping[str, str]) -> dict[str, str]:
    return {provider: external_id for provider, external_id in metadata.items() if provider in DEFAULT_PROVIDER_ORDER}


def task_body_without_sync_block(body: str) -> str:
    if SYNC_BLOCK_START not in body or SYNC_BLOCK_END not in body:
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
    if SYNC_BLOCK_START not in body or SYNC_BLOCK_END not in body:
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
    digest.update(record_clean_body(record).encode("utf-8"))
    digest.update(b"\0")
    digest.update(normalize_status(record.status).encode("utf-8"))
    return digest.hexdigest()


def provider_ids_match(existing: Mapping[str, str], expected: Mapping[str, str]) -> bool:
    """Compare provider IDs, only checking providers present in the expected set.

    The existing record may have provider_ids from its sync metadata for providers
    that don't have records in the current group. Only providers in `expected`
    are compared to prevent false mismatches from "extra" provider IDs.
    """
    for provider, external_id in expected.items():
        if not external_id:
            continue
        if existing.get(provider) != external_id:
            return False
    return True


def records_are_in_sync(existing: TaskRecord, canonical: TaskRecord, provider_ids: Mapping[str, str]) -> bool:
    same_title = existing.title.strip() == canonical.title.strip()
    same_body = record_clean_body(existing) == record_clean_body(canonical)
    same_status = normalize_status(existing.status) == normalize_status(canonical.status)
    same_links = provider_ids_match(existing.provider_ids, provider_ids)
    return same_title and same_body and same_status and same_links


def select_canonical_record(records: Sequence[TaskRecord]) -> TaskRecord:
    if not records:
        raise ValueError("Cannot select a canonical record from an empty sequence")

    # If there is a Linear record, it is ALWAYS canonical!
    linear_records = [r for r in records if r.provider == "linear"]
    if linear_records:
        if len(linear_records) == 1:
            return linear_records[0]
        records_to_sort = linear_records
    else:
        records_to_sort = records

    def compute_strength_score(title: str, clean_body: str) -> float:
        score = 0.0

        # Base score is length
        score += len(clean_body)

        # Check if it is a migration stub
        is_stub = False
        if "migrated from" in clean_body.lower() and len(clean_body) < 250:
            lines = [line.strip() for line in clean_body.splitlines() if line.strip()]
            stub_keywords = {"migrated from", "source type", "source status", "source priority", "priority:", "status:"}
            match_count = sum(1 for line in lines if any(k in line.lower() for k in stub_keywords))
            if match_count >= len(lines) - 1:
                is_stub = True

        if is_stub:
            score -= 5000.0

        # Proper markdown headers check
        header_count = len(re.findall(r"^#{1,6}\s+\S+", clean_body, re.MULTILINE))
        score += header_count * 50.0

        # Check for corrupted list headers, e.g. code blocks containing '1. ' or list-like headers
        # like '1. Task Overview' or '  1. Implementation Checklist'
        corrupted_headers = len(re.findall(r"```\s*\n\s*\d+\.\s+\S+", clean_body))
        corrupted_headers += len(
            re.findall(
                r"^\s*\d+\.\s+(Task Overview|Implementation Checklist|Objective|Milestones|Success Metrics|Definition of Done|Verified Files|Path Notes|Dependencies|Status|Background|Target Release)",
                clean_body,
                re.MULTILINE | re.IGNORECASE,
            )
        )
        score -= corrupted_headers * 100.0

        # Checklist check
        checklist_count = len(re.findall(r"-\s+\[\s*\]", clean_body))
        score += checklist_count * 30.0

        # Match words with title
        title_words = set(re.findall(r"\w+", title.lower()))
        body_words = set(re.findall(r"\w+", clean_body.lower()))
        matching_words = title_words.intersection(body_words)
        score += len(matching_words) * 10.0

        return score

    def sort_key(record: TaskRecord) -> tuple[float, datetime, int]:
        clean_body = record.clean_body if record.clean_body is not None else task_body_without_sync_block(record.body)
        score = compute_strength_score(record.title, clean_body)
        return (score, record.updated_at, PROVIDER_PRIORITY.get(record.provider, 0))

    return max(records_to_sort, key=sort_key)


def select_provider_record(records: Sequence[TaskRecord]) -> TaskRecord:
    if not records:
        raise ValueError("Cannot select a provider record from an empty sequence")

    def sort_key(record: TaskRecord) -> tuple[int, datetime, str]:
        status_rank = 0 if normalize_status(record.status) == "closed" else 1
        return (status_rank, record.updated_at, record.external_id)

    return max(records, key=sort_key)


def record_clean_body(record: TaskRecord) -> str:
    if record.clean_body is not None:
        return record.clean_body
    return task_body_without_sync_block(record.body)


def group_records_by_key(
    records_by_provider: Mapping[str, Sequence[TaskRecord]],
) -> dict[str, list[TaskRecord]]:
    normalized_by_provider = _normalize_by_provider(records_by_provider)
    id_to_key = _build_id_to_key_map(normalized_by_provider)

    grouped: dict[str, list[TaskRecord]] = {}
    for provider, records in normalized_by_provider.items():
        for record in records:
            rec_id = (provider, record.external_id)
            canonical_key = str(id_to_key.get(rec_id, record.sync_key) or "")
            updated_record = TaskRecord(
                provider=record.provider,
                external_id=record.external_id,
                title=record.title,
                body=record.body,
                status=record.status,
                updated_at=record.updated_at,
                sync_key=canonical_key,
                provider_ids=record.provider_ids,
                clean_body=record.clean_body,
                raw=record.raw,
                priority_label=record.priority_label,
                labels=record.labels,
            )
            grouped.setdefault(canonical_key, []).append(updated_record)
    return grouped


def normalized_group_record(provider: str, record: TaskRecord) -> TaskRecord:
    key = (record.sync_key or extract_sync_key(record.title, record.body)).strip().lower()
    return TaskRecord(
        provider=provider,
        external_id=record.external_id,
        title=record.title,
        body=record.body,
        status=record.status,
        updated_at=record.updated_at,
        sync_key=key,
        provider_ids=record.provider_ids,
        clean_body=record_clean_body(record),
        raw=record.raw,
        priority_label=record.priority_label,
        labels=record.labels,
    )


def _iter_all_records(
    normalized_by_provider: Mapping[str, Sequence[TaskRecord]],
) -> Iterable[TaskRecord]:
    for records in normalized_by_provider.values():
        yield from records


def _normalize_by_provider(
    records_by_provider: Mapping[str, Sequence[TaskRecord]],
) -> dict[str, list[TaskRecord]]:
    normalized_by_provider: dict[str, list[TaskRecord]] = {}
    for provider, records in records_by_provider.items():
        normalized_list = []
        for record in records:
            normalized_record = normalized_group_record(provider, record)
            if not normalized_record.sync_key:
                sys.stderr.write(f"Skipping {provider} record {record.external_id}: missing sync key\n")
                continue
            normalized_list.append(normalized_record)
        normalized_by_provider[provider] = normalized_list
    return normalized_by_provider


def _build_id_to_key_map(
    normalized_by_provider: Mapping[str, Sequence[TaskRecord]],
) -> dict[tuple[str, str], str]:
    id_to_key: dict[tuple[str, str], str] = {}
    for record in _iter_all_records(normalized_by_provider):
        key = str(record.sync_key or "")
        id_to_key[(record.provider, record.external_id)] = key
        for other_provider, other_id in record.provider_ids.items():
            if other_id:
                id_to_key[(other_provider, other_id)] = key
    for record in _iter_all_records(normalized_by_provider):
        if (record.provider, record.external_id) not in id_to_key:
            id_to_key[(record.provider, record.external_id)] = str(record.sync_key or "")
    return id_to_key


def build_sync_action(
    *,
    provider: str,
    existing: TaskRecord | None,
    canonical: TaskRecord,
    sync_key: str,
    provider_ids: Mapping[str, str],
) -> SyncAction | None:

    known_provider_ids = dict(provider_ids)
    if existing is not None:
        known_provider_ids[provider] = existing.external_id

    merged_body = merge_body_with_sync_metadata(
        record_clean_body(canonical),
        SyncMetadata(
            key=sync_key,
            status=normalize_status(canonical.status),
            source_provider=canonical.provider,
            source_id=canonical.external_id,
            provider_ids=known_provider_ids,
            updated_at=canonical.updated_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        ),
    )

    return SyncAction(
        provider=provider,
        action="create" if existing is None or not existing.external_id else "update",
        sync_key=sync_key,
        source_provider=canonical.provider,
        source_id=canonical.external_id,
        target_id=existing.external_id if existing and existing.external_id else None,
        title=canonical.title,
        body=merged_body,
        status=normalize_status(canonical.status),
        provider_ids=known_provider_ids,
        priority_label=canonical.priority_label,
        labels=canonical.labels,
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
        # If there is no Linear record in this group and linear is enabled, skip generating any sync actions!
        if "linear" in enabled_providers and not any(record.provider == "linear" for record in records):
            continue

        provider_lookup = {
            provider: select_provider_record([record for record in records if record.provider == provider])
            for provider in {record.provider for record in records}
        }
        canonical_candidates = [
            record for record in provider_lookup.values() if normalize_status(record.status) != "closed"
        ]
        canonical = select_canonical_record(canonical_candidates or list(provider_lookup.values()))
        provider_ids = merged_provider_ids(records)

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


def merged_provider_ids(records: Sequence[TaskRecord]) -> dict[str, str]:
    provider_ids: dict[str, str] = {}
    selected_by_provider = {
        provider: select_provider_record([record for record in records if record.provider == provider])
        for provider in {record.provider for record in records}
    }
    for record in records:
        provider_ids.update(
            {provider: external_id for provider, external_id in record.provider_ids.items() if external_id}
        )
    for provider, record in selected_by_provider.items():
        provider_ids[provider] = record.external_id
    return provider_ids


def _run_command(command: Sequence[str], *, input_text: str | None = None) -> str:
    try:
        completed = subprocess.run(
            list(command),
            input=input_text,
            capture_output=True,
            check=True,
            text=True,
            shell=False,
        )
        return completed.stdout.strip()
    except FileNotFoundError:
        return ""


def _run_process(command: Sequence[str], *, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    executable = command[0] if command else "<unknown>"
    if not shutil.which(executable):
        return subprocess.CompletedProcess(
            args=list(command),
            returncode=127,
            stdout="",
            stderr=f"{executable} command not found",
        )

    return subprocess.run(
        list(command),
        input=input_text,
        capture_output=True,
        check=False,
        text=True,
        shell=False,
    )


def normalize_asana_payload(payload: Mapping[str, Any]) -> TaskRecord | None:
    body = _string_or_empty(_first_present(payload, "notes", "description", "body", "html_notes"))
    clean_body, metadata = parse_sync_metadata(body)
    completed = _first_present(payload, "completed", "is_completed")
    raw_status = _first_present(
        payload,
        "status",
        "status.name",
        "custom_fields.status",
        "resource_subtype",
    )
    normalized_raw_status = normalize_status(_string_or_empty(raw_status) or "")
    status = (
        normalized_raw_status or "closed"
        if completed is True
        else normalize_status(_string_or_empty(raw_status) or "open")
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
        )
        or datetime.now(timezone.utc),
        sync_key=_string_or_empty(_first_present(payload, "sync_key")) or metadata.get("key"),
        provider_ids=_parse_provider_ids(metadata),
        clean_body=clean_body,
        raw=payload,
    )


def normalize_jira_payload(payload: Mapping[str, Any]) -> TaskRecord | None:
    fields = _first_present(payload, "fields")
    field_payload = fields if isinstance(fields, Mapping) else {}
    body = _jira_body(payload, field_payload)
    clean_body, metadata = parse_sync_metadata(body)
    raw_status = _jira_status(payload, field_payload)
    status = normalize_status(_string_or_empty(raw_status) or "open")

    # Extract priority from Jira ADHD named priority
    priority_field = field_payload.get("priority", {})
    raw_priority_name = _string_or_empty(priority_field.get("name", "")) if isinstance(priority_field, Mapping) else ""
    priority_label = JIRA_PRIORITY_TO_CANONICAL.get(raw_priority_name)

    # Extract labels from Jira
    raw_labels = field_payload.get("labels", [])
    labels = tuple(str(lbl) for lbl in raw_labels if isinstance(lbl, str)) if isinstance(raw_labels, list) else ()

    return TaskRecord(
        provider="jira",
        external_id=_string_or_empty(_first_present(payload, "key", "id", "issueKey")),
        title=_jira_title(payload, field_payload),
        body=body,
        status=status,
        priority_label=priority_label,
        labels=labels,
        updated_at=_jira_updated_at(payload, field_payload) or datetime.now(timezone.utc),
        sync_key=_string_or_empty(_first_present(payload, "sync_key", "external_ref")) or metadata.get("key"),
        provider_ids=_parse_provider_ids(metadata),
        clean_body=clean_body,
        raw=fields if isinstance(fields, Mapping) else payload,
    )


def normalize_github_payload(payload: Mapping[str, Any]) -> TaskRecord | None:
    body = _string_or_empty(_first_present(payload, "body", "description", "content"))
    clean_body, metadata = parse_sync_metadata(body)
    status = normalize_status(_string_or_empty(_first_present(payload, "state")) or "open")

    return TaskRecord(
        provider="github",
        external_id=_string_or_empty(_first_present(payload, "number", "id")),
        title=_string_or_empty(_first_present(payload, "title")),
        body=body,
        status=status,
        updated_at=_parse_updated_at(payload, "updated_at", "updated", "created_at", "created")
        or datetime.now(timezone.utc),
        sync_key=_string_or_empty(_first_present(payload, "sync_key")) or metadata.get("key"),
        provider_ids=_parse_provider_ids(metadata),
        clean_body=clean_body,
        raw=payload,
    )


def normalize_linear_payload(payload: Mapping[str, Any]) -> TaskRecord | None:
    body = _string_or_empty(_first_present(payload, "description", "body", "content"))
    clean_body, metadata = parse_sync_metadata(body)
    raw_state = _first_present(payload, "state", "state.name")
    # Linear state may be a dict like {'id': '...', 'name': 'Todo', 'type': 'unstarted'}
    if isinstance(raw_state, dict):
        raw_state = raw_state.get("name") or raw_state.get("type") or "open"
    status = normalize_status(_string_or_empty(raw_state) or "open")

    # Extract priority (Linear uses 0=urgent, 1=high, 2=medium, 3=low, 4=none)
    raw_priority = payload.get("priority")
    priority_label = LINEAR_PRIORITY_MAP.get(raw_priority) if isinstance(raw_priority, int) else None

    # Extract labels
    raw_labels = payload.get("labels", [])
    if isinstance(raw_labels, list):
        labels = tuple(lbl.get("name", "") for lbl in raw_labels if isinstance(lbl, dict) and lbl.get("name"))
    else:
        labels = ()

    return TaskRecord(
        provider="linear",
        external_id=_string_or_empty(_first_present(payload, "id", "identifier")),
        title=_string_or_empty(_first_present(payload, "title")),
        body=body,
        status=status,
        updated_at=(
            _parse_updated_at(payload, "updatedAt", "updated", "createdAt", "created") or datetime.now(timezone.utc)
        ),
        sync_key=_string_or_empty(_first_present(payload, "sync_key")) or metadata.get("key"),
        provider_ids=_parse_provider_ids(metadata),
        clean_body=clean_body,
        raw=payload,
        priority_label=priority_label,
        labels=labels,
    )


def _jira_body(payload: Mapping[str, Any], field_payload: Mapping[str, Any]) -> str:
    body = _first_present(payload, "description", "body") or _first_present(field_payload, "description")
    if isinstance(body, Mapping):
        return _jira_adf_to_text(body)
    return _string_or_empty(body)


def _jira_adf_to_text(node: Mapping[str, Any] | Sequence[Any] | str | None) -> str:
    if node is None:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, Sequence) and not isinstance(node, (str, bytes, bytearray)):
        return _jira_adf_sequence_to_text(node)
    if not isinstance(node, Mapping):
        return _string_or_empty(node)
    return _jira_adf_mapping_to_text(node)


def _jira_adf_sequence_to_text(nodes: Sequence[Any]) -> str:
    return "".join(_jira_adf_to_text(item) for item in nodes)


def _jira_adf_mapping_to_text(node: Mapping[str, Any]) -> str:
    handler = _resolve_jira_adf_handler(node)
    if handler is not None:
        return handler(node)
    return _jira_adf_content_to_text(node)


def _resolve_jira_adf_handler(node: Mapping[str, Any]) -> Any:
    node_type = _string_or_empty(node.get("type"))
    return _JIRA_ADF_NODE_HANDLERS.get(node_type)


def _jira_adf_content_to_text(node: Mapping[str, Any]) -> str:
    return _jira_adf_sequence_to_text(node.get("content", []))


def _jira_adf_list_item_text(node: Mapping[str, Any] | Sequence[Any] | str | None) -> str:
    if node is None:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, Sequence) and not isinstance(node, (str, bytes, bytearray)):
        return _jira_adf_sequence_to_text(node)
    if not isinstance(node, Mapping):
        return _string_or_empty(node)

    parts = []
    for item in node.get("content", []):
        if isinstance(item, Mapping) and _string_or_empty(item.get("type")) in {"bulletList", "orderedList"}:
            nested_text = _jira_adf_to_text(item).strip()
            if nested_text:
                parts.append(_indent_multiline_text(nested_text, "  "))
            continue
        rendered = _jira_adf_to_text(item).strip()
        if rendered:
            parts.append(rendered)
    return "\n".join(part for part in parts if part)


def _indent_multiline_text(text: str, prefix: str) -> str:
    return "\n".join(f"{prefix}{line}" if line else line for line in text.splitlines())


def _jira_adf_text_node(node: Mapping[str, Any]) -> str:
    return _string_or_empty(node.get("text"))


def _jira_adf_block_node(node: Mapping[str, Any]) -> str:
    text = "".join(_jira_adf_to_text(item) for item in node.get("content", []))
    return f"{text}\n\n" if text else ""


def _jira_adf_hard_break_node(node: Mapping[str, Any]) -> str:
    _ = node
    return "\n"


def _jira_adf_list_node(node: Mapping[str, Any]) -> str:
    node_type = _string_or_empty(node.get("type"))
    rendered_items = []
    for index, item in enumerate(node.get("content", []), start=1):
        item_text = _jira_adf_list_item_text(item).strip()
        prefix = f"{index}. " if node_type == "orderedList" else "- "
        if item_text:
            rendered_items.append(prefix + item_text)
    return "\n".join(item for item in rendered_items if item) + ("\n\n" if rendered_items else "")


def _jira_adf_list_item_node(node: Mapping[str, Any]) -> str:
    return _jira_adf_list_item_text(node)


_JIRA_ADF_NODE_HANDLERS: dict[str, Any] = {
    "text": _jira_adf_text_node,
    "paragraph": _jira_adf_block_node,
    "heading": _jira_adf_block_node,
    "hardBreak": _jira_adf_hard_break_node,
    "bulletList": _jira_adf_list_node,
    "orderedList": _jira_adf_list_node,
    "listItem": _jira_adf_list_item_node,
}


def _jira_status(payload: Mapping[str, Any], field_payload: Mapping[str, Any]) -> Any:
    return _first_present(payload, "status") or _first_present(field_payload, "status.name", "status")


def _jira_title(payload: Mapping[str, Any], field_payload: Mapping[str, Any]) -> str:
    return _string_or_empty(_first_present(payload, "title", "summary") or _first_present(field_payload, "summary"))


def _jira_updated_at(
    payload: Mapping[str, Any],
    field_payload: Mapping[str, Any],
) -> datetime | None:
    return _parse_updated_at(field_payload, "updated", "created") or _parse_updated_at(
        payload,
        "updated",
        "updated_at",
        "created",
    )


def get_provider_normalizer(provider: str):
    normalizers = {
        "asana": normalize_asana_payload,
        "jira": normalize_jira_payload,
        "github": normalize_github_payload,
        "linear": normalize_linear_payload,
    }
    try:
        return normalizers[provider]
    except KeyError as exc:
        raise ValueError(f"Unsupported provider export: {provider}") from exc


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
    path = Path(path)
    normalize_payload = get_provider_normalizer(provider)

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
    with ThreadPoolExecutor(max_workers=max(1, len(enabled_providers))) as executor:
        futures = {
            provider: executor.submit(collect_provider_records, provider, export_paths)
            for provider in enabled_providers
        }
        records_by_provider: dict[str, list[TaskRecord]] = {}
        for provider, future in futures.items():
            records = future.result()
            if records is not None:
                records_by_provider[provider] = records
    return records_by_provider


def collect_provider_records(
    provider: str,
    export_paths: Mapping[str, Path | str],
) -> list[TaskRecord] | None:
    path = resolve_export_path(provider, export_paths)
    if path is not None:
        return export_records_from_path(provider, path)

    exporter = _resolve_direct_provider_exporter(provider)
    if exporter is not None:
        return _direct_provider_export(provider, exporter())
    return None


def _direct_provider_export(provider: str, payloads: Sequence[Mapping[str, Any]]) -> list[TaskRecord]:
    normalize_payload = get_provider_normalizer(provider)
    records: list[TaskRecord] = []
    for payload in payloads:
        record = normalize_payload(payload)
        if record is not None:
            records.append(record)
    return records


def _resolve_direct_provider_exporter(provider: str) -> Any:
    exporters: dict[str, Any] = {
        "asana": export_asana_tasks,
        "jira": export_jira_issues,
        "github": export_github_issues,
        "linear": export_linear_issues,
    }
    return exporters.get(provider)


def resolve_export_path(
    provider: str,
    export_paths: Mapping[str, Path | str],
) -> Path | None:
    explicit_path = export_paths.get(provider)
    configured_path = explicit_path or os.getenv(PROVIDER_EXPORT_ENV_VARS.get(provider, ""), "").strip()
    if not configured_path:
        return None

    path = Path(configured_path)
    if not path.exists():
        raise FileNotFoundError(f"{provider} export path does not exist: {path}")
    return path

# Re-export the apply-phase public API lazily (PEP 562) so tri_sync keeps its
# original namespace without an eager circular import when run as __main__.
_APPLY_REEXPORTS = frozenset(
    {
        "apply_sync_action",
        "apply_sync_plan",
        "build_follow_up_plan",
        "dataclass_to_dict",
        "execute_apply_mode",
        "load_sync_state",
        "main",
        "plan_from_sources",
        "resolve_apply_commands_from_env",
        "resolve_enabled_providers_from_env",
        "save_sync_state",
        "summarize_plan",
        "update_sync_state",
    }
)

_PROVIDER_REEXPORTS = frozenset({"apply_provider_action", "extract_provider_target_id"})


def __getattr__(name: str) -> Any:
    if name in _APPLY_REEXPORTS:
        return getattr(importlib.import_module("scripts.task_sync.tri_sync_apply"), name)
    if name in _PROVIDER_REEXPORTS:
        return getattr(importlib.import_module("scripts.task_sync.provider_bridge"), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


if __name__ == "__main__":
    import sys as _sys

    _sys.modules["scripts.task_sync.tri_sync"] = _sys.modules[__name__]
    from scripts.task_sync.tri_sync_apply import main

    raise SystemExit(main())
