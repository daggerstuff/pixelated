"""Monthly LLM generator — per-batch LLM caller.

Handles:
- Split email/chat prompts (one artifact type per request)
- 3-attempt retry with raw-output preservation on failure
- Pre-parse JSON repair (code-fence strip, balanced-brace extraction, trailing-comma removal)
- Post-parse source quality gate (ID shape, dates in-month, no clairvoyance, no placeholders)
- Pre-source-gate artifact repair (date normalization, placeholder replacement)
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import ollama  # type: ignore[import]
from pydantic import ValidationError

from pixelated_empathy.personas import persona_voice_summary
from pixelated_empathy.schemas import (
    BatchSpec,
    ChatBurst,
    ChatMessage,
    ClinicalEvent,
    EmailRecord,
    GateTier,
    MonthEnrichment,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Ollama model selection by gate tier
# ---------------------------------------------------------------------------

MODEL_BY_TIER: dict[GateTier, str] = {
    GateTier.FOUNDATION: "wayfarer2:latest",
    GateTier.ASSESSMENT: "wayfarer2:latest",
    GateTier.CRISIS: "qwen2.5:32b",
    GateTier.RUPTURE_REPAIR: "qwen2.5:32b",
    GateTier.COMPLEX: "qwen2.5:32b",
    GateTier.CERTIFICATION: "qwen2.5:32b",
}

MAX_RETRIES = 3
RETRY_DELAY_SECS = 2.0


# ---------------------------------------------------------------------------
# JSON repair helpers
# ---------------------------------------------------------------------------

def _strip_code_fences(raw: str) -> str:
    """Remove ```json ... ``` wrappers if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _extract_json_array(raw: str) -> str:
    """Extract the first balanced JSON array from a string."""
    start = raw.find("[")
    if start == -1:
        raise ValueError("No JSON array found in output")
    depth = 0
    for i, ch in enumerate(raw[start:], start=start):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return raw[start : i + 1]
    raise ValueError("Unbalanced JSON array in output")


def _remove_trailing_commas(s: str) -> str:
    """Remove trailing commas before ] or }."""
    return re.sub(r",\s*([}\]])", r"\1", s)


def repair_json(raw: str) -> str:
    """Best-effort JSON repair pipeline."""
    s = _strip_code_fences(raw)
    try:
        s = _extract_json_array(s)
    except ValueError:
        pass
    s = _remove_trailing_commas(s)
    return s


# ---------------------------------------------------------------------------
# Artifact repair (pre-source-gate)
# ---------------------------------------------------------------------------

_PLACEHOLDER_BODY_RE = re.compile(
    r"^(-m|-c|short natural subject|\[email body\]|\.\.\.)\s*$",
    re.IGNORECASE,
)


def _repair_email(email: dict[str, Any], month: str) -> dict[str, Any]:
    """Repair common LLM output issues in an email record before schema validation."""
    year, mon = (int(x) for x in month.split("-"))

    # Normalize date to be within the month
    raw_date = email.get("date", "")
    try:
        dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
        if dt.year != year or dt.month != mon:
            # Clamp to first day of month
            email["date"] = f"{month}-01T09:00:00Z"
    except Exception:
        email["date"] = f"{month}-01T09:00:00Z"

    # Replace placeholder body
    body = str(email.get("body", "")).strip()
    if not body or _PLACEHOLDER_BODY_RE.match(body) or len(body) < 20:
        sender = email.get("sender", "Unknown")
        email["body"] = (
            f"Following up on the thread. Happy to discuss further when you have a moment."
        )
        logger.warning("Repaired placeholder body for email sender=%s", sender)

    # Remove sender from recipients if present
    sender = email.get("sender", "")
    recips = email.get("recipients", [])
    if isinstance(recips, list) and sender in recips:
        email["recipients"] = [r for r in recips if r != sender]

    return email


def _repair_chat_burst(burst: dict[str, Any], month: str) -> dict[str, Any]:
    """Repair common LLM output issues in a chat burst before schema validation."""
    year, mon = (int(x) for x in month.split("-"))

    raw_date = burst.get("date", "")
    try:
        dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
        if dt.year != year or dt.month != mon:
            burst["date"] = f"{month}-01T10:00:00Z"
    except Exception:
        burst["date"] = f"{month}-01T10:00:00Z"

    # Repair placeholder messages
    messages = burst.get("messages", [])
    if isinstance(messages, list):
        repaired: list[dict[str, Any]] = []
        for msg in messages:
            text = str(msg.get("text", "")).strip()
            if not text or text in {"-m", "-c", "..."}:
                msg["text"] = "Got it."
            repaired.append(msg)
        burst["messages"] = repaired

    return burst


