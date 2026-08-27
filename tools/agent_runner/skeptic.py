"""Skeptic reviewer monitoring coordination threads and spawning adversarial challenge tickets."""

from __future__ import annotations

import logging
import os

from tools.agent_runner.action_parser import ActionParser
from tools.agent_runner.adapters import get_agent_adapter
from tools.agent_runner.client import LinearClient
from tools.agent_runner.models import ActionType, AgentConfig, AgentRole, ProjectConfig, RunnerConfig
from tools.agent_runner.personas import get_role_prompt
from tools.agent_runner.state_manager import StateManager

logger = logging.getLogger("agent_runner.skeptic")

SKEPTIC_PROMPT_TEMPLATE = """You are the Senior Skeptic & Adversarial Critic agent.
Your mission is to continuously challenge architectural plans, code changes, and assumptions.

{role_guidelines}

COORDINATION & DISCUSSION THREAD (Team {team_key}):
{thread_content}

YOUR AUDIT MANDATE:
1. Scan recent comments for unaddressed edge cases, missing migration plans, security vulnerabilities, or single points of failure.
2. If you identify valid gaps, challenge them directly and declare actionable tickets for the team:
   CREATE TICKET: <title> | <detailed description of gap and required fix> | labels: <security/architecture/qa> | priority: <1/2>
3. If everything is sound and robust, conclude with:
   RESULT: All recent proposals and architectural changes verified without critical gaps.
"""


class SkepticReviewer:
    """Monitors coordination threads and spawns actionable challenge tickets."""

    def __init__(self, client: LinearClient, config: RunnerConfig, state_mgr: StateManager):
        self.client = client
        self.config = config
        self.state_mgr = state_mgr

    def process_skeptic_for_project(self, project: ProjectConfig, skeptic_agent: AgentConfig) -> int:
        """Review coordination comments and spawn tickets if gaps are detected."""
        coord_identifier = project.coordination_ticket
        if not coord_identifier:
            return 0

        team = self.client.resolve_team(project.team_key)
        try:
            _issue_id, comments = self.client.get_issue_comments(coord_identifier, limit=20)
        except Exception as e:
            logger.warning("Could not fetch coordination comments for %s: %s", project.team_key, e)
            return 0

        if not comments:
            return 0

        last_seen_id = self.state_mgr.get_last_skeptic_comment_id(project.team_key)
        latest_comment = comments[-1]
        if last_seen_id == latest_comment.id:
            return 0

        # Filter recent comments after last seen
        recent_comments = []
        found_last = last_seen_id is None
        for c in comments:
            if found_last:
                recent_comments.append(c)
            elif c.id == last_seen_id:
                found_last = True

        if not recent_comments:
            recent_comments = comments[-5:]

        thread_text = "\n".join([f"[{c.created_at[:19]}] {c.author_name}: {c.body}" for c in recent_comments])
        role_prompt = skeptic_agent.system_prompt_override or get_role_prompt(AgentRole.SKEPTIC)
        prompt = SKEPTIC_PROMPT_TEMPLATE.format(
            role_guidelines=role_prompt,
            team_key=project.team_key,
            thread_content=thread_text,
        )

        workdir = project.repos.get(project.default_repo) or os.getcwd()
        adapter = get_agent_adapter(skeptic_agent)

        logger.info(
            "Skeptic '%s' reviewing %d fresh comments on %s (%s)...",
            skeptic_agent.name,
            len(recent_comments),
            project.team_key,
            coord_identifier,
        )
        result = adapter.run(
            prompt=prompt,
            workdir=workdir,
            ticket_identifier=f"Skeptic-{project.team_key}",
            enable_branching=False,
        )

        spawned_count = 0
        triage_or_todo = team.states.get(self.config.triage_state) or team.states.get(self.config.ready_state)
        parsed_actions = result.actions or ActionParser.parse_actions(result.output)

        for action in parsed_actions:
            if action.action_type == ActionType.CREATE_TICKET:
                labels = list(action.labels)
                if "skeptic" not in labels:
                    labels.append("skeptic")
                label_ids = [self.client.get_or_create_label(team.id, lbl) for lbl in labels]

                desc = f"{action.content}\n\n*Created by Skeptic Critic `{skeptic_agent.name}` from review on {coord_identifier}.*"
                self.client.create_issue(
                    team_id=team.id,
                    title=f"[Skeptic Review] {action.title}",
                    description=desc,
                    state_id=triage_or_todo,
                    extra={"label_ids": label_ids, "priority": action.priority or 2},
                )
                spawned_count += 1
                logger.info("Skeptic spawned challenge ticket: '%s'", action.title)

        self.state_mgr.set_last_skeptic_comment_id(project.team_key, latest_comment.id)
        self.state_mgr.increment_metric("skeptic_reviews")
        return spawned_count
