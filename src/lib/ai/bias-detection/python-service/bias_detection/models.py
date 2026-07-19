"""Data models for bias detection service"""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BiasType(StrEnum):
    """Types of bias that can be detected"""

    GENDER = "gender"
    RACIAL = "racial"
    AGE = "age"
    RELIGIOUS = "religious"
    SOCIOECONOMIC = "socioeconomic"
    ABILITY = "ability"
    SEXUAL_ORIENTATION = "sexual_orientation"
    POLITICAL = "political"
    GEOGRAPHIC = "geographic"
    LANGUAGE = "language"
    EDUCATIONAL = "educational"
    HEALTH = "health"
    APPEARANCE = "appearance"
    FAMILY_STATUS = "family_status"
    VETERAN_STATUS = "veteran_status"
    IMMIGRATION = "immigration"
    CRIMINAL_HISTORY = "criminal_history"


# Canonical taxonomy mapping — the single source of truth reconciling the
# legacy bias vocabulary surfaces to this 17-value BiasType enum.
#
# Old surfaces consolidated (see docs/bias_taxonomy_mapping.md for the full
# table):
#   * ai-services/security/bias_detector.py bare-string categories:
#       "gender", "age", "ethnicity", "language"
#   * python-service/bias_detection/constants.py BIASED_TERMS_DICT keys:
#       "gender", "racial", "age", "ability"
#   * TechDeck 8-value Enum (DELETED — was dead code with zero importers):
#       GENDER, RACIAL, AGE, SOCIOECONOMIC, GEOGRAPHIC, DISABILITY,
#       RELIGIOUS, SEXUAL_ORIENTATION
#       Note: TechDeck DISABILITY → canonical ABILITY (canonical uses ABILITY).
#
# The multimodal BiasType enum at
# src/lib/ai/multimodal-bias-detection/python-service/.../models.py is
# deliberately NOT merged here: it models multimedia-specific bias types
# (VISUAL_REPRESENTATION, BODY_IMAGE, TECHNOLOGY_BIAS, ...) that are a
# distinct domain from text-bias taxonomy.
#
# The deslop DEFAULT_RULE_PACKS collections (packages/deslop/deslop/rules/core.py)
# are tone/style slop-marker packs, not a bias taxonomy — an orthogonal axis.
# G004 extends the deslop substrate with a `bias` pack drawn from these values.
#
# Reviewer decision (PIX-4078, resolved inline): map local "ethnicity" →
# RACIAL (no split). Local "language" → LANGUAGE. constants.py "racial" →
# RACIAL. TechDeck "disability" → ABILITY.
BIAS_TAXONOMY_MAPPING: dict[str, "BiasType"] = {
    # ai-services/security/bias_detector.py bare strings
    "gender": BiasType.GENDER,
    "age": BiasType.AGE,
    "ethnicity": BiasType.RACIAL,
    "language": BiasType.LANGUAGE,
    # constants.py BIASED_TERMS_DICT keys
    "racial": BiasType.RACIAL,
    "ability": BiasType.ABILITY,
    # TechDeck 8-enum values (module deleted; strings kept for any persisted payloads)
    "socioeconomic": BiasType.SOCIOECONOMIC,
    "geographic": BiasType.GEOGRAPHIC,
    "disability": BiasType.ABILITY,
    "religious": BiasType.RELIGIOUS,
    "sexual_orientation": BiasType.SEXUAL_ORIENTATION,
}


def canonical_bias_type(value: str | BiasType) -> BiasType:
    """Resolve any legacy bias-category string or BiasType to the canonical 17-enum value.

    Accepts: a BiasType instance (returned as-is), or any key in
    BIAS_TAXONOMY_MAPPING (legacy string category). Raises ValueError for
    unknown categories so callers cannot silently drop a bias signal.
    """
    if isinstance(value, BiasType):
        return value
    if value in BIAS_TAXONOMY_MAPPING:
        return BIAS_TAXONOMY_MAPPING[value]
    # Allow BiasType string values directly (e.g. "racial").
    try:
        return BiasType(value)
    except ValueError as exc:
        raise ValueError(f"Unknown bias category {value!r}; not in canonical 17-value BiasType taxonomy") from exc


