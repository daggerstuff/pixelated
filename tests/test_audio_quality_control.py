from pixel_voice.audio_quality_control import compute_quality_metrics
from pydub import AudioSegment


def test_audio_quality_metrics(tmp_path):
    # Create a dummy audio file (1s silence)
    audio = AudioSegment.silent(duration=1000)
    audio_path = tmp_path / "test.wav"
    audio.export(audio_path, format="wav")

    # Run quality metrics
    metrics = compute_quality_metrics(str(audio_path))
    assert "snr" in metrics
    assert "loudness" in metrics
    assert "silence_ratio" in metrics
    assert "clipping_ratio" in metrics
    assert "language" in metrics
    assert metrics["snr"] >= 0
    assert metrics["loudness"] <= 0
    assert 0 <= metrics["silence_ratio"] <= 1
    assert 0 <= metrics["clipping_ratio"] <= 1
    assert isinstance(metrics["language"], str)
