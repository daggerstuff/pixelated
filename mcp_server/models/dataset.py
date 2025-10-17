"""
Dataset Models for MCP Server

Defines data models for dataset processing, execution tracking, and
real-time monitoring within the MCP server architecture.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, validator


class DatasetStatus(str, Enum):
    """Dataset processing status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    VALIDATION_FAILED = "validation_failed"


class DatasetProcessingStage(str, Enum):
    """Dataset pipeline processing stages."""
    ACQUISITION = "acquisition"
    VALIDATION = "validation"
    STANDARDIZATION = "standardization"
    QUALITY_ASSESSMENT = "quality_assessment"
    BIAS_DETECTION = "bias_detection"
    FUSION = "fusion"
    DISTRIBUTION_BALANCING = "distribution_balancing"
    FINAL_VALIDATION = "final_validation"
    OUTPUT_GENERATION = "output_generation"


class DataSourceType(str, Enum):
    """Types of data sources."""
    S3 = "s3"
    GOOGLE_DRIVE = "google_drive"
    LOCAL = "local"
    HUGGINGFACE = "huggingface"
    URL = "url"
    API = "api"


class FusionStrategy(str, Enum):
    """Data fusion strategies."""
    QUALITY_WEIGHTED = "quality_weighted"
    SOURCE_PRIORITY = "source_priority"
    DIVERSITY_MAXIMIZING = "diversity_maximizing"
    BALANCED = "balanced"
    CUSTOM = "custom"


class BalancingStrategy(str, Enum):
    """Dataset balancing strategies."""
    DEMOGRAPHIC = "demographic"
    GEOGRAPHIC = "geographic"
    TEMPORAL = "temporal"
    TOPIC_BASED = "topic_based"
    CUSTOM = "custom"


# Request Models
class DatasetSource(BaseModel):
    """Dataset source configuration."""
    type: DataSourceType = Field(..., description="Type of data source")
    config: dict[str, Any] = Field(..., description="Source-specific configuration")
    priority: int = Field(default=1, ge=1, le=10, description="Source priority (1-10, lower is higher priority)")
    metadata: dict[str, Any] | None = Field(default=None, description="Additional source metadata")

    @validator("config")
    def validate_config(cls, v, values):
        """Validate source configuration based on type."""
        source_type = values.get("type")
        if source_type == DataSourceType.S3:
            required_fields = ["bucket", "key"]
            if not all(field in v for field in required_fields):
                raise ValueError(f"S3 source requires fields: {required_fields}")
        elif source_type == DataSourceType.GOOGLE_DRIVE:
            required_fields = ["file_id"]
            if not all(field in v for field in required_fields):
                raise ValueError(f"Google Drive source requires fields: {required_fields}")
        elif source_type == DataSourceType.LOCAL:
            required_fields = ["file_path"]
            if not all(field in v for field in required_fields):
                raise ValueError(f"Local source requires fields: {required_fields}")
        elif source_type == DataSourceType.HUGGINGFACE:
            required_fields = ["dataset_name"]
            if not all(field in v for field in required_fields):
                raise ValueError(f"HuggingFace source requires fields: {required_fields}")
        return v


class ValidationConfig(BaseModel):
    """Dataset validation configuration."""
    enabled: bool = Field(default=True, description="Enable validation")
    validation_level: str = Field(default="comprehensive", description="Validation level")
    custom_rules: list[dict[str, Any]] | None = Field(default=None, description="Custom validation rules")
    quality_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Quality threshold")
    max_issues: int = Field(default=100, ge=0, description="Maximum number of issues to report")


class QualityConfig(BaseModel):
    """Quality assessment configuration."""
    enabled: bool = Field(default=True, description="Enable quality assessment")
    assessment_criteria: list[str] = Field(default_factory=lambda: ["completeness", "consistency", "accuracy"], description="Quality criteria to assess")
    quality_threshold: float = Field(default=0.8, ge=0.0, le=1.0, description="Quality threshold")
    min_record_count: int = Field(default=100, ge=0, description="Minimum record count for quality assessment")


class BiasDetectionConfig(BaseModel):
    """Bias detection configuration."""
    enabled: bool = Field(default=True, description="Enable bias detection")
    bias_threshold: float = Field(default=0.3, ge=0.0, le=1.0, description="Bias threshold")
    protected_attributes: list[str] = Field(default_factory=lambda: ["age", "gender", "race", "ethnicity"], description="Protected attributes to check for bias")
    analysis_depth: str = Field(default="comprehensive", description="Analysis depth")
    demographic_groups: list[str] | None = Field(default=None, description="Specific demographic groups to analyze")


