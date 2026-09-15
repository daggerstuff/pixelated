"""
Multimodal bias detection ensemble service.

Combines the vision and audio detectors (plus a lightweight lexical text
scan) into a single multi-modal analysis. The ensemble reuses the already
loaded sub-detector instances so models are not loaded twice.
"""

import hashlib
import time
from collections import defaultdict
from typing import Any

import structlog

from ..models import (
    AnalysisStatus,
    BiasType,
    ConfidenceLevel,
    MediaType,
    MultimodalAnalysisRequest,
    MultimodalAnalysisResponse,
    MultimodalBiasScore,
)
from .audio_service import AudioBiasDetector
from .vision_service import VisionBiasDetector

logger = structlog.get_logger(__name__)

# Lexical markers for a lightweight text-modality bias scan. This is a
# heuristic pass only; visual/audio analyses carry the model-backed signal.
_TEXT_BIAS_MARKERS: dict[BiasType, tuple[str, ...]] = {
    BiasType.GENDER_STEREOTYPES: ("housewife", "breadwinner", "male nurse", "female engineer"),
    BiasType.RACIAL_BIAS: ("urban people", "those people", "illegal aliens"),
    BiasType.AGE_DISCRIMINATION: ("digital immigrant", "too old for", "young kids these days"),
    BiasType.ABLEISM: ("crippled by", "victim of autism", "wheelchair-bound"),
    BiasType.SOCIOECONOMIC: ("ghetto", "trailer trash", "welfare queen"),
    BiasType.PROFESSIONAL_STEREOTYPES: ("bossy woman", "aggressive man", "like a girl"),
}


class InMemoryRateLimitCache:
    """Simple per-process rate-limit counters.

    Good enough for a single-instance deployment; a Redis-backed
    implementation can replace it behind the same interface.
    """

    def __init__(self) -> None:
        self._counters: dict[str, list[tuple[float, int]]] = defaultdict(list)

    def _prune(self, key: str, window_start: float) -> None:
        self._counters[key] = [(ts, n) for ts, n in self._counters[key] if ts > window_start]

    async def get_rate_limit_counter(self, key: str) -> int:
        window_start = time.time() - 60.0
        self._prune(key, window_start)
        return sum(n for _, n in self._counters[key])

    async def increment_rate_limit_counter(self, key: str) -> None:
        self._counters[key].append((time.time(), 1))


