"""Trajectory search and multi-path evaluation for complex ticket resolution."""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger("agent_runner.trajectory")


@dataclass
class TrajectoryCandidate:
    candidate_id: str
    agent_name: str
    plan_summary: str
    verification_score: float = 0.0
    guardrail_score: float = 1.0
    cost_estimate: float = 1.0
    total_utility: float = 0.0


class TrajectorySearchEngine:
    """Evaluates candidate execution paths and selects the optimal path."""

    @staticmethod
    def calculate_utility(candidate: TrajectoryCandidate) -> float:
        """Calculate weighted utility score for a trajectory candidate."""
        # 60% verification proof, 30% guardrail safety, 10% efficiency
        utility = (
            (candidate.verification_score * 0.60)
            + (candidate.guardrail_score * 0.30)
            + (max(0.0, 1.0 - (candidate.cost_estimate / 10.0)) * 0.10)
        )
        candidate.total_utility = utility
        return utility

    def select_best_trajectory(self, candidates: list[TrajectoryCandidate]) -> TrajectoryCandidate | None:
        """Rank and select candidate with highest utility."""
        if not candidates:
            return None
        for c in candidates:
            self.calculate_utility(c)
        return max(candidates, key=lambda c: c.total_utility)
