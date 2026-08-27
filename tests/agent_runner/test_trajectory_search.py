"""Unit tests for TrajectorySearchEngine."""

from tools.agent_runner.trajectory_search import TrajectoryCandidate, TrajectorySearchEngine


def test_calculate_utility():
    engine = TrajectorySearchEngine()
    c1 = TrajectoryCandidate("c1", "opencode", "Plan 1", verification_score=0.9, guardrail_score=1.0, cost_estimate=1.0)
    c2 = TrajectoryCandidate("c2", "claude", "Plan 2", verification_score=0.4, guardrail_score=0.5, cost_estimate=5.0)

    u1 = engine.calculate_utility(c1)
    u2 = engine.calculate_utility(c2)
    assert u1 > u2

    best = engine.select_best_trajectory([c1, c2])
    assert best == c1
