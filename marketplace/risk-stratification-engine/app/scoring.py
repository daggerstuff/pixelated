"""Deterministic scoring logic for PHQ-9, GAD-7, and C-SSRS.

These functions produce rule-based scores and severity labels that feed
into the NIM model for final risk stratification. They are designed to be
independently testable and follow clinical guidelines:

PHQ-9:
  0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe
  Item 9 (index 8) is suicidal ideation — any positive value flags review.

GAD-7:
  0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe

C-SSRS (Columbia Suicide Severity Rating Scale, screening version):
  Q1 (passive ideation)  → medium at minimum
  Q2 (non-specific active) → medium-high
  Q3 (active with method) → high
  Q4 (active with intent) → crisis
  Q5 (active with plan+intent) → crisis
  Q6 (behavior, lifetime) → crisis
"""

from __future__ import annotations

from dataclasses import dataclass

from .models import RiskLevel


@dataclass(frozen=True)
class PHQ9Result:
    """PHQ-9 scoring result."""

    total: int
    severity: str
    item_9_positive: bool


def score_phq9(responses: list[int]) -> PHQ9Result:
    """Score PHQ-9 depression screening.

    Args:
        responses: Nine item scores, each 0-3.

    Returns:
        PHQ9Result with total, severity label, and item-9 flag.
    """
    total = sum(responses)
    if total <= 4:
        severity = "minimal"
    elif total <= 9:
        severity = "mild"
    elif total <= 14:
        severity = "moderate"
    elif total <= 19:
        severity = "moderately_severe"
    else:
        severity = "severe"

    return PHQ9Result(
        total=total,
        severity=severity,
        item_9_positive=responses[8] > 0,
    )


@dataclass(frozen=True)
class GAD7Result:
    """GAD-7 scoring result."""

    total: int
    severity: str


def score_gad7(responses: list[int]) -> GAD7Result:
    """Score GAD-7 anxiety screening.

    Args:
        responses: Seven item scores, each 0-3.

    Returns:
        GAD7Result with total and severity label.
    """
    total = sum(responses)
    if total <= 4:
        severity = "minimal"
    elif total <= 9:
        severity = "mild"
    elif total <= 14:
        severity = "moderate"
    else:
        severity = "severe"

    return GAD7Result(total=total, severity=severity)


@dataclass(frozen=True)
class CSSRSResult:
    """C-SSRS screening result."""

    highest_positive: int
    risk_label: str
    any_positive: bool


def score_cssrs(responses: list[bool]) -> CSSRSResult:
    """Score C-SSRS suicide risk screening (6-question version).

    The highest positive item determines the risk label:
      0 (none) → none
      1 (passive) → low_risk
      2 (non-specific active) → moderate_risk
      3 (active with method) → high_risk
      4-6 (intent/plan/behavior) → imminent_risk

    Args:
        responses: Six boolean answers.

    Returns:
        CSSRSResult with highest positive item, risk label, and any_positive flag.
    """
    highest = 0
    for i, val in enumerate(responses):
        if val:
            highest = i + 1

    if highest == 0:
        risk_label = "none"
    elif highest == 1:
        risk_label = "low_risk"
    elif highest == 2:
        risk_label = "moderate_risk"
    elif highest == 3:
        risk_label = "high_risk"
    else:
        risk_label = "imminent_risk"

    return CSSRSResult(
        highest_positive=highest,
        risk_label=risk_label,
        any_positive=highest > 0,
    )


def classify_risk(
    phq9: PHQ9Result,
    gad7: GAD7Result,
    cssrs: CSSRSResult,
) -> RiskLevel:
    """Determine preliminary risk level from deterministic scores.

    Uses the highest-risk signal across all three instruments.
    C-SSRS overrides everything: items 4-6 → crisis, item 3 → high.
    PHQ-9 item 9 (suicidal ideation) escalates at least one level.

    Args:
        phq9: Scored PHQ-9 result.
        gad7: Scored GAD-7 result.
        cssrs: Scored C-SSRS result.

    Returns:
        RiskLevel enum value.
    """
    # C-SSRS has highest priority
    if cssrs.highest_positive >= 4:
        return RiskLevel.CRISIS
    if cssrs.highest_positive == 3:
        return RiskLevel.HIGH

    # PHQ-9 item 9 (suicidal ideation) escalates risk
    if phq9.item_9_positive:
        return RiskLevel.HIGH if (phq9.total >= 15 or cssrs.highest_positive >= 1) else RiskLevel.MEDIUM

    # Without suicidal ideation, use combined severity
    if phq9.total >= 20 or cssrs.highest_positive == 2:
        return RiskLevel.HIGH
    if phq9.total >= 10 or gad7.total >= 10 or cssrs.highest_positive == 1:
        return RiskLevel.MEDIUM

    return RiskLevel.LOW


def get_recommended_actions(risk_level: RiskLevel) -> list[str]:
    """Return recommended clinical actions for a given risk level.

    Args:
        risk_level: The classified risk level.

    Returns:
        List of recommended action strings.
    """
    actions = {
        RiskLevel.LOW: [
            "Continue routine monitoring schedule",
            "Reassess at next standard appointment",
        ],
        RiskLevel.MEDIUM: [
            "Increase check-in frequency to weekly",
            "Notify supervisor of elevated risk",
            "Review medication adherence and stressors",
            "Schedule follow-up within 1 week",
        ],
        RiskLevel.HIGH: [
            "Immediate supervisor review required",
            "Update safety plan with client",
            "Increase contact to 2-3 times per week",
            "Consider partial hospitalization or IOP referral",
            "Document risk assessment in client record",
        ],
        RiskLevel.CRISIS: [
            "Activate emergency protocol immediately",
            "Do not leave client alone",
            "Contact crisis line: 988 (Suicide & Crisis Lifeline)",
            "Arrange emergency psychiatric evaluation",
            "Notify supervisor and emergency contacts",
            "Document crisis intervention in client record",
        ],
    }
    return actions[risk_level]
