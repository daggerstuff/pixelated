#!/usr/bin/env python3
"""
Verify quality of the Stage 2 persona re-generation output (10k JSONL).

Streams the S3 artifact, validates schema (messages, metadata.gestalt_simulation),
runs extra quality checks (lengths, directive, refusal/fallback, human-likeness,
persona distribution, duplicate detection), and reports counts + samples.

Requires OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY.

Pipeline-level upgrades (beyond this script):
- Write-time validation in batch_regenerate.py: validate each record before
  appending; skip or retry when assistant is fallback/refusal or fails human-likeness.
- Enforce non-empty directive: when defense model is not loaded, use a richer
  default directive from the persona's default_defense instead of empty.
- Persona balance: optionally bias sampling so no persona exceeds a target fraction.
- Deduplication: hash last assistant message and skip writing if already seen
  (or flag for review).
- Target record count: run until 10k valid records (or configurable target)
  instead of stopping at input exhaustion.
"""

import logging
import os
import sys
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path

# Project root for .env and ai package
_repo_root = Path(__file__).resolve().parents[1]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

with suppress(ImportError):
    from dotenv import load_dotenv

    load_dotenv(_repo_root / ".env")

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    stream=sys.stdout,
)

from ai.core.persona_manager import ROBOTIC_PHRASING_PENALTIES
from ai.core.utils.s3_dataset_loader import S3DatasetLoader

BUCKET = os.getenv("OVH_S3_BUCKET", "pixel-data")
KEY = "final_dataset/shards/curriculum/stage2/synthetic_persona_batch_10000.jsonl"
S3_PATH = f"s3://{BUCKET}/{KEY}"

# Quality thresholds (tunable)
MIN_USER_CHARS = 10
MIN_ASSISTANT_CHARS = 15
MAX_ASSISTANT_CHARS = 4000
MIN_DIRECTIVE_CHARS = 5
PERSONA_IMBALANCE_FRACTION = 0.35  # Flag if any persona > this fraction

# Fallback/refusal substrings that indicate low-value output
REFUSAL_PREFIXES = (
    "i cannot generate",
    "i'm not able to",
    "i can't generate",
    "as an ai",
    "i don't want to talk about it right now",
    "i guess i just don't have much to say about that",
)


def _validate_messages(record: dict, index: int) -> list[str]:
    """Validate messages array and roles. Caller must pass a dict record."""
    errors = []
    messages = record.get("messages")
    if not isinstance(messages, list):
        errors.append(f"line {index}: missing or invalid 'messages' (must be array)")
        return errors
    if len(messages) == 0:
        errors.append(f"line {index}: 'messages' is empty")

    roles = set()
    for i, msg in enumerate(messages):
        if not isinstance(msg, dict):
            errors.append(f"line {index}: messages[{i}] is not an object")
            continue
        r = msg.get("role")
        c = msg.get("content")
        if r:
            roles.add(r)
        if c is not None and not isinstance(c, str):
            errors.append(f"line {index}: messages[{i}].content is not string")
        elif isinstance(c, str) and not c.strip():
            errors.append(f"line {index}: messages[{i}].content is empty")

    if "user" not in roles:
        errors.append(f"line {index}: no 'user' message")
    if "assistant" not in roles:
        errors.append(f"line {index}: no 'assistant' message")
    return errors


def _validate_metadata_gs(record: dict, index: int) -> list[str]:
    """Validate metadata.gestalt_simulation. Caller must pass a dict record."""
    errors = []
    meta = record.get("metadata")
    if not isinstance(meta, dict):
        errors.append(f"line {index}: missing or invalid 'metadata'")
        return errors
    gs = meta.get("gestalt_simulation")
    if not isinstance(gs, dict):
        errors.append(f"line {index}: missing or invalid metadata.gestalt_simulation")
        return errors
    if not gs.get("persona_id"):
        errors.append(f"line {index}: metadata.gestalt_simulation.persona_id missing")
    if "directive" not in gs:
        errors.append(f"line {index}: metadata.gestalt_simulation.directive missing")
    return errors


def validate_record(record: dict, index: int) -> list[str]:
    """Validate a single persona batch record. Returns list of error strings (empty if OK)."""
    if not isinstance(record, dict):
        return [f"line {index}: not a JSON object"]
    errors = _validate_messages(record, index)
    errors.extend(_validate_metadata_gs(record, index))
    return errors


def _last_user_content(record: dict) -> str:
    messages = record.get("messages") or []
    m = next((x for x in reversed(messages) if x.get("role") == "user"), None)
    return (m.get("content") or "").strip() if m else ""


