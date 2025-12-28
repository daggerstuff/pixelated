"""
Data models for multi-modal bias detection service
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator


class MediaType(str, Enum):
    """Types of media that can be analyzed"""
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    MULTIMODAL = "multimodal"


class BiasType(str, Enum):
    """Types of bias that can be detected in multimedia"""
    VISUAL_REPRESENTATION = "visual_representation"
    GENDER_STEREOTYPES = "gender_stereotypes"
    RACIAL_BIAS = "racial_bias"
    AGE_DISCRIMINATION = "age_discrimination"
    ABLEISM = "ableism"
    BODY_IMAGE = "body_image"
    SOCIOECONOMIC = "socioeconomic"
    RELIGIOUS_BIAS = "religious_bias"
    CULTURAL_STEREOTYPES = "cultural_stereotypes"
    PROFESSIONAL_STEREOTYPES = "professional_stereotypes"
    FAMILY_STRUCTURE = "family_structure"
    GEOGRAPHIC_BIAS = "geographic_bias"
    LANGUAGE_BIAS = "language_bias"
    TECHNOLOGY_BIAS = "technology_bias"
    ENVIRONMENTAL_BIAS = "environmental_bias"
    EMOTIONAL_MANIPULATION = "emotional_manipulation"


class AnalysisStatus(str, Enum):
    """Status of multi-modal bias analysis"""
    PENDING = "pending"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ConfidenceLevel(str, Enum):
    """Confidence levels for bias detection"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class ImageAnalysisRequest(BaseModel):
    """Request model for image bias analysis"""

    image_url: Optional[str] = Field(
        default=None,
        description="URL of the image to analyze"
    )
    image_data: Optional[str] = Field(
        default=None,
        description="Base64 encoded image data"
    )
    image_format: str = Field(
        default="auto",
        description="Image format: jpg, png, gif, etc."
    )
    analysis_type: str = Field(
        default="comprehensive",
        description="Type of analysis: faces, objects, text, comprehensive"
    )
    bias_types: Optional[List[BiasType]] = Field(
        default=None,
        description="Specific bias types to check for"
    )
    sensitivity: str = Field(
        default="medium",
        description="Analysis sensitivity: low, medium, high"
    )
    include_recommendations: bool = Field(
        default=True,
        description="Whether to include bias mitigation recommendations"
    )
    include_visual_explanations: bool = Field(
        default=True,
        description="Whether to include visual explanations"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User ID for tracking and personalization"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for request correlation"
    )

    @validator("sensitivity")
    def validate_sensitivity(cls, v: str) -> str:
        """Validate sensitivity level"""
        valid_levels = {"low", "medium", "high"}
        if v.lower() not in valid_levels:
            raise ValueError(f"Sensitivity must be one of: {valid_levels}")
        return v.lower()

    @validator("analysis_type")
    def validate_analysis_type(cls, v: str) -> str:
        """Validate analysis type"""
        valid_types = {"faces", "objects", "text", "comprehensive"}
        if v.lower() not in valid_types:
            raise ValueError(f"Analysis type must be one of: {valid_types}")
        return v.lower()

    class Config:
        """Pydantic configuration"""
        use_enum_values = True
        validate_assignment = True


class AudioAnalysisRequest(BaseModel):
    """Request model for audio bias analysis"""

    audio_url: Optional[str] = Field(
        default=None,
        description="URL of the audio file to analyze"
    )
    audio_data: Optional[str] = Field(
        default=None,
        description="Base64 encoded audio data"
    )
    audio_format: str = Field(
        default="auto",
        description="Audio format: mp3, wav, flac, etc."
    )
    analysis_type: str = Field(
        default="comprehensive",
        description="Type of analysis: speech, music, comprehensive"
    )
    language: str = Field(
        default="auto",
        description="Language of the audio content (ISO 639-1 code)"
    )
    bias_types: Optional[List[BiasType]] = Field(
        default=None,
        description="Specific bias types to check for"
    )
    sensitivity: str = Field(
        default="medium",
        description="Analysis sensitivity: low, medium, high"
    )
    include_transcript: bool = Field(
        default=True,
        description="Whether to include speech-to-text transcript"
    )
    include_recommendations: bool = Field(
        default=True,
        description="Whether to include bias mitigation recommendations"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User ID for tracking and personalization"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for request correlation"
    )

    @validator("sensitivity")
    def validate_sensitivity(cls, v: str) -> str:
        """Validate sensitivity level"""
        valid_levels = {"low", "medium", "high"}
        if v.lower() not in valid_levels:
            raise ValueError(f"Sensitivity must be one of: {valid_levels}")
        return v.lower()

    @validator("analysis_type")
    def validate_analysis_type(cls, v: str) -> str:
        """Validate analysis type"""
        valid_types = {"speech", "music", "comprehensive"}
        if v.lower() not in valid_types:
            raise ValueError(f"Analysis type must be one of: {valid_types}")
        return v.lower()

    @validator("language")
    def validate_language(cls, v: str) -> str:
        """Validate language code"""
        if len(v) != 2 and v != "auto":
            raise ValueError("Language must be a 2-letter ISO 639-1 code or 'auto'")
        return v.lower()

    class Config:
        """Pydantic configuration"""
        use_enum_values = True


