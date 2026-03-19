from multimodal_bias_detection.config import settings
from multimodal_bias_detection.preprocessing_pipeline import validate_audio_format


def test_validate_audio_format_valid():
    """Test valid audio extensions from config"""
    for ext in settings.allowed_audio_formats:
        assert validate_audio_format(f"test_file.{ext}") is True


def test_validate_audio_format_invalid():
    """Test invalid audio extensions"""
    known_invalid = {"txt", "pdf", "mp4"} - set(settings.allowed_audio_formats)
    for ext in known_invalid:
        assert validate_audio_format(f"document.{ext}") is False

    assert validate_audio_format("no_extension") is False


def test_validate_audio_format_case_insensitive():
    """Test extensions with mixed case"""
    for ext in settings.allowed_audio_formats:
        assert validate_audio_format(f"AUDIO.{ext.upper()}") is True


def test_validate_audio_format_exceptions():
    """Test exception handling for invalid inputs"""
    # Passing None
    assert validate_audio_format(None) is False  # type: ignore

    # Passing an integer
    assert validate_audio_format(12345) is False  # type: ignore

    # Passing a boolean
    assert validate_audio_format(True) is False  # type: ignore