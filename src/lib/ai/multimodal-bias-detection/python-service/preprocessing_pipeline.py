"""
Data preprocessing pipeline for multimodal bias detection service.

This module implements comprehensive preprocessing pipelines for audio, vision, and video data
used in bias detection analysis.
"""

import asyncio
import base64
import io
import logging
import tempfile
from pathlib import Path
from typing import Any, Union

import librosa
import numpy as np
import torch
from PIL import Image
from transformers import (
    ViTImageProcessor,
    VideoMAEImageProcessor,
    Wav2Vec2Processor,
    WhisperProcessor,
)

from .config import settings

logger = logging.getLogger(__name__)


class AudioPreprocessingPipeline:
    """Audio preprocessing pipeline for bias detection"""

    def __init__(self):
        self.whisper_processor = None
        self.wav2vec_processor = None
        self.is_loaded = False
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    async def load_processors(self) -> bool:
        """Load audio processors"""
        try:
            logger.info("Loading audio preprocessing processors")

            # Load Whisper processor for speech-to-text preprocessing
            self.whisper_processor = WhisperProcessor.from_pretrained(
                f"openai/{settings.speech_to_text_model}"
            )

            # Load Wav2Vec2 processor for audio classification
            self.wav2vec_processor = Wav2Vec2Processor.from_pretrained(
                f"facebook/{settings.audio_model_name}"
            )

            self.is_loaded = True
            logger.info("Audio processors loaded successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to load audio processors: {str(e)}")
            return False

    async def preprocess_audio(
        self,
        audio_data: Union[str, bytes],
        extract_features: bool = True,
        normalize: bool = True
    ) -> dict[str, Any]:
        """Preprocess audio data for bias detection"""
        if not self.is_loaded:
            await self.load_processors()

        try:
            # Load and validate audio
            audio_array, sample_rate = await self._load_audio(audio_data)

            # Validate audio duration
            duration = len(audio_array) / sample_rate
            if duration > settings.max_audio_duration:
                raise ValueError(
                    f"Audio duration {duration}s exceeds maximum {settings.max_audio_duration}s"
                )

            # Normalize audio if requested
            if normalize:
                audio_array = self._normalize_audio(audio_array)

            # Extract features if requested
            features = {}
            if extract_features:
                features = await self._extract_audio_features(audio_array, sample_rate)

            # Prepare audio for model input
            model_inputs = await self._prepare_model_inputs(audio_array, sample_rate)

            logger.info(
                "Audio preprocessing completed",
                duration=duration,
                sample_rate=sample_rate,
                features_extracted=extract_features
            )

            return {
                "audio_array": audio_array,
                "sample_rate": sample_rate,
                "duration": duration,
                "features": features,
                "model_inputs": model_inputs,
                "metadata": {
                    "channels": 1 if len(audio_array.shape) == 1 else audio_array.shape[1],
                    "normalized": normalize
                }
            }

        except Exception as e:
            logger.error(f"Audio preprocessing failed: {str(e)}")
            raise

    async def _load_audio(self, audio_data: Union[str, bytes]) -> tuple[np.ndarray, int]:
        """Load audio from various input formats"""
        if isinstance(audio_data, str):
            # Base64 encoded audio
            if audio_data.startswith("data:audio"):
                # Remove data URL prefix
                audio_data = audio_data.split(",")[1]

            audio_bytes = base64.b64decode(audio_data)

            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_path = tmp_file.name

            # Load with librosa
            audio_array, sample_rate = librosa.load(tmp_path, sr=settings.sample_rate)

            # Clean up temp file
            Path(tmp_path).unlink()

            return audio_array, sample_rate

        elif isinstance(audio_data, bytes):
            # Direct audio bytes
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name

            audio_array, sample_rate = librosa.load(tmp_path, sr=settings.sample_rate)
            Path(tmp_path).unlink()

            return audio_array, sample_rate

        else:
            raise ValueError(f"Unsupported audio data type: {type(audio_data)}")

    def _normalize_audio(self, audio_array: np.ndarray) -> np.ndarray:
        """Normalize audio array to [-1, 1] range"""
        # Peak normalization
        max_amplitude = np.max(np.abs(audio_array))
        if max_amplitude > 0:
            audio_array = audio_array / max_amplitude

        return audio_array

    async def _extract_audio_features(
        self,
        audio_array: np.ndarray,
        sample_rate: int
    ) -> dict[str, Any]:
        """Extract audio features for analysis"""
        try:
            features = {
                "tempo": float(librosa.beat.tempo(y=audio_array, sr=sample_rate)[0]),
                "energy": float(np.mean(librosa.feature.rms(y=audio_array))),
                "spectral_centroid": float(
                    np.mean(librosa.feature.spectral_centroid(y=audio_array, sr=sample_rate))
                ),
                "zero_crossing_rate": float(
                    np.mean(librosa.feature.zero_crossing_rate(y=audio_array))
                ),
                "spectral_rolloff": float(
                    np.mean(librosa.feature.spectral_rolloff(y=audio_array, sr=sample_rate))
                ),
                "spectral_bandwidth": float(
                    np.mean(librosa.feature.spectral_bandwidth(y=audio_array, sr=sample_rate))
                )
            }

            # Extract MFCC features
            mfcc = librosa.feature.mfcc(y=audio_array, sr=sample_rate, n_mfcc=13)
            features["mfcc_mean"] = mfcc.mean(axis=1).tolist()
            features["mfcc_std"] = mfcc.std(axis=1).tolist()

            # Chroma features
            chroma = librosa.feature.chroma_stft(y=audio_array, sr=sample_rate)
            features["chroma_mean"] = float(chroma.mean())
            features["chroma_std"] = float(chroma.std())

            return features

        except Exception as e:
            logger.warning(f"Audio feature extraction failed: {str(e)}")
            return {}

    async def _prepare_model_inputs(
        self,
        audio_array: np.ndarray,
        sample_rate: int
    ) -> dict[str, Any]:
        """Prepare audio data for model input"""
        try:
            # Prepare for Whisper (speech-to-text)
            whisper_inputs = self.whisper_processor(
                audio_array,
                sampling_rate=sample_rate,
                return_tensors="pt"
            )

            # Prepare for Wav2Vec2 (audio classification)
            wav2vec_inputs = self.wav2vec_processor(
                audio_array,
                sampling_rate=sample_rate,
                return_tensors="pt",
                padding="longest"
            )

            return {
                "whisper_inputs": whisper_inputs,
                "wav2vec_inputs": wav2vec_inputs
            }

        except Exception as e:
            logger.warning(f"Model input preparation failed: {str(e)}")
            return {}


