"""
Bias Detector - Python Implementation
Analyzes therapeutic sessions for demographic bias using Fairlearn

Taxonomy note (PIX-4078): the bias category strings used here
("gender", "age", "ethnicity", "language") are now backed by the canonical
17-value BiasType enum at
src/lib/ai/bias-detection/python-service/bias_detection/models.py. Per the
resolved taxonomy review, "ethnicity" maps to the canonical RACIAL value
(no split). The string representation is preserved for API-backward
compatibility via StrEnum.value; consumers continue to receive the same
category strings.
"""

import logging
import re
import sys
from enum import StrEnum
from pathlib import Path

import numpy as np
from pydantic import BaseModel, Field

# Canonical 17-value BiasType taxonomy (single source of truth) — import
# before any local definitions so the canonical enum is available.
_CANONICAL_MODELS = Path(__file__).resolve().parents[2] / "src" / "lib" / "ai" / "bias-detection" / "python-service"
if str(_CANONICAL_MODELS) not in sys.path:
    sys.path.insert(0, str(_CANONICAL_MODELS))

from bias_detection.models import BiasType as CanonicalBiasType

logger = logging.getLogger(__name__)


# Local bias-category aliases mapped to the canonical 17-value enum.
# Reviewer decision (PIX-4078): ethnicity -> RACIAL (no split).
BIAS_CATEGORY_GENDER = CanonicalBiasType.GENDER
BIAS_CATEGORY_AGE = CanonicalBiasType.AGE
BIAS_CATEGORY_ETHNICITY = CanonicalBiasType.RACIAL  # "ethnicity" -> RACIAL
BIAS_CATEGORY_LANGUAGE = CanonicalBiasType.LANGUAGE


class BiasLevel(StrEnum):
    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class ParticipantDemographics(BaseModel):
    age: str = ""
    gender: str = ""
    ethnicity: str = ""
    primary_language: str = ""


class TrainingScenario(BaseModel):
    scenario_id: str
    type: str  # e.g., 'general-wellness', 'crisis', 'trauma'


class SessionContent(BaseModel):
    transcript: str
    ai_responses: list[str] = Field(default_factory=list)
    user_inputs: list[str] = Field(default_factory=list)


class TherapeuticSession(BaseModel):
    session_id: str
    session_date: str
    participant_demographics: ParticipantDemographics
    scenario: TrainingScenario
    content: SessionContent
    ai_responses: list[str] = Field(default_factory=list)
    expected_outcomes: list[str] = Field(default_factory=list)
    transcripts: list[str] = Field(default_factory=list)
    user_inputs: list[str] = Field(default_factory=list)
    metadata: dict | None = None


class BiasIndicator(BaseModel):
    category: str  # canonical BiasType value (gender/age/racial/language) — see BIAS_CATEGORY_* above
    severity: float  # 0-1
    evidence: list[str]
    affected_group: str


class BiasAnalysisResult(BaseModel):
    overall_bias_score: float  # 0-1
    bias_level: BiasLevel
    indicators: list[BiasIndicator] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    fairness_metrics: dict[str, float] = Field(default_factory=dict)


# Bias detection patterns
GENDER_BIAS_PATTERNS = [
    (r"\b(aggressive|assertive|dominant)\b", "male", 0.3),
    (r"\b(emotional|sensitive|nurturing)\b", "female", 0.3),
    (r"\b(hysterical|irrational|overreacting)\b", "female", 0.5),
    (r"\b(stoic|unemotional|detached)\b", "male", 0.4),
]

AGE_BIAS_PATTERNS = [
    (r"\b(young|inexperienced|naive)\b", "young", 0.3),
    (r"\b(old|outdated|senile)\b", "elderly", 0.5),
    (r"\b(millennial|entitled|lazy)\b", "young", 0.4),
]

ETHNICITY_BIAS_PATTERNS = [
    (r"\b(exotic|foreign|different)\b", "non-white", 0.3),
    (r"\b(articulate|well-spoken)\b", "non-white", 0.4),  # Backhanded compliment
]

LANGUAGE_BIAS_PATTERNS = [
    (r"\b(foreign accent|broken english|hard to understand)\b", "non-native speaker", 0.4),
    (r"\b(articulate|well-spoken|good english)\b", "non-native speaker", 0.3),  # Praise as bias marker
    (r"\b(native speaker|fluent)\b", "non-native speaker", 0.2),
]


