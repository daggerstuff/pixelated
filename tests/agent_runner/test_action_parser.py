"""Unit tests for ActionParser."""

from tools.agent_runner.action_parser import ActionParser
from tools.agent_runner.models import ActionType


def test_parse_create_ticket():
    text = """
Here is my analysis.
CREATE TICKET: Add OAuth2 Provider | Implement PKCE auth flow for EHR | labels: security, auth | priority: 1 | agent: claude
RESULT: Task created successfully.
"""
    actions = ActionParser.parse_actions(text)
    assert len(actions) == 2
    assert actions[0].action_type == ActionType.CREATE_TICKET
    assert actions[0].title == "Add OAuth2 Provider"
    assert "Implement PKCE" in actions[0].content
    assert actions[0].labels == ["security", "auth"]
    assert actions[0].priority == 1
    assert actions[0].target_agent == "claude"
    assert actions[1].action_type == ActionType.RESULT


def test_parse_subtask_and_broadcast():
    text = """
SUBTASK: Run DB Migration | Apply postgres schema migrations
BROADCAST: Migration completed successfully across all nodes.
STORE MEMORY: decision | Neon DB pooler configured for production.
PROPOSE: Adopt Fastify | Replace Express with Fastify for 3x throughput
VOTE: PROP-101 | APPROVE | Thoroughly tested benchmarks
"""
    actions = ActionParser.parse_actions(text)
    assert len(actions) == 5
    assert actions[0].action_type == ActionType.SUBTASK
    assert actions[1].action_type == ActionType.BROADCAST
    assert actions[2].action_type == ActionType.STORE_MEMORY
    assert actions[3].action_type == ActionType.PROPOSE
    assert actions[4].action_type == ActionType.VOTE
    assert actions[4].extra["decision"] == "APPROVE"
