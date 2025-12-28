"""
Main bias detection service integrating all components
"""

import hashlib
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings
from ..models import (
    AnalysisStatus,
    BiasAnalysisRequest,
    BiasAnalysisResponse,
    BiasScore,
    BiasType,
    CounterfactualScenario,
    Recommendation,
)
from .cache_service import cache_service
from .database_service import DatabaseService
from .model_service import ModelEnsembleService

logger = structlog.get_logger(__name__)


class BiasDetectionService:
    """Main bias detection service"""

    def __init__(self):
        self.model_service = ModelEnsembleService()
        self.database_service = DatabaseService()
        self.is_initialized = False

    async def initialize(self) -> bool:
        """Initialize the bias detection service"""
        try:
            logger.info("Initializing bias detection service")

            # Initialize cache
            cache_initialized = await cache_service.connect()
            if not cache_initialized:
                logger.warning(
                    "Cache service initialization failed, continuing without cache"
                )

            # Initialize database
            db_initialized = await self.database_service.connect()
            if not db_initialized:
                logger.warning(
                    "Database service initialization failed, continuing without database"
                )

            # Load models
            models_loaded = await self.model_service.load_all_models()
            if not models_loaded:
                logger.error("Model loading failed")
                return False

            self.is_initialized = True
            logger.info("Bias detection service initialized successfully")
            return True

        except Exception as e:
            logger.error(
                f"Failed to initialize bias detection service: {str(e)}", error=str(e)
            )
            return False

    async def shutdown(self) -> None:
        """Shutdown the bias detection service"""
        try:
            logger.info("Shutting down bias detection service")

            # Shutdown cache
            await cache_service.disconnect()

            # Shutdown database
            await self.database_service.disconnect()

            self.is_initialized = False
            logger.info("Bias detection service shutdown completed")

        except Exception as e:
            logger.error(f"Error during service shutdown: {str(e)}", error=str(e))

    async def analyze_bias(
        self, request: BiasAnalysisRequest, request_id: str
    ) -> BiasAnalysisResponse:
        """Analyze text for bias"""
        start_time = time.time()

        try:
            logger.info(
                "Starting bias analysis",
                request_id=request_id,
                content_length=len(request.content),
                user_id=request.user_id,
            )

            # Generate content hash
            content_hash = self._generate_content_hash(request.content)

            # Check cache first
            cached_result = await self._get_cached_analysis(content_hash)
            if cached_result:
                logger.info("Returning cached analysis result", request_id=request_id)
                return cached_result

            # Perform analysis
            analysis_result = await self._perform_analysis(
                request, request_id, content_hash
            )

            # Cache result
            await self._cache_analysis_result(content_hash, analysis_result)

            # Store in database
            await self._store_analysis_result(analysis_result)

            processing_time = int((time.time() - start_time) * 1000)

            logger.info(
                "Bias analysis completed",
                request_id=request_id,
                processing_time_ms=processing_time,
                overall_bias_score=analysis_result.overall_bias_score,
                bias_types_detected=len(analysis_result.bias_scores),
            )

            return analysis_result

        except Exception as e:
            logger.error(
                f"Bias analysis failed: {str(e)}", request_id=request_id, error=str(e)
            )
            raise

    async def _perform_analysis(
        self, request: BiasAnalysisRequest, request_id: str, content_hash: str
    ) -> BiasAnalysisResponse:
        """Perform the actual bias analysis"""

        # Get model predictions
        model_results = await self._get_model_predictions(request.content)

        # Process results
        bias_scores = self._process_model_results(model_results, request)

        # Calculate overall score
        overall_bias_score = self._calculate_overall_score(bias_scores)

        # Generate recommendations
        recommendations = await self._generate_recommendations(bias_scores, request)

        # Generate counterfactual scenarios
        counterfactuals = await self._generate_counterfactuals(
            request.content, bias_scores
        )

        # Perform additional analyses
        sentiment_analysis = await self._perform_sentiment_analysis(request.content)
        keyword_analysis = await self._perform_keyword_analysis(request.content)
        contextual_analysis = await self._perform_contextual_analysis(
            request.content, request.context
        )

        # Determine dominant bias types
        dominant_bias_types = self._get_dominant_bias_types(bias_scores)

        # Create response
        return BiasAnalysisResponse(
            request_id=request_id,
            status=AnalysisStatus.COMPLETED,
            content_hash=content_hash,
            overall_bias_score=overall_bias_score,
            bias_scores=bias_scores,
            dominant_bias_types=dominant_bias_types,
            sentiment_analysis=sentiment_analysis,
            keyword_analysis=keyword_analysis,
            contextual_analysis=contextual_analysis,
            recommendations=recommendations,
            counterfactual_scenarios=counterfactuals,
            processing_time_ms=int(model_results.get("processing_time_ms", 0)),
            model_version=self._get_model_version(),
            language_detected=self._detect_language(request.content),
            word_count=len(request.content.split()),
            completed_at=datetime.now(timezone.utc),
        )

    @retry(
        stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def _get_model_predictions(self, text: str) -> Dict[str, Any]:
        """Get predictions from ML models"""
        try:
            # Use ensemble service for predictions
            return await self.model_service.predict_ensemble(text)

        except Exception as e:
            logger.error(f"Model prediction failed: {str(e)}", error=str(e))
            raise

    def _process_model_results(
        self, model_results: Dict[str, Any], request: BiasAnalysisRequest
    ) -> List[BiasScore]:
        """Process model results into bias scores"""
        bias_scores = []

        # Get ensemble results
        ensemble_results = model_results.get("ensemble_results", [])

        for result in ensemble_results:
            # Filter by requested bias types if specified
            if request.bias_types and result["bias_type"] not in request.bias_types:
                continue

            # Apply sensitivity filtering
            if self._should_include_bias(result, request.sensitivity):
                bias_score = BiasScore(
                    bias_type=result["bias_type"],
                    score=result["score"],
                    confidence=result["confidence"],
                    confidence_level=result["confidence_level"],
                    evidence=result["evidence"],
                    explanation=result["explanation"],
                )
                bias_scores.append(bias_score)

        return bias_scores

    def _should_include_bias(self, result: Dict[str, Any], sensitivity: str) -> bool:
        """Determine if bias should be included based on sensitivity"""
        score = result["score"]

        sensitivity_thresholds = {"low": 0.3, "medium": 0.5, "high": 0.2}

        threshold = sensitivity_thresholds.get(sensitivity.lower(), 0.5)
        return score >= threshold

    def _calculate_overall_score(self, bias_scores: List[BiasScore]) -> float:
        """Calculate overall bias score"""
        if not bias_scores:
            return 0.0

        # Weighted average based on confidence
        total_weighted_score = 0.0
        total_confidence = 0.0

        for score in bias_scores:
            total_weighted_score += score.score * score.confidence
            total_confidence += score.confidence

        return total_weighted_score / total_confidence if total_confidence > 0 else 0.0

    def _get_dominant_bias_types(self, bias_scores: List[BiasScore]) -> List[BiasType]:
        """Get dominant bias types (top 3 by score)"""
        sorted_scores = sorted(bias_scores, key=lambda x: x.score, reverse=True)
        return [score.bias_type for score in sorted_scores[:3]]

    async def _generate_recommendations(
        self, bias_scores: List[BiasScore], request: BiasAnalysisRequest
    ) -> List[Recommendation]:
        """Generate bias mitigation recommendations"""
        recommendations = []

        for score in bias_scores:
            # Generate specific recommendations for each bias type
            bias_recommendations = self._get_bias_specific_recommendations(score)
            recommendations.extend(bias_recommendations)

        # Add general recommendations if no specific ones found
        if not recommendations and bias_scores:
            recommendations.append(self._get_general_recommendation())

        return recommendations[:5]  # Limit to top 5 recommendations

    def _get_bias_specific_recommendations(
        self, bias_score: BiasScore
    ) -> List[Recommendation]:
        """Get recommendations specific to bias type"""
        recommendations = []

        bias_type = bias_score.bias_type
        score = bias_score.score

        # Gender bias recommendations
        if bias_type == BiasType.GENDER:
            recommendations.append(
                Recommendation(
                    type="gender_neutral_language",
                    description="Use gender-neutral language instead of gender-specific terms",
                    priority="high" if score > 0.7 else "medium",
                    implementation_difficulty="easy",
                    estimated_impact="high",
                    examples=[
                        "Use 'they' instead of 'he/she'",
                        "Use 'chairperson' instead of 'chairman'",
                    ],
                )
            )

        # Racial bias recommendations
        elif bias_type == BiasType.RACIAL:
            recommendations.append(
                Recommendation(
                    type="inclusive_references",
                    description="Avoid racial or ethnic stereotypes in descriptions",
                    priority="high" if score > 0.7 else "medium",
                    implementation_difficulty="medium",
                    estimated_impact="high",
                    examples=[
                        "Focus on individual qualities rather than group characteristics"
                    ],
                )
            )

        # Age bias recommendations
        elif bias_type == BiasType.AGE:
            recommendations.append(
                Recommendation(
                    type="age_neutral_language",
                    description="Use age-neutral terms and avoid age-based assumptions",
                    priority="medium",
                    implementation_difficulty="easy",
                    estimated_impact="medium",
                    examples=[
                        "Use 'experienced' instead of 'old'",
                        "Avoid 'digital native' assumptions",
                    ],
                )
            )

        return recommendations

    def _get_general_recommendation(self) -> Recommendation:
        """Get general bias mitigation recommendation"""
        return Recommendation(
            type="bias_awareness",
            description="Review content for unconscious bias and consider diverse perspectives",
            priority="medium",
            implementation_difficulty="medium",
            estimated_impact="medium",
            examples=[
                "Have diverse team members review content",
                "Use bias detection tools regularly",
            ],
        )

    async def _generate_counterfactuals(
        self, content: str, bias_scores: List[BiasScore]
    ) -> List[CounterfactualScenario]:
        """Generate counterfactual scenarios"""
        counterfactuals = []

        for score in bias_scores[:2]:  # Limit to top 2 bias types
            if scenario := self._create_counterfactual(content, score):
                counterfactuals.append(scenario)

        return counterfactuals

    def _create_counterfactual(
        self, content: str, bias_score: BiasScore
    ) -> Optional[CounterfactualScenario]:
        """Create counterfactual scenario for specific bias"""
        # Simplified counterfactual generation
        # In production, this would use more sophisticated NLP techniques

        bias_type = bias_score.bias_type
        evidence = bias_score.evidence

        if not evidence:
            return None

        # Simple text replacement for demonstration
        original_text = content
        alternative_text = content

        # Basic replacements (simplified)
        for evidence_item in evidence:
            if bias_type == BiasType.GENDER:
                if evidence_item == "he":
                    alternative_text = alternative_text.replace("he", "they")
                elif evidence_item == "she":
                    alternative_text = alternative_text.replace("she", "they")
            elif bias_type == BiasType.RACIAL:
                # Remove racial references (simplified)
                alternative_text = alternative_text.replace(evidence_item, "individual")

        if alternative_text != original_text:
            return CounterfactualScenario(
                original_text=original_text,
                alternative_text=alternative_text,
                bias_type=bias_type,
                explanation=f"Replaced {bias_type.value} biased terms with neutral alternatives",
                impact_assessment="Reduces bias while maintaining core message",
            )

        return None

    async def _perform_sentiment_analysis(self, text: str) -> Dict[str, Any]:
        """Perform sentiment analysis"""
        # Simplified sentiment analysis
        # In production, this would use a proper sentiment analysis model

        positive_words = ["good", "great", "excellent", "amazing", "wonderful"]
        negative_words = ["bad", "terrible", "awful", "horrible", "poor"]

        words = text.lower().split()
        positive_count = sum(word in positive_words for word in words)
        negative_count = sum(word in negative_words for word in words)

        total_sentiment_words = positive_count + negative_count

        if total_sentiment_words == 0:
            sentiment_score = 0.0
            sentiment_label = "neutral"
        else:
            sentiment_score = (positive_count - negative_count) / total_sentiment_words
            if sentiment_score > 0.1:
                sentiment_label = "positive"
            elif sentiment_score < -0.1:
                sentiment_label = "negative"
            else:
                sentiment_label = "neutral"

        return {
            "score": sentiment_score,
            "label": sentiment_label,
            "positive_words": positive_count,
            "negative_words": negative_count,
        }

    async def _perform_keyword_analysis(self, text: str) -> Dict[str, Any]:
        """Perform keyword analysis"""
        words = text.lower().split()
        word_freq = {}

        for word in words:
            word_freq[word] = word_freq.get(word, 0) + 1

        # Get top keywords
        top_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "total_words": len(words),
            "unique_words": len(word_freq),
            "top_keywords": [
                {"word": word, "frequency": freq} for word, freq in top_keywords
            ],
        }

    async def _perform_contextual_analysis(
        self, text: str, context: Optional[str]
    ) -> Dict[str, Any]:
        """Perform contextual analysis"""
        analysis = {
            "has_context": bool(context),
            "context_length": len(context) if context else 0,
            "text_context_similarity": 0.0,
        }

        if context:
            # Simple similarity check (in production, use proper NLP techniques)
            text_words = set(text.lower().split())
            context_words = set(context.lower().split())

            if text_words and context_words:
                intersection = len(text_words.intersection(context_words))
                union = len(text_words.union(context_words))
                analysis["text_context_similarity"] = (
                    intersection / union if union > 0 else 0.0
                )

        return analysis

    def _generate_content_hash(self, content: str) -> str:
        """Generate SHA256 hash of content"""
        return hashlib.sha256(content.encode()).hexdigest()

    async def _get_cached_analysis(
        self, content_hash: str
    ) -> Optional[BiasAnalysisResponse]:
        """Get cached analysis result"""
        if not settings.enable_caching:
            return None

        if cached_result := await cache_service.get_analysis_result(content_hash):
            logger.info("Found cached analysis result", content_hash=content_hash)
            return BiasAnalysisResponse(**cached_result)

        return None

    async def _cache_analysis_result(
        self, content_hash: str, result: BiasAnalysisResponse
    ) -> None:
        """Cache analysis result"""
        if settings.enable_caching:
            await cache_service.cache_analysis_result(content_hash, result.dict())

    async def _store_analysis_result(self, result: BiasAnalysisResponse) -> None:
        """Store analysis result in database"""
        try:
            await self.database_service.store_analysis(result)
        except Exception as e:
            logger.warning(f"Failed to store analysis result: {str(e)}", error=str(e))

    def _get_model_version(self) -> str:
        """Get model version"""
        return "1.0.0-ensemble"

    def _detect_language(self, text: str) -> str:
        """Detect language of text"""
        # Simplified language detection
        # In production, use proper language detection library
        return "en"  # Default to English

    async def get_health_status(self) -> Dict[str, Any]:
        """Get service health status"""
        health_status = {
            "service": "bias_detection",
            "status": "healthy" if self.is_initialized else "unhealthy",
            "initialized": self.is_initialized,
            "model_service": await self._get_model_service_health(),
            "cache_service": await self._get_cache_service_health(),
            "database_service": await self._get_database_service_health(),
        }

        # Overall status
        if not self.is_initialized:
            health_status["status"] = "unhealthy"
        elif any(
            service.get("status") == "unhealthy"
            for service in [
                health_status["model_service"],
                health_status["cache_service"],
                health_status["database_service"],
            ]
        ):
            health_status["status"] = "degraded"

        return health_status

    async def _get_model_service_health(self) -> Dict[str, Any]:
        """Get model service health status"""
        try:
            ensemble_info = self.model_service.get_ensemble_info()
            models_loaded = all(
                model.get("loaded", False) for model in ensemble_info.get("models", [])
            )

            return {
                "status": "healthy" if models_loaded else "unhealthy",
                "models_loaded": models_loaded,
                "models_count": len(ensemble_info.get("models", [])),
            }
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}

    async def _get_cache_service_health(self) -> Dict[str, Any]:
        """Get cache service health status"""
        return await cache_service.get_health_status()

    async def _get_database_service_health(self) -> Dict[str, Any]:
        """Get database service health status"""
        return await self.database_service.get_health_status()
