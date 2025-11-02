"""
Vision bias detection service using CLIP and computer vision models
"""

import asyncio
import base64
import hashlib
import io
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import cv2
import numpy as np
import structlog
import torch
import torch.nn.functional as F
from PIL import Image
from transformers import CLIPProcessor, CLIPModel, pipeline
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings
from ..models import (
    BiasType,
    ConfidenceLevel,
    DetectedObject,
    FaceDetection,
    VisualBiasScore,
    TextExtraction
)

logger = structlog.get_logger(__name__)


class VisionBiasDetector:
    """Vision bias detection using CLIP and computer vision models"""
    
    def __init__(self):
        self.clip_model = None
        self.clip_processor = None
        self.face_detector = None
        self.object_detector = None
        self.ocr_pipeline = None
        self.is_loaded = False
        self.load_time = 0.0
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
    async def load_models(self) -> bool:
        """Load vision models"""
        try:
            logger.info("Loading vision bias detection models")
            start_time = time.time()
            
            # Load CLIP model for semantic understanding
            self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            self.clip_model.to(self.device)
            
            # Load face detection model
            self.face_detector = pipeline(
                "face-detection",
                model="facebook/detr-resnet-50",
                device=0 if torch.cuda.is_available() else -1
            )
            
            # Load object detection model
            self.object_detector = pipeline(
                "object-detection",
                model="facebook/detr-resnet-50",
                device=0 if torch.cuda.is_available() else -1
            )
            
            # Load OCR pipeline
            self.ocr_pipeline = pipeline(
                "ocr",
                model="kha-white/manga-ocr-base",
                device=0 if torch.cuda.is_available() else -1
            )
            
            self.is_loaded = True
            self.load_time = time.time() - start_time
            
            logger.info(
                f"Vision models loaded successfully in {self.load_time:.2f}s",
                device=str(self.device)
            )
            return True
            
        except Exception as e:
            logger.error(
                f"Failed to load vision models: {str(e)}",
                error=str(e)
            )
            return False
    
    async def analyze_image(
        self,
        image_data: Union[str, bytes, Image.Image],
        analysis_type: str = "comprehensive",
        bias_types: Optional[List[BiasType]] = None,
        sensitivity: str = "medium"
    ) -> Dict[str, Any]:
        """Analyze image for bias"""
        if not self.is_loaded:
            await self.load_models()
        
        try:
            start_time = time.time()
            
            # Load and preprocess image
            image = await self._load_image(image_data)
            
            # Perform different types of analysis
            results = {}
            
            if analysis_type in ["faces", "comprehensive"]:
                results["face_analysis"] = await self._analyze_faces(image)
            
            if analysis_type in ["objects", "comprehensive"]:
                results["object_analysis"] = await self._analyze_objects(image)
            
            if analysis_type in ["text", "comprehensive"]:
                results["text_analysis"] = await self._analyze_text(image)
            
            # CLIP-based semantic analysis
            results["semantic_analysis"] = await self._analyze_semantics(image)
            
            # Generate bias scores
            bias_scores = await self._generate_bias_scores(
                results, bias_types, sensitivity
            )
            
            processing_time = int((time.time() - start_time) * 1000)
            
            logger.info(
                "Image analysis completed",
                processing_time_ms=processing_time,
                bias_scores_count=len(bias_scores),
                analysis_type=analysis_type
            )
            
            return {
                "bias_scores": bias_scores,
                "detected_faces": results.get("face_analysis", {}).get("faces", []),
                "detected_objects": results.get("object_analysis", {}).get("objects", []),
                "extracted_text": results.get("text_analysis", {}).get("texts", []),
                "semantic_insights": results.get("semantic_analysis", {}),
                "processing_time_ms": processing_time,
                "image_metadata": {
                    "width": image.width,
                    "height": image.height,
                    "format": image.format,
                    "mode": image.mode
                }
            }
            
        except Exception as e:
            logger.error(
                f"Image analysis failed: {str(e)}",
                error=str(e)
            )
            raise
    
    async def _load_image(self, image_data: Union[str, bytes, Image.Image]) -> Image.Image:
        """Load image from various input formats"""
        if isinstance(image_data, Image.Image):
            return image_data
        
        if isinstance(image_data, str):
            # Base64 encoded image
            if image_data.startswith("data:image"):
                # Remove data URL prefix
                image_data = image_data.split(",")[1]
            
            image_bytes = base64.b64decode(image_data)
            return Image.open(io.BytesIO(image_bytes))
        
        elif isinstance(image_data, bytes):
            return Image.open(io.BytesIO(image_data))
        
        else:
            raise ValueError(f"Unsupported image data type: {type(image_data)}")
    
    async def _analyze_faces(self, image: Image.Image) -> Dict[str, Any]:
        """Analyze faces in the image for bias"""
        try:
            # Convert PIL image to numpy array for face detection
            image_array = np.array(image)
            
            # Detect faces
            faces = self.face_detector(image_array)
            
            face_detections = []
            bias_indicators = []
            
            for i, face in enumerate(faces):
                face_detection = FaceDetection(
                    face_id=f"face_{i}",
                    bbox=face.get("box", [0, 0, 0, 0]),
                    confidence=face.get("score", 0.0),
                    landmarks=face.get("landmarks", []),
                    demographics=self._extract_demographics(face),
                    emotions=self._extract_emotions(face)
                )
                face_detections.append(face_detection)
                
                # Check for bias indicators
                bias_indicators.extend(self._check_face_bias(face_detection))
            
            return {
                "faces": face_detections,
                "bias_indicators": bias_indicators,
                "total_faces": len(face_detections)
            }
            
        except Exception as e:
            logger.warning(f"Face analysis failed: {str(e)}", error=str(e))
            return {"faces": [], "bias_indicators": [], "total_faces": 0}
    
    async def _analyze_objects(self, image: Image.Image) -> Dict[str, Any]:
        """Analyze objects in the image for bias"""
        try:
            # Convert PIL image to numpy array
            image_array = np.array(image)
            
            # Detect objects
            objects = self.object_detector(image_array)
            
            detected_objects = []
            bias_indicators = []
            
            for obj in objects:
                detected_obj = DetectedObject(
                    object_class=obj.get("label", "unknown"),
                    confidence=obj.get("score", 0.0),
                    bbox=obj.get("box", [0, 0, 0, 0]),
                    attributes=self._extract_object_attributes(obj)
                )
                detected_objects.append(detected_obj)
                
                # Check for bias in object representation
                bias_indicators.extend(self._check_object_bias(detected_obj))
            
            return {
                "objects": detected_objects,
                "bias_indicators": bias_indicators,
                "total_objects": len(detected_objects)
            }
            
        except Exception as e:
            logger.warning(f"Object analysis failed: {str(e)}", error=str(e))
            return {"objects": [], "bias_indicators": [], "total_objects": 0}
    
    async def _analyze_text(self, image: Image.Image) -> Dict[str, Any]:
        """Extract and analyze text from image"""
        try:
            # Perform OCR
            ocr_results = self.ocr_pipeline(image)
            
            extracted_texts = []
            for result in ocr_results:
                text_extraction = TextExtraction(
                    text=result.get("text", ""),
                    bbox=result.get("box", [0, 0, 0, 0]),
                    confidence=result.get("score", 0.0),
                    language=result.get("language", "unknown")
                )
                extracted_texts.append(text_extraction)
            
            return {
                "texts": extracted_texts,
                "full_text": " ".join([t.text for t in extracted_texts]),
                "total_texts": len(extracted_texts)
            }
            
        except Exception as e:
            logger.warning(f"Text analysis failed: {str(e)}", error=str(e))
            return {"texts": [], "full_text": "", "total_texts": 0}
    
    async def _analyze_semantics(self, image: Image.Image) -> Dict[str, Any]:
        """Analyze image semantics using CLIP"""
        try:
            # Prepare text prompts for CLIP analysis
            bias_prompts = [
                "This image contains gender stereotypes",
                "This image shows racial bias",
                "This image has age discrimination",
                "This image contains ableism",
                "This image shows body image bias",
                "This image is neutral and unbiased",
                "This image promotes diversity and inclusion",
                "This image contains harmful stereotypes",
                "This image is respectful and inclusive",
                "This image shows socioeconomic bias"
            ]
            
            # Process image and text prompts
            inputs = self.clip_processor(
                text=bias_prompts,
                images=image,
                return_tensors="pt",
                padding=True
            ).to(self.device)
            
            # Get CLIP predictions
            with torch.no_grad():
                outputs = self.clip_model(**inputs)
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=-1)
            
            # Extract semantic insights
            semantic_scores = {}
            for i, prompt in enumerate(bias_prompts):
                semantic_scores[prompt] = float(probs[0][i])
            
            # Identify top semantic matches
            top_matches = sorted(
                semantic_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]
            
            return {
                "semantic_scores": semantic_scores,
                "top_matches": top_matches,
                "overall_sentiment": self._calculate_overall_sentiment(semantic_scores)
            }
            
        except Exception as e:
            logger.warning(f"Semantic analysis failed: {str(e)}", error=str(e))
            return {
                "semantic_scores": {},
                "top_matches": [],
                "overall_sentiment": "neutral"
            }
    
    def _extract_demographics(self, face_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract demographic information from face data"""
        demographics = {}
        
        # Extract age, gender, race if available
        if "age" in face_data:
            demographics["age"] = face_data["age"]
        if "gender" in face_data:
            demographics["gender"] = face_data["gender"]
        if "race" in face_data:
            demographics["race"] = face_data["race"]
        
        return demographics
    
    def _extract_emotions(self, face_data: Dict[str, Any]) -> Dict[str, float]:
        """Extract emotion information from face data"""
        emotions = {}
        
        # Extract emotion probabilities if available
        if "emotions" in face_data:
            for emotion, probability in face_data["emotions"].items():
                emotions[emotion] = float(probability)
        
        return emotions
    
    def _extract_object_attributes(self, obj_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract object attributes"""
        attributes = {}
        
        # Extract additional object attributes
        if "attributes" in obj_data:
            attributes.update(obj_data["attributes"])
        
        return attributes
    
    def _check_face_bias(self, face_detection: FaceDetection) -> List[str]:
        """Check for bias in face detection"""
        bias_indicators = []
        
        # Check for gender representation bias
        if "gender" in face_detection.demographics:
            gender = face_detection.demographics["gender"]
            if gender in ["male", "female"]:
                bias_indicators.append(f"Gender representation: {gender}")
        
        # Check for age bias
        if "age" in face_detection.demographics:
            age = face_detection.demographics["age"]
            if age < 18 or age > 65:
                bias_indicators.append(f"Age representation: {age}")
        
        # Check for emotion bias
        dominant_emotion = max(face_detection.emotions.items(), key=lambda x: x[1])[0] if face_detection.emotions else None
        if dominant_emotion in ["angry", "sad", "fearful"]:
            bias_indicators.append(f"Negative emotion: {dominant_emotion}")
        
        return bias_indicators
    
    def _check_object_bias(self, detected_obj: DetectedObject) -> List[str]:
        """Check for bias in object detection"""
        bias_indicators = []
        
        # Check for stereotypical object associations
        object_class = detected_obj.object_class.lower()
        
        # Gender-stereotypical objects
        if object_class in ["makeup", "jewelry", "dress", "skirt"]:
            bias_indicators.append("Gender-stereotypical object: feminine items")
        elif object_class in ["tools", "machinery", "sports_equipment"]:
            bias_indicators.append("Gender-stereotypical object: masculine items")
        
        # Socioeconomic bias
        if object_class in ["luxury_car", "yacht", "mansion"]:
            bias_indicators.append("Socioeconomic bias: luxury items")
        elif object_class in ["run_down_building", "old_car", "trash"]:
            bias_indicators.append("Socioeconomic bias: poverty indicators")
        
        return bias_indicators
    
    async def _generate_bias_scores(
        self,
        analysis_results: Dict[str, Any],
        bias_types: Optional[List[BiasType]],
        sensitivity: str
    ) -> List[VisualBiasScore]:
        """Generate bias scores from analysis results"""
        bias_scores = []
        
        # Define bias type mapping
        bias_mappings = {
            "gender_representation": BiasType.GENDER_STEREOTYPES,
            "racial_bias": BiasType.RACIAL_BIAS,
            "age_discrimination": BiasType.AGE_DISCRIMINATION,
            "ableism": BiasType.ABLEISM,
            "body_image": BiasType.BODY_IMAGE,
            "socioeconomic": BiasType.SOCIOECONOMIC,
            "cultural_stereotypes": BiasType.CULTURAL_STEREOTYPES,
            "professional_stereotypes": BiasType.PROFESSIONAL_STEREOTYPES
        }
        
        # Process face analysis results
        if "face_analysis" in analysis_results:
            faces = analysis_results["face_analysis"].get("faces", [])
            bias_indicators = analysis_results["face_analysis"].get("bias_indicators", [])
            
            for bias_indicator in bias_indicators:
                # Map bias indicator to bias type
                for keyword, bias_type in bias_mappings.items():
                    if keyword in bias_indicator.lower():
                        if bias_types and bias_type not in bias_types:
                            continue
                        
                        confidence = self._calculate_confidence(bias_indicator, sensitivity)
                        confidence_level = self._get_confidence_level(confidence)
                        
                        bias_score = VisualBiasScore(
                            bias_type=bias_type,
                            score=confidence,
                            confidence=confidence,
                            confidence_level=confidence_level,
                            evidence=[bias_indicator],
                            explanation=f"Detected {bias_type.value} bias in facial representation",
                            affected_regions=[],  # Would be populated with actual regions
                            objects_involved=[]
                        )
                        bias_scores.append(bias_score)
        
        # Process object analysis results
        if "object_analysis" in analysis_results:
            objects = analysis_results["object_analysis"].get("objects", [])
            bias_indicators = analysis_results["object_analysis"].get("bias_indicators", [])
            
            for bias_indicator in bias_indicators:
                for keyword, bias_type in bias_mappings.items():
                    if keyword in bias_indicator.lower():
                        if bias_types and bias_type not in bias_types:
                            continue
                        
                        confidence = self._calculate_confidence(bias_indicator, sensitivity)
                        confidence_level = self._get_confidence_level(confidence)
                        
                        bias_score = VisualBiasScore(
                            bias_type=bias_type,
                            score=confidence,
                            confidence=confidence,
                            confidence_level=confidence_level,
                            evidence=[bias_indicator],
                            explanation=f"Detected {bias_type.value} bias in object representation",
                            affected_regions=[],
                            objects_involved=objects
                        )
                        bias_scores.append(bias_score)
        
        # Process semantic analysis results
        if "semantic_analysis" in analysis_results:
            semantic_scores = analysis_results["semantic_analysis"].get("semantic_scores", {})
            top_matches = analysis_results["semantic_analysis"].get("top_matches", [])
            
            for prompt, score in top_matches:
                if score > 0.5:  # Threshold for semantic bias
                    for keyword, bias_type in bias_mappings.items():
                        if keyword in prompt.lower():
                            if bias_types and bias_type not in bias_types:
                                continue
                            
                            confidence = min(score, 0.9)  # Cap confidence
                            confidence_level = self._get_confidence_level(confidence)
                            
                            bias_score = VisualBiasScore(
                                bias_type=bias_type,
                                score=confidence,
                                confidence=confidence,
                                confidence_level=confidence_level,
                                evidence=[f"Semantic analysis: {prompt}"],
                                explanation=f"CLIP semantic analysis detected {bias_type.value} bias",
                                affected_regions=[],
                                objects_involved=[]
                            )
                            bias_scores.append(bias_score)
        
        return bias_scores
    
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
    
    def _calculate_overall_sentiment(self, semantic_scores: Dict[str, float]) -> str:
        """Calculate overall sentiment from semantic scores"""
        positive_scores = []
        negative_scores = []
        
        for prompt, score in semantic_scores.items():
            if any(pos_word in prompt.lower() for pos_word in ["neutral", "unbiased", "inclusive", "respectful"]):
                positive_scores.append(score)
            elif any(neg_word in prompt.lower() for neg_word in ["bias", "stereotypes", "harmful"]):
                negative_scores.append(score)
        
        if not positive_scores and not negative_scores:
            return "neutral"
        
        avg_positive = sum(positive_scores) / len(positive_scores) if positive_scores else 0
        avg_negative = sum(negative_scores) / len(negative_scores) if negative_scores else 0
        
        if avg_positive > avg_negative:
            return "positive"
        elif avg_negative > avg_positive:
            return "negative"
        else:
            return "neutral"
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get vision model information"""
        return {
            "name": "vision_bias_detector",
            "framework": "transformers",
            "models": {
                "clip": "openai/clip-vit-base-patch32",
                "face_detection": "facebook/detr-resnet-50",
                "object_detection": "facebook/detr-resnet-50",
                "ocr": "kha-white/manga-ocr-base"
            },
            "loaded": self.is_loaded,
            "load_time_ms": int(self.load_time * 1000),
            "device": str(self.device),
            "max_image_dimensions": settings.max_image_dimensions,
            "supported_formats": settings.allowed_image_formats
        }