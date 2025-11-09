"""
Tests for the multimodal preprocessing pipeline.
"""

import base64
import json
from unittest.mock import AsyncMock, patch

import numpy as np
import pytest
from PIL import Image

# Updated imports for the correct module structure
from src.lib.ai.multimodal-bias-detection.python-service.preprocessing_pipeline import (
    AudioPreprocessingPipeline,
    VisionPreprocessingPipeline,
    VideoPreprocessingPipeline,
    MultimodalPreprocessingPipeline,
    validate_audio_format,
    validate_image_format,
    validate_video_format
)


class TestAudioPreprocessingPipeline:
    """Test audio preprocessing pipeline"""

    @pytest.fixture
    def audio_pipeline(self):
        """Create audio preprocessing pipeline instance"""
        return AudioPreprocessingPipeline()

    @pytest.fixture
    def sample_audio_bytes(self):
        """Create sample audio bytes (mock data)"""
        # Create mock audio data
        audio_data = np.random.randn(16000).astype(np.float32)  # 1 second of random audio
        return audio_data.tobytes()

    @pytest.mark.asyncio
    async def test_initialize_pipeline(self, audio_pipeline):
        """Test pipeline initialization"""
        assert audio_pipeline is not None
        assert audio_pipeline.is_loaded == False

    @pytest.mark.asyncio
    async def test_load_processors(self, audio_pipeline):
        """Test loading processors"""
        with patch('transformers.WhisperProcessor.from_pretrained') as mock_whisper, \
             patch('transformers.Wav2Vec2Processor.from_pretrained') as mock_wav2vec:

            mock_whisper.return_value = Mock()
            mock_wav2vec.return_value = Mock()

            result = await audio_pipeline.load_processors()
            assert result == True
            assert audio_pipeline.is_loaded == True

    @pytest.mark.asyncio
    async def test_preprocess_audio_bytes(self, audio_pipeline, sample_audio_bytes):
        """Test preprocessing audio from bytes"""
        with patch.object(audio_pipeline, 'load_processors', AsyncMock()), \
             patch('librosa.load') as mock_librosa, \
             patch.object(audio_pipeline, '_extract_audio_features', AsyncMock(return_value={})), \
             patch.object(audio_pipeline, '_prepare_model_inputs', AsyncMock(return_value={})):

            # Mock librosa.load to return sample data
            mock_librosa.return_value = (np.array([0.1, 0.2, 0.3]), 16000)

            result = await audio_pipeline.preprocess_audio(sample_audio_bytes)

            assert "audio_array" in result
            assert "sample_rate" in result
            assert "duration" in result
            assert result["sample_rate"] == 16000

    @pytest.mark.asyncio
    async def test_normalize_audio(self, audio_pipeline):
        """Test audio normalization"""
        test_audio = np.array([2.0, -3.0, 1.0, -1.0])
        normalized = audio_pipeline._normalize_audio(test_audio)

        # Check that values are in [-1, 1] range
        assert np.all(normalized <= 1.0)
        assert np.all(normalized >= -1.0)

        # Check that max absolute value is 1.0
        assert np.max(np.abs(normalized)) == 1.0


class TestVisionPreprocessingPipeline:
    """Test vision preprocessing pipeline"""

    @pytest.fixture
    def vision_pipeline(self):
        """Create vision preprocessing pipeline instance"""
        return VisionPreprocessingPipeline()

    @pytest.fixture
    def sample_image_bytes(self):
        """Create sample image bytes"""
        # Create a simple test image
        image = Image.new('RGB', (100, 100), color='red')
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            image.save(tmp, format='PNG')
            tmp_path = tmp.name

        with open(tmp_path, 'rb') as f:
            image_bytes = f.read()

        Path(tmp_path).unlink()
        return image_bytes

    @pytest.mark.asyncio
    async def test_initialize_pipeline(self, vision_pipeline):
        """Test pipeline initialization"""
        assert vision_pipeline is not None
        assert vision_pipeline.is_loaded == False

    @pytest.mark.asyncio
    async def test_load_processor(self, vision_pipeline):
        """Test loading processor"""
        with patch('transformers.ViTImageProcessor.from_pretrained') as mock_vit:
            mock_vit.return_value = Mock()

            result = await vision_pipeline.load_processor()
            assert result == True
            assert vision_pipeline.is_loaded == True

    @pytest.mark.asyncio
    async def test_preprocess_image_bytes(self, vision_pipeline, sample_image_bytes):
        """Test preprocessing image from bytes"""
        with patch.object(vision_pipeline, 'load_processor', AsyncMock()), \
             patch.object(vision_pipeline, '_prepare_model_inputs', AsyncMock(return_value={})):

            result = await vision_pipeline.preprocess_image(sample_image_bytes)

            assert "image" in result
            assert "width" in result
            assert "height" in result
            assert result["width"] == 100
            assert result["height"] == 100


class TestVideoPreprocessingPipeline:
    """Test video preprocessing pipeline"""

    @pytest.fixture
    def video_pipeline(self):
        """Create video preprocessing pipeline instance"""
        return VideoPreprocessingPipeline()

    @pytest.mark.asyncio
    async def test_initialize_pipeline(self, video_pipeline):
        """Test pipeline initialization"""
        assert video_pipeline is not None
        assert video_pipeline.is_loaded == False


class TestMultimodalPreprocessingPipeline:
    """Test multimodal preprocessing pipeline"""

    @pytest.fixture
    def multimodal_pipeline(self):
        """Create multimodal preprocessing pipeline instance"""
        return MultimodalPreprocessingPipeline()

    @pytest.mark.asyncio
    async def test_initialize_pipeline(self, multimodal_pipeline):
        """Test pipeline initialization"""
        assert multimodal_pipeline is not None
        assert multimodal_pipeline.audio_pipeline is not None
        assert multimodal_pipeline.vision_pipeline is not None
        assert multimodal_pipeline.video_pipeline is not None


class TestValidationFunctions:
    """Test data validation functions"""

    def test_validate_audio_format(self):
        """Test audio format validation"""
        # Test valid formats
        assert validate_audio_format("test.mp3") == True
        assert validate_audio_format("test.wav") == True
        assert validate_audio_format("test.flac") == True

        # Test invalid format
        assert validate_audio_format("test.txt") == False

    def test_validate_image_format(self):
        """Test image format validation"""
        # Test valid formats
        assert validate_image_format("test.jpg") == True
        assert validate_image_format("test.png") == True
        assert validate_image_format("test.gif") == True

        # Test invalid format
        assert validate_image_format("test.mp3") == False

    def test_validate_video_format(self):
        """Test video format validation"""
        # Test valid formats
        assert validate_video_format("test.mp4") == True
        assert validate_video_format("test.avi") == True
        assert validate_video_format("test.mov") == True

        # Test invalid format
        assert validate_video_format("test.jpg") == False


class TestIntegration:
    """Integration tests for preprocessing pipeline"""

    @pytest.mark.asyncio
    async def test_full_preprocessing_pipeline(self):
        """Test full preprocessing pipeline integration"""
        # This would test the complete flow with mocked dependencies
        pipeline = MultimodalPreprocessingPipeline()
        assert pipeline is not None


if __name__ == "__main__":
    pytest.main([__file__])