class VisionPreprocessingPipeline:
    """Vision preprocessing pipeline for bias detection"""

    def __init__(self):
        self.image_processor = None
        self.is_loaded = False

    async def load_processor(self) -> bool:
        """Load vision processor"""
        try:
            logger.info("Loading vision preprocessing processor")

            # Load ViT image processor
            self.image_processor = ViTImageProcessor.from_pretrained(
                f"google/{settings.vision_model_name}"
            )

            self.is_loaded = True
            logger.info("Vision processor loaded successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to load vision processor: {str(e)}")
            return False

    async def preprocess_image(
        self,
        image_data: Union[str, bytes],
        resize: bool = True,
        normalize: bool = True
    ) -> dict[str, Any]:
        """Preprocess image data for bias detection"""
        if not self.is_loaded:
            await self.load_processor()

        try:
            # Load and validate image
            image = await self._load_image(image_data)

            # Validate image dimensions
            width, height = image.size
            if max(width, height) > settings.max_image_dimensions:
                if resize:
                    image = self._resize_image(image, settings.max_image_dimensions)
                else:
                    raise ValueError(
                        f"Image dimensions ({width}x{height}) exceed maximum "
                        f"{settings.max_image_dimensions}px"
                    )

            # Convert to RGB if needed
            if image.mode != "RGB":
                image = image.convert("RGB")

            # Prepare image for model input
            model_inputs = await self._prepare_model_inputs(image)

            logger.info(
                "Image preprocessing completed",
                width=image.size[0],
                height=image.size[1],
                resized=resize
            )

            return {
                "image": image,
                "width": image.size[0],
                "height": image.size[1],
                "model_inputs": model_inputs,
                "metadata": {
                    "original_mode": image.mode,
                    "normalized": normalize
                }
            }

        except Exception as e:
            logger.error(f"Image preprocessing failed: {str(e)}")
            raise

    async def _load_image(self, image_data: Union[str, bytes]) -> Image.Image:
        """Load image from various input formats"""
        if isinstance(image_data, str):
            # Base64 encoded image
            if image_data.startswith("data:image"):
                # Remove data URL prefix
                image_data = image_data.split(",")[1]

            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))

            return image

        elif isinstance(image_data, bytes):
            # Direct image bytes
            image = Image.open(io.BytesIO(image_data))
            return image

        else:
            raise ValueError(f"Unsupported image data type: {type(image_data)}")

    def _resize_image(self, image: Image.Image, max_dimension: int) -> Image.Image:
        """Resize image while maintaining aspect ratio"""
        width, height = image.size
        if width > height:
            new_width = max_dimension
            new_height = int(height * max_dimension / width)
        else:
            new_height = max_dimension
            new_width = int(width * max_dimension / height)

        return image.resize((new_width, new_height), Image.Resampling.LANCZOS)

    async def _prepare_model_inputs(self, image: Image.Image) -> Dict[str, Any]:
        """Prepare image data for model input"""
        try:
            # Prepare for ViT
            vit_inputs = self.image_processor(
                images=image,
                return_tensors="pt"
            )

            return {
                "vit_inputs": vit_inputs
            }

        except Exception as e:
            logger.warning(f"Model input preparation failed: {str(e)}")
            return {}


