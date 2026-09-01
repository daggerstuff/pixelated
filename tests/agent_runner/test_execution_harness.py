"""Unit tests for the AgentExecutionHarness and 6-stage quality gauntlet."""

from __future__ import annotations

import os
import tempfile

from tools.agent_runner.execution_harness import AgentExecutionHarness
from tools.agent_runner.models import (
    ExecutionResult,
    LinearIssue,
    RunnerConfig,
)


def test_harness_anti_hollow_gate_catches_fake_mocks():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a dummy git repo in tmpdir
        os.system(f"git init {tmpdir} -q")

        # Write a fake mock generator file
        fake_prod_file = os.path.join(tmpdir, "fake_service.ts")
        with open(fake_prod_file, "w") as f:
            f.write("export function getMetrics() { return seededRandom('test')(); }\n")

        config = RunnerConfig(server_label="srv:test")
        harness = AgentExecutionHarness(config=config)

        issue = LinearIssue(
            id="test-1",
            identifier="PIX-9999",
            title="Implement real metrics service",
            description="Build actual metrics database querying",
        )

        exec_res = ExecutionResult(
            agent_name="opencode", ticket_identifier="PIX-9999", success=True, output="Implemented metrics", stderr=""
        )
        gates, _files = harness._run_quality_gauntlet(tmpdir, exec_res, issue)

        s1 = next(g for g in gates if "Stage 1" in g.stage_name)
        assert not s1.passed
        assert any("Fake pseudo-random generator detected" in f for f in s1.failures)


def test_harness_anti_suppression_gate_catches_tags():
    with tempfile.TemporaryDirectory() as tmpdir:
        os.system(f"git init {tmpdir} -q")

        suppressed_file = os.path.join(tmpdir, "bad_types.ts")
        with open(suppressed_file, "w") as f:
            f.write("// @ts-ignore\nconst x: number = 'not a number';\n")

        config = RunnerConfig(server_label="srv:test")
        harness = AgentExecutionHarness(config=config)

        issue = LinearIssue(
            id="test-2",
            identifier="PIX-9998",
            title="Fix typescript types",
            description="Properly resolve types",
        )

        exec_res = ExecutionResult(
            agent_name="opencode", ticket_identifier="PIX-9998", success=True, output="Fixed types", stderr=""
        )
        gates, _files = harness._run_quality_gauntlet(tmpdir, exec_res, issue)

        s2 = next(g for g in gates if "Stage 2" in g.stage_name)
        assert not s2.passed
        assert any("Contains forbidden suppression tag" in f for f in s2.failures)
