"""
test_voice_quality_assessor.py
Unit tests for voice_quality_assessor.py
"""

from pathlib import Path

from pydub import AudioSegment  # type: ignore[import]

from ai.dataset_pipeline import voice_quality_assessor as vqa


def create_test_audio(
    duration_ms: int = 3000, silence_ms: int = 0, clipping: bool = False
) -> AudioSegment:
    """Generate a simple sine wave with optional silence and clipping."""
    from pydub.generators import Sine  # type: ignore[import]

    audio = Sine(440).to_audio_segment(duration=duration_ms - silence_ms)
    if silence_ms > 0:
        audio += AudioSegment.silent(duration=silence_ms)
    if clipping:
        # Artificially set max amplitude
        samples = audio.get_array_of_samples()
        max_val = max(samples)
        audio = audio._spawn(
            bytes(max_val if i % 2 == 0 else 0 for i in range(len(samples)))
        )  # type: ignore[attr-defined]
    return audio


def test_assess_audio_quality_pass(tmp_path: Path):  # type: ignore[unused-argument]
    audio = create_test_audio()
    file_path = tmp_path / "test_pass.wav"
    audio.export(file_path, format="wav")
    result = vqa.assess_audio_quality(str(file_path))
    assert result["passed"] is True
    assert result["duration_sec"] >= vqa.DEFAULT_CONFIG["min_duration_sec"]
    assert result["snr_db"] >= vqa.DEFAULT_CONFIG["min_snr_db"]


def test_assess_audio_quality_fail_duration(tmp_path: Path):  # type: ignore[unused-argument]
    audio = create_test_audio(duration_ms=500)
    file_path = tmp_path / "test_fail.wav"
    audio.export(file_path, format="wav")
    result = vqa.assess_audio_quality(str(file_path))
    assert result["passed"] is False
    assert result["duration_sec"] < vqa.DEFAULT_CONFIG["min_duration_sec"]


def test_assess_audio_quality_fail_silence(tmp_path: Path):  # type: ignore[unused-argument]
    audio = create_test_audio(duration_ms=3000, silence_ms=2000)
    file_path = tmp_path / "test_silence.wav"
    audio.export(file_path, format="wav")
    result = vqa.assess_audio_quality(str(file_path))
    assert result["passed"] is False
    assert result["silence_ratio"] > vqa.DEFAULT_CONFIG["max_silence_ratio"]


def test_assess_audio_quality_fail_clipping(tmp_path: Path):  # type: ignore[unused-argument]
    audio = create_test_audio(duration_ms=3000, clipping=True)
    file_path = tmp_path / "test_clipping.wav"
    audio.export(file_path, format="wav")
    result = vqa.assess_audio_quality(str(file_path))
    assert result["passed"] is False
    assert result["clipping_ratio"] > vqa.DEFAULT_CONFIG["max_clipping_ratio"]


def test_batch_assess(tmp_path: Path):  # type: ignore[unused-argument]
    audio1 = create_test_audio()
    audio2 = create_test_audio(duration_ms=500)
    file1 = tmp_path / "a1.wav"
    file2 = tmp_path / "a2.wav"
    audio1.export(file1, format="wav")
    audio2.export(file2, format="wav")
    results = vqa.batch_assess([str(file1), str(file2)])
    assert len(results) == 2
    assert any(r["passed"] for r in results)
    assert any(not r["passed"] for r in results)


def test_assess_audio_quality_error():
    # Nonexistent file should return error
    result = vqa.assess_audio_quality("/nonexistent/file.wav")
    assert result["passed"] is False
    assert "error" in result