class FusionConfig(BaseModel):
    """Data fusion configuration."""
    enabled: bool = Field(default=True, description="Enable data fusion")
    strategy: FusionStrategy = Field(default=FusionStrategy.BALANCED, description="Fusion strategy")
    target_size: int | None = Field(default=None, ge=1, description="Target dataset size")
    quality_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Quality threshold for fusion")
    diversity_requirements: dict[str, Any] | None = Field(default=None, description="Diversity requirements")
    deduplication_enabled: bool = Field(default=True, description="Enable deduplication")


class BalancingConfig(BaseModel):
    """Dataset balancing configuration."""
    enabled: bool = Field(default=True, description="Enable balancing")
    strategy: BalancingStrategy = Field(default=BalancingStrategy.DEMOGRAPHIC, description="Balancing strategy")
    target_distributions: dict[str, float] | None = Field(default=None, description="Target distribution percentages")
    balancing_constraints: dict[str, Any] | None = Field(default=None, description="Balancing constraints")
    max_imbalance_ratio: float = Field(default=0.2, ge=0.0, le=1.0, description="Maximum allowed imbalance ratio")


class OutputConfig(BaseModel):
    """Output configuration."""
    formats: list[str] = Field(default_factory=lambda: ["json"], description="Output formats")
    compression: bool = Field(default=False, description="Enable compression")
    encryption: bool = Field(default=False, description="Enable encryption")
    metadata_included: bool = Field(default=True, description="Include metadata in output")
    validation_report: bool = Field(default=True, description="Generate validation report")
    expected_record_count: int | None = Field(default=None, ge=1, description="Expected record count")


class SafetyValidationConfig(BaseModel):
    """Safety validation configuration."""
    enabled: bool = Field(default=True, description="Enable safety validation")
    crisis_detection: bool = Field(default=True, description="Enable crisis detection")
    content_safety: bool = Field(default=True, description="Enable content safety checks")
    privacy_compliance: bool = Field(default=True, description="Enable privacy compliance checks")
    bias_validation: bool = Field(default=True, description="Enable bias validation")
    safety_thresholds: dict[str, float] | None = Field(default=None, description="Safety thresholds")


class ProcessingConfig(BaseModel):
    """Dataset processing configuration."""
    validation: ValidationConfig = Field(default_factory=ValidationConfig, description="Validation configuration")
    quality: QualityConfig = Field(default_factory=QualityConfig, description="Quality assessment configuration")
    bias_detection: BiasDetectionConfig = Field(default_factory=BiasDetectionConfig, description="Bias detection configuration")
    fusion: FusionConfig = Field(default_factory=FusionConfig, description="Data fusion configuration")
    balancing: BalancingConfig = Field(default_factory=BalancingConfig, description="Balancing configuration")
    output: OutputConfig = Field(default_factory=OutputConfig, description="Output configuration")
    safety_validation: SafetyValidationConfig = Field(default_factory=SafetyValidationConfig, description="Safety validation configuration")
    max_processing_time_minutes: int = Field(default=120, ge=1, description="Maximum processing time in minutes")
    retry_on_failure: bool = Field(default=True, description="Retry processing on failure")
    max_retries: int = Field(default=2, ge=0, le=5, description="Maximum number of retries")


class DatasetProcessingRequest(BaseModel):
    """Dataset processing request model."""
    sources: list[DatasetSource] = Field(..., description="List of dataset sources")
    processing_config: ProcessingConfig = Field(default_factory=ProcessingConfig, description="Processing configuration")
    processing_mode: str = Field(default="comprehensive", description="Processing mode")
    metadata: dict[str, Any] | None = Field(default=None, description="Additional metadata")

    @validator("sources")
    def validate_sources(cls, v):
        """Validate that at least one source is provided."""
        if not v:
            raise ValueError("At least one data source must be specified")
        return v


# Response Models
class DatasetProgressMetrics(BaseModel):
    """Dataset processing progress metrics."""
    records_processed: int = Field(default=0, ge=0, description="Number of records processed")
    total_records: int | None = Field(default=None, ge=0, description="Total number of records")
    processing_rate: float | None = Field(default=None, ge=0, description="Processing rate (records/second)")
    estimated_time_remaining: int | None = Field(default=None, ge=0, description="Estimated time remaining in seconds")
    memory_usage_mb: float | None = Field(default=None, ge=0, description="Memory usage in MB")
    disk_usage_mb: float | None = Field(default=None, ge=0, description="Disk usage in MB")


