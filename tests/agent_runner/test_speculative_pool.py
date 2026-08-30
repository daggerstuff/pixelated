"""Unit tests for ParallelSpeculativeExecutor concurrent worktree batches."""

from __future__ import annotations

import os
import tempfile
from unittest.mock import MagicMock
from tools.agent_runner.execution_harness import HarnessRunReport
from tools.agent_runner.models import AgentConfig, ExecutionResult, LinearIssue
from tools.agent_runner.speculative_pool import ParallelSpeculativeExecutor


def test_parallel_speculative_executor_batch():
    with tempfile.TemporaryDirectory() as tmpdir:
        os.system(f"git init {tmpdir} -q")
        os.system(f"touch {tmpdir}/README.md && git -C {tmpdir} add . && git -C {tmpdir} commit -m 'init' -q")

        mock_harness = MagicMock()
        mock_harness.run_harness.return_value = (
            ExecutionResult(agent_name="dev", ticket_identifier="PIX-1", success=True, output="ok"),
            HarnessRunReport(ticket_identifier="PIX-1", agent_name="dev", overall_passed=True, worktree_path=tmpdir),
        )

        executor = ParallelSpeculativeExecutor(base_repo=tmpdir, harness=mock_harness, max_concurrency=2)

        batch = [
            (LinearIssue(id="1", identifier="PIX-10", title="Task 1"), AgentConfig(name="dev1", label="agent:dev1", cmd=["echo"]), "Prompt 1"),
            (LinearIssue(id="2", identifier="PIX-20", title="Task 2"), AgentConfig(name="dev2", label="agent:dev2", cmd=["echo"]), "Prompt 2"),
        ]

        executions = executor.execute_parallel_batch(batch)
        assert len(executions) == 2
        assert all(e.report is not None and e.report.overall_passed for e in executions)