class VideoPreprocessingPipeline:
    """Video preprocessing pipeline for bias detection"""

    def __init__(self):
        self.video_processor = None
        self.is_loaded = False

    async def load_processor(self) -> bool:
        """Load video processor"""
        try:
            logger.info("Loading video preprocessing processor")

            # Load VideoMAE image processor
            self.video_processor = VideoMAEImageProcessor.from_pretrained(
                "MCG-NJU/videomae-base"
            )

            self.is_loaded = True
            logger.info("Video processor loaded successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to load video processor: {str(e)}")
            return False

    async def preprocess_video(
        self,
        video_data: Union[str, bytes],
        extract_frames: bool = True,
        normalize: bool = True
    ) -> dict[str, Any]:
        """Preprocess video data for bias detection"""
        if not self.is_loaded:
            await self.load_processor()

        try:
            # Load and validate video
            video_path = await self._save_video(video_data)

            # Extract frames if requested
            frames = []
            if extract_frames:
                frames = await self._extract_frames(video_path)

            # Prepare video for model input
            model_inputs = await self._prepare_model_inputs(frames)

            logger.info(
                "Video preprocessing completed",
                frames_extracted=len(frames),
                extract_frames=extract_frames
            )

            return {
                "video_path": video_path,
                "frames": frames,
                "model_inputs": model_inputs,
                "metadata": {
                    "frame_count": len(frames),
                    "normalized": normalize
                }
            }

        except Exception as e:
            logger.error(f"Video preprocessing failed: {str(e)}")
            raise

    async def _save_video(self, video_data: Union[str, bytes]) -> str:
        """Save video data to temporary file"""
        if isinstance(video_data, str):
            # Base64 encoded video
            if video_data.startswith("data:video"):
                # Remove data URL prefix
                video_data = video_data.split(",")[1]

            video_bytes = base64.b64decode(video_data)

        elif isinstance(video_data, bytes):
            # Direct video bytes
            video_bytes = video_data

        else:
            raise ValueError(f"Unsupported video data type: {type(video_data)}")

        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_file:
            tmp_file.write(video_bytes)
            tmp_path = tmp_file.name

        return tmp_path

    async def _extract_frames(self, video_path: str) -> list[Image.Image]:
        """Extract key frames from video"""
        try:
            import cv2

            cap = cv2.VideoCapture(video_path)
            frames = []
            frame_count = 0

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                # Extract frames at specified rate
                if frame_count % int(settings.frame_extraction_rate) == 0:
                    # Convert BGR to RGB
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    pil_image = Image.fromarray(frame_rgb)
                    frames.append(pil_image)

                frame_count += 1

            cap.release()

            # Clean up temp file
            Path(video_path).unlink()

            return frames

        except ImportError:
            logger.warning("OpenCV not available, returning empty frames")
            Path(video_path).unlink()
            return []
        except Exception as e:
            logger.warning(f"Frame extraction failed: {str(e)}")
            Path(video_path).unlink()
            return []

    async def _prepare_model_inputs(self, frames: list[Image.Image]) -> dict[str, Any]:
        """Prepare video frames for model input"""
        try:
            if not frames:
                return {}

            # Prepare for VideoMAE
            videomae_inputs = self.video_processor(
                images=frames,
                return_tensors="pt"
            )

            return {
                "videomae_inputs": videomae_inputs
            }

        except Exception as e:
            logger.warning(f"Model input preparation failed: {str(e)}")
            return {}


