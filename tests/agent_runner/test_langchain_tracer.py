"""Unit tests for LangChainAgentTracer."""

import os
import tempfile

from tools.agent_runner.langchain_tracer import LangChainAgentTracer
from tools.agent_runner.models import AgentConfig, ExecutionResult, LinearIssue, ProjectConfig
from tools.agent_runner.verifier import VerificationOutcome


def test_langchain_tracer_full_lifecycle():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tracer = LangChainAgentTracer(enabled=True, traces_dir=tmp_dir)

        proj = ProjectConfig(team_key="PIX", default_repo="main")
        agent = AgentConfig(name="opencode", label="agent:opencode", cmd=["opencode"])
        issue = LinearIssue(id="1", identifier="PIX-10", title="Build Feature")

        # 1. Start tick
        tick_tree = tracer.start_tick_trace("srv:box", [proj])

        # 2. Start ticket
        ticket_tree = tracer.start_ticket_execution_trace(tick_tree, proj, agent, issue)

        # 3. Record retrieval
        tracer.record_retrieval(ticket_tree, "Build Feature", "Context text", [("skill-1", "desc")])

        # 4. Record agent CLI
        exec_res = ExecutionResult(success=True, agent_name="opencode", ticket_identifier="PIX-10", output="Done")
        tracer.record_agent_cli(ticket_tree, agent, "Prompt text", exec_res)

        # 5. Record verification
        verif = VerificationOutcome(passed=True, summary="All passed")
        tracer.record_verification(ticket_tree, verif)

        # 6. End ticket
        tracer.end_ticket_execution_trace(ticket_tree, exec_res)

        # 7. End tick
        tracer.end_tick_trace(tick_tree, {"processed": 1})

        # Verify trace files were written
        trace_files = os.listdir(tmp_dir)
        assert len(trace_files) >= 1