# ---------------------------------------------------------------------------
# Source quality gate
# ---------------------------------------------------------------------------

def _validate_email_quality(
    email: EmailRecord,
    month: str,
    events: list[ClinicalEvent],
) -> list[str]:
    """Return a list of quality issues, empty if clean."""
    issues: list[str] = []
    year, mon = (int(x) for x in month.split("-"))

    # Date within month
    if email.date.year != year or email.date.month != mon:
        issues.append(f"Date {email.date.date()} outside month {month}")

    # No clairvoyance: event_id must reference an event before or on the email date
    if email.event_id:
        future_events = [
            e for e in events if e.id == email.event_id and e.date > email.date
        ]
        if future_events:
            issues.append(
                f"Clairvoyant event reference: {email.event_id} is after email date {email.date.date()}"
            )

    # Thread date monotonicity is checked at the batch level

    # ID shape: YYYY-MM-llm-email-NNN-N
    parts = email.id.split("-")
    if len(parts) < 6:
        issues.append(f"Malformed email id: {email.id}")

    return issues


def _validate_chat_quality(
    burst: ChatBurst,
    month: str,
    events: list[ClinicalEvent],
) -> list[str]:
    issues: list[str] = []
    year, mon = (int(x) for x in month.split("-"))

    if burst.date.year != year or burst.date.month != mon:
        issues.append(f"Date {burst.date.date()} outside month {month}")

    if burst.event_id:
        future_events = [
            e for e in events if e.id == burst.event_id and e.date > burst.date
        ]
        if future_events:
            issues.append(f"Clairvoyant event reference: {burst.event_id}")

    parts = burst.id.split("-")
    if len(parts) < 5:
        issues.append(f"Malformed chat id: {burst.id}")

    return issues


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def _email_prompt(
    batch_spec: BatchSpec,
    enrichment: MonthEnrichment,
    events: list[ClinicalEvent],
    reference_examples: list[dict[str, Any]],
) -> str:
    persona_blocks = "\n\n".join(
        persona_voice_summary(name)
        for name in batch_spec.personas_involved
        if name in enrichment.model_dump().get("persona_contexts", {})
        or True  # always include requested personas
    )

    event_summaries = "\n".join(
        f"  {e.id} ({e.date.date()}) — {e.summary}"
        for e in events
        if e.id in batch_spec.event_ids
    )

    ref_block = "\n\n".join(
        f"[REFERENCE ONLY — NOT OUTPUT]\n"
        f"From: {ex.get('sender')} To: {ex.get('recipients')}\n"
        f"Subject: {ex.get('subject')}\n"
        f"{ex.get('body')}"
        for ex in reference_examples[:3]
        if ex.get("__type") == "reference_non_output" and "body" in ex
    )

    topic_list = ", ".join(batch_spec.topics[:10])

    return f"""You are generating a synthetic clinical training corpus for the Pixelated Empathy platform (month: {batch_spec.month}).

CLINICAL CONTEXT:
Pixelated Empathy is a clinical AI training platform where a 9-person clinical team practices and supervises mental health
skills through AI-powered patient simulations. The 9 personas are:
- Ada (Clinical Director): Formal, precise, regulatory-minded, grounds decisions in evidence and policy.
- Marcus (AI Systems Lead): Technical, dry humor, pushes back on hype, bridges engineering and clinical requirements.
- Naomi (Senior Supervisor): Empathetic, detail-oriented, trainee-focused, grounds feedback in specific therapeutic modalities.
- London (Training Program Coordinator): Energetic, trainee-centric, thinks in curriculum milestones and training outcomes.
- Adaora (Clinical Research Engineer): Direct, ships fast, references specific outcome measures (PHQ-9, GAD-7, OQ-45).
- Mira (Founding Clinician): Visionary, philosophical, integrates clinical theory with AI implications.
- Lin (Scenario Designer): Visual thinker, casual, designs patient personas and branching narrative scripts.
- Ren (Platform Engineer): Terse, system-focused, manages PHI encryption and audit logs.
- Sam (Trainee/Resident): Evolves from deferential and uncertain to confident and independent across the 12-month curriculum.

MONTH EVENTS (anchor every email to one of these):
{event_summaries}

TOPICS THIS BATCH: {topic_list}

PERSONAS INVOLVED:
{persona_blocks}

VOICE RULES:
- Let people be professional but human — tired, frustrated, caring, sometimes sarcastic. This is a clinical training team, not an HR module.
- No job-title signatures in internal emails unless the context is formal/external.
- Every communication thread must carry a real clinical anchor: a case code, a supervision observation, a training metric, a patient persona, a protocol reference, or a curriculum milestone.
- Emails should vary in length, opener style, and register across senders.
- No stock phrases: "circle back", "double-click", "synergize", "I hope this finds you well", "per my last email", "going forward".
- No formulaic closers: every email should close in the sender's natural voice.
- All patient references must use de-identified case codes (e.g., "Case 2025-07-003"). Never use real patient names.
- Clinical terminology should be used accurately — DSM-5-TR criteria, therapeutic modalities (CBT, DBT, MI, EMDR, TF-CBT), assessment tools (PHQ-9, GAD-7, Columbia Protocol).

REFERENCE EXAMPLES (do NOT include these in output — study the style only):
{ref_block}

TASK: Generate exactly {batch_spec.target_count} email records as a JSON array. Each record must match this schema exactly:
{{
  "id": "{batch_spec.month}-llm-email-NNN-N",
  "thread_id": "{batch_spec.month}-llm-email-NNN",
  "date": "YYYY-MM-DDTHH:MM:SSZ",
  "sender": "<persona name>",
  "recipients": ["<persona name>", ...],
  "subject": "<subject line>",
  "body": "<email body — minimum 30 words>",
  "event_id": "<EVT-YYYY-NNN or null>",
  "topic": "<topic string>",
  "communication_type": "supervision|case_consult|care_coordination|training|admin"
}}

CONSTRAINTS:
- All dates must be in {batch_spec.month}.
- Do NOT reference events with dates after the email's own date (no clairvoyance).
- Sender must NOT appear in recipients.
- Bodies must be genuine email text — no placeholders, no "-m", no "-c".
- Batch ID prefix for this batch: {batch_spec.batch_id}. Number emails sequentially within this batch.

OUTPUT: Only the JSON array. No commentary, no markdown fences, no explanation.
"""


