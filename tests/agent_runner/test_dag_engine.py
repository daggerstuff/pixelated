"""Unit tests for DAGEngine."""

from unittest.mock import MagicMock

from tools.agent_runner.dag_engine import DAGEngine


def test_parse_task_graph():
    text = """
Here is the architectural plan:

TASK_GRAPH:
- id: 1, phase: 1, title: Setup Database Schema, agent: opencode, priority: 1, labels: [db], depends: []
- id: 2, phase: 2, title: Implement Auth Endpoints, agent: agy, priority: 1, labels: [security], depends: [1]
- id: 3, phase: 3, title: Add Vitest Integration Tests, agent: agy, priority: 2, depends: [1, 2]
"""
    nodes = DAGEngine.parse_task_graph(text)
    assert len(nodes) == 3
    assert nodes[0].key == "1"
    assert nodes[0].title == "Setup Database Schema"
    assert nodes[0].agent_label == "agent:opencode"
    assert nodes[0].dependencies == []
    assert nodes[1].key == "2"
    assert nodes[1].dependencies == ["1"]
    assert nodes[2].key == "3"
    assert nodes[2].dependencies == ["1", "2"]


def test_dependency_satisfaction():
    mock_client = MagicMock()
    mock_client.get_issue_comments.return_value = ("dep-id-1", [])
    mock_client.execute_gql.return_value = {"issue": {"state": {"name": "Done"}}}

    satisfied = DAGEngine.is_dependency_satisfied(["PIX-1"], mock_client, "PIX")
    assert satisfied is True

    mock_client.execute_gql.return_value = {"issue": {"state": {"name": "In Progress"}}}
    not_satisfied = DAGEngine.is_dependency_satisfied(["PIX-1"], mock_client, "PIX")
    assert not_satisfied is False
