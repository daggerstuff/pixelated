"""Normalization and deterministic ID generation for corpus entries."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from typing import Any

from .model import CorpusEntry, CorpusLane, CorpusSource
from .quality import content_hash, near_duplicate_hash
from .rubrics import normalize_clinician_review, normalize_rubric_items

_ROLE_TO_BUCKET = {
    "assistant": "response",
    "client": "prompt",
    "counselor": "response",
    "gpt": "response",
    "human": "prompt",
    "prompter": "prompt",
    "therapist": "response",
    "user": "prompt",
}
_ENTRY_PROMPT_KEYS = ("input", "prompt", "instruction", "user")
_ENTRY_RESPONSE_KEYS = ("output", "response", "completion", "assistant")
_LANE_VALUES = {"benchmark", "evaluator", "policy", "simulation"}
_SYNTHESIS_OBJECT_KEYS = (
    "scenario_archetype",
    "client_state_profile",
    "benchmark_spec",
)
_SYNTHESIS_SEQUENCE_KEYS = (
    "therapist_moves",
    "therapist_move_inventory",
)
_SYNTHESIS_SCALAR_KEYS = (
    "hidden_driver",
    "difficulty",
    "rupture_risk",
)
_SYNTHESIS_LIST_KEYS = (
    "repair_opportunities",
    "safety_flags",
    "must_detect",
    "likely_therapist_mistakes",
)


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def _conversation_parts(raw: dict[str, Any]) -> tuple[str, str]:
    prompts: list[str] = []
    responses: list[str] = []
    for message in _message_sequence(raw):
        if not isinstance(message, dict):
            continue
        role = _ROLE_TO_BUCKET.get(str(message.get("role", "")).strip().lower())
        content = _clean_text(message.get("content") or message.get("text"))
        if not content or role is None:
            continue
        if role == "prompt":
            prompts.append(content)
        else:
            responses.append(content)
    return "\n".join(prompts).strip(), "\n".join(responses).strip()


def _message_count(raw: dict[str, Any]) -> int:
    return sum(1 for message in _message_sequence(raw) if isinstance(message, dict))


def _message_sequence(raw: dict[str, Any]) -> Iterable[object]:
    messages = raw.get("messages") or raw.get("conversation") or raw.get("turns")
    if not isinstance(messages, Iterable) or isinstance(messages, (str, bytes)):
        return ()
    return messages


def _metadata(raw: dict[str, Any]) -> dict[str, Any]:
    metadata = raw.get("metadata")
    if not isinstance(metadata, dict):
        return {}
    return metadata


def _entry_id(source: CorpusSource, prompt: str, response: str) -> str:
    digest = hashlib.sha256()
    digest.update(source.corpus_id.encode("utf-8"))
    digest.update(b"\0")
    digest.update(source.stage.encode("utf-8"))
    digest.update(b"\0")
    digest.update(prompt.encode("utf-8"))
    digest.update(b"\0")
    digest.update(response.encode("utf-8"))
    return digest.hexdigest()


def assign_split(entry_id: str, seed: str) -> str:
    digest = hashlib.sha256(f"{seed}:{entry_id}".encode()).hexdigest()
    bucket = int(digest[:8], 16) % 100
    if bucket < 90:
        return "train"
    if bucket < 95:
        return "val"
    return "test"


def _normalize_lane_value(value: str) -> CorpusLane | None:
    normalized = value.strip().lower()
    return normalized if normalized in _LANE_VALUES else None


def _lane_candidate(value: object, allowed_lanes: tuple[CorpusLane, ...]) -> CorpusLane | None:
    if not isinstance(value, str):
        return None
    normalized = _normalize_lane_value(value)
    if normalized is None or normalized not in allowed_lanes:
        return None
    return normalized


def _resolve_lane(source: CorpusSource, raw: dict[str, Any]) -> CorpusLane | None:
    candidate = _lane_candidate(raw.get("lane"), source.allowed_lanes)
    if candidate is not None:
        return candidate
    candidate = _lane_candidate(_metadata(raw).get("lane"), source.allowed_lanes)
    if candidate is not None:
        return candidate
    return source.default_lane or (source.allowed_lanes[0] if source.allowed_lanes else None)


def _clean_first(raw: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        cleaned = _clean_text(raw.get(key))
        if cleaned:
            return cleaned
    return ""


def _resolve_prompt_response(raw: dict[str, Any]) -> tuple[str, str]:
    prompt = _clean_first(raw, _ENTRY_PROMPT_KEYS)
    response = _clean_first(raw, _ENTRY_RESPONSE_KEYS)
    if prompt and response:
        return prompt, response
    return _conversation_parts(raw)


def _continuity_attributes(raw: dict[str, Any], metadata: dict[str, Any]) -> dict[str, Any]:
    attributes: dict[str, Any] = {}
    continuity_id = (
        raw.get("continuity_id")
        or raw.get("thread_id")
        or metadata.get("continuity_id")
        or metadata.get("thread_id")
        or raw.get("conversation_id")
    )
    if continuity_id:
        attributes["continuity_id"] = str(continuity_id)

    turn_count = _message_count(raw)
    if turn_count:
        attributes["turn_count"] = turn_count
    elif isinstance(metadata.get("turn_count"), int):
        attributes["turn_count"] = metadata["turn_count"]

    benchmark_slice = attributes.get("benchmark_slice") or metadata.get("benchmark_slice")
    if isinstance(raw.get("benchmark_slice"), str):
        benchmark_slice = raw["benchmark_slice"]
    if isinstance(benchmark_slice, str):
        attributes["benchmark_slice"] = benchmark_slice

    if bool(
        metadata.get("long_running")
        or benchmark_slice == "benchmark_long_running_continuity"
        or (
            "continuity_id" in attributes
            and isinstance(attributes.get("turn_count"), int)
            and attributes["turn_count"] >= 10
        )
    ):
        attributes["long_running"] = True
    return attributes


def _persona_attributes(raw: dict[str, Any], metadata: dict[str, Any]) -> dict[str, Any]:
    for key in ("persona_id", "persona_archetype", "persona_texture"):
        for container in (raw, metadata):
            candidate = container.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return {key: candidate.strip()}
    return {}


def _copy_scalar_attributes(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key in ("conversation_id", "record_id", "label", "category")
        if isinstance((value := raw.get(key)), (str, int, float, bool))
    }


def _sanitize_attribute_value(value: Any) -> Any:
    try:
        return json.loads(json.dumps(value))
    except (TypeError, ValueError):
        return None


def _structured_candidate(raw: dict[str, Any], metadata: dict[str, Any], key: str) -> Any:
    candidate = raw.get(key)
    if candidate is None:
        candidate = metadata.get(key)
    return _sanitize_attribute_value(candidate)


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()
        if cleaned:
            result.append(cleaned)
    return result


def _synthesis_attributes(raw: dict[str, Any], metadata: dict[str, Any]) -> dict[str, Any]:
    attributes: dict[str, Any] = {}

    for key in _SYNTHESIS_OBJECT_KEYS:
        candidate = _structured_candidate(raw, metadata, key)
        if isinstance(candidate, dict) and candidate:
            attributes[key] = candidate

    for key in _SYNTHESIS_SEQUENCE_KEYS:
        candidate = _structured_candidate(raw, metadata, key)
        if isinstance(candidate, list) and candidate:
            normalized_key = "therapist_moves" if key == "therapist_move_inventory" else key
            attributes[normalized_key] = candidate

    for key in _SYNTHESIS_SCALAR_KEYS:
        candidate = raw.get(key)
        if candidate is None:
            candidate = metadata.get(key)
        if isinstance(candidate, str) and candidate.strip():
            attributes[key] = candidate.strip()

    for key in _SYNTHESIS_LIST_KEYS:
        candidate = raw.get(key)
        if candidate is None:
            candidate = metadata.get(key)
        normalized = _normalize_string_list(candidate)
        if normalized:
            attributes[key] = normalized

    benchmark_spec = attributes.get("benchmark_spec")
    if isinstance(benchmark_spec, dict):
        benchmark_slice = benchmark_spec.get("benchmark_slice")
        if isinstance(benchmark_slice, str) and benchmark_slice.strip():
            attributes["benchmark_slice"] = benchmark_slice.strip()
        for key in _SYNTHESIS_SCALAR_KEYS:
            candidate = benchmark_spec.get(key)
            if isinstance(candidate, str) and candidate.strip() and key not in attributes:
                attributes[key] = candidate.strip()
        for key in _SYNTHESIS_LIST_KEYS:
            if key in attributes:
                continue
            normalized = _normalize_string_list(benchmark_spec.get(key))
            if normalized:
                attributes[key] = normalized

    return attributes


def make_entry(source: CorpusSource, raw: dict[str, Any], split_seed: str) -> CorpusEntry | None:
    prompt, response = _resolve_prompt_response(raw)
    if not prompt or not response:
        return None
    lane = _resolve_lane(source, raw)
    if lane is None:
        return None

    entry_id = _entry_id(source, prompt, response)
    metadata = _metadata(raw)
    attributes: dict[str, Any] = dict(metadata)
    attributes["content_hash"] = content_hash(prompt, response)
    attributes["near_duplicate_hash"] = near_duplicate_hash(prompt, response)
    attributes["rubric_items"] = normalize_rubric_items(raw, lane)
    clinician_review = normalize_clinician_review(raw, lane)
    if clinician_review is not None:
        attributes["clinician_review"] = clinician_review
    attributes.update(_synthesis_attributes(raw, metadata))
    attributes.update(_continuity_attributes(raw, metadata))
    attributes.update(_persona_attributes(raw, metadata))
    attributes.update(_copy_scalar_attributes(raw))

    return CorpusEntry(
        entry_id=entry_id,
        source_id=source.source_id,
        stage=source.stage,
        lane=lane,
        prompt=prompt,
        response=response,
        split=assign_split(attributes["content_hash"], split_seed),
        source_family=source.family,
        source_type=source.source_type,
        attributes=attributes,
    )