class DatasetProgressUpdate(BaseModel):
    """Dataset processing progress update."""
    execution_id: str = Field(..., description="Dataset execution ID")
    overall_progress: float = Field(..., ge=0, le=100, description="Overall progress percentage")
    current_stage: DatasetProcessingStage | None = Field(None, description="Current processing stage")
    stage_progress: dict[str, Any] | None = Field(None, description="Stage-specific progress")
    quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Current quality score")
    bias_score: float | None = Field(None, ge=0.0, le=1.0, description="Current bias score")
    metrics: DatasetProgressMetrics | None = Field(None, description="Progress metrics")
    estimated_completion: datetime | None = Field(None, description="Estimated completion time")
    message: str | None = Field(None, description="Progress message")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Update timestamp")


class DatasetStageResult(BaseModel):
    """Result of a dataset processing stage."""
    stage_name: str = Field(..., description="Stage name")
    status: str = Field(..., description="Stage status")
    start_time: datetime | None = Field(None, description="Stage start time")
    end_time: datetime | None = Field(None, description="Stage end time")
    duration_seconds: float | None = Field(None, ge=0, description="Stage duration in seconds")
    result_data: dict[str, Any] | None = Field(None, description="Stage result data")
    quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Stage quality score")
    bias_score: float | None = Field(None, ge=0.0, le=1.0, description="Stage bias score")
    issues: list[str] | None = Field(None, description="Issues encountered")
    warnings: list[str] | None = Field(None, description="Warnings generated")


class DatasetStatusResponse(BaseModel):
    """Response model for dataset processing status."""
    execution_id: str = Field(..., description="Dataset execution ID")
    status: DatasetStatus = Field(..., description="Current execution status")
    current_stage: DatasetProcessingStage | None = Field(None, description="Current processing stage")
    overall_progress: float = Field(..., ge=0, le=100, description="Overall progress percentage")
    quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Overall quality score")
    bias_score: float | None = Field(None, ge=0.0, le=1.0, description="Overall bias score")
    stage_results: dict[str, DatasetStageResult] = Field(default_factory=dict, description="Results from all stages")
    start_time: datetime = Field(..., description="Execution start time")
    end_time: datetime | None = Field(None, description="Execution end time")
    error_message: str | None = Field(None, description="Error message if failed")
    estimated_completion: datetime | None = Field(None, description="Estimated completion time")
    source_locations: list[str] = Field(default_factory=list, description="Source data locations")
    output_locations: list[str] = Field(default_factory=list, description="Output data locations")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


class DatasetStatistics(BaseModel):
    """Comprehensive dataset processing statistics."""
    execution_summary: dict[str, Any] = Field(..., description="Execution summary statistics")
    data_metrics: dict[str, Any] = Field(default_factory=dict, description="Data-related metrics")
    quality_metrics: dict[str, Any] = Field(default_factory=dict, description="Quality metrics")
    bias_metrics: dict[str, Any] = Field(default_factory=dict, description="Bias metrics")
    processing_metrics: dict[str, Any] = Field(default_factory=dict, description="Processing performance metrics")
    detailed_metrics: dict[str, Any] | None = Field(None, description="Detailed metrics if requested")


class DatasetCancelRequest(BaseModel):
    """Request model for dataset processing cancellation."""
    reason: str | None = Field(None, description="Cancellation reason", max_length=500)


# Task Models for Dataset Processing
class DatasetTask(BaseModel):
    """Dataset processing task model."""
    task_id: str = Field(..., description="Task identifier")
    execution_id: str = Field(..., description="Associated execution ID")
    task_type: str = Field(..., description="Task type")
    stage: DatasetProcessingStage = Field(..., description="Processing stage")
    priority: int = Field(default=5, ge=1, le=10, description="Task priority")
    payload: dict[str, Any] = Field(..., description="Task payload")
    requirements: dict[str, Any] | None = Field(None, description="Task requirements")
    timeout_seconds: int = Field(default=3600, ge=60, description="Task timeout in seconds")
    max_retries: int = Field(default=2, ge=0, le=5, description="Maximum retries")
    metadata: dict[str, Any] | None = Field(None, description="Task metadata")


class DatasetTaskResult(BaseModel):
    """Result of a dataset processing task."""
    task_id: str = Field(..., description="Task identifier")
    execution_id: str = Field(..., description="Associated execution ID")
    success: bool = Field(..., description="Task success status")
    result_data: dict[str, Any] | None = Field(None, description="Task result data")
    error_message: str | None = Field(None, description="Error message if failed")
    quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Result quality score")
    bias_score: float | None = Field(None, ge=0.0, le=1.0, description="Result bias score")
    processing_time_seconds: float | None = Field(None, ge=0, description="Processing time in seconds")
    records_processed: int | None = Field(None, ge=0, description="Number of records processed")


