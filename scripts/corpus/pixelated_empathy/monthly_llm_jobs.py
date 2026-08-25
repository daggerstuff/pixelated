"""Monthly LLM jobs — orchestrator.

Handles: launch, status, resume with checkpoint idempotency.
Reads month_bible.json + month_enrichment.json, fans out into email and chat batches,
writes generated_emails.json and generated_chat_bursts.json, and produces
llm_generation_report.json.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pixelated_empathy.monthly_llm_generator import generate_batch
from pixelated_empathy.schemas import (
    BatchSpec,
    ChatBurst,
    EmailRecord,
    LLMGenerationReport,
    MonthBible,
    MonthEnrichment,
    MONTH_ORDER,
    MONTH_TARGETS,
)

logger = logging.getLogger(__name__)

# How many artifacts to request per LLM batch call
EMAIL_BATCH_SIZE = 20
CHAT_BATCH_SIZE = 15


def _make_batch_id(month: str, artifact_type: str, batch_num: int) -> str:
    return f"{month}-{artifact_type}-{batch_num:03d}"


def _checkpoint_path(work_dir: Path, batch_id: str) -> Path:
    cp_dir = work_dir / "checkpoints"
    cp_dir.mkdir(parents=True, exist_ok=True)
    return cp_dir / f"{batch_id}.json"


def _load_checkpoint(work_dir: Path, batch_id: str) -> list[dict[str, Any]] | None:
    """Return previously completed batch records, or None if not checkpointed."""
    path = _checkpoint_path(work_dir, batch_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def _save_checkpoint(work_dir: Path, batch_id: str, records: list[dict[str, Any]]) -> None:
    path = _checkpoint_path(work_dir, batch_id)
    path.write_text(json.dumps(records, indent=2, default=str))


def _batch_specs_for_month(
    month: str,
    bible: MonthBible,
    n_email_batches: int,
    n_chat_batches: int,
) -> list[BatchSpec]:
    """Create all batch specs for email and chat generation."""
    events = bible.events
    n_events = len(events)
    specs: list[BatchSpec] = []

    for batch_num in range(1, n_email_batches + 1):
        # Round-robin event assignment across batches
        event_slice = events[(batch_num - 1) % max(n_events, 1) : (batch_num - 1) % max(n_events, 1) + 5]
        if not event_slice:
            event_slice = events[:3]
        event_ids = [e.id for e in event_slice]
        topics = list({t for e in event_slice for t in e.topics})[:6]
        participants: list[str] = []
        for e in event_slice:
            participants.extend(e.participants)
        unique_participants = list(dict.fromkeys(participants))[:5]

        specs.append(
            BatchSpec(
                batch_id=_make_batch_id(month, "email", batch_num),
                month=month,
                artifact_type="email",
                target_count=EMAIL_BATCH_SIZE,
                event_ids=event_ids,
                topics=topics,
                personas_involved=unique_participants or bible.active_personas[:4],
            )
        )

    for batch_num in range(1, n_chat_batches + 1):
        event_slice = events[(batch_num - 1) % max(n_events, 1) : (batch_num - 1) % max(n_events, 1) + 4]
        if not event_slice:
            event_slice = events[:3]
        event_ids = [e.id for e in event_slice]
        topics = list({t for e in event_slice for t in e.topics})[:5]
        participants = []
        for e in event_slice:
            participants.extend(e.participants)
        unique_participants = list(dict.fromkeys(participants))[:5]

        specs.append(
            BatchSpec(
                batch_id=_make_batch_id(month, "chat", batch_num),
                month=month,
                artifact_type="chat",
                target_count=CHAT_BATCH_SIZE,
                event_ids=event_ids,
                topics=topics,
                personas_involved=unique_participants or bible.active_personas[:4],
            )
        )

    return specs


def launch(
    month: str,
    work_dir_root: Path,
    model_override: str | None = None,
    dry_run: bool = False,
) -> LLMGenerationReport:
    """
    Launch (or resume) generation for a month.

    Idempotent: if a batch checkpoint exists, it is replayed rather than regenerated.
    """
    if month not in MONTH_ORDER:
        raise ValueError(f"Unknown month: {month!r}")

    work_dir = work_dir_root / month
    bible_path = work_dir / "month_bible.json"
    enrichment_path = work_dir / "month_enrichment.json"

    if not bible_path.exists():
        raise FileNotFoundError(f"month_bible.json missing for {month}")
    if not enrichment_path.exists():
        raise FileNotFoundError(f"month_enrichment.json missing for {month}")

    bible = MonthBible.model_validate_json(bible_path.read_text())
    enrichment = MonthEnrichment.model_validate_json(enrichment_path.read_text())

    target = MONTH_TARGETS[month]
    target_emails: int = target["emails"]
    target_chats: int = target["chat_bursts"]

    n_email_batches = math.ceil(target_emails / EMAIL_BATCH_SIZE)
    n_chat_batches = math.ceil(target_chats / CHAT_BATCH_SIZE)

    all_specs = _batch_specs_for_month(month, bible, n_email_batches, n_chat_batches)

    # Write lock file
    lock_path = work_dir / "generation.lock"
    lock_path.write_text(datetime.now(tz=timezone.utc).isoformat())

    all_emails: list[EmailRecord] = []
    all_chat_bursts: list[ChatBurst] = []
    batches_run = 0
    batches_succeeded = 0
    batches_failed = 0
    parse_failures = 0
    gate_rejections = 0

    try:
        for spec in all_specs:
            # Check checkpoint
            checkpoint_data = _load_checkpoint(work_dir, spec.batch_id)
            if checkpoint_data is not None:
                logger.info("Replaying checkpoint for batch %s (%d records)", spec.batch_id, len(checkpoint_data))
                if spec.artifact_type == "email":
                    for r in checkpoint_data:
                        try:
                            all_emails.append(EmailRecord(**r))
                        except Exception:
                            pass
                else:
                    for r in checkpoint_data:
                        try:
                            all_chat_bursts.append(ChatBurst(**r))
                        except Exception:
                            pass
                batches_succeeded += 1
                continue

            if dry_run:
                logger.info("[DRY RUN] Would generate batch %s (target %d)", spec.batch_id, spec.target_count)
                batches_run += 1
                batches_succeeded += 1
                continue

            batches_run += 1
            try:
                records, quality_issues = generate_batch(spec, enrichment, work_dir, model_override)
                gate_rejections += len(quality_issues)

                if spec.artifact_type == "email":
                    email_records = [r for r in records if isinstance(r, EmailRecord)]
                    all_emails.extend(email_records)
                    cp_data = [e.model_dump() for e in email_records]
                else:
                    chat_records = [r for r in records if isinstance(r, ChatBurst)]
                    all_chat_bursts.extend(chat_records)
                    cp_data = [c.model_dump() for c in chat_records]

                _save_checkpoint(work_dir, spec.batch_id, cp_data)
                batches_succeeded += 1

            except ValueError as exc:
                if "JSON parsing" in str(exc):
                    parse_failures += 1
                logger.error("Batch %s failed: %s", spec.batch_id, exc)
                batches_failed += 1
            except Exception as exc:
                logger.error("Batch %s unexpected error: %s", spec.batch_id, exc)
                batches_failed += 1

    finally:
        # Write the canonical output files from the in-memory collections.
        # We always overwrite (never append) so that idempotent re-runs
        # produce exactly the records held in checkpoints — no duplicates.
        emails_path = work_dir / "generated_emails.json"
        emails_path.write_text(
            json.dumps([e.model_dump() for e in all_emails], indent=2, default=str)
        )

        chats_path = work_dir / "generated_chat_bursts.json"
        chats_path.write_text(
            json.dumps([c.model_dump() for c in all_chat_bursts], indent=2, default=str)
        )

        if lock_path.exists():
            lock_path.unlink()

    report = LLMGenerationReport(
        month=month,
        batches_run=batches_run,
        batches_succeeded=batches_succeeded,
        batches_failed=batches_failed,
        emails_generated=len(all_emails),
        chat_bursts_generated=len(all_chat_bursts),
        parse_failures=parse_failures,
        gate_rejections=gate_rejections,
    )
    (work_dir / "llm_generation_report.json").write_text(report.model_dump_json(indent=2))

    logger.info(
        "Generation complete for %s: %d emails, %d chat bursts (%d batches failed)",
        month,
        len(all_emails),
        len(all_chat_bursts),
        batches_failed,
    )
    return report


def status(month: str, work_dir_root: Path) -> dict[str, Any]:
    """Return the current generation status for a month."""
    work_dir = work_dir_root / month
    result: dict[str, Any] = {"month": month}

    report_path = work_dir / "llm_generation_report.json"
    if report_path.exists():
        result["report"] = json.loads(report_path.read_text())
    else:
        result["report"] = None

    emails_path = work_dir / "generated_emails.json"
    if emails_path.exists():
        try:
            emails: list[dict[str, Any]] = json.loads(emails_path.read_text())
            result["email_count"] = len(emails)
        except Exception:
            result["email_count"] = 0
    else:
        result["email_count"] = 0

    chats_path = work_dir / "generated_chat_bursts.json"
    if chats_path.exists():
        try:
            chats: list[dict[str, Any]] = json.loads(chats_path.read_text())
            result["chat_burst_count"] = len(chats)
        except Exception:
            result["chat_burst_count"] = 0
    else:
        result["chat_burst_count"] = 0

    checkpoints_dir = work_dir / "checkpoints"
    if checkpoints_dir.exists():
        result["checkpoints"] = len(list(checkpoints_dir.glob("*.json")))
    else:
        result["checkpoints"] = 0

    lock_path = work_dir / "generation.lock"
    result["in_progress"] = lock_path.exists()

    target = MONTH_TARGETS.get(month, {})
    result["target_emails"] = target.get("emails", 0)
    result["target_chat_bursts"] = target.get("chat_bursts", 0)

    return result