class AnalysisStatus(StrEnum):
    """Status of bias analysis"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ConfidenceLevel(StrEnum):
    """Confidence levels for bias detection"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class BiasAnalysisRequest(BaseModel):
    """Request model for bias analysis"""

    content: str = Field(description="Text content to analyze for bias", min_length=1, max_length=10000)
    content_type: str = Field(default="text", description="Type of content: text, email, document, etc.")
    language: str = Field(default="en", description="Language of the content (ISO 639-1 code)")
    context: str | None = Field(default=None, description="Additional context about the content")
    bias_types: list[BiasType] | None = Field(default=None, description="Specific bias types to check for")
    sensitivity: str = Field(default="medium", description="Analysis sensitivity: low, medium, high")
    include_recommendations: bool = Field(
        default=True, description="Whether to include bias mitigation recommendations"
    )
    include_counterfactuals: bool = Field(default=True, description="Whether to include counterfactual scenarios")
    user_id: str | None = Field(default=None, description="User ID for tracking and personalization")
    session_id: str | None = Field(default=None, description="Session ID for request correlation")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        """Validate content field"""
        if not v.strip():
            raise ValueError("Content cannot be empty or whitespace only")
        return v.strip()

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        """Validate language code"""
        if len(v) != 2:
            raise ValueError("Language must be a 2-letter ISO 639-1 code")
        return v.lower()

    @field_validator("sensitivity")
    @classmethod
    def validate_sensitivity(cls, v: str) -> str:
        """Validate sensitivity level"""
        valid_levels = {"low", "medium", "high"}
        if v.lower() not in valid_levels:
            raise ValueError(f"Sensitivity must be one of: {valid_levels}")
        return v.lower()

    model_config = ConfigDict(use_enum_values=True, validate_assignment=True)


class BiasScore(BaseModel):
    """Individual bias score for a specific bias type"""

    bias_type: BiasType
    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Bias score from 0.0 (no bias) to 1.0 (maximum bias)",
    )
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence in the bias detection")
    confidence_level: ConfidenceLevel
    evidence: list[str] = Field(description="Text snippets that support the bias detection")
    explanation: str = Field(description="Explanation of why this bias was detected")

    model_config = ConfigDict(use_enum_values=True)


class Recommendation(BaseModel):
    """Bias mitigation recommendation"""

    type: str = Field(description="Type of recommendation")
    description: str = Field(description="Detailed recommendation description")
    priority: str = Field(description="Priority: high, medium, low")
    implementation_difficulty: str = Field(description="Difficulty: low, medium, high")
    estimated_impact: str = Field(description="Expected impact: low, medium, high")
    examples: list[str] = Field(default_factory=list, description="Example implementations")

    @field_validator("priority", "implementation_difficulty", "estimated_impact")
    @classmethod
    def validate_priority_fields(cls, v: str) -> str:
        """Validate priority-related fields"""
        valid_values = {"low", "medium", "high"}
        if v.lower() not in valid_values:
            raise ValueError(f"Field must be one of: {valid_values}")
        return v.lower()


class CounterfactualScenario(BaseModel):
    """Counterfactual scenario for bias analysis"""

    original_text: str = Field(description="Original biased text")
    alternative_text: str = Field(description="Bias-neutral alternative text")
    bias_type: BiasType
    explanation: str = Field(description="Explanation of how the alternative reduces bias")
    impact_assessment: str = Field(description="Assessment of the impact of the change")


class BiasAnalysisResponse(BaseModel):
    """Response model for bias analysis"""

    id: UUID = Field(default_factory=uuid4, description="Unique analysis ID")
    request_id: str = Field(description="Request ID for correlation")
    status: AnalysisStatus
    content_hash: str = Field(description="SHA256 hash of the analyzed content")

    # Analysis results
    overall_bias_score: float = Field(ge=0.0, le=1.0, description="Overall bias score across all detected biases")
    bias_scores: list[BiasScore] = Field(description="Individual bias scores by type")
    dominant_bias_types: list[BiasType] = Field(description="Most significant bias types detected")

    # Additional analysis
    sentiment_analysis: dict[str, Any] | None = Field(default=None, description="Sentiment analysis results")
    keyword_analysis: dict[str, Any] | None = Field(default=None, description="Keyword-based analysis results")
    contextual_analysis: dict[str, Any] | None = Field(default=None, description="Contextual analysis results")

    # Recommendations and insights
    recommendations: list[Recommendation] = Field(default_factory=list, description="Bias mitigation recommendations")
    counterfactual_scenarios: list[CounterfactualScenario] = Field(
        default_factory=list, description="Counterfactual scenarios"
    )

    # Metadata
    processing_time_ms: int = Field(description="Processing time in milliseconds")
    model_version: str = Field(description="Model version used for analysis")
    language_detected: str = Field(description="Detected language of content")
    word_count: int = Field(description="Word count of analyzed content")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = Field(default=None)

    model_config = ConfigDict(use_enum_values=True)


class HealthResponse(BaseModel):
    """Health check response"""

    status: str = Field(description="Service status: healthy, degraded, unhealthy")
    version: str = Field(description="Service version")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    dependencies: dict[str, str] = Field(default_factory=dict, description="Status of external dependencies")
    metrics: dict[str, Any] = Field(default_factory=dict, description="Service metrics")


class ErrorResponse(BaseModel):
    """Error response model"""

    error: str = Field(description="Error type")
    message: str = Field(description="Error message")
    details: dict[str, Any] | None = Field(default=None, description="Error details")
    request_id: str | None = Field(default=None, description="Request ID")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
