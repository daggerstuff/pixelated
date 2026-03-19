from multimodal_bias_detection.preprocessing_pipeline import validate_audio_format


def test_validate_audio_format_valid():
    """Test valid audio extensions from config"""
    assert validate_audio_format("test_file.mp3") is True
    assert validate_audio_format("audio.wav") is True
    assert validate_audio_format("/path/to/file.flac") is True
    assert validate_audio_format("m4a_audio.m4a") is True
    assert validate_audio_format("sound.ogg") is True

def test_validate_audio_format_invalid():
    """Test invalid audio extensions"""
    assert validate_audio_format("document.txt") is False
    assert validate_audio_format("image.pdf") is False
    assert validate_audio_format("video.mp4") is False
    assert validate_audio_format("no_extension") is False

def test_validate_audio_format_case_insensitive():
    """Test extensions with mixed case"""
    assert validate_audio_format("AUDIO.MP3") is True
    assert validate_audio_format("sound.Wav") is True
    assert validate_audio_format("test.Flac") is True
    assert validate_audio_format("music.M4a") is True

def test_validate_audio_format_exceptions():
    """Test exception handling for invalid inputs"""
    # Passing None
    assert validate_audio_format(None) is False  # type: ignore

    # Passing an integer
    assert validate_audio_format(12345) is False  # type: ignore

    # Passing a boolean
    assert validate_audio_format(True) is False  # type: ignore