def _last_assistant_content(record: dict) -> str:
    messages = record.get("messages") or []
    m = next((x for x in reversed(messages) if x.get("role") == "assistant"), None)
    return (m.get("content") or "").strip() if m else ""


def _is_refusal_or_fallback(text: str) -> bool:
    stripped = (text or "").strip()
    if not stripped:
        return True
    lower = stripped.lower()
    return any(lower.startswith(p) or p in lower for p in REFUSAL_PREFIXES)


def _fails_human_likeness(text: str) -> bool:
    if not text:
        return True
    text_lower = text.lower()
    if any(phrase in text_lower for phrase in ROBOTIC_PHRASING_PENALTIES):
        return True
    return "\n1." in text and "\n2." in text and "\n3." in text


@dataclass
class _StreamResult:
    total: int
    valid: int
    invalid: int
    error_samples: list[tuple[int, list[str]]]
    sample_records: list[tuple[int, dict]]
    short_user: int
    short_assistant: int
    long_assistant: int
    empty_directive: int
    short_directive: int
    refusal_or_fallback: int
    robotic: int
    persona_counts: dict[str, int]
    last_assistant_hashes: dict[int, int]


@dataclass
class _QualityCounts:
    """Mutable quality counters for streaming aggregation."""

    short_user: int = 0
    short_assistant: int = 0
    long_assistant: int = 0
    empty_directive: int = 0
    short_directive: int = 0
    refusal_or_fallback: int = 0
    robotic: int = 0


def _update_quality_counts(
    record: dict,
    counts: _QualityCounts,
    persona_counts: dict[str, int],
    last_assistant_hashes: dict[int, int],
) -> None:
    """Update quality counters for one valid record."""
    user_text = _last_user_content(record)
    asst_text = _last_assistant_content(record)
    gs = (record.get("metadata") or {}).get("gestalt_simulation") or {}
    directive = (gs.get("directive") or "").strip()

    if len(user_text) < MIN_USER_CHARS:
        counts.short_user += 1
    if len(asst_text) < MIN_ASSISTANT_CHARS:
        counts.short_assistant += 1
    if len(asst_text) > MAX_ASSISTANT_CHARS:
        counts.long_assistant += 1
    if not directive:
        counts.empty_directive += 1
    elif len(directive) < MIN_DIRECTIVE_CHARS:
        counts.short_directive += 1
    if _is_refusal_or_fallback(asst_text):
        counts.refusal_or_fallback += 1
    if _fails_human_likeness(asst_text):
        counts.robotic += 1

    pid = gs.get("persona_id") or "unknown"
    persona_counts[pid] = persona_counts.get(pid, 0) + 1
    h = hash(asst_text)
    last_assistant_hashes[h] = last_assistant_hashes.get(h, 0) + 1


def _stream_and_collect(loader: S3DatasetLoader) -> _StreamResult | str:
    """Stream S3 JSONL and collect counts. Returns _StreamResult or error message string."""
    total = 0
    valid = 0
    invalid = 0
    error_samples: list[tuple[int, list[str]]] = []
    sample_records: list[tuple[int, dict]] = []
    max_error_samples = 10
    counts = _QualityCounts()
    persona_counts: dict[str, int] = {}
    last_assistant_hashes: dict[int, int] = {}

    logger.info("Streaming %s ...", S3_PATH)
    try:
        for idx, record in enumerate(loader.stream_jsonl(S3_PATH)):
            total += 1
            if errs := validate_record(record, idx + 1):
                invalid += 1
                if len(error_samples) < max_error_samples:
                    error_samples.append((idx + 1, errs))
                continue
            valid += 1
            if len(sample_records) < 3:
                sample_records.append((idx + 1, record))
            _update_quality_counts(
                record, counts, persona_counts, last_assistant_hashes
            )
    except Exception as e:
        return str(e)

    return _StreamResult(
        total=total,
        valid=valid,
        invalid=invalid,
        error_samples=error_samples,
        sample_records=sample_records,
        short_user=counts.short_user,
        short_assistant=counts.short_assistant,
        long_assistant=counts.long_assistant,
        empty_directive=counts.empty_directive,
        short_directive=counts.short_directive,
        refusal_or_fallback=counts.refusal_or_fallback,
        robotic=counts.robotic,
        persona_counts=persona_counts,
        last_assistant_hashes=last_assistant_hashes,
    )