class VideoAnalysisRequest(BaseModel):
    """Request model for video bias analysis"""

    video_url: Optional[str] = Field(
        default=None,
        description="URL of the video file to analyze"
    )
    video_data: Optional[str] = Field(
        default=None,
        description="Base64 encoded video data"
    )
    video_format: str = Field(
        default="auto",
        description="Video format: mp4, avi, mov, etc."
    )
    analysis_type: str = Field(
        default="comprehensive",
        description="Type of analysis: visual, audio, text, comprehensive"
    )
    frame_extraction_rate: int = Field(
        default=1,
        description="Frame extraction rate (frames per second)"
    )
    bias_types: Optional[List[BiasType]] = Field(
        default=None,
        description="Specific bias types to check for"
    )
    sensitivity: str = Field(
        default="medium",
        description="Analysis sensitivity: low, medium, high"
    )
    include_transcript: bool = Field(
        default=True,
        description="Whether to include speech-to-text transcript"
    )
    include_recommendations: bool = Field(
        default=True,
        description="Whether to include bias mitigation recommendations"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User ID for tracking and personalization"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for request correlation"
    )

    @validator("sensitivity")
    def validate_sensitivity(cls, v: str) -> str:
        """Validate sensitivity level"""
        valid_levels = {"low", "medium", "high"}
        if v.lower() not in valid_levels:
            raise ValueError(f"Sensitivity must be one of: {valid_levels}")
        return v.lower()

    @validator("analysis_type")
    def validate_analysis_type(cls, v: str) -> str:
        """Validate analysis type"""
        valid_types = {"visual", "audio", "text", "comprehensive"}
        if v.lower() not in valid_types:
            raise ValueError(f"Analysis type must be one of: {valid_types}")
        return v.lower()

    @validator("frame_extraction_rate")
    def validate_frame_rate(cls, v: int) -> int:
        """Validate frame extraction rate"""
        if v < 1 or v > 10:
            raise ValueError("Frame extraction rate must be between 1 and 10")
        return v

    class Config:
        """Pydantic configuration"""
        use_enum_values = True