def _chat_prompt(
    batch_spec: BatchSpec,
    enrichment: MonthEnrichment,
    events: list[ClinicalEvent],
    reference_examples: list[dict[str, Any]],
) -> str:
    event_summaries = "\n".join(
        f"  {e.id} ({e.date.date()}) — {e.summary}"
        for e in events
        if e.id in batch_spec.event_ids
    )

    ref_block = "\n\n".join(
        f"[REFERENCE ONLY — NOT OUTPUT]\n"
        f"Room: {ex.get('room')} | Topic: {ex.get('topic')}\n"
        + "\n".join(f"  {m['sender']}: {m['text']}" for m in ex.get("messages", []))
        for ex in reference_examples[:2]
        if ex.get("__type") == "reference_non_output" and "messages" in ex
    )

    topic_list = ", ".join(batch_spec.topics[:10])

    return f"""You are generating synthetic clinical team chat bursts for the Pixelated Empathy platform (month: {batch_spec.month}).

CLINICAL CONTEXT:
9-person clinical training team. Channels: #general, #clinical, #supervision, #engineering, #scenarios, #infra, #random, #leadership, #data, #announcements.

MONTH EVENTS (anchor each burst to one):
{event_summaries}

TOPICS THIS BATCH: {topic_list}

CHAT VOICE RULES:
- Chats should have off-topic texture, controlled disagreement, and cross-artifact callbacks — not just task reporting.
- Each burst is 3–12 messages. Messages should feel like real Slack/chat messages between clinical team members.
- Mix quick reactions (👍, "on it", "done") with substantive exchanges.
- Room assignments must be appropriate: clinical discussions in #clinical, supervision in #supervision, technical in #engineering, scenario design in #scenarios, infrastructure in #infra.
- Do NOT have every burst be a celebration or a crisis. Most chats are mundane clinical coordination.
- No message should just restate the previous message.
- All patient references must use de-identified case codes. Never use real patient names.

REFERENCE EXAMPLES (study the style, do NOT output):
{ref_block}

TASK: Generate exactly {batch_spec.target_count} chat burst records as a JSON array. Schema:
{{
  "id": "{batch_spec.month}-llm-chat-NNN",
  "event_id": "<EVT-YYYY-NNN or null>",
  "room": "#<channel>",
  "date": "YYYY-MM-DDTHH:MM:SSZ",
  "topic": "<topic string>",
  "discussion_type": "debrief|case_conference|huddle|supervision|crisis_response",
  "messages": [
    {{"sender": "<name>", "text": "<message text>"}},
    ...
  ]
}}

CONSTRAINTS:
- All dates must be in {batch_spec.month}.
- No clairvoyant event references (event date must be <= burst date).
- Each burst must have at least 3 messages.
- Batch ID prefix: {batch_spec.batch_id}.
- Topics: {topic_list}.

OUTPUT: Only the JSON array. No commentary. No markdown.
"""


