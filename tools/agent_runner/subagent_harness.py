"""Sub-agent hierarchy and task delegation manager."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from tools.agent_runner.adapters import get_agent_adapter
from tools.agent_runner.models import AgentConfig, ExecutionResult

logger = logging.getLogger("agent_runner.subagent")


@dataclass
class DelegationResult:
    target_agent: str
    subtask_prompt: str
    execution_result: ExecutionResult


class SubAgentHarness:
    """Manages spawning child/sub-agent instances for delegated subtasks."""

    def __init__(self, available_agents: list[AgentConfig]):
        self.available_agents = {a.name.lower(): a for a in available_agents}

    def delegate_subtask(
        self,
        target_agent_name: str,
        subtask_prompt: str,
        workdir: str,
        parent_ticket: str,
    ) -> DelegationResult | None:
        """Spawn a subagent to handle a scoped subtask directive."""
        agent_cfg = self.available_agents.get(target_agent_name.lower())
        if not agent_cfg:
            logger.warning("Target subagent '%s' not found in available agents.", target_agent_name)
            return None

        logger.info("Spawning subagent '%s' for subtask on %s...", agent_cfg.name, parent_ticket)
        adapter = get_agent_adapter(agent_cfg)
        result = adapter.run(
            prompt=subtask_prompt,
            workdir=workdir,
            ticket_identifier=f"{parent_ticket}-sub-{target_agent_name}",
            enable_branching=False,
        )

        return DelegationResult(
            target_agent=agent_cfg.name,
            subtask_prompt=subtask_prompt,
            execution_result=result,
        )
