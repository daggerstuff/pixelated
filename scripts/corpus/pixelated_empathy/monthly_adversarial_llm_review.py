"""Monthly adversarial LLM review — 3-persona judge.

Three personas evaluate the corpus:
  1. "Pied Piper" — voice fidelity: "Does each character sound like themselves?"
  2. "Man In Black" — edge-case detector: "What's the one thing that would reveal this is generated?"
  3. "LLM Fidelity Engineer" — quality reviewer: "What would a model evaluator flag?"

A month passes if all 3 personas pass (score >= 0.7 and no critical flags).
"""

from __future__ import annotations

import json
import logging
import random
from pathlib import Path
from typing import Any

import ollama

from pixelated_empathy.schemas import (
    AdversarialLLMReviewReport,
    AuditSeverity,
    ChatBurst,
    EmailRecord,
    GateTier,
    MonthEnrichment,
    PersonaJudgeResult,
    MONTH_ORDER,
    MONTH_TARGETS,
)
from pixelated_empathy.monthly_llm_generator import MODEL_BY_TIER

logger = logging.getLogger(__name__)

PASS_THRESHOLD = 0.70
SAMPLE_SIZE_EMAILS = 30
SAMPLE_SIZE_CHATS = 20


def _load_emails(work_dir: Path) -> list[EmailRecord]:
    path = work_dir / "generated_emails.json"
    if not path.exists():
        return []
    raw: list[dict[str, Any]] = json.loads(path.read_text())
    records: list[EmailRecord] = []
    for r in raw:
        try:
            records.append(EmailRecord(**r))
        except Exception:
            pass
    return records


def _load_chats(work_dir: Path) -> list[ChatBurst]:
    path = work_dir / "generated_chat_bursts.json"
    if not path.exists():
        return []
    raw: list[dict[str, Any]] = json.loads(path.read_text())
    records: list[ChatBurst] = []
    for r in raw:
        try:
            records.append(ChatBurst(**r))
        except Exception:
            pass
    return records


def _format_email_samples(emails: list[EmailRecord], n: int = SAMPLE_SIZE_EMAILS) -> str:
    sample = random.sample(emails, min(n, len(emails)))
    blocks: list[str] = []
    for email in sample:
        blocks.append(
            f"[{email.id}]\n"
            f"From: {email.sender} → {', '.join(email.recipients)}\n"
            f"Subject: {email.subject}\n"
            f"{email.body[:400]}"
        )
    return "\n\n---\n\n".join(blocks)


def _format_chat_samples(chats: list[ChatBurst], n: int = SAMPLE_SIZE_CHATS) -> str:
    sample = random.sample(chats, min(n, len(chats)))
    blocks: list[str] = []
    for burst in sample:
        messages_text = "\n".join(
            f"  {msg.sender}: {msg.text}" for msg in burst.messages
        )
        blocks.append(
            f"[{burst.id}] {burst.room} — {burst.topic}\n{messages_text}"
        )
    return "\n\n---\n\n".join(blocks)


def _pied_piper_prompt(email_samples: str, chat_samples: str) -> str:
    return f"""You are the "Pied Piper" — a sharp script editor who has memorized the voice of each of the 9 personas at Pixelated Empathy. Your job is to evaluate whether each character sounds like themselves.

The 9 personas:
- Chad (CEO): Short emails, metrics-obsessed, no wasted words.
- Marcus (CTO): Technical precision, dry humor, pushes back on hype.
- Ada (Head of Clinical): Careful, formal, patient-first, writes in full paragraphs.
- London (Head of Product): Energetic, customer-centric, em dashes and parentheticals.
- Adaora (Senior Engineer): Direct, ships fast, short declarative emails.
- Naomi (Clinical Lead): Empathetic, detail-oriented, longer than she intends.
- Lin (Designer): Casual, lowercase, links to Figma instead of explaining.
- Ren (DevOps): Terse, 3-word emails, system-focused.
- Mira (Founding Clinician): Early months—brief; later months—philosophical and long.

HARD CONSTRAINTS (flag any violation as CRITICAL):
- Chad never writes more than 8 sentences in a non-board email.
- Ada never uses "amazing", "incredible", "game-changing".
- Nobody uses: "circle back", "double-click", "synergize", "I hope this finds you well".
- Ren does not engage in feature discussions.
- No job-title signatures in internal emails.

EMAIL SAMPLES TO EVALUATE:
{email_samples}

CHAT SAMPLES TO EVALUATE:
{chat_samples}

Respond in JSON with this exact structure:
{{
  "score": <float 0.0-1.0>,
  "passed": <bool>,
  "notes": "<2-4 sentence assessment>",
  "flagged_ids": ["<id1>", "<id2>", ...]
}}

Score >= 0.7 = pass. Flag IDs of artifacts with voice violations. Be specific in notes.
Respond ONLY with the JSON. No markdown.
"""


