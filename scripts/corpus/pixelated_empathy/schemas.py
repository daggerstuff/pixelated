"""Pydantic v2 schemas for all clinical corpus data structures.

The corpus generates synthetic clinical training communications for the
Pixelated Empathy platform: supervision emails, case consultations, team
debriefs, and care coordination messages between clinical team members.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class GateTier(str, Enum):
    FOUNDATION = "foundation"           # basic therapeutic skills, rapport building
    ASSESSMENT = "assessment"            # intake, risk screening, differential dx
    CRISIS = "crisis"                    # suicidality, de-escalation, safety planning
    RUPTURE_REPAIR = "rupture-repair"    # therapeutic alliance rupture, repair
    COMPLEX = "complex"                  # comorbidity, intersectionality, trauma-informed
    CERTIFICATION = "certification"      # final review, independent practice readiness


class GateStatus(str, Enum):
    READY = "ready"
    NOT_READY = "not_ready"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class AuditSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


# ---------------------------------------------------------------------------
# Clinical events
# ---------------------------------------------------------------------------


class ClinicalEvent(BaseModel):
    """A clinical training event: supervision session, case review, workshop, crisis simulation, etc."""
    id: str = Field(pattern=r"^EVT-\d{4}-\d{3}$")
    date: datetime
    participants: list[str]
    summary: str
    topics: list[str]
    event_type: str = "session"  # session | supervision | workshop | case_review | crisis_sim | debrief | admin

    model_config = {"frozen": True}


class EventSpine(BaseModel):
    events: list[ClinicalEvent]
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    def events_for_month(self, year: int, month: int) -> list[ClinicalEvent]:
        return [e for e in self.events if e.date.year == year and e.date.month == month]

    def events_before(self, dt: datetime) -> list[ClinicalEvent]:
        return [e for e in self.events if e.date < dt]


# ---------------------------------------------------------------------------
# Email & chat records (clinical communications)
# ---------------------------------------------------------------------------


class EmailRecord(BaseModel):
    """A clinical email: supervision feedback, case consult, care coordination, training note."""
    id: str
    thread_id: str
    date: datetime
    sender: str
    recipients: list[str]
    subject: str
    body: str
    event_id: str | None = None
    topic: str
    communication_type: str = "supervision"  # supervision | case_consult | care_coordination | training | admin

    @model_validator(mode="after")
    def validate_id_shape(self) -> "EmailRecord":
        parts = self.id.split("-")
        if len(parts) < 6:
            raise ValueError(f"Email id has unexpected shape: {self.id}")
        return self

    @model_validator(mode="after")
    def sender_not_in_recipients(self) -> "EmailRecord":
        if self.sender in self.recipients:
            raise ValueError(f"Sender '{self.sender}' appears in recipients")
        return self

    @model_validator(mode="after")
    def body_not_placeholder(self) -> "EmailRecord":
        lowered = self.body.strip().lower()
        placeholders = {"-m", "-c", "short natural subject", "[email body]", "..."}
        if lowered in placeholders or len(self.body.strip()) < 20:
            raise ValueError(f"Email body looks like a placeholder: {self.body!r}")
        return self


class ChatMessage(BaseModel):
    sender: str
    text: str

    @model_validator(mode="after")
    def text_not_placeholder(self) -> "ChatMessage":
        lowered = self.text.strip().lower()
        if lowered in {"-m", "-c", "...", "[message]", "placeholder"}:
            raise ValueError(f"Chat message looks like a placeholder: {self.text!r}")
        if len(self.text.strip()) == 0:
            raise ValueError(f"Chat message is empty: {self.text!r}")
        return self


class ChatBurst(BaseModel):
    """A clinical team discussion: debrief, case conference, team huddle, supervision chat."""
    id: str
    event_id: str | None = None
    room: str
    date: datetime
    topic: str
    messages: list[ChatMessage] = Field(min_length=2)
    discussion_type: str = "debrief"  # debrief | case_conference | huddle | supervision | crisis_response

    @model_validator(mode="after")
    def validate_id_shape(self) -> "ChatBurst":
        parts = self.id.split("-")
        if len(parts) < 5:
            raise ValueError(f"Chat id has unexpected shape: {self.id}")
        return self


# ---------------------------------------------------------------------------
# Month bible & manifest
# ---------------------------------------------------------------------------


MONTH_TARGETS: dict[str, dict[str, Any]] = {
    "2025-07": {"emails": 350, "chat_bursts": 420, "tier": GateTier.FOUNDATION},
    "2025-08": {"emails": 450, "chat_bursts": 560, "tier": GateTier.FOUNDATION},
    "2025-09": {"emails": 550, "chat_bursts": 680, "tier": GateTier.ASSESSMENT},
    "2025-10": {"emails": 650, "chat_bursts": 800, "tier": GateTier.ASSESSMENT},
    "2025-11": {"emails": 700, "chat_bursts": 900, "tier": GateTier.CRISIS},
    "2025-12": {"emails": 500, "chat_bursts": 620, "tier": GateTier.CRISIS},
    "2026-01": {"emails": 550, "chat_bursts": 700, "tier": GateTier.RUPTURE_REPAIR},
    "2026-02": {"emails": 600, "chat_bursts": 780, "tier": GateTier.RUPTURE_REPAIR},
    "2026-03": {"emails": 850, "chat_bursts": 1050, "tier": GateTier.COMPLEX},
    "2026-04": {"emails": 900, "chat_bursts": 1150, "tier": GateTier.COMPLEX},
    "2026-05": {"emails": 950, "chat_bursts": 1170, "tier": GateTier.CERTIFICATION},
    "2026-06": {"emails": 950, "chat_bursts": 1170, "tier": GateTier.CERTIFICATION},
}

MONTH_ORDER = list(MONTH_TARGETS.keys())


class MonthBible(BaseModel):
    month: str  # YYYY-MM
    tier: GateTier
    target_emails: int
    target_chat_bursts: int
    events: list[ClinicalEvent]
    active_personas: list[str]
    theme: str
    narrative_arc: str
    key_threads: list[str]  # suggested supervision/consult thread topics


class SalvageCandidate(BaseModel):
    source_month: str
    thread_id: str
    subject: str
    score: float
    reason: str


class ManifestEntry(BaseModel):
    month: str
    tier: GateTier
    target_emails: int
    target_chat_bursts: int
    theme: str
    narrative_arc: str


class Manifest(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    months: list[ManifestEntry]


# ---------------------------------------------------------------------------
# Gate report
# ---------------------------------------------------------------------------


class GateReport(BaseModel):
    month: str
    status: GateStatus
    checks: list[dict[str, Any]]
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Month enrichment context
# ---------------------------------------------------------------------------


class PersonaVoiceContext(BaseModel):
    name: str
    role: str
    style: str
    hard_constraints: list[str]
    opener_pool: list[str]
    closer_pool: list[str]


class MonthEnrichment(BaseModel):
    month: str
    tier: GateTier
    persona_contexts: list[PersonaVoiceContext]
    events: list[ClinicalEvent]
    topic_names: list[str]
    reference_examples: list[dict[str, Any]]  # marked non-output
    thread_continuity_hooks: list[dict[str, Any]]
    prior_month_summary: str | None = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# LLM generation
# ---------------------------------------------------------------------------


class BatchSpec(BaseModel):
    batch_id: str  # e.g. "2025-07-email-001"
    month: str
    artifact_type: str  # "email" | "chat"
    target_count: int
    event_ids: list[str]
    topics: list[str]
    personas_involved: list[str]


class LLMGenerationReport(BaseModel):
    month: str
    batches_run: int
    batches_succeeded: int
    batches_failed: int
    emails_generated: int
    chat_bursts_generated: int
    parse_failures: int
    gate_rejections: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Audit findings
# ---------------------------------------------------------------------------


class AuditFinding(BaseModel):
    severity: AuditSeverity
    category: str
    artifact_id: str
    detail: str


class AuditReport(BaseModel):
    month: str
    passed: bool
    findings: list[AuditFinding]
    email_count: int
    chat_burst_count: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def critical_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == AuditSeverity.CRITICAL)

    @property
    def warning_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == AuditSeverity.WARNING)


# ---------------------------------------------------------------------------
# Adversarial review
# ---------------------------------------------------------------------------


class AdversarialFinding(BaseModel):
    severity: AuditSeverity
    rule: str
    artifact_id: str
    excerpt: str
    detail: str


class AdversarialReviewReport(BaseModel):
    month: str
    passed: bool
    findings: list[AdversarialFinding]
    artifacts_reviewed: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def critical_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == AuditSeverity.CRITICAL)


# ---------------------------------------------------------------------------
# LLM adversarial review (three-persona judge)
# ---------------------------------------------------------------------------


class PersonaJudgeResult(BaseModel):
    persona: str  # "Voice Fidelity Auditor" | "Clinical Accuracy Reviewer" | "Training Signal Engineer"
    passed: bool
    score: float  # 0.0–1.0
    notes: str
    flagged_ids: list[str]


class AdversarialLLMReviewReport(BaseModel):
    month: str
    passed: bool  # all three personas must pass
    persona_results: list[PersonaJudgeResult]
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode="after")
    def derive_passed(self) -> "AdversarialLLMReviewReport":
        self.passed = all(r.passed for r in self.persona_results)
        return self