def _report_validation(
    total: int,
    valid: int,
    invalid: int,
    error_samples: list[tuple[int, list[str]]],
) -> None:
    logger.info("")
    logger.info("=== Schema validation ===")
    logger.info("Total records: %s", total)
    logger.info("Valid:        %s", valid)
    logger.info("Invalid:      %s", invalid)
    if total:
        logger.info("Pass rate:    %.2f%%", 100.0 * valid / total)
    logger.info("")
    if error_samples:
        logger.info("First few validation errors:")
        for _, errs in error_samples:
            for e in errs:
                logger.info("  %s", e)
        logger.info("")


def _report_quality_metrics(data: _StreamResult) -> None:
    valid = data.valid
    logger.info("=== Quality metrics (valid records only) ===")
    logger.info(
        "Short user message (<%s chars):     %s (%.1f%%)",
        MIN_USER_CHARS,
        data.short_user,
        100.0 * data.short_user / valid,
    )
    logger.info(
        "Short assistant (<%s chars):     %s (%.1f%%)",
        MIN_ASSISTANT_CHARS,
        data.short_assistant,
        100.0 * data.short_assistant / valid,
    )
    logger.info(
        "Long assistant (>%s chars):      %s (%.1f%%)",
        MAX_ASSISTANT_CHARS,
        data.long_assistant,
        100.0 * data.long_assistant / valid,
    )
    logger.info(
        "Empty directive:                                  %s (%.1f%%)",
        data.empty_directive,
        100.0 * data.empty_directive / valid,
    )
    logger.info(
        "Short directive (<%s chars):   %s (%.1f%%)",
        MIN_DIRECTIVE_CHARS,
        data.short_directive,
        100.0 * data.short_directive / valid,
    )
    logger.info(
        "Refusal/fallback phrasing:                        %s (%.1f%%)",
        data.refusal_or_fallback,
        100.0 * data.refusal_or_fallback / valid,
    )
    logger.info(
        "Robotic / human-likeness fail:                    %s (%.1f%%)",
        data.robotic,
        100.0 * data.robotic / valid,
    )
    dup_groups = sum(c > 1 for c in data.last_assistant_hashes.values())
    dup_record_count = sum(max(0, c - 1) for c in data.last_assistant_hashes.values())
    logger.info(
        "Duplicate last-message (groups / duplicate records): %s / %s",
        dup_groups,
        dup_record_count,
    )
    logger.info("")


def _report_persona_distribution(data: _StreamResult) -> None:
    valid = data.valid
    threshold = PERSONA_IMBALANCE_FRACTION * valid
    logger.info("=== Persona distribution ===")
    for pid in sorted(data.persona_counts.keys()):
        c = data.persona_counts[pid]
        pct = 100.0 * c / valid
        flag = " (IMBALANCED)" if c > threshold else ""
        logger.info("  %s: %s (%.1f%%)%s", pid, c, pct, flag)
    logger.info("")


def _report_sample_records(sample_records: list[tuple[int, dict]]) -> None:
    logger.info("Sample records (structure only; content truncated):")
    for line_no, rec in sample_records[:3]:
        msg_count = len(rec.get("messages") or [])
        gs = (rec.get("metadata") or {}).get("gestalt_simulation") or {}
        persona = gs.get("persona_id", "?")
        directive_len = len(gs.get("directive") or "")
        last_msg = (rec.get("messages") or [])[-1] if rec.get("messages") else {}
        last_preview = (last_msg.get("content") or "")[:80].replace("\n", " ")
        logger.info(
            "  Line %s: messages=%s, persona_id=%s, directive_len=%s",
            line_no,
            msg_count,
            persona,
            directive_len,
        )
        logger.info("    last message preview: %s...", last_preview)
    logger.info("")


def main() -> int:
    if not os.getenv("OVH_S3_ACCESS_KEY") or not os.getenv("OVH_S3_SECRET_KEY"):
        logger.error("OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY must be set.")
        return 1

    loader = S3DatasetLoader(bucket=BUCKET)
    result = _stream_and_collect(loader)
    if isinstance(result, str):
        logger.error("%s", result)
        return 1

    _report_validation(
        result.total,
        result.valid,
        result.invalid,
        result.error_samples,
    )
    if result.valid > 0:
        _report_quality_metrics(result)
        _report_persona_distribution(result)
    if result.sample_records:
        _report_sample_records(result.sample_records)

    if result.invalid > 0:
        logger.info("FAIL: Some records failed schema validation.")
        return 1
    logger.info("PASS: All records passed schema validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
