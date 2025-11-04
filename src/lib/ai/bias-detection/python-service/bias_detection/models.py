"""
Data models for bias detection service
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator


class BiasType(str, Enum):
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


class AnalysisStatus(str, Enum):
    """Status of bias analysis"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ConfidenceLevel(str, Enum):
    """Confidence levels for bias detection"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class BiasAnalysisRequest(BaseModel):
    """Request model for bias analysis"""

    content: str = Field(
        description="Text content to analyze for bias", min_length=1, max_length=10000
    )
    content_type: str = Field(
        default="text", description="Type of content: text, email, document, etc."
    )
    language: str = Field(
        default="en", description="Language of the content (ISO 639-1 code)"
    )
    context: Optional[str] = Field(
        default=None, description="Additional context about the content"
    )
    bias_types: Optional[List[BiasType]] = Field(
        default=None, description="Specific bias types to check for"
    )
    sensitivity: str = Field(
        default="medium", description="Analysis sensitivity: low, medium, high"
    )
    include_recommendations: bool = Field(
        default=True, description="Whether to include bias mitigation recommendations"
    )
    include_counterfactuals: bool = Field(
        default=True, description="Whether to include counterfactual scenarios"
    )
    user_id: Optional[str] = Field(
        default=None, description="User ID for tracking and personalization"
    )
    session_id: Optional[str] = Field(
        default=None, description="Session ID for request correlation"
    )

    @validator("content")
    def validate_content(cls, v: str) -> str:
        """Validate content field"""
        if not v.strip():
            raise ValueError("Content cannot be empty or whitespace only")
        return v.strip()

    @validator("language")
    def validate_language(cls, v: str) -> str:
        """Validate language code"""
        if len(v) != 2:
            raise ValueError("Language must be a 2-letter ISO 639-1 code")
        return v.lower()

    @validator("sensitivity")
    def validate_sensitivity(cls, v: str) -> str:
        """Validate sensitivity level"""
        valid_levels = {"low", "medium", "high"}
        if v.lower() not in valid_levels:
            raise ValueError(f"Sensitivity must be one of: {valid_levels}")
        return v.lower()

    class Config:
        """Pydantic configuration"""

        use_enum_values = True
        validate_assignment = True


class BiasScore(BaseModel):
    """Individual bias score for a specific bias type"""

    bias_type: BiasType
    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Bias score from 0.0 (no bias) to 1.0 (maximum bias)",
    )
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in the bias detection"
    )
    confidence_level: ConfidenceLevel
    evidence: List[str] = Field(
        description="Text snippets that support the bias detection"
    )
    explanation: str = Field(description="Explanation of why this bias was detected")

    class Config:
        """Pydantic configuration"""

        use_enum_values = True


class Recommendation(BaseModel):
    """Bias mitigation recommendation"""

    type: str = Field(description="Type of recommendation")
    description: str = Field(description="Detailed recommendation description")
    priority: str = Field(description="Priority: high, medium, low")
    implementation_difficulty: str = Field(description="Difficulty: easy, medium, hard")
    estimated_impact: str = Field(description="Expected impact: low, medium, high")
    examples: List[str] = Field(
        default_factory=list, description="Example implementations"
    )

    @validator("priority", "implementation_difficulty", "estimated_impact")
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
    explanation: str = Field(
        description="Explanation of how the alternative reduces bias"
    )
    impact_assessment: str = Field(description="Assessment of the impact of the change")


class BiasAnalysisResponse(BaseModel):
    """Response model for bias analysis"""

    id: UUID = Field(default_factory=uuid4, description="Unique analysis ID")
    request_id: str = Field(description="Request ID for correlation")
    status: AnalysisStatus
    content_hash: str = Field(description="SHA256 hash of the analyzed content")

    # Analysis results
    overall_bias_score: float = Field(
        ge=0.0, le=1.0, description="Overall bias score across all detected biases"
    )
    bias_scores: List[BiasScore] = Field(description="Individual bias scores by type")
    dominant_bias_types: List[BiasType] = Field(
        description="Most significant bias types detected"
    )

    # Additional analysis
    sentiment_analysis: Optional[Dict[str, Any]] = Field(
        default=None, description="Sentiment analysis results"
    )
    keyword_analysis: Optional[Dict[str, Any]] = Field(
        default=None, description="Keyword-based analysis results"
    )
    contextual_analysis: Optional[Dict[str, Any]] = Field(
        default=None, description="Contextual analysis results"
    )

    # Recommendations and insights
    recommendations: List[Recommendation] = Field(
        default_factory=list, description="Bias mitigation recommendations"
    )
    counterfactual_scenarios: List[CounterfactualScenario] = Field(
        default_factory=list, description="Counterfactual scenarios"
    )

    # Metadata
    processing_time_ms: int = Field(description="Processing time in milliseconds")
    model_version: str = Field(description="Model version used for analysis")
    language_detected: str = Field(description="Detected language of content")
    word_count: int = Field(description="Word count of analyzed content")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(default=None)

    class Config:
        """Pydantic configuration"""

        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class HealthResponse(BaseModel):
    """Health check response"""

    status: str = Field(description="Service status: healthy, degraded, unhealthy")
    version: str = Field(description="Service version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    dependencies: Dict[str, str] = Field(
        default_factory=dict, description="Status of external dependencies"
    )
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Service metrics")


class ErrorResponse(BaseModel):
    """Error response model"""

    error: str = Field(description="Error type")
    message: str = Field(description="Error message")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Error details")
    request_id: Optional[str] = Field(default=None, description="Request ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
