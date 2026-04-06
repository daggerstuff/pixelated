import asyncio
import time
from typing import Any

import numpy as np
import structlog

from bias_detection.models import BiasAnalysisRequest
from bias_detection.services.bias_detection_service import BiasDetectionService
from bias_detection.services.database_service import DatabaseService
from bias_detection.services.diagnostic_service import DiagnosticService
from bias_detection.services.fairness_analyzer import FairnessAnalyzer
from bias_detection.services.linguistic_service import LinguisticAnalyzer
from bias_detection.services.security_service import AuditLogger, SecurityManager

logger = structlog.get_logger(__name__)


class AnalysisOrchestrator:
    """Orchestrates comprehensive bias detection across multiple analysis layers."""

    def __init__(
        self,
        bias_detection_service: BiasDetectionService,
        database_service: DatabaseService,
        config: Any | None = None
    ):
        self.bias_service = bias_detection_service
        self.db_service = database_service
        self.config = config

        # Initialize sub-services (default values as fallback)
        self.fairness_analyzer = FairnessAnalyzer(
            warning_threshold=getattr(config, "warning_threshold", 0.3)
        )
        self.diagnostic_service = DiagnosticService(
            warning_threshold=getattr(config, "warning_threshold", 0.3)
        )
        self.linguistic_analyzer = LinguisticAnalyzer()

        # Security managers
        self.security_manager = SecurityManager(
            jwt_secret_key=getattr(config, "jwt_secret_key", None),
encryption_password=getattr(config, "encryption_password", None),
encryption_salt=getattr(config, "encryption_salt", None),
pbkdf2_iterations=getattr(config, "pbkdf2_iterations", 100000),
        )
        self.audit_logger = AuditLogger(self.security_manager)

    async def analyze_session(self, session_data: dict[str, Any]) -> dict[str, Any]:
        """Run comprehensive bias analysis across all available layers."""
        session_id = session_data.get("session_id", "unknown")
        user_id = session_data.get("user_id", "anonymous")
        start_time = time.time()

        logger.info("Starting comprehensive bias analysis for session", session_id=session_id)

        # 1. Run all analysis layers in parallel
        tasks = [
            self._run_layer_analysis("model_ensemble", session_data),
            self._run_layer_analysis("fairness", session_data),
            self._run_layer_analysis("diagnostic", session_data),
            self._run_layer_analysis("linguistic", session_data)
        ]

        layer_results = await asyncio.gather(*tasks)

        # 2. Consolidate results
        final_result = self._consolidate_results(layer_results)
        final_result["session_id"] = session_id
        final_result["user_id"] = user_id
        final_result["processing_time_ms"] = int((time.time() - start_time) * 1000)

        # 3. Log to audit trail (HIPAA compliance)
        await self.audit_logger.log_event(
            event_type="bias_analysis_completed",
            user_context={"session_id": session_id, "user_id": user_id},
            details={
                "overall_score": final_result["overall_bias_score"],
                "alert_level": final_result["alert_level"]
            },
            sensitive_data=False
        )


        # 4. Persistence (optional database storage)
        try:
            await self.db_service.store_analysis_result(session_id, final_result)
        except Exception as e:
            logger.warning("Failed to store analysis result", error=str(e))

        logger.info("Analysis completed", score=final_result["overall_bias_score"], session_id=session_id)
        return final_result

    async def _run_layer_analysis(self, layer_type: str, session_data: dict[str, Any]) -> dict[str, Any]:
        """Execute a specific analysis layer based on its type."""
        session_id = session_data.get("session_id", "unknown")
        try:
            if layer_type == "model_ensemble":
                # Primarily looks at text content through ensemble prediction
                text_content = self._extract_text(session_data)
                bias_request = BiasAnalysisRequest(
                    content=text_content,
                    user_id=session_data.get("user_id", "anonymous"),
                    context=session_data.get("context", "")
                )
                response = await self.bias_service.analyze_bias(bias_request, request_id=session_id)

                # Extract dictionary representation
                res = {}
                if hasattr(response, "model_dump"):
                    res = response.model_dump()
                elif hasattr(response, "dict"):
                    res = response.dict()
                elif isinstance(response, dict):
                    res = response
                return res

            if layer_type == "fairness":
                return await self.fairness_analyzer.run_preprocessing_analysis(session_data)

            if layer_type == "diagnostic":
                return await self.diagnostic_service.run_interactive_analysis(session_data)

            if layer_type == "linguistic":
                text_content = self._extract_text(session_data)
                return await self.linguistic_analyzer.detect_bias(text_content)

            return {"error": f"Unknown layer type: {layer_type}"}
        except Exception as e:
            logger.error("Layer analysis failed", layer_type=layer_type, error=str(e))
            return {"layer": layer_type, "error": str(e), "bias_score": 0.0}


    def _consolidate_results(self, layer_results: list[dict[str, Any]]) -> dict[str, Any]:
        """Consolidate multiple layer results into a single final report."""
        scores = []
        recommendations = []
        detected_biases = []

        for res in layer_results:
            if "bias_score" in res:
                scores.append(res["bias_score"])
            elif "overall_bias_score" in res:
                scores.append(res["overall_bias_score"])

            if "recommendations" in res:
                recommendations.extend(res["recommendations"])

            # Aggregate specific detected biases if any
            if "results" in res:
                detected_biases.extend(res["results"])

        avg_score = float(np.mean(scores)) if scores else 0.0

        # Determine alert level based on score
        alert_level = "low"
        if avg_score >= 0.7:
            alert_level = "critical"
        elif avg_score >= 0.4:
            alert_level = "high"
        elif avg_score >= 0.2:
            alert_level = "warning"

        return {
            "overall_bias_score": avg_score,
            "alert_level": alert_level,
            "detected_biases": detected_biases,
            "recommendations": list(set(recommendations)),
            "layer_results": layer_results
        }

    def _extract_text(self, session_data: dict[str, Any]) -> str:
        """Extract combined text content from various data structures in the session."""
        parts = []

        # AI Responses
        if "ai_responses" in session_data:
            parts.extend([r.get("content", "") for r in session_data["ai_responses"] if isinstance(r, dict)])

        # Transcripts
        if "transcripts" in session_data:
            parts.extend([t.get("text", "") for t in session_data["transcripts"] if isinstance(t, dict)])

        # Raw text
        if "text" in session_data:
            parts.append(str(session_data["text"]))

        return " ".join([p for p in parts if p])