class MultimodalAnalysisRequest(BaseModel):
    """Request model for combined multi-modal bias analysis"""

    text_content: Optional[str] = Field(
        default=None,
        description="Text content to analyze alongside media"
    )
    image_url: Optional[str] = Field(
        default=None,
        description="URL of the image to analyze"
    )
    image_data: Optional[str] = Field(
        default=None,
        description="Base64 encoded image data"
    )
    audio_url: Optional[str] = Field(
        default=None,
        description="URL of the audio file to analyze"
    )
    audio_data: Optional[str] = Field(
        default=None,
        description="Base64 encoded audio data"
    )
    video_url: Optional[str] = Field(
        default=None,
        description="URL of the video file to analyze"
    )
    video_data: Optional[str] = Field(
        default=None,
        description="Base64 encoded video data"
    )
    analysis_priority: str = Field(
        default="balanced",
        description="Priority: text, visual, audio, balanced"
    )
    bias_types: Optional[List[BiasType]] = Field(
        default=None,
        description="Specific bias types to check for"
    )
    sensitivity: str = Field(
        default="medium",
        description="Analysis sensitivity: low, medium, high"
    )
    include_cross_modal_analysis: bool = Field(
        default=True,
        description="Whether to analyze relationships between modalities"
    )
    include_recommendations: bool = Field(
        default=True,
        description="Whether to include bias mitigation recommendations"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User ID for tracking and personalization"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for request correlation"
    )

    @validator("sensitivity")
    def validate_sensitivity(cls, v: str) -> str:
        """Validate sensitivity level"""
        valid_levels = {"low", "medium", "high"}
        if v.lower() not in valid_levels:
            raise ValueError(f"Sensitivity must be one of: {valid_levels}")
        return v.lower()

    @validator("analysis_priority")
    def validate_priority(cls, v: str) -> str:
        """Validate analysis priority"""
        valid_priorities = {"text", "visual", "audio", "balanced"}
        if v.lower() not in valid_priorities:
            raise ValueError(f"Analysis priority must be one of: {valid_priorities}")
        return v.lower()

    @validator("text_content")
    def validate_text_content(cls, v: Optional[str]) -> Optional[str]:
        """Validate text content if provided"""
        if v and len(v.strip()) == 0:
            raise ValueError("Text content cannot be empty or whitespace only")
        return v.strip() if v else v

    class Config:
        """Pydantic configuration"""
        use_enum_values = True


class DetectedObject(BaseModel):
    """Detected object in image/video"""

    object_class: str = Field(description="Object class/type")
    confidence: float = Field(ge=0.0, le=1.0, description="Detection confidence")
    bbox: List[float] = Field(description="Bounding box coordinates [x1, y1, x2, y2]")
    attributes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Object attributes (age, gender, race, etc.)"
    )


class FaceDetection(BaseModel):
    """Face detection result"""

    face_id: str = Field(description="Unique face identifier")
    bbox: List[float] = Field(description="Bounding box coordinates [x1, y1, x2, y2]")
    confidence: float = Field(ge=0.0, le=1.0, description="Detection confidence")
    landmarks: List[List[float]] = Field(
        description="Facial landmarks coordinates"
    )
    demographics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Estimated demographics (age, gender, race, etc.)"
    )
    emotions: Dict[str, float] = Field(
        default_factory=dict,
        description="Emotion detection results"
    )


class TextExtraction(BaseModel):
    """Extracted text from image/video"""

    text: str = Field(description="Extracted text content")
    bbox: List[float] = Field(description="Bounding box coordinates [x1, y1, x2, y2]")
    confidence: float = Field(ge=0.0, le=1.0, description="OCR confidence")
    language: str = Field(description="Detected language")


class AudioSegment(BaseModel):
    """Audio segment analysis"""

    start_time: float = Field(description="Start time in seconds")
    end_time: float = Field(description="End time in seconds")
    transcript: str = Field(description="Speech-to-text transcript")
    confidence: float = Field(ge=0.0, le=1.0, description="Transcription confidence")
    speaker_id: Optional[str] = Field(
        default=None,
        description="Speaker identification"
    )
    emotion: Optional[str] = Field(
        default=None,
        description="Detected emotion"
    )
    language: str = Field(description="Detected language")


class VisualBiasScore(BaseModel):
    """Visual bias score for image/video analysis"""

    bias_type: BiasType
    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Bias score from 0.0 (no bias) to 1.0 (maximum bias)"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the bias detection"
    )
    confidence_level: ConfidenceLevel
    evidence: List[str] = Field(
        description="Visual evidence supporting the bias detection"
    )
    explanation: str = Field(
        description="Explanation of why this bias was detected"
    )
    affected_regions: List[List[float]] = Field(
        default_factory=list,
        description="Regions in the image/video where bias was detected"
    )
    objects_involved: List[DetectedObject] = Field(
        default_factory=list,
        description="Objects involved in the bias detection"
    )


class AudioBiasScore(BaseModel):
    """Audio bias score for audio analysis"""

    bias_type: BiasType
    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Bias score from 0.0 (no bias) to 1.0 (maximum bias)"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the bias detection"
    )
    confidence_level: ConfidenceLevel
    evidence: List[str] = Field(
        description="Audio evidence supporting the bias detection"
    )
    explanation: str = Field(
        description="Explanation of why this bias was detected"
    )
    segments_involved: List[AudioSegment] = Field(
        default_factory=list,
        description="Audio segments where bias was detected"
    )
    keywords_detected: List[str] = Field(
        default_factory=list,
        description="Biased keywords or phrases detected"
    )


