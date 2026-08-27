"""Unit tests for SelfEvolutionEngine."""

import os
import tempfile
from unittest.mock import MagicMock

from tools.agent_runner.models import ExecutionResult, LinearIssue
from tools.agent_runner.self_evolution import SelfEvolutionEngine


def test_self_evolution_friction_distillation():
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = os.path.join(tmp_dir, "lessons.jsonl")
        mock_foresight = MagicMock()
        mock_event_bus = MagicMock()

        engine = SelfEvolutionEngine(
            foresight=mock_foresight,
            event_bus=mock_event_bus,
            storage_path=storage,
        )

        issue = LinearIssue(id="1", identifier="PIX-500", title="Fix Auth Router")
        failed_res = ExecutionResult(
            success=False,
            agent_name="opencode",
            ticket_identifier="PIX-500",
            output="Error TS2307: Cannot find module '@pixelated/auth'",
            stderr="error TS2307: Cannot find module '@pixelated/auth'",
            exit_code=1,
            verification_passed=False,
            verification_logs="error TS2307: Cannot find module '@pixelated/auth'",
        )

        lesson = engine.process_execution_friction(
            issue=issue,
            agent_name="opencode",
            result=failed_res,
            repair_attempts=2,
        )

        assert lesson is not None
        assert lesson.failure_category == "typecheck"
        assert "Cannot find module" in lesson.root_cause_summary
        assert "TypeScript" in lesson.actionable_rule

        mock_foresight.store_decision.assert_called_once()
        mock_event_bus.publish.assert_called_once()

        recent = engine.get_recent_lessons()
        assert len(recent) == 1
        assert recent[0].ticket_identifier == "PIX-500"