def analyze_session_bias(session: TherapeuticSession) -> BiasAnalysisResult:
    """Analyze therapeutic session for demographic bias"""

    indicators = []
    recommendations = []

    # Combine all text for analysis
    all_text = " ".join(
        [
            session.content.transcript,
            *session.content.ai_responses,
            *session.ai_responses,
        ]
    )

    # Gender bias detection
    gender_indicators = detect_gender_bias(all_text, session.participant_demographics.gender)
    indicators.extend(gender_indicators)

    # Age bias detection
    age_indicators = detect_age_bias(all_text, session.participant_demographics.age)
    indicators.extend(age_indicators)

    # Ethnicity bias detection
    ethnicity_indicators = detect_ethnicity_bias(all_text, session.participant_demographics.ethnicity)
    indicators.extend(ethnicity_indicators)

    # Calculate overall bias score
    overall_bias_score = np.mean([ind.severity for ind in indicators]) if indicators else 0.0

    # Determine bias level
    bias_level = determine_bias_level(overall_bias_score)

    # Generate recommendations
    if bias_level in [BiasLevel.MODERATE, BiasLevel.HIGH, BiasLevel.CRITICAL]:
        recommendations.append("Review AI responses for demographic stereotypes")
        recommendations.append("Retrain model with more diverse and balanced dataset")

    if any(ind.category == "gender" for ind in indicators):
        recommendations.append("Implement gender-neutral language guidelines")

    if any(ind.category == "age" for ind in indicators):
        recommendations.append("Review age-related assumptions in therapeutic approach")

    # Calculate fairness metrics (simplified)
    fairness_metrics = {
        "demographic_parity": 1.0 - overall_bias_score,
        "equalized_odds": 1.0 - (overall_bias_score * 0.8),
        "treatment_equality": 1.0 - (overall_bias_score * 0.9),
    }

    return BiasAnalysisResult(
        overall_bias_score=overall_bias_score,
        bias_level=bias_level,
        indicators=indicators,
        recommendations=recommendations,
        fairness_metrics=fairness_metrics,
    )


def detect_gender_bias(text: str, gender: str) -> list[BiasIndicator]:
    """Detect gender bias patterns"""
    indicators = []

    if not gender:
        return indicators

    for pattern, target_gender, severity in GENDER_BIAS_PATTERNS:
        if gender.lower() == target_gender.lower():
            matches = re.findall(pattern, text, re.I)
            if matches:
                indicators.append(
                    BiasIndicator(
                        category=BIAS_CATEGORY_GENDER,
                        severity=severity,
                        evidence=matches[:3],  # First 3 examples
                        affected_group=f"{gender} participants",
                    )
                )

    return indicators


def detect_age_bias(text: str, age: str) -> list[BiasIndicator]:
    """Detect age bias patterns"""
    indicators = []

    if not age:
        return indicators

    # Map age ranges to categories
    age_category = "young" if "18-25" in age or "26-35" in age else "elderly" if "65+" in age else None

    if not age_category:
        return indicators

    for pattern, target_age, severity in AGE_BIAS_PATTERNS:
        if age_category == target_age:
            matches = re.findall(pattern, text, re.I)
            if matches:
                indicators.append(
                    BiasIndicator(
                        category=BIAS_CATEGORY_AGE,
                        severity=severity,
                        evidence=matches[:3],
                        affected_group=f"{age_category} participants",
                    )
                )

    return indicators


def detect_ethnicity_bias(text: str, ethnicity: str) -> list[BiasIndicator]:
    """Detect ethnicity bias patterns"""
    indicators = []

    if not ethnicity or ethnicity.lower() in ["", "prefer not to say"]:
        return indicators

    for pattern, _target_group, severity in ETHNICITY_BIAS_PATTERNS:
        matches = re.findall(pattern, text, re.I)
        if matches:
            indicators.append(
                BiasIndicator(
                    category=BIAS_CATEGORY_ETHNICITY,
                    severity=severity,
                    evidence=matches[:3],
                    affected_group=f"{ethnicity} participants",
                )
            )

    return indicators


def determine_bias_level(score: float) -> BiasLevel:
    """Determine bias level from score"""
    if score >= 0.8:
        return BiasLevel.CRITICAL
    if score >= 0.6:
        return BiasLevel.HIGH
    if score >= 0.3:
        return BiasLevel.MODERATE
    if score > 0:
        return BiasLevel.LOW
    return BiasLevel.NONE


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Test
    test_session = TherapeuticSession(
        session_id="test123",
        session_date="2026-01-24",
        participant_demographics=ParticipantDemographics(
            age="26-35", gender="female", ethnicity="asian", primary_language="en"
        ),
        scenario=TrainingScenario(scenario_id="wellness-001", type="general-wellness"),
        content=SessionContent(
            transcript="The patient seems very emotional about this situation.",
            ai_responses=["I understand you're feeling sensitive about this."],
            user_inputs=["I'm feeling overwhelmed."],
        ),
    )

    result = analyze_session_bias(test_session)
    logger.info("Bias Level: %s", result.bias_level.value)
    logger.info("Overall Score: %.2f", result.overall_bias_score)
    logger.info("Indicators: %d", len(result.indicators))
    for ind in result.indicators:
        logger.info("  - %s: %.2f (%s)", ind.category, ind.severity, ", ".join(ind.evidence))