class MultimodalBiasScore(BaseModel):
    """Combined multi-modal bias score"""

    bias_type: BiasType
    overall_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall bias score across all modalities"
    )
    modality_scores: Dict[str, float] = Field(
        description="Individual scores by modality (text, visual, audio)"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the bias detection"
    )
    confidence_level: ConfidenceLevel
    cross_modal_evidence: List[str] = Field(
        description="Evidence of bias across multiple modalities"
    )
    explanation: str = Field(
        description="Explanation of multi-modal bias detection"
    )


class VisualRecommendation(BaseModel):
    """Visual bias mitigation recommendation"""

    type: str = Field(description="Type of visual recommendation")
    description: str = Field(description="Detailed recommendation description")
    visual_examples: List[str] = Field(
        default_factory=list,
        description="Visual examples or references"
    )
    implementation_difficulty: str = Field(
        description="Difficulty: easy, medium, hard"
    )
    estimated_impact: str = Field(
        description="Expected impact: low, medium, high"
    )


class MultimodalRecommendation(BaseModel):
    """Multi-modal bias mitigation recommendation"""

    type: str = Field(description="Type of multi-modal recommendation")
    description: str = Field(description="Detailed recommendation description")
    affected_modalities: List[str] = Field(
        description="Modalities this recommendation applies to"
    )
    priority: str = Field(description="Priority: high, medium, low")
    implementation_difficulty: str = Field(
        description="Difficulty: easy, medium, hard"
    )
    estimated_impact: str = Field(
        description="Expected impact: low, medium, high"
    )
    examples: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Multi-modal examples"
    )


class MultimodalAnalysisResponse(BaseModel):
    """Response model for multi-modal bias analysis"""

    id: UUID = Field(default_factory=uuid4, description="Unique analysis ID")
    request_id: str = Field(description="Request ID for correlation")
    status: AnalysisStatus
    media_type: MediaType
    content_hash: str = Field(description="SHA256 hash of the analyzed content")

    # Analysis results
    overall_bias_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall bias score across all detected biases"
    )
    bias_scores: List[MultimodalBiasScore] = Field(
        description="Individual bias scores by type"
    )
    dominant_bias_types: List[BiasType] = Field(
        description="Most significant bias types detected"
    )

    # Modality-specific results
    visual_analysis: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Visual analysis results"
    )
    audio_analysis: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Audio analysis results"
    )
    text_analysis: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Text analysis results"
    )

    # Cross-modal analysis
    cross_modal_patterns: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Patterns detected across modalities"
    )
    modality_correlations: Dict[str, float] = Field(
        default_factory=dict,
        description="Correlation scores between modalities"
    )

    # Recommendations and insights
    recommendations: List[MultimodalRecommendation] = Field(
        default_factory=list,
        description="Multi-modal bias mitigation recommendations"
    )
    alternative_representations: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Alternative bias-neutral representations"
    )

    # Technical details
    processing_time_ms: int = Field(
        description="Processing time in milliseconds"
    )
    model_versions: Dict[str, str] = Field(
        description="Model versions used for analysis"
    )
    modalities_analyzed: List[str] = Field(
        description="Modalities that were analyzed"
    )
    file_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Original file metadata"
    )

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
    """Health check response for multi-modal service"""

    status: str = Field(description="Service status: healthy, degraded, unhealthy")
    version: str = Field(description="Service version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    modalities: Dict[str, str] = Field(
        default_factory=dict,
        description="Status of each modality service"
    )
    gpu_status: Dict[str, Any] = Field(
        default_factory=dict,
        description="GPU availability and status"
    )
    dependencies: Dict[str, str] = Field(
        default_factory=dict,
        description="Status of external dependencies"
    )
    metrics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Service metrics"
    )


class ErrorResponse(BaseModel):
    """Error response model for multi-modal service"""

    error: str = Field(description="Error type")
    message: str = Field(description="Error message")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Error details")
    request_id: Optional[str] = Field(default=None, description="Request ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    affected_modalities: List[str] = Field(
        default_factory=list,
        description="Modalities affected by the error"
    )