# Monitoring and Alerting Models
class DatasetAlert(BaseModel):
    """Dataset processing alert."""
    alert_id: str = Field(..., description="Alert identifier")
    execution_id: str = Field(..., description="Associated execution ID")
    alert_type: str = Field(..., description="Alert type")
    severity: str = Field(..., description="Alert severity")
    message: str = Field(..., description="Alert message")
    details: dict[str, Any] | None = Field(None, description="Alert details")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Alert timestamp")
    acknowledged: bool = Field(default=False, description="Alert acknowledgment status")


class DatasetMonitoringMetrics(BaseModel):
    """Dataset processing monitoring metrics."""
    execution_id: str = Field(..., description="Associated execution ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Metrics timestamp")

    # System metrics
    cpu_usage_percent: float | None = Field(None, ge=0, le=100, description="CPU usage percentage")
    memory_usage_mb: float | None = Field(None, ge=0, description="Memory usage in MB")
    disk_usage_mb: float | None = Field(None, ge=0, description="Disk usage in MB")

    # Processing metrics
    active_tasks: int = Field(default=0, ge=0, description="Number of active tasks")
    completed_tasks: int = Field(default=0, ge=0, description="Number of completed tasks")
    failed_tasks: int = Field(default=0, ge=0, description="Number of failed tasks")
    queue_size: int = Field(default=0, ge=0, description="Current queue size")

    # Quality metrics
    average_quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Average quality score")
    average_bias_score: float | None = Field(None, ge=0.0, le=1.0, description="Average bias score")

    # Performance metrics
    processing_rate_records_per_second: float | None = Field(None, ge=0, description="Processing rate in records per second")
    estimated_completion_time: datetime | None = Field(None, description="Estimated completion time")


# Configuration Models
class DatasetServiceConfig(BaseModel):
    """Dataset service configuration."""
    max_concurrent_executions: int = Field(default=10, ge=1, description="Maximum concurrent executions")
    execution_timeout_minutes: int = Field(default=120, ge=1, description="Execution timeout in minutes")
    max_retry_attempts: int = Field(default=2, ge=0, le=5, description="Maximum retry attempts")
    health_check_interval_seconds: int = Field(default=30, ge=10, description="Health check interval")
    cleanup_interval_minutes: int = Field(default=60, ge=1, description="Cleanup interval in minutes")
    storage_config: dict[str, Any] | None = Field(None, description="Storage configuration")
    safety_validation_enabled: bool = Field(default=True, description="Enable safety validation")
    real_time_monitoring_enabled: bool = Field(default=True, description="Enable real-time monitoring")


# WebSocket Event Models
class DatasetWebSocketEvent(BaseModel):
    """Dataset WebSocket event model."""
    event_type: str = Field(..., description="Event type")
    execution_id: str = Field(..., description="Associated execution ID")
    user_id: str = Field(..., description="User ID")
    data: dict[str, Any] = Field(..., description="Event data")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")


class DatasetProgressEvent(DatasetWebSocketEvent):
    """Dataset progress WebSocket event."""
    event_type: str = Field(default="dataset_progress", description="Event type")
    data: DatasetProgressUpdate = Field(..., description="Progress update data")


class DatasetStatusEvent(DatasetWebSocketEvent):
    """Dataset status WebSocket event."""
    event_type: str = Field(default="dataset_status", description="Event type")
    data: DatasetStatusResponse = Field(..., description="Status update data")


class DatasetAlertEvent(DatasetWebSocketEvent):
    """Dataset alert WebSocket event."""
    event_type: str = Field(default="dataset_alert", description="Event type")
    data: DatasetAlert = Field(..., description="Alert data")


# Export all models
__all__ = [
    "BalancingConfig",
    "BalancingStrategy",
    "BiasDetectionConfig",
    "DataSourceType",
    "DatasetAlert",
    "DatasetAlertEvent",
    "DatasetCancelRequest",
    "DatasetMonitoringMetrics",
    "DatasetProcessingRequest",
    "DatasetProcessingStage",
    "DatasetProgressEvent",
    "DatasetProgressMetrics",
    "DatasetProgressUpdate",
    "DatasetServiceConfig",
    "DatasetSource",
    "DatasetStageResult",
    "DatasetStatistics",
    "DatasetStatus",
    "DatasetStatusEvent",
    "DatasetStatusResponse",
    "DatasetTask",
    "DatasetTaskResult",
    "DatasetWebSocketEvent",
    "FusionConfig",
    "FusionStrategy",
    "OutputConfig",
    "ProcessingConfig",
    "QualityConfig",
    "SafetyValidationConfig",
    "ValidationConfig"
]
