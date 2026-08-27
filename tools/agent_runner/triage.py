"""Auto-triage engine for unassigned Linear tickets with role, capability matching, and Omni-Triage."""

from __future__ import annotations

import logging
import os

from tools.agent_runner.client import LinearClient
from tools.agent_runner.models import AgentConfig, LinearIssue, ProjectConfig, RunnerConfig, TriageRule
from tools.agent_runner.state_manager import StateManager

logger = logging.getLogger("agent_runner.triage")


class AutoTriageEngine:
    """Intelligently routes unassigned triage & ready tickets to appropriate agents, roles, and servers."""

    def __init__(self, client: LinearClient, config: RunnerConfig, state_mgr: StateManager):
        self.client = client
        self.config = config
        self.state_mgr = state_mgr

    def get_ticket_agents(self) -> list[AgentConfig]:
        """Return all agents that work on tickets (excluding watchers/skeptics)."""
        return [a for a in self.config.agents if a.watch != "coordination"]

    def _match_triage_rule(self, full_text: str, agent_pool: list[AgentConfig], rule: TriageRule) -> AgentConfig | None:
        if rule.required_role:
            for agent in agent_pool:
                if agent.role == rule.required_role and any(kw.lower() in full_text for kw in rule.keywords):
                    logger.info("Triage role matched '%s' -> assigned to %s", rule.required_role.value, agent.name)
                    return agent

        for kw in rule.keywords:
            if kw.lower() in full_text:
                for agent in agent_pool:
                    if agent.name.lower() == rule.preferred_agent.lower():
                        logger.info("Triage rule matched keyword '%s' -> assigned to %s", kw, agent.name)
                        return agent
        return None

    def _match_agent_capability(self, full_text: str, agent_pool: list[AgentConfig]) -> AgentConfig | None:
        for agent in agent_pool:
            for cap in agent.capabilities:
                if cap.lower() in full_text:
                    logger.info("Capability matched '%s' -> assigned to %s", cap, agent.name)
                    return agent
        return None

    def select_agent_for_issue(self, issue: LinearIssue, agent_pool: list[AgentConfig]) -> AgentConfig:
        """Select best agent for issue based on role rules, keywords, capabilities, or round-robin."""
        full_text = f"{issue.title} {issue.description} {' '.join(issue.labels)}".lower()

        # 1. Check explicit triage rules
        for rule in self.config.triage_rules:
            matched = self._match_triage_rule(full_text, agent_pool, rule)
            if matched:
                return matched

        # 2. Check agent capabilities
        cap_matched = self._match_agent_capability(full_text, agent_pool)
        if cap_matched:
            return cap_matched

        # 3. Fallback: Round-Robin
        idx = self.state_mgr.get_and_advance_rr_index(len(agent_pool))
        return agent_pool[idx]

    def _triage_single_issue(
        self,
        issue: LinearIssue,
        team_id: str,
        agent_pool: list[AgentConfig],
        ready_state_id: str,
        from_triage: bool,
    ) -> bool:
        """Assign agent and server labels to an unassigned issue."""
        agent = self.select_agent_for_issue(issue, agent_pool)
        agent_label_id = self.client.get_or_create_label(team_id, agent.label)
        self.client.add_label_to_issue(issue.id, agent_label_id)

        server_label = self.config.server_label
        if server_label:
            srv_label_id = self.client.get_or_create_label(team_id, server_label)
            self.client.add_label_to_issue(issue.id, srv_label_id)

        if from_triage:
            self.client.set_issue_state(issue.id, ready_state_id)

        host_name = os.uname().nodename
        comment_body = (
            f"🤖 **Auto-Triage Dispatch (Omni-Triage)**\n\n"
            f"- **Assigned Agent:** `{agent.name}` (`{agent.label}` - Role: `{agent.role.value}`)\n"
            f"- **Server Affinity:** `{server_label}` ({host_name})\n"
            f"- **Target Queue:** `{self.config.ready_state}`\n"
        )
        self.client.post_comment(issue.id, comment_body)
        self.state_mgr.increment_metric("total_triaged")

        logger.info(
            "Triaged %s ('%s') -> %s (%s) on %s",
            issue.identifier,
            issue.title,
            agent.name,
            agent.role.value,
            server_label,
        )
        return True

    def process_triage_for_project(self, project: ProjectConfig) -> int:
        """Process unassigned triage tickets and unassigned ready tickets for a specific project."""
        team = self.client.resolve_team(project.team_key)
        agent_pool = self.get_ticket_agents()
        if not agent_pool:
            logger.warning("No ticket agents configured for triage.")
            return 0

        ready_state_id = team.states.get(self.config.ready_state)
        if not ready_state_id:
            logger.error(
                "Ready state '%s' not found for team %s",
                self.config.ready_state,
                project.team_key,
            )
            return 0

        triaged_count = 0

        # 1. Process issues in Triage state
        triage_issues = self.client.get_issues_by_state_and_label(
            team_key=project.team_key,
            state_name=self.config.triage_state,
            limit=25,
        )
        for issue in triage_issues:
            if not any(lbl.startswith("agent:") for lbl in issue.labels) and self._triage_single_issue(
                issue, team.id, agent_pool, ready_state_id, from_triage=True
            ):
                triaged_count += 1

        # 2. Omni-Triage: Also process unassigned issues sitting in Todo / Ready state
        todo_issues = self.client.get_issues_by_state_and_label(
            team_key=project.team_key,
            state_name=self.config.ready_state,
            limit=25,
        )
        for issue in todo_issues:
            if "coordination" in issue.labels:
                continue
            if not any(lbl.startswith("agent:") for lbl in issue.labels) and self._triage_single_issue(
                issue, team.id, agent_pool, ready_state_id, from_triage=False
            ):
                triaged_count += 1

        # 3. Omni-Triage: Also process unassigned issues sitting in Backlog state
        if self.config.backlog_state and self.config.backlog_state in team.states:
            backlog_issues = self.client.get_issues_by_state_and_label(
                team_key=project.team_key,
                state_name=self.config.backlog_state,
                limit=25,
            )
            for issue in backlog_issues:
                if "coordination" in issue.labels:
                    continue
                if not any(lbl.startswith("agent:") for lbl in issue.labels) and self._triage_single_issue(
                    issue, team.id, agent_pool, ready_state_id, from_triage=True
                ):
                    triaged_count += 1

        return triaged_count
