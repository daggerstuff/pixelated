#!/usr/bin/env python3
"""Unit tests for AnalysisOrchestrator event emission."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from bias_detection.services.analysis_orchestrator import AnalysisOrchestrator


class AnalysisOrchestratorEventEmissionTest(unittest.IsolatedAsyncioTestCase):
    """analyze_session must emit bias/crisis events and never break on emitter failure."""

    SCORE = 0.05  # default layer score -> alert_level "low"

    def setUp(self):
        self.bias_service = MagicMock()
        self.db_service = MagicMock()
        self.orchestrator = AnalysisOrchestrator(self.bias_service, self.db_service)

        # Stub heavy sub-services so the orchestration flow is fast and isolated.
        self.orchestrator.audit_logger = AsyncMock()
        self.orchestrator.fairness_analyzer = MagicMock()
        self.orchestrator.fairness_analyzer.run_preprocessing_analysis = AsyncMock(
            return_value={"bias_score": self.SCORE}
        )
        self.orchestrator.diagnostic_service = MagicMock()
        self.orchestrator.diagnostic_service.run_interactive_analysis = AsyncMock(
            return_value={"bias_score": self.SCORE}
        )
        self.orchestrator.linguistic_analyzer = MagicMock()
        self.orchestrator.linguistic_analyzer.detect_bias = AsyncMock(
            return_value={
                "bias_score": self.SCORE,
                "results": [],
                "recommendations": [],
            }
        )
        model_response = MagicMock()
        model_response.model_dump.return_value = {
            "bias_score": self.SCORE,
            "results": [],
            "recommendations": [],
        }
        self.bias_service.analyze_bias = AsyncMock(return_value=model_response)

        self.session = {"session_id": "s1", "user_id": "u1", "text": "hello world"}

    def _set_layer_score(self, score):
        """Force every analysis layer to return the same bias score."""
        self.orchestrator.fairness_analyzer.run_preprocessing_analysis = AsyncMock(return_value={"bias_score": score})
        self.orchestrator.diagnostic_service.run_interactive_analysis = AsyncMock(return_value={"bias_score": score})
        self.orchestrator.linguistic_analyzer.detect_bias = AsyncMock(
            return_value={"bias_score": score, "results": [], "recommendations": []}
        )
        self.bias_service.analyze_bias = AsyncMock(
            return_value=MagicMock(model_dump=MagicMock(return_value={"bias_score": score}))
        )

    async def test_low_score_emits_bias_detected_with_session_context(self):
        with patch("bias_detection.services.analysis_orchestrator.emit_bias_events") as mock_emit:
            result = await self.orchestrator.analyze_session(self.session)
        self.assertEqual(result["overall_bias_score"], self.SCORE)
        self.assertEqual(result["alert_level"], "low")
        mock_emit.assert_called_once_with(
            session_id="s1",
            user_id="u1",
            overall_score=self.SCORE,
            alert_level="low",
            detected_biases=[],
        )

    async def test_receipt_root_hash_forwarded_from_session_data(self):
        self.session["receipt_root_hash"] = "a" * 64
        with patch("bias_detection.services.analysis_orchestrator.emit_bias_events"):
            result = await self.orchestrator.analyze_session(self.session)
        self.assertEqual(result["receipt_root_hash"], "a" * 64)

    async def test_receipt_root_hash_defaults_to_none_when_absent(self):
        with patch("bias_detection.services.analysis_orchestrator.emit_bias_events"):
            result = await self.orchestrator.analyze_session(self.session)
        self.assertIsNone(result["receipt_root_hash"])

    async def test_warning_score_passes_warning_alert_level(self):
        self._set_layer_score(0.25)
        with patch("bias_detection.services.analysis_orchestrator.emit_bias_events") as mock_emit:
            result = await self.orchestrator.analyze_session(self.session)
        self.assertEqual(result["alert_level"], "warning")
        mock_emit.assert_called_once_with(
            session_id="s1",
            user_id="u1",
            overall_score=0.25,
            alert_level="warning",
            detected_biases=[],
        )

    async def test_critical_score_passes_critical_alert_level(self):
        self._set_layer_score(0.75)
        with patch("bias_detection.services.analysis_orchestrator.emit_bias_events") as mock_emit:
            result = await self.orchestrator.analyze_session(self.session)
        self.assertEqual(result["alert_level"], "critical")
        mock_emit.assert_called_once_with(
            session_id="s1",
            user_id="u1",
            overall_score=0.75,
            alert_level="critical",
            detected_biases=[],
        )

    async def test_detected_biases_are_forwarded_to_emitter(self):
        self.orchestrator.linguistic_analyzer.detect_bias = AsyncMock(
            return_value={
                "bias_score": self.SCORE,
                "results": [{"term": "he", "type": "gender"}],
                "recommendations": [],
            }
        )
        with patch("bias_detection.services.analysis_orchestrator.emit_bias_events") as mock_emit:
            await self.orchestrator.analyze_session(self.session)
        mock_emit.assert_called_once()
        self.assertEqual(
            mock_emit.call_args.kwargs["detected_biases"],
            [{"term": "he", "type": "gender"}],
        )

    async def test_emitter_failure_does_not_break_analysis(self):
        with patch(
            "bias_detection.services.analysis_orchestrator.emit_bias_events",
            side_effect=RuntimeError("event bus down"),
        ):
            result = await self.orchestrator.analyze_session(self.session)
        self.assertEqual(result["overall_bias_score"], self.SCORE)
        self.assertEqual(result["alert_level"], "low")
        self.assertEqual(result["session_id"], "s1")


if __name__ == "__main__":
    unittest.main()