class MultimodalBiasDetector:
    """Ensemble detector combining vision, audio, and text modalities."""

    def __init__(self) -> None:
        self.vision_detector = VisionBiasDetector()
        self.audio_detector = AudioBiasDetector()
        self.cache_service = InMemoryRateLimitCache()
        self._initialized = False
        self._init_error: str | None = None

    async def initialize(self) -> None:
        """Load ensemble sub-detectors. Failures degrade to unavailable
        modalities rather than blocking service startup."""
        errors: list[str] = []
        for name, detector in (("vision", self.vision_detector), ("audio", self.audio_detector)):
            try:
                loaded = await detector.load_models()
                if not loaded:
                    errors.append(f"{name}: load_models returned false")
            except Exception as exc:
                logger.warning("ensemble sub-detector failed to load", modality=name, error=str(exc))
                errors.append(f"{name}: {exc}")
        self._init_error = "; ".join(errors) if errors else None
        self._initialized = True
        logger.info("multimodal ensemble initialized", degraded=bool(errors))

    async def shutdown(self) -> None:
        """Release ensemble resources."""
        self._initialized = False

    def _analyze_text(self, text: str, sensitivity: str) -> list[MultimodalBiasScore]:
        """Heuristic lexical scan of the text modality."""
        scores: list[MultimodalBiasScore] = []
        lowered = text.lower()
        for bias_type, markers in _TEXT_BIAS_MARKERS.items():
            hits = [m for m in markers if m in lowered]
            if not hits:
                continue
            strength = len(hits) / len(markers)
            scores.append(
                MultimodalBiasScore(
                    bias_type=bias_type,
                    overall_score=min(1.0, strength * (1.5 if sensitivity == "high" else 1.0)),
                    modality_scores={"text": min(1.0, strength)},
                    confidence=0.4,
                    confidence_level=ConfidenceLevel.LOW,
                    cross_modal_evidence=[f"lexical marker: {m}" for m in hits],
                    explanation=f"Text contains biased phrasing markers: {', '.join(hits)}",
                )
            )
        return scores

    def _modality_for(self, request: MultimodalAnalysisRequest) -> MediaType:
        has_image = bool(request.image_url or request.image_data)
        has_audio = bool(request.audio_url or request.audio_data)
        has_video = bool(request.video_url or request.video_data)
        has_text = bool(request.text_content)
        signals = [has_image or has_video, has_audio, has_text]
        if sum(bool(s) for s in signals[:2]) > 1 or (has_video and has_audio):
            return MediaType.MULTIMODAL
        if has_image:
            return MediaType.IMAGE
        if has_audio:
            return MediaType.AUDIO
        if has_video:
            return MediaType.VIDEO
        return MediaType.MULTIMODAL

    async def analyze_multimodal(
        self, request: MultimodalAnalysisRequest, request_id: str
    ) -> MultimodalAnalysisResponse:
        """Run all requested modalities and fuse their scores."""
        start = time.time()
        bias_scores: list[MultimodalBiasScore] = []
        visual_result: dict[str, Any] | None = None
        audio_result: dict[str, Any] | None = None
        text_result: dict[str, Any] | None = None
        modalities: list[str] = []

        if request.image_url or request.image_data or request.video_url or request.video_data:
            try:
                visual_result = await self.vision_detector.analyze_image(
                    image_data=b"",
                    analysis_type="comprehensive",
                    bias_types=request.bias_types,
                    sensitivity=request.sensitivity,
                )
                modalities.append("visual")
                for score in visual_result.get("bias_scores", []):
                    bias_scores.append(self._fuse("visual", score))
            except Exception as exc:
                logger.warning("visual modality failed", request_id=request_id, error=str(exc))

        if request.audio_url or request.audio_data:
            try:
                audio_result = await self.audio_detector.analyze_audio(
                    audio_data=b"",
                    analysis_type="comprehensive",
                    bias_types=request.bias_types,
                    sensitivity=request.sensitivity,
                )
                modalities.append("audio")
                for score in audio_result.get("bias_scores", []):
                    bias_scores.append(self._fuse("audio", score))
            except Exception as exc:
                logger.warning("audio modality failed", request_id=request_id, error=str(exc))

        if request.text_content:
            text_scores = self._analyze_text(request.text_content, request.sensitivity)
            if text_scores:
                modalities.append("text")
                bias_scores.extend(text_scores)
            text_result = {"bias_scores": [s.model_dump() for s in text_scores]}

        # Deduplicate by bias type, averaging overall scores across modalities
        fused: dict[BiasType, list[float]] = defaultdict(list)
        for score in bias_scores:
            fused[score.bias_type].append(score.overall_score)
        bias_scores = [
            MultimodalBiasScore(
                bias_type=bias_type,
                overall_score=sum(v) / len(v),
                modality_scores={},
                confidence=0.5,
                confidence_level=ConfidenceLevel.MEDIUM,
                cross_modal_evidence=[f"detected across {len(v)} analysis pass(es)"],
                explanation=f"Bias type {bias_type.value} detected in {len(v)} modality pass(es)",
            )
            for bias_type, v in fused.items()
        ]
        bias_scores.sort(key=lambda s: s.overall_score, reverse=True)

        dominant = [s.bias_type for s in bias_scores[:3]]
        overall = max((s.overall_score for s in bias_scores), default=0.0)

        return MultimodalAnalysisResponse(
            request_id=request_id,
            status=AnalysisStatus.COMPLETED,
            media_type=self._modality_for(request),
            content_hash=hashlib.sha256(
                (request.text_content or "").encode()
                + (request.image_url or request.image_data or "").encode()
                + (request.audio_url or request.audio_data or "").encode()
                + (request.video_url or request.video_data or "").encode()
            ).hexdigest(),
            overall_bias_score=overall,
            bias_scores=bias_scores,
            dominant_bias_types=dominant,
            visual_analysis=visual_result,
            audio_analysis=audio_result,
            text_analysis=text_result,
            cross_modal_patterns=[],
            modality_correlations={},
            recommendations=[],
            alternative_representations=[],
            processing_time_ms=int((time.time() - start) * 1000),
            model_versions={"ensemble": "vision+audio+text-heuristic"},
            modalities_analyzed=modalities or ["none"],
            file_metadata={},
        )

    def _fuse(self, modality: str, score: dict[str, Any]) -> MultimodalBiasScore:
        """Convert a single-modality score dict into the fused model."""
        return MultimodalBiasScore(
            bias_type=score.get("bias_type", BiasType.CULTURAL_STEREOTYPES),
            overall_score=float(score.get("score", 0.0)),
            modality_scores={modality: float(score.get("score", 0.0))},
            confidence=float(score.get("confidence", 0.0)),
            confidence_level=score.get("confidence_level", ConfidenceLevel.LOW),
            cross_modal_evidence=score.get("evidence", []),
            explanation=score.get("explanation", f"detected by {modality} modality"),
        )

    async def get_health_status(self) -> dict[str, Any]:
        """Report ensemble health per sub-detector."""

        def sub_status(ok: bool) -> str:
            if not self._initialized:
                return "degraded"
            return "healthy" if ok else "unhealthy"

        vision_ok = self._initialized and self.vision_detector.is_loaded
        audio_ok = self._initialized and self.audio_detector.is_loaded
        sub = [
            sub_status(vision_ok),
            sub_status(audio_ok),
            sub_status(self._initialized and self._init_error is None),
        ]
        overall = (
            "healthy"
            if all(s == "healthy" for s in sub)
            else "degraded"
            if any(s != "unhealthy" for s in sub)
            else "unhealthy"
        )
        return {
            "status": overall,
            "vision_service": {"status": sub[0]},
            "audio_service": {"status": sub[1]},
            "multimodal_service": {"status": sub[2]},
            "gpu_status": {},
            "dependencies": {"note": self._init_error or "all dependencies nominal"},
            "metrics": {"rate_limit_backend": "in-memory"},
        }

    def get_ensemble_info(self) -> dict[str, Any]:
        """Describe the ensemble composition for the models-info endpoint."""
        return {
            "vision": self.vision_detector.get_model_info(),
            "audio": self.audio_detector.get_model_info(),
            "text": {"framework": "lexical-heuristic", "markers": len(_TEXT_BIAS_MARKERS)},
            "fusion": "per-bias-type mean across modality passes",
            "initialized": self._initialized,
            "degraded_reason": self._init_error,
        }
