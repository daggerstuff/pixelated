"""
Emotion Validator - Python Implementation
Validates emotion detection results with bias detection integration
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class EmotionCategory(str, Enum):
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    FEARFUL = "fearful"
    SURPRISED = "surprised"
    DISGUSTED = "disgusted"
    NEUTRAL = "neutral"
    ANXIOUS = "anxious"
    CONFUSED = "confused"


@dataclass
class ParticipantDemographics:
    age: str = ""
    gender: str = ""
    ethnicity: str = ""
    primary_language: str = ""


@dataclass
class EmotionData:
    session_id: str
    detected_emotion: str
    confidence: float
    context: str
    participant_demographics: ParticipantDemographics | None = None
    response_text: str | None = None
    timestamp: str | None = None


@dataclass
class EmotionValidationResult:
    is_valid: bool
    confidence: float
    issues: list[str] = field(default_factory=list)
    bias_score: float = 0.0
    emotion_consistency: float = 0.0
    authenticity_score: float = 0.0
    contextual_appropriate: bool = True
    recommendations: list[str] = field(default_factory=list)


# Bias patterns in emotional responses
BIAS_PATTERNS = [
    {
        "pattern": r"aggressive|angry|hostile",
        "demographic": "male",
        "bias": "gender_aggression",
    },
    {
        "pattern": r"emotional|sensitive|caring",
        "demographic": "female",
        "bias": "gender_emotion",
    },
]

VALID_EMOTIONS = [e.value for e in EmotionCategory]


def validate_emotion_result(emotion_data: EmotionData) -> EmotionValidationResult:
    """Validate emotion detection result with bias detection"""

    issues = []
    recommendations = []

    # Basic validation
    if not emotion_data.detected_emotion or emotion_data.detected_emotion.strip() == "":
        issues.append("Missing or empty detected emotion")

    if not emotion_data.context or emotion_data.context.strip() == "":
        issues.append("Missing emotional context")

    if emotion_data.confidence < 0.3:
        issues.append("Low emotion detection confidence")

    # Check for valid emotion categories
    if not any(
        valid_emotion in emotion_data.detected_emotion.lower() for valid_emotion in VALID_EMOTIONS
    ):
        issues.append("Unrecognized emotion category")

    # Calculate authenticity score
    authenticity_score = 0.5
    if emotion_data.response_text:
        # Higher score for first-person emotional statements
        if re.search(r"\bI (feel|am|think)\b", emotion_data.response_text, re.I):
            authenticity_score += 0.3
        # Penalize generic text
        if re.search(r"lorem ipsum|placeholder", emotion_data.response_text, re.I):
            authenticity_score -= 0.4

    authenticity_score = max(0.0, min(1.0, authenticity_score))

    # Emotion consistency with context
    emotion_consistency = calculate_emotion_consistency(
        emotion_data.context.lower(), emotion_data.detected_emotion.lower()
    )

    # Contextual appropriateness
    contextual_appropriate = assess_contextual_appropriateness(
        emotion_data.context.lower(), emotion_data.detected_emotion.lower(), emotion_data.confidence
    )

    if not contextual_appropriate:
        issues.append("Contextually inappropriate emotional response")

    # Calculate bias score (simplified)
    bias_score = 0.0
    if emotion_data.participant_demographics and emotion_data.response_text:
        bias_score = detect_bias_patterns(
            emotion_data.response_text, emotion_data.participant_demographics
        )

    # Generate recommendations
    if emotion_data.confidence < 0.5:
        recommendations.append("Consider retraining emotion detection model with more diverse data")

    if bias_score > 0.6:
        recommendations.append("Review training data for demographic bias in emotional responses")

    if emotion_consistency < 0.4:
        recommendations.append("Enhance context understanding in emotion detection algorithms")

    # Calculate overall confidence
    basic_confidence = max(0.1, emotion_data.confidence)
    overall_confidence = 0.4 * basic_confidence + 0.3 * emotion_consistency + 0.3 * (1 - bias_score)
    overall_confidence = max(0.1, min(1.0, overall_confidence))

    # Determine validity
    is_valid = len(issues) == 0 and bias_score < 0.6 and overall_confidence > 0.5

    return EmotionValidationResult(
        is_valid=is_valid,
        confidence=overall_confidence,
        issues=issues,
        bias_score=bias_score,
        emotion_consistency=emotion_consistency,
        authenticity_score=authenticity_score,
        contextual_appropriate=contextual_appropriate,
        recommendations=recommendations,
    )


def calculate_emotion_consistency(context: str, emotion: str) -> float:
    """Calculate emotion-context consistency"""

    consistency_rules = [
        {
            "context": r"crisis|emergency|urgent|help",
            "emotions": ["fearful", "anxious", "sad"],
            "weight": 0.9,
        },
        {
            "context": r"positive|good|success|achievement",
            "emotions": ["happy", "surprised"],
            "weight": 0.8,
        },
        {
            "context": r"conflict|argument|fight",
            "emotions": ["angry", "frustrated"],
            "weight": 0.8,
        },
    ]

    max_consistency = 0.5  # Base consistency

    for rule in consistency_rules:
        if re.search(rule["context"], context):
            for expected_emotion in rule["emotions"]:
                if expected_emotion in emotion:
                    max_consistency = max(max_consistency, rule["weight"])

    return max_consistency


def assess_contextual_appropriateness(context: str, emotion: str, confidence: float) -> bool:
    """Assess if emotion is contextually appropriate"""

    inappropriate_combos = [
        {"context": r"therapy|counseling|support", "emotion": r"happy|excited", "threshold": 0.8},
        {"context": r"crisis|emergency", "emotion": r"happy|amused", "threshold": 0.7},
        {"context": r"grief|loss", "emotion": r"happy|excited", "threshold": 0.9},
    ]

    for combo in inappropriate_combos:
        if (
            re.search(combo["context"], context)
            and re.search(combo["emotion"], emotion)
            and confidence > combo["threshold"]
        ):
            return False

    return True


def detect_bias_patterns(text: str, demographics: ParticipantDemographics) -> float:
    """Detect bias patterns in emotional responses"""

    bias_score = 0.0

    for pattern in BIAS_PATTERNS:
        if (
            re.search(pattern["pattern"], text, re.I)
            and demographics.gender
            and demographics.gender.lower() == pattern["demographic"].lower()
        ):
            bias_score += 0.3

    return min(1.0, bias_score)


if __name__ == "__main__":
    # Test
    test_data = EmotionData(
        session_id="test123",
        detected_emotion="happy",
        confidence=0.8,
        context="positive success",
        response_text="I feel really proud of myself today.",
        participant_demographics=ParticipantDemographics(
            age="26-35", gender="female", ethnicity="other", primary_language="en"
        ),
    )

    logging.basicConfig(level=logging.INFO)

    result = validate_emotion_result(test_data)
    logger.info("Valid: %s", result.is_valid)
    logger.info("Confidence: %.2f", result.confidence)
    logger.info("Authenticity: %.2f", result.authenticity_score)
    logger.info("Bias Score: %.2f", result.bias_score)
