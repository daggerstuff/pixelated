"""Inter-agent consensus deliberation and voting protocol engine."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger("agent_runner.deliberation")


@dataclass
class Proposal:
    prop_id: str
    title: str
    description: str
    proposer: str
    created_at: str
    votes: dict[str, tuple[str, str]] = field(default_factory=dict)  # agent_name -> (APPROVE/REJECT, reason)
    status: str = "OPEN"  # OPEN, APPROVED, REJECTED


class DeliberationEngine:
    """Manages multi-agent proposals, votes, consensus tallying, and skeptic vetoes."""

    def __init__(self, approval_threshold: float = 0.6):
        self.approval_threshold = approval_threshold
        self._proposals: dict[str, Proposal] = {}

    def register_proposal(
        self, prop_id: str, title: str, description: str, proposer: str, created_at: str = ""
    ) -> Proposal:
        """Register a new proposal from an agent."""
        prop = Proposal(
            prop_id=prop_id,
            title=title,
            description=description,
            proposer=proposer,
            created_at=created_at or datetime.now(timezone.utc).isoformat(),
        )
        self._proposals[prop_id] = prop
        logger.info("Registered proposal [%s] '%s' by %s", prop_id, title, proposer)
        return prop

    def record_vote(self, prop_id: str, voter: str, decision: str, reason: str = "") -> bool:
        """Record an agent's vote on a proposal."""
        prop = self._proposals.get(prop_id)
        if not prop or prop.status != "OPEN":
            return False

        prop.votes[voter] = (decision.upper(), reason)
        logger.info("Recorded vote on [%s] by %s: %s (%s)", prop_id, voter, decision.upper(), reason[:60])
        return True

    def evaluate_consensus(self, prop_id: str, total_agents: int) -> str:
        """Tally votes, apply skeptic vetoes, and determine consensus status."""
        prop = self._proposals.get(prop_id)
        if not prop:
            return "UNKNOWN"

        approves = sum(1 for dec, _ in prop.votes.values() if dec == "APPROVE")
        rejects = sum(1 for dec, _ in prop.votes.values() if dec == "REJECT")

        # Check for skeptic veto
        for voter, (dec, reason) in prop.votes.items():
            if "skeptic" in voter.lower() and dec == "REJECT":
                prop.status = "REJECTED"
                logger.warning("Proposal [%s] VETOED by skeptic %s: %s", prop_id, voter, reason)
                return "REJECTED"

        if total_agents > 0 and (approves / total_agents) >= self.approval_threshold:
            prop.status = "APPROVED"
        elif total_agents > 0 and (rejects / total_agents) > (1.0 - self.approval_threshold):
            prop.status = "REJECTED"

        return prop.status
