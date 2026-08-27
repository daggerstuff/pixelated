"""Unit tests for SpecProjectInitializer."""

from unittest.mock import MagicMock

from tools.agent_runner.models import AgentConfig, AgentRole, ExecutionResult, LinearTeam, RunnerConfig
from tools.agent_runner.project_initializer import SpecProjectInitializer


def test_project_initializer_deliberative_flow(monkeypatch):
    mock_client = MagicMock()
    mock_client.resolve_team.return_value = LinearTeam(
        id="team-1", key="PIX", name="Pixelated", states={"Todo": "state-todo", "Triage": "state-triage"}
    )
    mock_client.create_project.return_value = {
        "id": "proj-100",
        "name": "EHR Audit Initiative",
        "url": "https://linear.app/pix/project/ehr-audit-100",
    }
    mock_client.get_or_create_label.side_effect = lambda _tid, lbl: f"lbl-{lbl}"

    created_counter = 0

    def mock_create_issue(team_id, title, description="", state_id=None, extra=None):
        _ = (team_id, state_id, extra)
        nonlocal created_counter
        created_counter += 1
        return MagicMock(
            id=f"iss-{created_counter}",
            identifier=f"PIX-{created_counter}",
            title=title,
            description=description,
            url=f"https://linear.app/pix/issue/PIX-{created_counter}",
            labels=[],
        )

    mock_client.create_issue.side_effect = mock_create_issue

    arch_draft = """
TASK_GRAPH:
- id: 1, phase: 1, title: Audit FHIR Endpoints, agent: opencode, priority: 1, labels: [security], depends: []
- id: 2, phase: 2, title: Add End-to-End EHR Tests, agent: agy, priority: 2, labels: [qa], depends: [1]

### Task 1: Audit FHIR Endpoints
- Phase: Phase 1
- Complexity: M
- Target Files: apps/web/src/fhir.ts
- Description: Audit endpoints for RBAC
- Acceptance Criteria: All endpoints tested
- Verification: uv run pytest

### Task 2: Add End-to-End EHR Tests
- Phase: Phase 2
- Complexity: L
- Target Files: tests/e2e/ehr.spec.ts
- Description: Add test coverage
- Acceptance Criteria: Coverage > 90%
- Verification: pnpm vitest
"""
    skeptic_critique = """
1. Missing DB migration rollback test.
2. Ensure token expiration is tested.
"""
    arch_final = arch_draft + "\n# Hardened with critique"

    mock_arch_adapter = MagicMock()
    mock_arch_adapter.run.side_effect = [
        ExecutionResult(success=True, agent_name="arch", ticket_identifier="Plan-Init", output=arch_draft),
        ExecutionResult(success=True, agent_name="arch", ticket_identifier="Plan-Final", output=arch_final),
    ]

    mock_skeptic_adapter = MagicMock()
    mock_skeptic_adapter.run.return_value = ExecutionResult(
        success=True, agent_name="skeptic", ticket_identifier="Plan-RedTeam", output=skeptic_critique
    )

    def adapter_factory(agent):
        if agent.role == AgentRole.ARCHITECT:
            return mock_arch_adapter
        return mock_skeptic_adapter

    monkeypatch.setattr(
        "tools.agent_runner.project_initializer.get_agent_adapter",
        adapter_factory,
    )

    cfg = RunnerConfig(
        server_label="srv:test",
        agents=[
            AgentConfig(name="arch", label="agent:arch", cmd=["arch"], role=AgentRole.ARCHITECT),
            AgentConfig(name="skeptic", label="agent:skeptic", cmd=["skeptic"], role=AgentRole.SKEPTIC),
        ],
    )

    initializer = SpecProjectInitializer(mock_client, cfg)
    res = initializer.initialize_from_spec(
        spec_content="Feature spec for EHR audit",
        project_name="EHR Audit Initiative",
        team_key="PIX",
        options={"enable_deliberation": True},
    )

    assert res.project_id == "proj-100"
    assert res.project_name == "EHR Audit Initiative"
    assert len(res.created_issues) == 2
    assert "Audit FHIR Endpoints" in res.created_issues[0].title
    assert "Add End-to-End EHR Tests" in res.created_issues[1].title
    assert res.meta_issue.identifier.startswith("PIX-")
    assert "```mermaid" in res.mermaid_diagram
    assert "subgraph" in res.mermaid_diagram
    assert "PIX-1 --> PIX-2" in res.mermaid_diagram
    assert "Deliberative Planning Record" in res.deliberation_summary


def test_project_initializer_dry_run(monkeypatch):
    mock_client = MagicMock()
    mock_client.resolve_team.return_value = LinearTeam(
        id="team-1", key="PIX", name="Pixelated", states={"Todo": "state-todo"}
    )

    arch_output = """
TASK_GRAPH:
- id: 1, phase: 1, title: Setup Database Schema, agent: opencode, priority: 1, labels: [db], depends: []
"""
    mock_adapter = MagicMock()
    mock_adapter.run.return_value = ExecutionResult(
        success=True, agent_name="opencode", ticket_identifier="Init", output=arch_output
    )

    monkeypatch.setattr(
        "tools.agent_runner.project_initializer.get_agent_adapter",
        lambda _agent: mock_adapter,
    )

    cfg = RunnerConfig(
        server_label="srv:test",
        agents=[AgentConfig(name="opencode", label="agent:opencode", cmd=["opencode"], role=AgentRole.ARCHITECT)],
    )

    initializer = SpecProjectInitializer(mock_client, cfg)
    res = initializer.initialize_from_spec(
        spec_content="Database setup spec",
        project_name="DB Setup",
        team_key="PIX",
        options={"enable_deliberation": False, "dry_run": True},
    )

    assert res.is_dry_run is True
    assert len(res.created_issues) == 1
    assert res.created_issues[0].identifier == "PREVIEW-1"
    mock_client.create_project.assert_not_called()
    mock_client.create_issue.assert_not_called()