class MultimodalPreprocessingPipeline:
    """Unified preprocessing pipeline for multimodal data"""

    def __init__(self):
        self.audio_pipeline = AudioPreprocessingPipeline()
        self.vision_pipeline = VisionPreprocessingPipeline()
        self.video_pipeline = VideoPreprocessingPipeline()

    async def preprocess_multimodal_data(
        self,
        data: Dict[str, Any]
    ) -> dict[str, Any]:
        """Preprocess multimodal data (audio, vision, video)"""
        try:
            results = {}

            # Preprocess audio if present
            if "audio" in data:
                results["audio"] = await self.audio_pipeline.preprocess_audio(
                    data["audio"]
                )

            # Preprocess image if present
            if "image" in data:
                results["image"] = await self.vision_pipeline.preprocess_image(
                    data["image"]
                )

            # Preprocess video if present
            if "video" in data:
                results["video"] = await self.video_pipeline.preprocess_video(
                    data["video"]
                )

            # Combine metadata
            metadata = {
                "modalities_processed": list(results.keys()),
                "timestamp": asyncio.get_event_loop().time(),
                "preprocessing_complete": True
            }

            logger.info(
                "Multimodal preprocessing completed",
                modalities=list(results.keys())
            )

            return {
                "results": results,
                "metadata": metadata
            }

        except Exception as e:
            logger.error(f"Multimodal preprocessing failed: {str(e)}")
            raise


# Utility functions for data validation and error handling

def validate_audio_format(file_path: str) -> bool:
    """Validate audio file format"""
    try:
        audio_formats = settings.allowed_audio_formats
        file_extension = Path(file_path).suffix.lower()[1:]  # Remove the dot
        return file_extension in audio_formats
    except Exception:
        return False


def validate_image_format(file_path: str) -> bool:
    """Validate image file format"""
    try:
        image_formats = settings.allowed_image_formats
        file_extension = Path(file_path).suffix.lower()[1:]
        return file_extension in image_formats
    except Exception:
        return False


def validate_video_format(file_path: str) -> bool:
    """Validate video file format"""
    try:
        video_formats = settings.allowed_video_formats
        file_extension = Path(file_path).suffix.lower()[1:]
        return file_extension in video_formats
    except Exception:
        return False


def get_file_size(file_path: str) -> int:
    """Get file size in bytes"""
    try:
        return Path(file_path).stat().st_size
    except Exception:
        return 0


# Performance monitoring utilities

class PreprocessingMetrics:
    """Performance metrics for preprocessing operations"""

    def __init__(self):
        self.metrics = {}

    def record_timing(self, operation: str, duration: float):
        """Record timing for an operation"""
        if operation not in self.metrics:
            self.metrics[operation] = []
        self.metrics[operation].append(duration)

    def get_average_time(self, operation: str) -> float:
        """Get average time for an operation"""
        if operation in self.metrics and self.metrics[operation]:
            return sum(self.metrics[operation]) / len(self.metrics[operation])
        return 0.0

    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of all metrics"""
        summary = {}
        for operation, times in self.metrics.items():
            summary[operation] = {
                "average_time": sum(times) / len(times) if times else 0,
                "min_time": min(times) if times else 0,
                "max_time": max(times) if times else 0,
                "count": len(times)
            }
        return summary


# Example usage and testing

async def main():
    """Example usage of the preprocessing pipeline"""
    # Initialize pipelines (example usage - pipelines can be used here)
    # audio_pipeline = AudioPreprocessingPipeline()
    # vision_pipeline = VisionPreprocessingPipeline()
    # multimodal_pipeline = MultimodalPreprocessingPipeline()

    # Example audio preprocessing
    # audio_result = await audio_pipeline.preprocess_audio(audio_bytes)

    # Example image preprocessing
    # image_result = await vision_pipeline.preprocess_image(image_bytes)

    # Example multimodal preprocessing
    # multimodal_data = {
    #     "audio": audio_bytes,
    #     "image": image_bytes
    # }
    # multimodal_result = await multimodal_pipeline.preprocess_multimodal_data(multimodal_data)

    print("Preprocessing pipeline initialized successfully")


if __name__ == "__main__":
    asyncio.run(main())
