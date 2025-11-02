"""
Audio bias detection service using speech recognition and audio analysis
"""

import asyncio
import base64
import hashlib
import io
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import librosa
import numpy as np
import soundfile as sf
import structlog
import torch
import torch.nn.functional as F
from transformers import (
    WhisperProcessor, 
    WhisperForConditionalGeneration,
    Wav2Vec2Processor,
    Wav2Vec2ForSequenceClassification,
    pipeline
)
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings
from ..models import (
    BiasType,
    ConfidenceLevel,
    AudioSegment,
    AudioBiasScore
)

logger = structlog.get_logger(__name__)


class AudioBiasDetector:
    """Audio bias detection using speech recognition and audio analysis"""
    
    def __init__(self):
        self.speech_to_text_model = None
        self.speech_to_text_processor = None
        self.audio_classifier = None
        self.speaker_diarization = None
        self.emotion_classifier = None
        self.is_loaded = False
        self.load_time = 0.0
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
    async def load_models(self) -> bool:
        """Load audio models"""
        try:
            logger.info("Loading audio bias detection models")
            start_time = time.time()
            
            # Load Whisper model for speech-to-text
            self.speech_to_text_processor = WhisperProcessor.from_pretrained("openai/whisper-base")
            self.speech_to_text_model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-base")
            self.speech_to_text_model.to(self.device)
            
            # Load Wav2Vec2 for audio classification
            self.audio_classifier_processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base")
            self.audio_classifier = Wav2Vec2ForSequenceClassification.from_pretrained("facebook/wav2vec2-base")
            self.audio_classifier.to(self.device)
            
            # Load speaker diarization pipeline
            self.speaker_diarization = pipeline(
                "speaker-diarization",
                model="pyannote/speaker-diarization",
                device=0 if torch.cuda.is_available() else -1
            )
            
            # Load emotion classification pipeline
            self.emotion_classifier = pipeline(
                "audio-classification",
                model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
                device=0 if torch.cuda.is_available() else -1
            )
            
            self.is_loaded = True
            self.load_time = time.time() - start_time
            
            logger.info(
                f"Audio models loaded successfully in {self.load_time:.2f}s",
                device=str(self.device)
            )
            return True
            
        except Exception as e:
            logger.error(
                f"Failed to load audio models: {str(e)}",
                error=str(e)
            )
            return False
    
    async def analyze_audio(
        self,
        audio_data: Union[str, bytes],
        analysis_type: str = "comprehensive",
        language: str = "auto",
        bias_types: Optional[List[BiasType]] = None,
        sensitivity: str = "medium"
    ) -> Dict[str, Any]:
        """Analyze audio for bias"""
        if not self.is_loaded:
            await self.load_models()
        
        try:
            start_time = time.time()
            
            # Load and preprocess audio
            audio_array, sample_rate = await self._load_audio(audio_data)
            
            # Validate audio duration
            duration = len(audio_array) / sample_rate
            if duration > settings.max_audio_duration:
                raise ValueError(f"Audio duration {duration}s exceeds maximum {settings.max_audio_duration}s")
            
            # Perform different types of analysis
            results = {}
            
            if analysis_type in ["speech", "comprehensive"]:
                results["speech_analysis"] = await self._analyze_speech(
                    audio_array, sample_rate, language
                )
            
            if analysis_type in ["music", "comprehensive"]:
                results["music_analysis"] = await self._analyze_music(
                    audio_array, sample_rate
                )
            
            # Speaker diarization
            results["speaker_analysis"] = await self._analyze_speakers(
                audio_array, sample_rate
            )
            
            # Emotion analysis
            results["emotion_analysis"] = await self._analyze_emotions(
                audio_array, sample_rate
            )
            
            # Generate bias scores
            bias_scores = await self._generate_bias_scores(
                results, bias_types, sensitivity
            )
            
            processing_time = int((time.time() - start_time) * 1000)
            
            logger.info(
                "Audio analysis completed",
                processing_time_ms=processing_time,
                bias_scores_count=len(bias_scores),
                analysis_type=analysis_type,
                duration=duration
            )
            
            return {
                "bias_scores": bias_scores,
                "transcript": results.get("speech_analysis", {}).get("transcript", ""),
                "segments": results.get("speech_analysis", {}).get("segments", []),
                "speakers": results.get("speaker_analysis", {}).get("speakers", []),
                "emotions": results.get("emotion_analysis", {}).get("emotions", []),
                "music_analysis": results.get("music_analysis", {}),
                "processing_time_ms": processing_time,
                "audio_metadata": {
                    "duration": duration,
                    "sample_rate": sample_rate,
                    "channels": 1 if len(audio_array.shape) == 1 else audio_array.shape[1]
                }
            }
            
        except Exception as e:
            logger.error(
                f"Audio analysis failed: {str(e)}",
                error=str(e)
            )
            raise
    
    async def _load_audio(self, audio_data: Union[str, bytes]) -> tuple:
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
    
    async def _analyze_speech(
        self,
        audio_array: np.ndarray,
        sample_rate: int,
        language: str
    ) -> Dict[str, Any]:
        """Analyze speech content for bias"""
        try:
            # Prepare audio for Whisper
            inputs = self.speech_to_text_processor(
                audio_array,
                sampling_rate=sample_rate,
                return_tensors="pt"
            ).to(self.device)
            
            # Generate transcript
            with torch.no_grad():
                generated_ids = self.speech_to_text_model.generate(inputs["input_features"])
            
            transcript = self.speech_to_text_processor.batch_decode(
                generated_ids,
                skip_special_tokens=True
            )[0]
            
            # Perform speaker diarization
            speaker_segments = await self._perform_speaker_diarization(audio_array, sample_rate)
            
            # Analyze transcript for bias
            bias_indicators = await self._analyze_transcript(transcript, speaker_segments)
            
            return {
                "transcript": transcript,
                "segments": speaker_segments,
                "bias_indicators": bias_indicators,
                "language_detected": language if language != "auto" else self._detect_language(transcript)
            }
            
        except Exception as e:
            logger.warning(f"Speech analysis failed: {str(e)}", error=str(e))
            return {
                "transcript": "",
                "segments": [],
                "bias_indicators": [],
                "language_detected": "unknown"
            }
    
    async def _perform_speaker_diarization(
        self,
        audio_array: np.ndarray,
        sample_rate: int
    ) -> List[AudioSegment]:
        """Perform speaker diarization on audio"""
        try:
            # Save audio to temporary file for diarization
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                sf.write(tmp_file.name, audio_array, sample_rate)
                tmp_path = tmp_file.name
            
            # Perform diarization
            diarization = self.speaker_diarization(tmp_path)
            
            segments = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                segment = AudioSegment(
                    start_time=turn.start,
                    end_time=turn.end,
                    transcript="",  # Will be filled later
                    confidence=0.8,  # Placeholder
                    speaker_id=speaker
                )
                segments.append(segment)
            
            # Clean up temp file
            Path(tmp_path).unlink()
            
            return segments
            
        except Exception as e:
            logger.warning(f"Speaker diarization failed: {str(e)}", error=str(e))
            return []
    
    async def _analyze_transcript(
        self,
        transcript: str,
        segments: List[AudioSegment]
    ) -> List[str]:
        """Analyze transcript for bias indicators"""
        bias_indicators = []
        
        # Check for gender bias in language
        gender_keywords = {
            "he", "she", "man", "woman", "male", "female", "gentleman", "lady",
            "guys", "gals", "dude", "chick", "handsome", "beautiful", "pretty"
        }
        
        words = transcript.lower().split()
        for word in words:
            if word in gender_keywords:
                bias_indicators.append(f"Gendered language: '{word}'")
        
        # Check for professional stereotypes
        professional_stereotypes = {
            "nurse": "female_stereotype",
            "doctor": "male_stereotype",
            "secretary": "female_stereotype",
            "engineer": "male_stereotype",
            "teacher": "female_stereotype",
            "ceo": "male_stereotype",
            "cleaner": "female_stereotype",
            "programmer": "male_stereotype"
        }
        
        for word in words:
            if word in professional_stereotypes:
                bias_indicators.append(f"Professional stereotype: '{word}' ({professional_stereotypes[word]})")
        
        # Check for age-related bias
        age_keywords = ["young", "old", "elderly", "youth", "senior", "junior", "millennial", "boomer"]
        for word in words:
            if word in age_keywords:
                bias_indicators.append(f"Age-related language: '{word}'")
        
        return bias_indicators
    
    async def _analyze_music(
        self,
        audio_array: np.ndarray,
        sample_rate: int
    ) -> Dict[str, Any]:
        """Analyze music/audio characteristics for bias"""
        try:
            # Extract audio features
            features = {
                "tempo": librosa.beat.tempo(y=audio_array, sr=sample_rate)[0],
                "energy": np.mean(librosa.feature.rms(y=audio_array)),
                "spectral_centroid": np.mean(librosa.feature.spectral_centroid(y=audio_array, sr=sample_rate)),
                "zero_crossing_rate": np.mean(librosa.feature.zero_crossing_rate(y=audio_array)),
                "mfcc": np.mean(librosa.feature.mfcc(y=audio_array, sr=sample_rate), axis=1)
            }
            
            # Classify music genre/style
            genre_predictions = self._classify_music_genre(features)
            
            # Check for cultural bias in music
            bias_indicators = []
            for genre, confidence in genre_predictions:
                if confidence > 0.7:
                    # Check for cultural stereotypes in music genres
                    if genre in ["classical", "jazz", "opera"]:
                        bias_indicators.append(f"Cultural bias: Western classical music ({genre})")
                    elif genre in ["reggae", "salsa", "afrobeat"]:
                        bias_indicators.append(f"Cultural bias: Specific ethnic music ({genre})")
            
            return {
                "features": features,
                "genre_predictions": genre_predictions,
                "bias_indicators": bias_indicators
            }
            
        except Exception as e:
            logger.warning(f"Music analysis failed: {str(e)}", error=str(e))
            return {
                "features": {},
                "genre_predictions": [],
                "bias_indicators": []
            }
    
    def _classify_music_genre(self, features: Dict[str, Any]) -> List[Tuple[str, float]]:
        """Classify music genre based on features"""
        # Simplified genre classification
        # In production, this would use a trained classifier
        
        genres = [
            ("classical", 0.3),
            ("jazz", 0.2),
            ("pop", 0.2),
            ("rock", 0.1),
            ("electronic", 0.1),
            ("world", 0.1)
        ]
        
        return genres
    
    async def _analyze_speakers(
        self,
        audio_array: np.ndarray,
        sample_rate: int
    ) -> Dict[str, Any]:
        """Analyze speaker characteristics"""
        try:
            # Save audio to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                sf.write(tmp_file.name, audio_array, sample_rate)
                tmp_path = tmp_file.name
            
            # Perform speaker analysis
            speakers = []
            
            # Extract speaker characteristics
            # This is a simplified implementation
            num_speakers = min(3, len(audio_array) // (sample_rate * 10))  # Estimate
            
            for i in range(num_speakers):
                speaker = {
                    "speaker_id": f"speaker_{i}",
                    "start_time": i * 10,
                    "end_time": (i + 1) * 10,
                    "characteristics": {
                        "pitch": np.random.normal(200, 50),  # Placeholder
                        "speaking_rate": np.random.normal(150, 30),  # Placeholder
                        "energy": np.random.normal(0.5, 0.2)  # Placeholder
                    }
                }
                speakers.append(speaker)
            
            # Clean up temp file
            Path(tmp_path).unlink()
            
            return {
                "speakers": speakers,
                "total_speakers": len(speakers),
                "speaker_diversity_score": self._calculate_speaker_diversity(speakers)
            }
            
        except Exception as e:
            logger.warning(f"Speaker analysis failed: {str(e)}", error=str(e))
            return {
                "speakers": [],
                "total_speakers": 0,
                "speaker_diversity_score": 0.0
            }
    
    def _calculate_speaker_diversity(self, speakers: List[Dict[str, Any]]) -> float:
        """Calculate speaker diversity score"""
        if not speakers:
            return 0.0
        
        # Simple diversity calculation based on characteristics
        diversity_score = 0.0
        
        # Check for gender diversity (simplified)
        # In production, this would use actual voice analysis
        if len(speakers) > 1:
            diversity_score += 0.3
        
        # Check for speaking rate diversity
        speaking_rates = [s["characteristics"]["speaking_rate"] for s in speakers]
        if len(set([round(rate, -1) for rate in speaking_rates])) > 1:
            diversity_score += 0.3
        
        # Check for energy diversity
        energies = [s["characteristics"]["energy"] for s in speakers]
        if max(energies) - min(energies) > 0.2:
            diversity_score += 0.4
        
        return min(diversity_score, 1.0)
    
    async def _analyze_emotions(
        self,
        audio_array: np.ndarray,
        sample_rate: int
    ) -> Dict[str, Any]:
        """Analyze emotions in audio"""
        try:
            # Segment audio for emotion analysis
            segment_duration = 3  # seconds
            segment_length = int(segment_duration * sample_rate)
            
            emotions = []
            num_segments = len(audio_array) // segment_length
            
            for i in range(num_segments):
                start_idx = i * segment_length
                end_idx = min((i + 1) * segment_length, len(audio_array))
                segment = audio_array[start_idx:end_idx]
                
                # Classify emotion for this segment
                emotion_result = self.emotion_classifier(segment)
                
                dominant_emotion = max(emotion_result, key=lambda x: x["score"])
                
                emotion_data = {
                    "start_time": i * segment_duration,
                    "end_time": (i + 1) * segment_duration,
                    "emotion": dominant_emotion["label"],
                    "confidence": dominant_emotion["score"]
                }
                emotions.append(emotion_data)
            
            # Calculate emotion statistics
            emotion_counts = {}
            for emotion in emotions:
                emotion_label = emotion["emotion"]
                emotion_counts[emotion_label] = emotion_counts.get(emotion_label, 0) + 1
            
            dominant_emotion = max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else "neutral"
            
            return {
                "emotions": emotions,
                "emotion_counts": emotion_counts,
                "dominant_emotion": dominant_emotion,
                "total_segments": len(emotions)
            }
            
        except Exception as e:
            logger.warning(f"Emotion analysis failed: {str(e)}", error=str(e))
            return {
                "emotions": [],
                "emotion_counts": {},
                "dominant_emotion": "neutral",
                "total_segments": 0
            }
    
    def _detect_language(self, transcript: str) -> str:
        """Detect language from transcript"""
        # Simplified language detection
        # In production, use proper language detection library
        
        # Check for common language indicators
        if any(word in transcript.lower() for word in ["the", "and", "is", "are"]):
            return "en"
        elif any(word in transcript.lower() for word in ["el", "la", "es", "son"]):
            return "es"
        elif any(word in transcript.lower() for word in ["le", "la", "est", "sont"]):
            return "fr"
        elif any(word in transcript.lower() for word in ["der", "die", "das", "ist"]):
            return "de"
        else:
            return "unknown"
    
    async def _generate_bias_scores(
        self,
        analysis_results: Dict[str, Any],
        bias_types: Optional[List[BiasType]],
        sensitivity: str
    ) -> List[AudioBiasScore]:
        """Generate bias scores from audio analysis results"""
        bias_scores = []
        
        # Process speech analysis results
        if "speech_analysis" in analysis_results:
            transcript = analysis_results["speech_analysis"].get("transcript", "")
            bias_indicators = analysis_results["speech_analysis"].get("bias_indicators", [])
            segments = analysis_results["speech_analysis"].get("segments", [])
            
            for bias_indicator in bias_indicators:
                # Map bias indicator to bias type
                bias_type = self._map_text_bias(bias_indicator)
                if bias_types and bias_type not in bias_types:
                    continue
                
                confidence = self._calculate_confidence(bias_indicator, sensitivity)
                confidence_level = self._get_confidence_level(confidence)
                
                bias_score = AudioBiasScore(
                    bias_type=bias_type,
                    score=confidence,
                    confidence=confidence,
                    confidence_level=confidence_level,
                    evidence=[bias_indicator],
                    explanation=f"Detected {bias_type.value} bias in speech content",
                    segments_involved=segments,
                    keywords_detected=self._extract_keywords(bias_indicator)
                )
                bias_scores.append(bias_score)
        
        # Process speaker analysis results
        if "speaker_analysis" in analysis_results:
            speakers = analysis_results["speaker_analysis"].get("speakers", [])
            diversity_score = analysis_results["speaker_analysis"].get("speaker_diversity_score", 0.0)
            
            if diversity_score < 0.5 and len(speakers) > 1:
                bias_type = BiasType.GENDER_STEREOTYPES  # Simplified mapping
                
                if bias_types and bias_type not in bias_types:
                    continue
                
                confidence = 0.7  # Medium confidence for speaker diversity
                confidence_level = self._get_confidence_level(confidence)
                
                bias_score = AudioBiasScore(
                    bias_type=bias_type,
                    score=confidence,
                    confidence=confidence,
                    confidence_level=confidence_level,
                    evidence=["Low speaker diversity detected"],
                    explanation="Limited speaker diversity may indicate bias in representation",
                    segments_involved=[],
                    keywords_detected=[]
                )
                bias_scores.append(bias_score)
        
        # Process emotion analysis results
        if "emotion_analysis" in analysis_results:
            emotions = analysis_results["emotion_analysis"].get("emotions", [])
            dominant_emotion = analysis_results["emotion_analysis"].get("dominant_emotion", "neutral")
            
            # Check for emotion bias
            if dominant_emotion in ["angry", "sad", "fearful"]:
                bias_type = BiasType.EMOTIONAL_MANIPULATION  # Custom bias type
                
                if bias_types and bias_type not in bias_types:
                    continue
                
                confidence = 0.6
                confidence_level = self._get_confidence_level(confidence)
                
                bias_score = AudioBiasScore(
                    bias_type=bias_type,
                    score=confidence,
                    confidence=confidence,
                    confidence_level=confidence_level,
                    evidence=[f"Dominant negative emotion: {dominant_emotion}"],
                    explanation="Predominantly negative emotions may indicate emotional manipulation",
                    segments_involved=emotions,
                    keywords_detected=[]
                )
                bias_scores.append(bias_score)
        
        return bias_scores
    
    def _map_text_bias(self, text: str) -> BiasType:
        """Map text bias to bias type"""
        text_lower = text.lower()
        
        if "gender" in text_lower or "male" in text_lower or "female" in text_lower:
            return BiasType.GENDER_STEREOTYPES
        elif "age" in text_lower or "young" in text_lower or "old" in text_lower:
            return BiasType.AGE_DISCRIMINATION
        elif "professional" in text_lower or "stereotype" in text_lower:
            return BiasType.PROFESSIONAL_STEREOTYPES
        elif "cultural" in text_lower or "ethnic" in text_lower:
            return BiasType.CULTURAL_STEREOTYPES
        else:
            return BiasType.LANGUAGE_BIAS
    
    def _calculate_confidence(self, evidence: str, sensitivity: str) -> float:
        """Calculate confidence score based on evidence and sensitivity"""
        base_confidence = 0.6
        
        # Adjust based on sensitivity
        sensitivity_multiplier = {
            "low": 0.7,
            "medium": 0.8,
            "high": 0.9
        }
        
        confidence = base_confidence * sensitivity_multiplier.get(sensitivity, 0.8)
        
        # Adjust based on evidence strength
        if "strong" in evidence.lower() or "clear" in evidence.lower():
            confidence += 0.1
        elif "weak" in evidence.lower() or "unclear" in evidence.lower():
            confidence -= 0.1
        
        return min(max(confidence, 0.1), 0.95)
    
    def _get_confidence_level(self, confidence: float) -> ConfidenceLevel:
        """Convert confidence score to confidence level"""
        if confidence >= 0.8:
            return ConfidenceLevel.VERY_HIGH
        elif confidence >= 0.6:
            return ConfidenceLevel.HIGH
        elif confidence >= 0.4:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract keywords from text"""
        # Simple keyword extraction
        # In production, use proper NLP techniques
        
        words = text.lower().split()
        keywords = []
        
        # Extract meaningful words (length > 3)
        for word in words:
            if len(word) > 3 and word.isalpha():
                keywords.append(word)
        
        return keywords[:10]  # Limit to top 10 keywords
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get audio model information"""
        return {
            "name": "audio_bias_detector",
            "framework": "transformers",
            "models": {
                "speech_to_text": "openai/whisper-base",
                "audio_classification": "facebook/wav2vec2-base",
                "speaker_diarization": "pyannote/speaker-diarization",
                "emotion_classification": "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
            },
            "loaded": self.is_loaded,
            "load_time_ms": int(self.load_time * 1000),
            "device": str(self.device),
            "max_audio_duration": settings.max_audio_duration,
            "sample_rate": settings.sample_rate,
            "supported_formats": settings.allowed_audio_formats
        }