from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from ai.pipelines.orchestrator.processing.transcript_quality_pipeline import (
    TranscriptQualityPipeline,
)


@pytest.fixture
def mock_dependencies():
    with (
        patch(
            "ai.pipelines.orchestrator.processing.transcript_quality_pipeline.VoiceTranscriber"
        ) as mock_whisper,
        patch(
            "ai.pipelines.orchestrator.processing.transcript_quality_pipeline.NemoCuratorClient"
        ) as mock_curator,
        patch(
            "ai.pipelines.orchestrator.processing.transcript_quality_pipeline.NemoEvaluatorClient"
        ) as mock_evaluator,
        patch(
            "ai.pipelines.orchestrator.processing.transcript_quality_pipeline.TranscriptCorrector"
        ) as mock_corrector,
    ):
        # Setup mock instances
        whisper_instance = mock_whisper.return_value
        curator_instance = mock_curator.return_value
        evaluator_instance = mock_evaluator.return_value
        corrector_instance = mock_corrector.return_value

        yield {
            "whisper": whisper_instance,
            "curator": curator_instance,
            "evaluator": evaluator_instance,
            "corrector": corrector_instance,
            "classes": {
                "whisper": mock_whisper,
                "curator": mock_curator,
                "evaluator": mock_evaluator,
                "corrector": mock_corrector,
            },
        }


def test_pipeline_initialization(mock_dependencies):
    pipeline = TranscriptQualityPipeline()
    assert pipeline.transcriber == mock_dependencies["whisper"]
    assert pipeline.curator == mock_dependencies["curator"]
    assert pipeline.evaluator == mock_dependencies["evaluator"]
    assert pipeline.corrector == mock_dependencies["corrector"]


def test_process_audio_flow(mock_dependencies):
    pipeline = TranscriptQualityPipeline()
    audio_path = Path("test.wav")

    # Mock return values - Success case
    mock_result = MagicMock()
    mock_result.success = True
    mock_result.full_text = "I feel anxious."
    mock_result.confidence_score = 0.95
    mock_result.model_used = "base"
    pipeline.transcriber.transcribe_audio.return_value = mock_result

    pipeline.curator.detect_crisis_narratives.return_value = []

    pipeline.corrector.correct_transcript.return_value = "I feel anxious (corrected)."

    pipeline.evaluator.evaluate_therapeutic_alignment.return_value = {
        "score": 0.8,
        "status": "aligned",
    }

    result = pipeline.process_audio(audio_path)

    # Verify calls
    # 1. Transcription
    mock_dependencies["whisper"].transcribe_audio.assert_called_once_with(str(audio_path))

    # 2. Correction
    mock_dependencies["corrector"].correct_transcript.assert_called_once_with(
        "I feel anxious.", context="therapy_session"
    )

    # 3. Validation (Therapeutic Alignment)
    # The code calls evaluate_therapeutic_alignment, not evaluate_text
    mock_dependencies["evaluator"].evaluate_therapeutic_alignment.assert_called_once()

    # Verify structure of result
    assert result["success"] is True
    assert result["original_text"] == "I feel anxious."
    assert result["corrected_text"] == "I feel anxious (corrected)."
    assert result["alignment"] == {"score": 0.8, "status": "aligned"}


def test_process_audio_failure():
    pipeline = TranscriptQualityPipeline()
    audio_path = Path("test.wav")

    # Simulate transcription failure (VoiceTranscriber returns success=False, doesn't raise usually)
    mock_result = MagicMock()
    mock_result.success = False
    mock_result.error_message = "Transcription failed"
    pipeline.transcriber.transcribe_audio.return_value = mock_result

    # Run pipeline
    result = pipeline.process_audio(audio_path)

    # Verify failure handling
    assert result["success"] is False
    assert "error" in result
    assert "Pass 1 failed" in result["error"]
