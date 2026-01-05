"""
Vision bias detection service using CLIP and computer vision models
"""

import base64
import io
import time
from typing import Any, Optional, Union

import numpy as np
import structlog
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel, pipeline
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
        bias_types: Optional[list[BiasType]] = None,
        sensitivity: str = "medium"
    ) -> dict[str, Any]:
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

    async def _analyze_faces(self, image: Image.Image) -> dict[str, Any]:
        """Analyze faces in the image for bias"""
        if self.face_detector is None:
            raise RuntimeError("Face detector model not loaded. Call load_models() first.")

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

    async def _analyze_objects(self, image: Image.Image) -> dict[str, Any]:
        """Analyze objects in the image for bias"""
        if self.object_detector is None:
            raise RuntimeError("Object detector model not loaded. Call load_models() first.")

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
        if self.ocr_pipeline is None:
            raise RuntimeError("OCR pipeline not loaded. Call load_models() first.")

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
        if self.clip_processor is None or self.clip_model is None:
            raise RuntimeError("CLIP model not loaded. Call load_models() first.")

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

    def _get_bias_type_mappings(self) -> Dict[str, BiasType]:
        """Get bias type keyword mappings"""
        return {
            "gender_representation": BiasType.GENDER_STEREOTYPES,
            "racial_bias": BiasType.RACIAL_BIAS,
            "age_discrimination": BiasType.AGE_DISCRIMINATION,
            "ableism": BiasType.ABLEISM,
            "body_image": BiasType.BODY_IMAGE,
            "socioeconomic": BiasType.SOCIOECONOMIC,
            "cultural_stereotypes": BiasType.CULTURAL_STEREOTYPES,
            "professional_stereotypes": BiasType.PROFESSIONAL_STEREOTYPES
        }

    def _find_matching_bias_type(
        self,
        text: str,
        bias_mappings: Dict[str, BiasType],
        bias_types: Optional[List[BiasType]]
    ) -> Optional[BiasType]:
        """Find matching bias type from text"""
        text_lower = text.lower()
        for keyword, bias_type in bias_mappings.items():
            if keyword in text_lower:
                if bias_types is None or bias_type in bias_types:
                    return bias_type
        return None

    def _create_bias_score(
        self,
        bias_type: BiasType,
        confidence: float,
        evidence: List[str],
        explanation: str,
        objects_involved: Optional[List] = None,
        affected_regions: Optional[List] = None
    ) -> VisualBiasScore:
        """Create a VisualBiasScore object"""
        confidence_level = self._get_confidence_level(confidence)
        return VisualBiasScore(
            bias_type=bias_type,
            score=confidence,
            confidence=confidence,
            confidence_level=confidence_level,
            evidence=evidence,
            explanation=explanation,
            affected_regions=affected_regions or [],
            objects_involved=objects_involved or []
        )

    def _process_bias_indicators(
        self,
        bias_indicators: List[str],
        bias_mappings: Dict[str, BiasType],
        bias_types: Optional[List[BiasType]],
        sensitivity: str,
        explanation_template: str,
        objects_involved: Optional[List] = None
    ) -> List[VisualBiasScore]:
        """Process bias indicators and create scores"""
        bias_scores = []
        for bias_indicator in bias_indicators:
            bias_type = self._find_matching_bias_type(
                bias_indicator, bias_mappings, bias_types
            )
            if bias_type is None:
                continue

            confidence = self._calculate_confidence(bias_indicator, sensitivity)
            explanation = explanation_template.format(bias_type=bias_type.value)
            bias_score = self._create_bias_score(
                bias_type=bias_type,
                confidence=confidence,
                evidence=[bias_indicator],
                explanation=explanation,
                objects_involved=objects_involved
            )
            bias_scores.append(bias_score)
        return bias_scores

    def _process_semantic_matches(
        self,
        top_matches: List[tuple],
        bias_mappings: Dict[str, BiasType],
        bias_types: Optional[List[BiasType]],
        threshold: float = 0.5
    ) -> List[VisualBiasScore]:
        """Process semantic analysis matches"""
        bias_scores = []
        for prompt, score in top_matches:
            if score <= threshold:
                continue

            bias_type = self._find_matching_bias_type(
                prompt, bias_mappings, bias_types
            )
            if bias_type is None:
                continue

            confidence = min(score, 0.9)  # Cap confidence
            explanation = f"Detected {bias_type.value} bias in semantic analysis"
            bias_score = self._create_bias_score(
                bias_type=bias_type,
                confidence=confidence,
                evidence=[prompt],
                explanation=explanation
            )
            bias_scores.append(bias_score)
        return bias_scores

    async def _generate_bias_scores(
        self,
        analysis_results: Dict[str, Any],
        bias_types: Optional[List[BiasType]],
        sensitivity: str
    ) -> List[VisualBiasScore]:
        """Generate bias scores from analysis results"""
        bias_scores = []
        bias_mappings = self._get_bias_type_mappings()

        # Process face analysis results
        if "face_analysis" in analysis_results:
            bias_indicators = analysis_results["face_analysis"].get("bias_indicators", [])
            face_scores = self._process_bias_indicators(
                bias_indicators,
                bias_mappings,
                bias_types,
                sensitivity,
                "Detected {bias_type} bias in facial representation"
            )
            bias_scores.extend(face_scores)

        # Process object analysis results
        if "object_analysis" in analysis_results:
            objects = analysis_results["object_analysis"].get("objects", [])
            bias_indicators = analysis_results["object_analysis"].get("bias_indicators", [])
            object_scores = self._process_bias_indicators(
                bias_indicators,
                bias_mappings,
                bias_types,
                sensitivity,
                "Detected {bias_type} bias in object representation",
                objects_involved=objects
            )
            bias_scores.extend(object_scores)

        # Process semantic analysis results
        if "semantic_analysis" in analysis_results:
            top_matches = analysis_results["semantic_analysis"].get("top_matches", [])
            semantic_scores = self._process_semantic_matches(
                top_matches,
                bias_mappings,
                bias_types
            )
            bias_scores.extend(semantic_scores)

        # Process OCR analysis results if available
        if "ocr_analysis" in analysis_results:
            ocr_text = analysis_results["ocr_analysis"].get("text", "")
            if ocr_text:
                bias_indicators = [ocr_text]  # Simple approach
                ocr_scores = self._process_bias_indicators(
                    bias_indicators,
                    bias_mappings,
                    bias_types,
                    sensitivity,
                    "Detected {bias_type} bias in OCR text"
                )
                bias_scores.extend(ocr_scores)

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

    def _categorize_score(
        self,
        prompt: str,
        positive_words: List[str],
        negative_words: List[str]
    ) -> Optional[str]:
        """Categorize a prompt as positive, negative, or None"""
        prompt_lower = prompt.lower()
        if any(word in prompt_lower for word in positive_words):
            return "positive"
        if any(word in prompt_lower for word in negative_words):
            return "negative"
        return None

    def _calculate_average_score(self, scores: List[float]) -> float:
        """Calculate average of scores"""
        return sum(scores) / len(scores) if scores else 0.0

    def _determine_sentiment(
        self,
        avg_positive: float,
        avg_negative: float
    ) -> str:
        """Determine overall sentiment from averages"""
        if avg_positive > avg_negative:
            return "positive"
        if avg_negative > avg_positive:
            return "negative"
        return "neutral"

    def _calculate_overall_sentiment(self, semantic_scores: Dict[str, float]) -> str:
        """Calculate overall sentiment from semantic scores"""
        positive_words = ["neutral", "unbiased", "inclusive", "respectful"]
        negative_words = ["bias", "stereotypes", "harmful"]

        positive_scores = []
        negative_scores = []

        for prompt, score in semantic_scores.items():
            category = self._categorize_score(prompt, positive_words, negative_words)
            if category == "positive":
                positive_scores.append(score)
            elif category == "negative":
                negative_scores.append(score)

        if not positive_scores and not negative_scores:
            return "neutral"

        avg_positive = self._calculate_average_score(positive_scores)
        avg_negative = self._calculate_average_score(negative_scores)

        return self._determine_sentiment(avg_positive, avg_negative)

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
