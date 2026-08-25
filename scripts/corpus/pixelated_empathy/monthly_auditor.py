"""Monthly auditor — structural audit.

Checks:
- Chronology: thread dates monotonically increase within a thread
- Thread continuity: thread_id references are consistent
- Sender sanity: all senders are valid persona names
- Room assignments: chat rooms are valid channel names
- Date within month: all artifacts are in the target month
- No duplicate IDs

A month is auditable only if llm_generation_report.json exists.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from pixelated_empathy.personas import PERSONA_NAMES
from pixelated_empathy.schemas import (
    AuditFinding,
    AuditReport,
    AuditSeverity,
    ChatBurst,
    EmailRecord,
    MONTH_ORDER,
)

VALID_CHAT_ROOMS = {
    "#general",
    "#engineering",
    "#clinical",
    "#product",
    "#design",
    "#infra",
    "#random",
    "#announcements",
    "#leadership",
    "#data",
}


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


def audit(month: str, work_dir_root: Path) -> AuditReport:
    """
    Run structural audit on a month's generated corpus.

    Returns an AuditReport. passed=True only if 0 CRITICAL findings.
    """
    if month not in MONTH_ORDER:
        raise ValueError(f"Unknown month: {month!r}")

    work_dir = work_dir_root / month

    # Gate: require llm_generation_report.json
    report_path = work_dir / "llm_generation_report.json"
    if not report_path.exists():
        raise FileNotFoundError(
            f"llm_generation_report.json missing for {month}. Run generation first."
        )

    year, mon = (int(x) for x in month.split("-"))
    findings: list[AuditFinding] = []
    emails = _load_emails(work_dir)
    chats = _load_chats(work_dir)

    # ------------------------------------------------------------------ #
    # Email audits
    # ------------------------------------------------------------------ #

    # 1. Sender sanity
    for email in emails:
        if email.sender not in PERSONA_NAMES:
            findings.append(AuditFinding(
                severity=AuditSeverity.CRITICAL,
                category="sender_sanity",
                artifact_id=email.id,
                detail=f"Unknown sender: {email.sender!r}",
            ))
        for recip in email.recipients:
            if recip not in PERSONA_NAMES:
                findings.append(AuditFinding(
                    severity=AuditSeverity.WARNING,
                    category="recipient_sanity",
                    artifact_id=email.id,
                    detail=f"Unknown recipient: {recip!r}",
                ))

    # 2. Date within month
    for email in emails:
        if email.date.year != year or email.date.month != mon:
            findings.append(AuditFinding(
                severity=AuditSeverity.CRITICAL,
                category="date_out_of_month",
                artifact_id=email.id,
                detail=f"Date {email.date.date()} outside month {month}",
            ))

    # 3. Thread date monotonicity
    thread_dates: dict[str, list[tuple[datetime, str]]] = {}
    for email in emails:
        thread_dates.setdefault(email.thread_id, []).append((email.date, email.id))

    for thread_id, entries in thread_dates.items():
        # Sort by ID (string sort — IDs end with -1, -2 … so alphabetic ≈ reply order)
        sorted_by_id = sorted(entries, key=lambda x: x[1])
        for i in range(1, len(sorted_by_id)):
            prev_date, prev_id = sorted_by_id[i - 1]
            curr_date, curr_id = sorted_by_id[i]
            if curr_date < prev_date:
                findings.append(AuditFinding(
                    severity=AuditSeverity.CRITICAL,
                    category="chronology",
                    artifact_id=curr_id,
                    detail=(
                        f"Thread {thread_id}: email {curr_id} "
                        f"({curr_date}) is before {prev_id} ({prev_date})"
                    ),
                ))

    # 4. Duplicate email IDs
    email_ids = [e.id for e in emails]
    seen_ids: set[str] = set()
    for eid in email_ids:
        if eid in seen_ids:
            findings.append(AuditFinding(
                severity=AuditSeverity.CRITICAL,
                category="duplicate_id",
                artifact_id=eid,
                detail=f"Duplicate email ID: {eid}",
            ))
        seen_ids.add(eid)

    # 5. Thread continuity — thread_id prefix matches email ID prefix
    for email in emails:
        if not email.id.startswith(email.thread_id):
            findings.append(AuditFinding(
                severity=AuditSeverity.WARNING,
                category="thread_continuity",
                artifact_id=email.id,
                detail=f"email id {email.id!r} does not start with thread_id {email.thread_id!r}",
            ))

    # ------------------------------------------------------------------ #
    # Chat audits
    # ------------------------------------------------------------------ #

    # 6. Room assignments
    for burst in chats:
        if burst.room not in VALID_CHAT_ROOMS:
            findings.append(AuditFinding(
                severity=AuditSeverity.WARNING,
                category="room_assignment",
                artifact_id=burst.id,
                detail=f"Unknown room: {burst.room!r}",
            ))

    # 7. Chat sender sanity
    for burst in chats:
        for msg in burst.messages:
            if msg.sender not in PERSONA_NAMES:
                findings.append(AuditFinding(
                    severity=AuditSeverity.CRITICAL,
                    category="sender_sanity",
                    artifact_id=burst.id,
                    detail=f"Unknown chat sender: {msg.sender!r}",
                ))

    # 8. Chat date within month
    for burst in chats:
        if burst.date.year != year or burst.date.month != mon:
            findings.append(AuditFinding(
                severity=AuditSeverity.CRITICAL,
                category="date_out_of_month",
                artifact_id=burst.id,
                detail=f"Chat date {burst.date.date()} outside month {month}",
            ))

    # 9. Duplicate chat IDs
    chat_ids = [c.id for c in chats]
    seen_chat_ids: set[str] = set()
    for cid in chat_ids:
        if cid in seen_chat_ids:
            findings.append(AuditFinding(
                severity=AuditSeverity.CRITICAL,
                category="duplicate_id",
                artifact_id=cid,
                detail=f"Duplicate chat ID: {cid}",
            ))
        seen_chat_ids.add(cid)

    # 10. Minimum message count per chat burst
    for burst in chats:
        if len(burst.messages) < 2:
            findings.append(AuditFinding(
                severity=AuditSeverity.WARNING,
                category="message_count",
                artifact_id=burst.id,
                detail=f"Chat burst has only {len(burst.messages)} message(s)",
            ))

    # 11. Empty email subjects
    for email in emails:
        if not email.subject.strip():
            findings.append(AuditFinding(
                severity=AuditSeverity.WARNING,
                category="empty_subject",
                artifact_id=email.id,
                detail="Empty email subject",
            ))

    # passed = 0 CRITICAL findings
    critical_count = sum(1 for f in findings if f.severity == AuditSeverity.CRITICAL)
    passed = critical_count == 0

    report = AuditReport(
        month=month,
        passed=passed,
        findings=findings,
        email_count=len(emails),
        chat_burst_count=len(chats),
    )

    work_dir.mkdir(parents=True, exist_ok=True)
    (work_dir / "audit_report.json").write_text(report.model_dump_json(indent=2))

    return report
