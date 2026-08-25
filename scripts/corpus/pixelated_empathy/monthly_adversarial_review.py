"""Monthly adversarial review — rule-based voice slop detection.

Rejects:
- Repeated normalized lines across bursts (Jaccard similarity above threshold)
- Stock phrases: "circle back", "double-click", "synergize"
- Formulaic openers: "I hope this finds you well"
- Chat lines that just restate the parent message (cosine/overlap heuristic)
- Empty/placeholder bodies: "-m", "-c", "short natural subject"

A month passes this gate if it has 0 CRITICAL findings.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from pixelated_empathy.schemas import (
    AdversarialFinding,
    AdversarialReviewReport,
    AuditSeverity,
    ChatBurst,
    EmailRecord,
    MONTH_ORDER,
)

# ---------------------------------------------------------------------------
# Slop patterns
# ---------------------------------------------------------------------------

STOCK_PHRASES_RE = re.compile(
    r"\b(circle back|double.click|synergize|synergies|leverage|per my last email"
    r"|going forward|reach out|touch base|move the needle|deep.dive"
    r"|bandwidth|unpack|ideate|deliverables|actionable|paradigm.shift)\b",
    re.IGNORECASE,
)

FORMULAIC_OPENER_RE = re.compile(
    r"^(i hope (this|it) finds you well|hope you're (doing well|having a great day)"
    r"|as per our (previous |last )?conversation|please don't hesitate to"
    r"|i wanted to (reach out|circle back|follow up)|to (recap|summarize|reiterate))",
    re.IGNORECASE,
)

PLACEHOLDER_BODY_RE = re.compile(
    r"^(-m|-c|short natural subject|\[email body\]|\.\.\.|placeholder|lorem ipsum)\s*$",
    re.IGNORECASE,
)

JACCARD_THRESHOLD = 0.6  # above this = "repeated normalized line"
MIN_TOKENS_FOR_JACCARD = 6  # only check lines with enough content


def _tokenize(text: str) -> frozenset[str]:
    return frozenset(re.findall(r"\b\w+\b", text.lower()))


def _jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _check_emails(emails: list[EmailRecord]) -> list[AdversarialFinding]:
    findings: list[AdversarialFinding] = []

    for email in emails:
        body = email.body.strip()

        # Placeholder body
        if PLACEHOLDER_BODY_RE.match(body) or len(body) < 20:
            findings.append(AdversarialFinding(
                severity=AuditSeverity.CRITICAL,
                rule="placeholder_body",
                artifact_id=email.id,
                excerpt=body[:80],
                detail="Email body is a placeholder or too short",
            ))
            continue

        # Stock phrases
        stock_hits = STOCK_PHRASES_RE.findall(body)
        if stock_hits:
            findings.append(AdversarialFinding(
                severity=AuditSeverity.WARNING,
                rule="stock_phrase",
                artifact_id=email.id,
                excerpt=body[:120],
                detail=f"Stock phrase(s) found: {', '.join(set(h.lower() for h in stock_hits))}",
            ))

        # Formulaic opener — check first line
        first_line = body.split("\n")[0].strip()
        if FORMULAIC_OPENER_RE.match(first_line):
            findings.append(AdversarialFinding(
                severity=AuditSeverity.CRITICAL,
                rule="formulaic_opener",
                artifact_id=email.id,
                excerpt=first_line[:100],
                detail="Formulaic opener detected",
            ))

    # Jaccard check: repeated normalized lines across email bodies
    body_tokens: list[tuple[str, frozenset[str]]] = []
    for email in emails:
        tokens = _tokenize(email.body)
        if len(tokens) >= MIN_TOKENS_FOR_JACCARD:
            body_tokens.append((email.id, tokens))

    # O(n^2) but bounded by batch size; flag pairs above threshold
    flagged_for_repetition: set[str] = set()
    for i in range(len(body_tokens)):
        for j in range(i + 1, len(body_tokens)):
            id_a, tokens_a = body_tokens[i]
            id_b, tokens_b = body_tokens[j]
            sim = _jaccard(tokens_a, tokens_b)
            if sim >= JACCARD_THRESHOLD and id_a not in flagged_for_repetition:
                findings.append(AdversarialFinding(
                    severity=AuditSeverity.WARNING,
                    rule="repeated_content",
                    artifact_id=id_a,
                    excerpt=f"Similar to {id_b} (Jaccard={sim:.2f})",
                    detail=f"Email bodies are {sim:.0%} similar",
                ))
                flagged_for_repetition.add(id_a)

    return findings


def _check_chats(chats: list[ChatBurst]) -> list[AdversarialFinding]:
    findings: list[AdversarialFinding] = []

    for burst in chats:
        messages = burst.messages
        if len(messages) < 2:
            continue

        # Check each message against the previous
        for i in range(1, len(messages)):
            prev_text = messages[i - 1].text.strip().lower()
            curr_text = messages[i].text.strip().lower()

            # Placeholder check
            if PLACEHOLDER_BODY_RE.match(curr_text):
                findings.append(AdversarialFinding(
                    severity=AuditSeverity.CRITICAL,
                    rule="placeholder_message",
                    artifact_id=burst.id,
                    excerpt=curr_text[:60],
                    detail=f"Placeholder text in message {i} from {messages[i].sender}",
                ))
                continue

            # Message restates parent (high token overlap)
            prev_tokens = _tokenize(prev_text)
            curr_tokens = _tokenize(curr_text)
            if len(prev_tokens) >= 4 and len(curr_tokens) >= 4:
                sim = _jaccard(prev_tokens, curr_tokens)
                if sim >= 0.75:
                    findings.append(AdversarialFinding(
                        severity=AuditSeverity.WARNING,
                        rule="message_restates_parent",
                        artifact_id=burst.id,
                        excerpt=curr_text[:80],
                        detail=(
                            f"Message {i} from {messages[i].sender} "
                            f"restates message {i-1} from {messages[i-1].sender} "
                            f"(Jaccard={sim:.2f})"
                        ),
                    ))

            # Stock phrases in chat
            stock_hits = STOCK_PHRASES_RE.findall(messages[i].text)
            if stock_hits:
                findings.append(AdversarialFinding(
                    severity=AuditSeverity.WARNING,
                    rule="stock_phrase",
                    artifact_id=burst.id,
                    excerpt=messages[i].text[:80],
                    detail=f"Stock phrase in chat from {messages[i].sender}: "
                           f"{', '.join(set(h.lower() for h in stock_hits))}",
                ))

    # Check for repeated normalized bursts (same topic text across bursts)
    burst_texts: list[tuple[str, frozenset[str]]] = []
    for burst in chats:
        full_text = " ".join(m.text for m in burst.messages)
        tokens = _tokenize(full_text)
        if len(tokens) >= MIN_TOKENS_FOR_JACCARD:
            burst_texts.append((burst.id, tokens))

    flagged: set[str] = set()
    for i in range(len(burst_texts)):
        for j in range(i + 1, len(burst_texts)):
            id_a, tokens_a = burst_texts[i]
            id_b, tokens_b = burst_texts[j]
            sim = _jaccard(tokens_a, tokens_b)
            if sim >= JACCARD_THRESHOLD and id_a not in flagged:
                findings.append(AdversarialFinding(
                    severity=AuditSeverity.WARNING,
                    rule="repeated_burst_content",
                    artifact_id=id_a,
                    excerpt=f"Similar to {id_b} (Jaccard={sim:.2f})",
                    detail=f"Chat bursts are {sim:.0%} similar",
                ))
                flagged.add(id_a)

    return findings


def _load_emails(work_dir: Path) -> list[EmailRecord]:
    path = work_dir / "generated_emails.json"
    if not path.exists():
        return []
    raw: list[dict[str, Any]] = json.loads(path.read_text())
    emails: list[EmailRecord] = []
    for r in raw:
        try:
            emails.append(EmailRecord(**r))
        except Exception:
            pass
    return emails


def _load_chats(work_dir: Path) -> list[ChatBurst]:
    path = work_dir / "generated_chat_bursts.json"
    if not path.exists():
        return []
    raw: list[dict[str, Any]] = json.loads(path.read_text())
    bursts: list[ChatBurst] = []
    for r in raw:
        try:
            bursts.append(ChatBurst(**r))
        except Exception:
            pass
    return bursts


def review(month: str, work_dir_root: Path) -> AdversarialReviewReport:
    """Run rule-based adversarial review for a month."""
    if month not in MONTH_ORDER:
        raise ValueError(f"Unknown month: {month!r}")

    work_dir = work_dir_root / month

    report_path = work_dir / "llm_generation_report.json"
    if not report_path.exists():
        raise FileNotFoundError(
            f"llm_generation_report.json missing for {month}. Run generation first."
        )

    emails = _load_emails(work_dir)
    chats = _load_chats(work_dir)

    email_findings = _check_emails(emails)
    chat_findings = _check_chats(chats)
    all_findings = email_findings + chat_findings

    critical_count = sum(1 for f in all_findings if f.severity == AuditSeverity.CRITICAL)
    passed = critical_count == 0

    report = AdversarialReviewReport(
        month=month,
        passed=passed,
        findings=all_findings,
        artifacts_reviewed=len(emails) + len(chats),
    )

    work_dir.mkdir(parents=True, exist_ok=True)
    (work_dir / "adversarial_review_report.json").write_text(report.model_dump_json(indent=2))

    return report
