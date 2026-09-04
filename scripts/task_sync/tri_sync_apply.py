from __future__ import annotations

import json
import os
import shlex
import sys
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from scripts.task_sync import tri_sync as _tri_sync
from scripts.task_sync.provider_bridge import extract_provider_target_id
from scripts.task_sync.tri_sync import (
    DEFAULT_APPLY_MAX_PASSES,
    DEFAULT_APPLY_MAX_WORKERS,
    DEFAULT_PROVIDER_ORDER,
    PROVIDER_APPLY_COMMAND_ENV_VARS,
    SYNC_STATE_PATH,
    SyncAction,
    SyncExecutionResult,
    SyncMetadata,
    _run_process,
    merge_body_with_sync_metadata,
    provider_ids_match,
    task_body_without_sync_block,
)


def load_sync_state(path: Path = SYNC_STATE_PATH) -> dict[str, Any]:
    if not path.exists():
        return {"records": {}}

    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"records": {}}

    if not isinstance(state, dict):
        return {"records": {}}
    if not isinstance(state.get("records"), dict):
        state["records"] = {}
    return state


def save_sync_state(state: Mapping[str, Any], path: Path = SYNC_STATE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def update_sync_state(
    plan: Sequence[SyncAction],
    results: Sequence[SyncExecutionResult],
    *,
    state: Mapping[str, Any] | None = None,
    applied_at: str | None = None,
) -> dict[str, Any]:
    next_state = dict(state or {})
    records = next_state.get("records")
    if not isinstance(records, dict):
        records = {}
        next_state["records"] = records

    timestamp = applied_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for action, result in zip(plan, results, strict=True):
        existing_record = records.get(action.sync_key)
        record = dict(existing_record) if isinstance(existing_record, dict) else {}

        provider_ids = record.get("provider_ids")
        if not isinstance(provider_ids, dict):
            provider_ids = {}
        provider_ids.update(
            {provider: external_id for provider, external_id in action.provider_ids.items() if external_id}
        )
        if result.success and result.target_id:
            provider_ids[action.provider] = result.target_id

        providers = record.get("providers")
        if not isinstance(providers, dict):
            providers = {}

        providers[action.provider] = {
            "action": action.action,
            "success": result.success,
            "target_id": result.target_id,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "updated_at": timestamp,
        }

        record.update(
            {
                "sync_key": action.sync_key,
                "source_provider": action.source_provider,
                "source_id": action.source_id,
                "title": action.title,
                "status": action.status,
                "provider_ids": provider_ids,
                "providers": providers,
                "updated_at": timestamp,
            }
        )
        records[action.sync_key] = record

    next_state["last_applied_at"] = timestamp
    next_state["record_count"] = len(records)
    return next_state


def summarize_plan(plan: Sequence[SyncAction]) -> dict[str, int]:
    summary = {"create": 0, "update": 0}
    for action in plan:
        summary[action.action] = summary.get(action.action, 0) + 1
    return summary


def resolve_apply_commands_from_env() -> dict[str, list[str]]:
    commands: dict[str, list[str]] = {}
    for provider, env_var in PROVIDER_APPLY_COMMAND_ENV_VARS.items():
        raw_command = os.getenv(env_var, "").strip()
        if raw_command:
            commands[provider] = shlex.split(raw_command)
    return commands


def _apply_bridge_action(
    action: SyncAction,
    *,
    provider_commands: Mapping[str, Sequence[str]],
    run_process: Any,
) -> SyncExecutionResult:
    command = provider_commands.get(action.provider)
    if not command:
        raise RuntimeError(
            f"No apply command configured for provider '{action.provider}'. "
            f"Set {PROVIDER_APPLY_COMMAND_ENV_VARS.get(action.provider, 'a provider command env var')}."
        )

    completed = run_process(command, input_text=json.dumps(dataclass_to_dict(action)))
    stdout = (getattr(completed, "stdout", "") or "").strip()
    payload = _parse_bridge_stdout_payload(stdout)
    target_id = (
        extract_provider_target_id(action.provider, payload) if isinstance(payload, Mapping) else None
    ) or action.target_id
    return SyncExecutionResult(
        provider=action.provider,
        action=action.action,
        sync_key=action.sync_key,
        target_id=target_id,
        success=getattr(completed, "returncode", 1) == 0,
        stdout=stdout,
        stderr=(getattr(completed, "stderr", "") or "").strip(),
    )


def _apply_direct_provider_action(action: SyncAction) -> SyncExecutionResult:
    payload = dataclass_to_dict(action)
    applier = _resolve_direct_provider_applier(action.provider)
    if applier is None:
        raise RuntimeError(f"Unsupported direct provider apply for '{action.provider}'.")
    response = applier(payload)

    return SyncExecutionResult(
        provider=action.provider,
        action=action.action,
        sync_key=action.sync_key,
        target_id=extract_provider_target_id(action.provider, response) or action.target_id,
        success=True,
        stdout=json.dumps(response, sort_keys=True),
        stderr="",
    )


def _resolve_direct_provider_applier(provider: str) -> Any:
    if provider in {"asana", "jira", "github", "linear"}:
        return lambda payload: _tri_sync.apply_provider_action(provider, payload)
    return None


def apply_sync_action(
    action: SyncAction,
    *,
    provider_commands: Mapping[str, Sequence[str]] | None = None,
    run_process: Any = _run_process,
) -> SyncExecutionResult:
    provider_commands = provider_commands or {}

    sys.stderr.write(f"[{action.provider}] Starting {action.action} for '{action.sync_key}'\n")
    sys.stderr.flush()
    has_direct_applier = _resolve_direct_provider_applier(action.provider) is not None
    has_provider_command = action.provider in provider_commands

    if has_direct_applier and not has_provider_command:
        res = _apply_direct_provider_action(action)
    elif not has_provider_command:
        raise RuntimeError(f"No sync execution path configured for provider '{action.provider}'.")
    else:
        res = _apply_bridge_action(
            action,
            provider_commands=provider_commands,
            run_process=run_process,
        )

    sys.stderr.write(
        f"[{action.provider}] Completed {action.action} for '{action.sync_key}' -> {'Success' if res.success else 'Failure'} (ID: {res.target_id})\n"
    )
    sys.stderr.flush()
    return res


def apply_sync_plan(
    plan: Sequence[SyncAction],
    *,
    provider_commands: Mapping[str, Sequence[str]] | None = None,
    run_process: Any = _run_process,
    max_workers: int | None = None,
) -> list[SyncExecutionResult]:
    if not plan:
        return []

    configured_workers = max_workers or int(
        os.getenv("PIXELATED_TASK_SYNC_MAX_WORKERS", str(DEFAULT_APPLY_MAX_WORKERS))
    )
    worker_count = max(1, min(configured_workers, len(plan)))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [
            executor.submit(
                apply_sync_action,
                action,
                provider_commands=provider_commands,
                run_process=run_process,
            )
            for action in plan
        ]
        return [future.result() for future in futures]


def build_follow_up_plan(
    plan: Sequence[SyncAction],
    results: Sequence[SyncExecutionResult],
) -> list[SyncAction]:
    enabled_providers = _tri_sync.resolve_enabled_providers_from_env()
    grouped: dict[str, list[tuple[SyncAction, SyncExecutionResult]]] = {}
    for action, result in zip(plan, results, strict=True):
        if not result.success or not result.target_id:
            continue
        grouped.setdefault(action.sync_key, []).append((action, result))

    follow_up: list[SyncAction] = []
    for sync_key, pairs in grouped.items():
        if not pairs:
            continue
        template_action = pairs[0][0]
        merged_provider_ids = dict(template_action.provider_ids)
        current_provider_ids: dict[str, str] = {}
        for action, result in pairs:
            merged_provider_ids.update(
                {provider: external_id for provider, external_id in action.provider_ids.items() if external_id}
            )
            if result.target_id:
                merged_provider_ids[action.provider] = result.target_id
                if action.action == "update":
                    current_provider_ids[action.provider] = result.target_id

        for provider, target_id in sorted(merged_provider_ids.items()):
            if provider not in enabled_providers:
                continue
            current_ids = dict(template_action.provider_ids)
            if provider in current_provider_ids:
                current_ids[provider] = current_provider_ids[provider]
            if provider_ids_match(current_ids, merged_provider_ids):
                continue

            follow_up_body = merge_body_with_sync_metadata(
                task_body_without_sync_block(template_action.body),
                SyncMetadata(
                    key=sync_key,
                    status=template_action.status,
                    source_provider=template_action.source_provider,
                    source_id=template_action.source_id,
                    provider_ids=merged_provider_ids,
                ),
            )
            follow_up.append(
                SyncAction(
                    provider=provider,
                    action="update",
                    sync_key=sync_key,
                    source_provider=template_action.source_provider,
                    source_id=template_action.source_id,
                    target_id=target_id,
                    title=template_action.title,
                    body=follow_up_body,
                    status=template_action.status,
                    provider_ids=merged_provider_ids,
                    priority_label=template_action.priority_label,
                    labels=template_action.labels,
                )
            )

    follow_up.sort(key=lambda action: (action.sync_key, action.provider))
    return follow_up


def plan_from_sources(
    *,
    enabled_providers: Sequence[str] = DEFAULT_PROVIDER_ORDER,
    export_paths: Mapping[str, Path | str] | None = None,
) -> list[SyncAction]:
    return _tri_sync.build_sync_plan(
        _tri_sync.collect_records(enabled_providers=enabled_providers, export_paths=export_paths),
        enabled_providers=enabled_providers,
    )


def resolve_enabled_providers_from_env() -> tuple[str, ...]:
    raw = os.getenv("PIXELATED_TASK_SYNC_PROVIDERS", "").strip()
    if not raw:
        return DEFAULT_PROVIDER_ORDER

    providers = tuple(
        provider.strip().lower() for provider in raw.split(",") if provider.strip().lower() in DEFAULT_PROVIDER_ORDER
    )
    return providers or DEFAULT_PROVIDER_ORDER


def execute_apply_mode(
    plan: Sequence[SyncAction],
) -> tuple[dict[str, Any], int]:
    provider_commands = _tri_sync.resolve_apply_commands_from_env()
    max_passes = max(
        1,
        int(os.getenv("PIXELATED_TASK_SYNC_MAX_PASSES", str(DEFAULT_APPLY_MAX_PASSES))),
    )
    state = load_sync_state(path=_tri_sync.SYNC_STATE_PATH)
    all_results: list[SyncExecutionResult] = []
    pass_summaries: list[dict[str, Any]] = []
    current_plan = list(plan)

    for pass_index in range(1, max_passes + 1):
        if not current_plan:
            break
        results = _tri_sync.apply_sync_plan(current_plan, provider_commands=provider_commands)
        all_results.extend(results)
        state = update_sync_state(current_plan, results, state=state)
        save_sync_state(state, path=_tri_sync.SYNC_STATE_PATH)
        pass_summaries.append(
            {
                "pass": pass_index,
                "summary": summarize_plan(current_plan),
                "result_count": len(results),
                "success": all(result.success for result in results),
            }
        )
        if not all(result.success for result in results):
            break
        current_plan = build_follow_up_plan(current_plan, results)

    payload: dict[str, Any] = {
        "passes": pass_summaries,
        "results": [dataclass_to_dict(result) for result in all_results],
    }
    exit_code = 0
    if not all(result.success for result in all_results):
        exit_code = 1
    return payload, exit_code


def main(argv: Sequence[str] | None = None) -> int:
    args = list(argv or sys.argv[1:])
    mode = args[0] if args else "plan"

    if mode not in {"plan", "dry-run", "apply"}:
        raise SystemExit("Usage: tri_sync.py [plan|dry-run|apply]")

    enabled_providers = resolve_enabled_providers_from_env()
    records_by_provider = _tri_sync.collect_records(enabled_providers=enabled_providers)
    plan = _tri_sync.build_sync_plan(records_by_provider, enabled_providers=enabled_providers)
    action_payloads = [dataclass_to_dict(action) for action in plan]
    payload: dict[str, Any] = {
        "mode": mode,
        "summary": summarize_plan(plan),
        "actions": action_payloads,
    }
    if mode == "apply":
        apply_payload, exit_code = execute_apply_mode(plan)
        payload.update(apply_payload)
        if exit_code:
            sys.stdout.write(json.dumps(payload, indent=2) + "\n")
            return exit_code

    sys.stdout.write(json.dumps(payload, indent=2) + "\n")
    return 0


def dataclass_to_dict(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return {field_name: dataclass_to_dict(getattr(value, field_name)) for field_name in value.__dataclass_fields__}
    if isinstance(value, Mapping):
        return {key: dataclass_to_dict(item) for key, item in value.items()}
    if isinstance(value, list):
        return [dataclass_to_dict(item) for item in value]
    return value


def _parse_bridge_stdout_payload(stdout: str) -> Mapping[str, Any] | None:
    candidates = [stdout.strip()]
    lines = [line for line in stdout.splitlines() if line.strip()]
    if lines:
        candidates.extend(reversed(lines))

    for candidate in candidates:
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, Mapping):
            return payload
    return None


if __name__ == "__main__":
    raise SystemExit(main())
