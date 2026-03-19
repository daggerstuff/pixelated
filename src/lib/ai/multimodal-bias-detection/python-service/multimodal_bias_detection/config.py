""" Configuration management for multi-modal bias detection service """
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from pydantic.networks import RedisDsn, PostgresDsn


class Settings(BaseSettings):
    """Application settings with validation for multi-modal bias detection"""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    # Application settings
    app_name: str = Field(default="Multi-Modal Bias Detection Service", validation_alias="APP_NAME")
    app_version: str = Field(default="1.0.0", validation_alias="APP_VERSION")
    debug: bool = Field(default=False, validation_alias="DEBUG")
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")

    # Server settings
    host: str = Field(default="0.0.0.0", validation_alias="HOST")
    port: int = Field(default=8001, validation_alias="PORT")  # Different port from text service
    workers: int = Field(default=1, validation_alias="WORKERS")

    # Database settings
    database_url: PostgresDsn = Field(
        default="postgresql://user:password@localhost:5432/multimodal_bias_detection",
        validation_alias="DATABASE_URL"
    )

    # Redis settings
    redis_url: RedisDsn = Field(
        default="redis://localhost:6379/1",  # Different Redis DB
        validation_alias="REDIS_URL"
    )

    # Model settings for different modalities
    vision_model_path: str = Field(default="./models/vision", validation_alias="VISION_MODEL_PATH")
    audio_model_path: str = Field(default="./models/audio", validation_alias="AUDIO_MODEL_PATH")
    video_model_path: str = Field(default="./models/video", validation_alias="VIDEO_MODEL_PATH")
    multimodal_model_path: str = Field(default="./models/multimodal", validation_alias="MULTIMODAL_MODEL_PATH")

    # Processing settings
    max_image_size: int = Field(default=10 * 1024 * 1024, validation_alias="MAX_IMAGE_SIZE")  # 10MB
    max_audio_size: int = Field(default=50 * 1024 * 1024, validation_alias="MAX_AUDIO_SIZE")  # 50MB
    max_video_size: int = Field(default=100 * 1024 * 1024, validation_alias="MAX_VIDEO_SIZE")  # 100MB
    max_image_dimensions: int = Field(default=2048, validation_alias="MAX_IMAGE_DIMENSIONS")
    max_audio_duration: int = Field(default=300, validation_alias="MAX_AUDIO_DURATION")  # 5 minutes
    max_video_duration: int = Field(default=600, validation_alias="MAX_VIDEO_DURATION")  # 10 minutes

    # ML settings
    batch_size: int = Field(default=16, validation_alias="BATCH_SIZE")
    model_timeout: int = Field(default=60, validation_alias="MODEL_TIMEOUT")  # Longer timeout for multimedia
    confidence_threshold: float = Field(default=0.7, validation_alias="CONFIDENCE_THRESHOLD")

    # Vision processing
    vision_model_name: str = Field(default="clip-vit-base-patch32", validation_alias="VISION_MODEL_NAME")
    face_detection_model: str = Field(default="retinaface", validation_alias="FACE_DETECTION_MODEL")
    ocr_model_name: str = Field(default="paddleocr", validation_alias="OCR_MODEL_NAME")

    # Audio processing
    audio_model_name: str = Field(default="wav2vec2-base", validation_alias="AUDIO_MODEL_NAME")
    speech_to_text_model: str = Field(default="whisper-base", validation_alias="SPEECH_TO_TEXT_MODEL")
    sample_rate: int = Field(default=16000, validation_alias="SAMPLE_RATE")

    # Video processing
    video_model_name: str = Field(default="timesformer-base", validation_alias="VIDEO_MODEL_NAME")
    frame_extraction_rate: int = Field(default=1, validation_alias="FRAME_EXTRACTION_RATE")  # frames per second
    keyframe_threshold: float = Field(default=0.3, validation_alias="KEYFRAME_THRESHOLD")

    # Security settings
    api_key_header: str = Field(default="X-API-Key", validation_alias="API_KEY_HEADER")
    rate_limit_per_minute: int = Field(default=30, validation_alias="RATE_LIMIT_PER_MINUTE")  # Lower for multimedia
    max_concurrent_requests: int = Field(default=5, validation_alias="MAX_CONCURRENT_REQUESTS")

    # File storage
    upload_dir: str = Field(default="./uploads", validation_alias="UPLOAD_DIR")
    temp_cleanup_interval: int = Field(default=3600, validation_alias="TEMP_CLEANUP_INTERVAL")  # 1 hour
    allowed_image_formats: list = Field(default=["jpg", "jpeg", "png", "gif", "bmp", "webp"], validation_alias="ALLOWED_IMAGE_FORMATS")
    allowed_audio_formats: list = Field(default=["mp3", "wav", "flac", "m4a", "ogg"], validation_alias="ALLOWED_AUDIO_FORMATS")
    allowed_video_formats: list = Field(default=["mp4", "avi", "mov", "mkv", "webm"], validation_alias="ALLOWED_VIDEO_FORMATS")

    # Logging settings
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    log_format: str = Field(
        default="json",
        validation_alias="LOG_FORMAT",
        description="Log format: json, text"
    )

    # Performance settings
    enable_caching: bool = Field(default=True, validation_alias="ENABLE_CACHING")
    cache_ttl_seconds: int = Field(default=1800, validation_alias="CACHE_TTL_SECONDS")  # 30 minutes for multimedia
    enable_async_processing: bool = Field(default=True, validation_alias="ENABLE_ASYNC_PROCESSING")
    enable_gpu_acceleration: bool = Field(default=True, validation_alias="ENABLE_GPU_ACCELERATION")

    @field_validator("environment")
    def validate_environment(cls, v: str) -> str:
        """Validate environment setting"""
        valid_environments = {"development", "staging", "production"}
        if v not in valid_environments:
            raise ValueError(f"Environment must be one of: {valid_environments}")
        return v

    @field_validator("log_level")
    def validate_log_level(cls, v: str) -> str:
        """Validate log level setting"""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of: {valid_levels}")
        return v.upper()

    @field_validator("log_format")
    def validate_log_format(cls, v: str) -> str:
        """Validate log format setting"""
        valid_formats = {"json", "text"}
        if v.lower() not in valid_formats:
            raise ValueError(f"Log format must be one of: {valid_formats}")
        return v.lower()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()