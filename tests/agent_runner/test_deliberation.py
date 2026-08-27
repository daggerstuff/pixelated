"""Unit tests for DeliberationEngine."""

from tools.agent_runner.deliberation import DeliberationEngine


def test_deliberation_consensus_flow():
    delib = DeliberationEngine(approval_threshold=0.6)
    prop = delib.register_proposal("PROP-1", "Upgrade Fastify", "Replace Express", "claude")
    assert prop.status == "OPEN"

    delib.record_vote("PROP-1", "opencode", "APPROVE", "Better perf")
    delib.record_vote("PROP-1", "agy", "APPROVE", "Tested clean")
    delib.record_vote("PROP-1", "fx", "APPROVE", "Refactor is ready")

    status = delib.evaluate_consensus("PROP-1", total_agents=4)
    assert status == "APPROVED"


def test_deliberation_skeptic_veto():
    delib = DeliberationEngine(approval_threshold=0.6)
    delib.register_proposal("PROP-2", "Drop Postgres Schema Check", "Speed up CI", "opencode")

    delib.record_vote("PROP-2", "opencode", "APPROVE")
    delib.record_vote("PROP-2", "fx", "APPROVE")
    delib.record_vote("PROP-2", "skeptic_agent", "REJECT", "Critical safety violation")

    status = delib.evaluate_consensus("PROP-2", total_agents=4)
    assert status == "REJECTED"
