"""Pydantic models for the Risk Stratification service.

Defines request/response schemas for risk assessment input and output.
Risk levels follow the four-tier clinical escalation model:
  low → medium → high → crisis
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, field_validator


class RiskLevel(StrEnum):
    """Four-tier risk classification with recommended clinical actions."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRISIS = "crisis"


class PHQ9Scores(BaseModel):
    """PHQ-9 depression screening — 9 items scored 0-3 each (total 0-27)."""

    responses: list[int] = Field(
        ..., min_length=9, max_length=9, description="Nine PHQ-9 item scores (0-3 each)."
    )

    @field_validator("responses")
    @classmethod
    def validate_item_range(cls, v: list[int]) -> list[int]:
        for item in v:
            if not 0 <= item <= 3:
                raise ValueError("Each PHQ-9 item must be 0-3")
        return v


class GAD7Scores(BaseModel):
    """GAD-7 anxiety screening — 7 items scored 0-3 each (total 0-21)."""

    responses: list[int] = Field(
        ..., min_length=7, max_length=7, description="Seven GAD-7 item scores (0-3 each)."
    )

    @field_validator("responses")
    @classmethod
    def validate_item_range(cls, v: list[int]) -> list[int]:
        for item in v:
            if not 0 <= item <= 3:
                raise ValueError("Each GAD-7 item must be 0-3")
        return v


class CSSRSScreen(BaseModel):
    """C-SSRS Suicide Risk Screening — 6-question screening version.

    Items 1-3 assess ideation severity; items 4-5 assess ideation intensity;
    item 6 assesses behavior. Any positive on 4-6 is highest severity.
    """

    # Q1: Passive wish to be dead
    # Q2: Non-specific active suicidal thoughts
    # Q3: Active ideation with method (no intent/plan)
    # Q4: Active ideation with some intent
    # Q5: Active ideation with specific plan and intent
    # Q6: Suicidal behavior (lifetime)
    responses: list[bool] = Field(
        ...,
        min_length=6,
        max_length=6,
        description="Six C-SSRS screening answers (True/False).",
    )


class ClinicalContext(BaseModel):
    """Clinical note context provided alongside assessment scores."""

    note_text: str = Field(
        default="",
        max_length=5000,
        description="Clinical note excerpt for NIM context (max 5000 chars).",
    )
    session_id: str = Field(
        ..., min_length=1, description="Session identifier (required for audit)."
    )
    patient_id: str = Field(
        ..., min_length=1, description="Patient identifier (required for audit)."
    )


class RiskStratificationRequest(BaseModel):
    """Full request for risk stratification assessment."""

    phq9: PHQ9Scores
    gad7: GAD7Scores
    cssrs: CSSRSScreen
    clinical_context: ClinicalContext


class RiskScoreBreakdown(BaseModel):
    """Breakdown of deterministic scores feeding into the risk level."""

    phq9_total: int = Field(..., ge=0, le=27, description="PHQ-9 total score (0-27).")
    phq9_severity: str = Field(..., description="PHQ-9 severity label.")
    gad7_total: int = Field(..., ge=0, le=21, description="GAD-7 total score (0-21).")
    gad7_severity: str = Field(..., description="GAD-7 severity label.")
    cssrs_highest_positive: int = Field(
        ...,
        ge=0,
        le=6,
        description="Highest positive C-SSRS item (0 = none positive).",
    )
    cssrs_risk_label: str = Field(..., description="C-SSRS suicide risk label.")


class RiskStratificationResponse(BaseModel):
    """Risk stratification result returned to the EHR system."""

    patient_id: str = Field(..., description="Redacted patient ID for correlation.")
    session_id: str = Field(..., description="Redacted session ID for correlation.")
    risk_level: RiskLevel
    confidence_score: float = Field(
        ..., ge=0.0, le=1.0, description="Model confidence (0.0-1.0)."
    )
    score_breakdown: RiskScoreBreakdown
    recommended_actions: list[str] = Field(
        ..., min_length=1, description="Recommended clinical actions."
    )
    requires_supervisor_review: bool = Field(
        ..., description="True if high/crisis (triggers supervisor queue)."
    )
    requires_crisis_protocol: bool = Field(
        ..., description="True if crisis level (triggers emergency protocol)."
    )
    model_source: str = Field(..., description="Model used: 'nim-hetzner' or 'mock'.")
    warnings: list[str] = Field(
        default_factory=list, description="Non-fatal warnings (e.g., mock mode)."
    )
    audit_entry_id: str = Field(
        ..., min_length=1, description="Audit trail entry identifier."
    )


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    service: str = "risk-stratification"
    baa_confirmed: bool
    nim_configured: bool
