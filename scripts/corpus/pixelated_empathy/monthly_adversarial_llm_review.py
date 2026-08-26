"""Monthly adversarial LLM review — 3-persona clinical judge.

Three clinical personas evaluate the corpus:
  1. "Voice Fidelity Auditor" — voice fidelity: "Does each team member sound like themselves?"
  2. "Clinical Accuracy Reviewer" — clinical accuracy: "Are there clinical errors, wrong terminology, or safety violations?"
  3. "Training Signal Engineer" — quality reviewer: "Would training data generated from this corpus produce a clinically competent model?"

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
            f"From: {email.sender} -> {', '.join(email.recipients)}\n"
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


def _voice_fidelity_prompt(email_samples: str, chat_samples: str) -> str:
    return f"""You are the "Voice Fidelity Auditor" — a clinical communication expert who has memorized the voice of each of the 9 personas at Pixelated Empathy. Your job is to evaluate whether each team member sounds like themselves.

The 9 personas:
- Ada (Clinical Director): Formal, precise, regulatory-minded. Grounds decisions in evidence and policy. Never uses superlatives. Writes in full paragraphs.
- Marcus (AI Systems Lead): Technical, dry humor, pushes back on hype. Quantifies tradeoffs. Bridges engineering and clinical requirements.
- Naomi (Senior Supervisor): Empathetic, detail-oriented, trainee-focused. Grounds feedback in specific therapeutic modalities (MI, CBT, DBT, EMDR). Writes longer than she intends.
- London (Training Program Coordinator): Energetic, trainee-centric. Em dashes and parentheticals. References curriculum milestones and completion rates.
- Adaora (Clinical Research Engineer): Direct, ships fast. References specific outcome measures (PHQ-9, GAD-7, OQ-45). Short declarative emails.
- Mira (Founding Clinician): Early months—brief and uncertain; later months—philosophical and long. References Rogers, Yalom, Brown.
- Lin (Scenario Designer): Casual, lowercase, links to Figma. Designs patient personas and branching narratives.
- Ren (Platform Engineer): Terse, 3-word emails. System-focused. Manages PHI encryption and audit logs.
- Sam (Trainee/Resident): Early months—deferential, asks for approval; later months—confident, pushes back. Always uses de-identified case codes.

HARD CONSTRAINTS (flag any violation as CRITICAL):
- Ada never uses "amazing", "incredible", "game-changing".
- Nobody uses: "circle back", "double-click", "synergize", "I hope this finds you well".
- Ren does not engage in clinical discussions — redirects to infra/security.
- No job-title signatures in internal emails.
- All patient references must use de-identified case codes, never real names.
- Sam's voice must evolve: deferential in early months, confident in later months.

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


def _clinical_accuracy_prompt(email_samples: str, chat_samples: str) -> str:
    return f"""You are the "Clinical Accuracy Reviewer" — a licensed clinical psychologist evaluating the clinical accuracy of synthetic training communications. Your job is to find clinical errors, safety violations, or misrepresentations of therapeutic practice.

You are looking for:
- Incorrect use of clinical terminology (wrong DSM-5-TR criteria, misnamed therapeutic techniques, wrong assessment tools)
- Safety violations (patient identifying information, breach of confidentiality, inappropriate clinical advice)
- Misrepresentation of therapeutic modalities (CBT, DBT, MI, EMDR, TF-CBT described incorrectly)
- Risk assessment errors (wrong protocol, incorrect risk stratification, missing safety planning steps)
- Ethical violations (boundary crossings, dual relationships, inappropriate supervisor-trainee dynamics)
- Clinical plausibility (would a real clinical team communicate this way about these cases?)

EMAIL SAMPLES:
{email_samples}

CHAT SAMPLES:
{chat_samples}

Respond in JSON:
{{
  "score": <float 0.0-1.0 — higher is MORE clinically accurate>,
  "passed": <bool — pass if score >= 0.7>,
  "notes": "<your sharpest clinical accuracy finding + 1-2 secondary observations>",
  "flagged_ids": ["<id of the artifact with the worst clinical accuracy>"]
}}

Score >= 0.7 = clinically accurate enough to pass. Respond ONLY with JSON. No markdown.
"""


def _training_signal_prompt(email_samples: str, chat_samples: str) -> str:
    return f"""You are the "Training Signal Engineer" — a technical evaluator who assesses synthetic corpus quality for AI clinical training purposes. Your job is to identify quality issues that would degrade a model trained on this data.

You are checking for:
- Training signal pollution (repeated patterns that would overfit a model)
- Label leakage (artifacts that reveal their own generation — e.g. LLM-style hedging, over-explanation)
- Semantic diversity (are different personas discussing different clinical topics, or is there topic monoculture?)
- Hallucination artifacts (names of tools, people, or events that don't exist in the clinical program)
- Format consistency (IDs follow naming conventions, dates are parseable, required fields present)
- Clinical balance (email-to-chat ratio appropriate, no one persona dominating, clinical topics distributed across tiers)
- De-identification compliance (all patient references use case codes, no real patient names)

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
                for name in ["Voice Fidelity Auditor", "Clinical Accuracy Reviewer", "Training Signal Engineer"]
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
            "Voice Fidelity Auditor",
            _voice_fidelity_prompt(email_samples, chat_samples),
            model,
        ),
        _call_judge(
            "Clinical Accuracy Reviewer",
            _clinical_accuracy_prompt(email_samples, chat_samples),
            model,
        ),
        _call_judge(
            "Training Signal Engineer",
            _training_signal_prompt(email_samples, chat_samples),
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