def _man_in_black_prompt(email_samples: str, chat_samples: str) -> str:
    return f"""You are the "Man In Black" — a language model forensics expert. Your job is to find the ONE thing that would reveal this corpus is AI-generated, not real human communication.

You are looking for:
- Statistical uniformity (all messages same length, all openers different, all subjects follow a template)
- Overly cooperative tone (nobody ever stonewalls, sarcasm is always gentle, disagreements are resolved too cleanly)
- Missing texture (no typos, no incomplete thoughts, no ellipsis trails, no "oops, wrong thread")
- Temporal impossibility (emails sent at suspiciously round times, nobody ever writes at 11pm before a big demo)
- False realism (too many anchors, every email has a meeting reference, every chat ends with action items)
- Cross-character uniformity (Chad's email sounds like Ada's email after persona names are stripped)

EMAIL SAMPLES:
{email_samples}

CHAT SAMPLES:
{chat_samples}

Respond in JSON:
{{
  "score": <float 0.0-1.0 — higher is MORE authentic, NOT more generated>,
  "passed": <bool — pass if score >= 0.7>,
  "notes": "<your single sharpest forensic observation + 1-2 secondary findings>",
  "flagged_ids": ["<id of the artifact most likely to betray generation>"]
}}

Score >= 0.7 = authentic enough to pass. Respond ONLY with JSON. No markdown.
"""


def _fidelity_engineer_prompt(email_samples: str, chat_samples: str) -> str:
    return f"""You are the "LLM Fidelity Engineer" — a technical evaluator who assesses synthetic corpus quality for AI training purposes. Your job is to identify quality issues that would degrade a model trained on this data.

You are checking for:
- Training signal pollution (repeated patterns that would overfit a model)
- Label leakage (artifacts that reveal their own generation — e.g. LLM-style hedging, over-explanation)
- Semantic diversity (are different personas discussing different things, or is there topic monoculture?)
- Hallucination artifacts (names of tools, people, or events that don't exist in the company's world)
- Format consistency (IDs follow naming conventions, dates are parseable, required fields present)
- Balance (email-to-chat ratio appropriate, no one persona dominating)

EMAIL SAMPLES:
{email_samples}

CHAT SAMPLES:
{chat_samples}

Respond in JSON:
{{
  "score": <float 0.0-1.0>,
  "passed": <bool — pass if score >= 0.7>,
  "notes": "<assessment of training data quality — what would degrade a model trained here?>",
  "flagged_ids": ["<ids of artifacts with the worst quality signal>"]
}}

Score >= 0.7 = pass. Respond ONLY with JSON. No markdown.
"""


def _call_judge(
    judge_name: str,
    prompt: str,
    model: str,
) -> PersonaJudgeResult:
    """Call the LLM judge and parse the result."""
    try:
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.3, "num_ctx": 8192},
        )
        raw = response["message"]["content"].strip()

        # Strip code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        parsed: dict[str, Any] = json.loads(raw)
        score = float(parsed.get("score", 0.0))
        passed = bool(parsed.get("passed", score >= PASS_THRESHOLD))
        notes = str(parsed.get("notes", ""))
        flagged_ids = [str(fid) for fid in parsed.get("flagged_ids", [])]

        return PersonaJudgeResult(
            persona=judge_name,
            passed=passed,
            score=score,
            notes=notes,
            flagged_ids=flagged_ids,
        )

    except Exception as exc:
        logger.error("Judge %s failed: %s", judge_name, exc)
        return PersonaJudgeResult(
            persona=judge_name,
            passed=False,
            score=0.0,
            notes=f"Judge call failed: {exc}",
            flagged_ids=[],
        )


def review(
    month: str,
    work_dir_root: Path,
    model_override: str | None = None,
) -> AdversarialLLMReviewReport:
    """Run 3-persona LLM judge review for a month."""
    if month not in MONTH_ORDER:
        raise ValueError(f"Unknown month: {month!r}")

    work_dir = work_dir_root / month

    report_path = work_dir / "llm_generation_report.json"
    if not report_path.exists():
        raise FileNotFoundError(
            f"llm_generation_report.json missing for {month}. Run generation first."
        )

    target = MONTH_TARGETS[month]
    tier: GateTier = target["tier"]
    model = model_override or MODEL_BY_TIER.get(tier, "wayfarer2:latest")

    emails = _load_emails(work_dir)
    chats = _load_chats(work_dir)

    if not emails and not chats:
        report = AdversarialLLMReviewReport(
            month=month,
            passed=False,
            persona_results=[
                PersonaJudgeResult(
                    persona=name,
                    passed=False,
                    score=0.0,
                    notes="No artifacts to review",
                    flagged_ids=[],
                )
                for name in ["Pied Piper", "Man In Black", "LLM Fidelity Engineer"]
            ],
        )
        (work_dir / "adversarial_llm_review_report.json").write_text(
            report.model_dump_json(indent=2)
        )
        return report

    email_samples = _format_email_samples(emails)
    chat_samples = _format_chat_samples(chats)

    results: list[PersonaJudgeResult] = [
        _call_judge(
            "Pied Piper",
            _pied_piper_prompt(email_samples, chat_samples),
            model,
        ),
        _call_judge(
            "Man In Black",
            _man_in_black_prompt(email_samples, chat_samples),
            model,
        ),
        _call_judge(
            "LLM Fidelity Engineer",
            _fidelity_engineer_prompt(email_samples, chat_samples),
            model,
        ),
    ]

    all_passed = all(r.passed for r in results)
    report = AdversarialLLMReviewReport(
        month=month,
        passed=all_passed,
        persona_results=results,
    )

    work_dir.mkdir(parents=True, exist_ok=True)
    (work_dir / "adversarial_llm_review_report.json").write_text(
        report.model_dump_json(indent=2)
    )

    return report
