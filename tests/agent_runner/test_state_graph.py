"""Unit tests for the CodingStateGraph, Developer/Reviewer Nodes, and HITL Escalation Store."""

from __future__ import annotations

import json
import os
import tempfile
from unittest.mock import MagicMock
import pytest

from tools.agent_runner.hitl_proxy import EscalationStore
from tools.agent_runner.models import AgentConfig, ExecutionResult, LinearIssue
from tools.agent_runner.sandbox_provisioner import EphemeralSandbox
from tools.agent_runner.state_graph import CodingStateGraph, DeveloperNode, ReviewerNode
from tools.agent_runner.verifier import VerificationOutcome


def test_coding_state_graph_routing_and_hitl_breakpoint():
    dev_cfg = AgentConfig(name="developer", label="agent:dev", cmd=["echo", "dev"])
    rev_cfg = AgentConfig(name="reviewer", label="agent:qa", cmd=["echo", "qa"])

    mock_adapter = MagicMock()
    mock_adapter.run.return_value = ExecutionResult(
        agent_name="developer",
        ticket_identifier="PIX-101",
        success=True,
        output="Code written",
        git_diff_summary="M file.ts",
    )

    mock_verifier = MagicMock()
    # First 2 attempts fail verification, 3rd passes
    mock_verifier.verify.side_effect = [
        VerificationOutcome(passed=False, summary="Test failed: expected 200 got 500", command_results=[]),
        VerificationOutcome(passed=False, summary="Test failed: type error", command_results=[]),
        VerificationOutcome(passed=True, summary="All tests passed", command_results=[]),
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        esc_db = os.path.join(tmpdir, "escalations.db")
        esc_store = EscalationStore(db_path=esc_db)

        graph = CodingStateGraph(
            developer_cfg=dev_cfg,
            reviewer_cfg=rev_cfg,
            verifier=mock_verifier,
            max_iterations=5,
            escalation_store=esc_store,
        )
        graph.developer_node.adapter = mock_adapter

        issue = LinearIssue(
            id="1",
            identifier="PIX-101",
            title="Implement User Auth Endpoint",
            description="Add JWT authentication",
        )

        state = graph.initialize_state(issue, max_iterations=5)
        final_state, history = graph.run_graph_loop(state, workdir=tmpdir)

        assert final_state["status"] == "approved"
        assert final_state["iteration_count"] == 3
        assert len(final_state["reviewer_feedback"]) == 3
        assert "VERIFICATION APPROVED" in final_state["reviewer_feedback"][-1]


def test_hitl_escalation_store_resolution():
    with tempfile.TemporaryDirectory() as tmpdir:
        esc_db = os.path.join(tmpdir, "escalations.db")
        store = EscalationStore(db_path=esc_db)

        dummy_state = {
            "task_id": "PIX-999",
            "task_description": "Fix complex bug",
            "file_paths": ["src/index.ts"],
            "current_code": "const x = 1;",
            "reviewer_feedback": ["Error: Infinite loop in worker"],
            "iteration_count": 5,
            "max_iterations": 5,
            "status": "escalated",
            "active_agent": "developer",
            "developer_agent": "developer",
            "reviewer_agent": "reviewer",
            "escalation_id": None,
            "metadata": {},
        }

        esc_id = store.create_escalation(dummy_state)  # type: ignore[arg-type]
        pending = store.get_pending_escalations()
        assert len(pending) == 1
        assert pending[0]["id"] == esc_id

        # Human operator injects hint
        resolved_state = store.resolve_escalation(esc_id, action="hint", hint="Use setTimeout to debounce worker")
        assert resolved_state is not None
        assert resolved_state["status"] == "in_progress"
        assert "SYSTEM OVERRIDE: Use setTimeout to debounce worker" in resolved_state["reviewer_feedback"][-1]

        # Ensure no more pending
        assert len(store.get_pending_escalations()) == 0


def test_ephemeral_sandbox_lifecycle():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Init dummy git repo in tmpdir
        os.system(f"git init {tmpdir} -q")
        os.system(f"touch {tmpdir}/README.md && git -C {tmpdir} add . && git -C {tmpdir} commit -m 'init' -q")

        sandbox = EphemeralSandbox(task_id="PIX-SB-1", base_repo=tmpdir)
        sb_path = sandbox.provision()
        assert os.path.exists(sb_path)

        # Inject file
        sandbox.inject_file("src/hello.txt", "Hello from Sandbox!")
        assert os.path.exists(os.path.join(sb_path, "src/hello.txt"))

        # Execute isolated command
        res = sandbox.execute_command("cat src/hello.txt")
        assert res.exit_code == 0
        assert "Hello from Sandbox!" in res.stdout

        sandbox.teardown(delete_branch=True)