# ---------------------------------------------------------------------------
# Core generation function
# ---------------------------------------------------------------------------

def _save_parse_failure(
    batch_id: str,
    attempt: int,
    raw_output: str,
    parse_failures_dir: Path,
) -> Path:
    parse_failures_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S")
    path = parse_failures_dir / f"{batch_id}_attempt{attempt}_{ts}.txt"
    path.write_text(raw_output)
    return path


def generate_batch(
    batch_spec: BatchSpec,
    enrichment: MonthEnrichment,
    work_dir: Path,
    model_override: str | None = None,
) -> tuple[list[EmailRecord] | list[ChatBurst], list[dict[str, Any]]]:
    """
    Run LLM generation for one batch.

    Returns:
        (validated_records, quality_issues)
        validated_records: list of EmailRecord or ChatBurst (whichever batch_spec.artifact_type is)
        quality_issues: list of dicts describing records that failed quality gates
    """
    parse_failures_dir = work_dir / "parse_failures"
    model = model_override or MODEL_BY_TIER.get(enrichment.tier, "wayfarer2:latest")
    events = enrichment.events

    if batch_spec.artifact_type == "email":
        prompt = _email_prompt(batch_spec, enrichment, events, enrichment.reference_examples)
    elif batch_spec.artifact_type == "chat":
        prompt = _chat_prompt(batch_spec, enrichment, events, enrichment.reference_examples)
    else:
        raise ValueError(f"Unknown artifact_type: {batch_spec.artifact_type}")

    raw_output: str = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = ollama.chat(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.75, "num_ctx": 8192},
            )
            raw_output = response["message"]["content"]
        except Exception as exc:
            logger.warning("Batch %s attempt %d: Ollama error: %s", batch_spec.batch_id, attempt, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECS)
                continue
            raise

        # Parse
        try:
            repaired = repair_json(raw_output)
            parsed: list[dict[str, Any]] = json.loads(repaired)
            if not isinstance(parsed, list):
                raise ValueError("Top-level JSON is not a list")
            break
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning(
                "Batch %s attempt %d: JSON parse failure: %s",
                batch_spec.batch_id,
                attempt,
                exc,
            )
            _save_parse_failure(batch_spec.batch_id, attempt, raw_output, parse_failures_dir)
            if attempt == MAX_RETRIES:
                raise ValueError(
                    f"Batch {batch_spec.batch_id} failed JSON parsing after {MAX_RETRIES} attempts"
                ) from exc
            time.sleep(RETRY_DELAY_SECS)
    else:
        raise RuntimeError(f"Batch {batch_spec.batch_id}: exhausted retries without successful parse")

    # Repair + validate
    validated_records: list[Any] = []
    quality_issues: list[dict[str, Any]] = []

    for raw_record in parsed:
        if not isinstance(raw_record, dict):
            quality_issues.append({"issue": "non-dict record", "raw": str(raw_record)[:200]})
            continue

        if batch_spec.artifact_type == "email":
            repaired_record = _repair_email(raw_record, batch_spec.month)
            try:
                email = EmailRecord(**repaired_record)
            except (ValidationError, TypeError) as exc:
                quality_issues.append({
                    "issue": "schema_validation_failed",
                    "artifact_id": raw_record.get("id", "unknown"),
                    "detail": str(exc),
                })
                continue
            issues = _validate_email_quality(email, batch_spec.month, events)
            if issues:
                for issue in issues:
                    quality_issues.append({
                        "issue": "quality_gate",
                        "artifact_id": email.id,
                        "detail": issue,
                    })
                continue
            validated_records.append(email)

        elif batch_spec.artifact_type == "chat":
            repaired_record = _repair_chat_burst(raw_record, batch_spec.month)
            try:
                burst = ChatBurst(**repaired_record)
            except (ValidationError, TypeError) as exc:
                quality_issues.append({
                    "issue": "schema_validation_failed",
                    "artifact_id": raw_record.get("id", "unknown"),
                    "detail": str(exc),
                })
                continue
            issues = _validate_chat_quality(burst, batch_spec.month, events)
            if issues:
                for issue in issues:
                    quality_issues.append({
                        "issue": "quality_gate",
                        "artifact_id": burst.id,
                        "detail": issue,
                    })
                continue
            validated_records.append(burst)

    logger.info(
        "Batch %s: %d/%d records passed validation (%d quality issues)",
        batch_spec.batch_id,
        len(validated_records),
        len(parsed),
        len(quality_issues),
    )
    return validated_records, quality_issues
