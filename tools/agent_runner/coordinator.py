"""Main Multi-Agent Coordinator and Execution Engine (Full Autonomous Ecosystem)."""

from __future__ import annotations

import concurrent.futures
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from tools.agent_runner.client import LinearClient
from tools.agent_runner.cluster_registry import ClusterRegistry
from tools.agent_runner.compactor import ThreadCompactor
from tools.agent_runner.deliberation import DeliberationEngine
from tools.agent_runner.event_bus import EventBus, EventType
from tools.agent_runner.execution_harness import AgentExecutionHarness
from tools.agent_runner.foresight_bridge import ForesightBridge
from tools.agent_runner.guardrails import GuardrailsEngine
from tools.agent_runner.langchain_tracer import LangChainAgentTracer
from tools.agent_runner.lineage import LineageTracker
from tools.agent_runner.loop_auditor import WorkLoopAuditor, WorkLoopAuditReport
from tools.agent_runner.models import (
    ActionType,
    AgentConfig,
    ExecutionResult,
    LinearIssue,
    LinearTeam,
    ProjectConfig,
    RunnerConfig,
)
from tools.agent_runner.personas import get_role_prompt
from tools.agent_runner.pr_bridge import PRCreationResult, PullRequestBridge
from tools.agent_runner.self_evolution import SelfEvolutionEngine
from tools.agent_runner.sensor_hooks import SensorHookEngine
from tools.agent_runner.skeptic import SkepticReviewer
from tools.agent_runner.skills_bridge import SkillsBridge
from tools.agent_runner.state_manager import StateManager
from tools.agent_runner.subagent_harness import SubAgentHarness
from tools.agent_runner.telemetry import TelemetryCollector
from tools.agent_runner.trace_analyzer import TraceAnalyzer
from tools.agent_runner.triage import AutoTriageEngine
from tools.agent_runner.verifier import VerificationEngine
from tools.agent_runner.worktree_pool import GitWorktreePool

logger = logging.getLogger("agent_runner.coordinator")

TICKET_PROMPT_TEMPLATE = """You are agent '{name}' on an autonomous multi-agent software engineering team.
Linear is our shared nervous system and single source of truth.

{role_guidelines}

PROJECT: {team_key}
REPOSITORY CHECKOUT: {workdir}
SERVER: {server_label} ({hostname})

TICKET {identifier}: {title}

DESCRIPTION:
{description}

{skills_context}

{foresight_context}

{lessons_context}

SHARED COORDINATION BLACKBOARD:
{coord_thread}

MANDATORY OPERATING RAILS & PROTOCOLS:
1. READ AGENTS.MD: Strictly adhere to `AGENTS.md` and repository guidelines in `{workdir}/AGENTS.md`.
2. SURGICAL & DIRECT EXECUTION: Work directly on target files. Avoid sprawling whole-repo file indexing or reading massive documentation files that trigger context exhaustion.
3. BLAST RADIUS CAP — CRITICAL: Your diff MUST touch ≤30 files for feature/fix tickets. For config-only or skeptic-review tickets, ≤10 files. If you find yourself editing >30 files, STOP, revert unrelated changes, and focus only on files directly required by the ticket. Breadth is NOT quality — surgical precision is.
4. SCOPED TYPECHECK: After code changes, run `pnpm typecheck 2>&1 | tail -30` to check only relevant errors. DO NOT run workspace-wide typecheck repeatedly for unrelated files. If errors appear in unrelated files, ignore them — only fix errors in files you modified.
5. NO HOLLOW / FAKE WORK: Implement real production classes, interfaces, and utilities. Never submit empty stubs or mocks testing only mocks.
6. STRICT ZERO-TOLERANCE ANTI-SUPPRESSION: No @ts-ignore, no @ts-nocheck, no # noqa, no # type: ignore, no /* eslint-disable */. Fix all underlying root causes.
7. PYTHON & LINT IDIOMS: For Python datetime handling, construct timezone-aware UTC datetimes (`datetime.now(timezone.utc)`) or use `datetime.fromisoformat()` for naive test cases to satisfy strict Ruff DTZ rules without `# noqa`.
8. TEST REAL CODE: Write and run real tests verifying your actual production implementation with pytest / vitest.
9. AUTO-FORMAT: Ensure all modified files adhere to Prettier and ruff/oxlint standards.
10. If this task creates follow-up work or subtasks, declare them using:
    CREATE TICKET: <title> | <description> | labels: <labels>
    or
    SUBTASK: <title> | <description>
11. If scoping complex multi-step work, declare a task graph:
    TASK_GRAPH:
    - id: 1, title: <step 1>, agent: <agent>
    - id: 2, title: <step 2>, agent: <agent>, depends: [1]
12. If delegating to a specialist sub-agent, use:
    DELEGATE: <agent_name> | <subtask directive>
13. If an architectural decision or fact was made, declare it using:
    STORE MEMORY: decision | <concise statement>
14. If you have an update or proposal for other agents, declare it using:
    BROADCAST: <message> or PROPOSE: <title> | <details>
15. Conclude with a final summary line:
    RESULT: <one concise sentence describing the outcome>
"""


@dataclass
class CoordinatorComponents:
    """Optional pluggable dependencies for MultiAgentCoordinator testing and custom harness setups."""

    state_mgr: StateManager | None = None
    event_bus: EventBus | None = None
    lineage_tracker: LineageTracker | None = None
    self_evolution: SelfEvolutionEngine | None = None


class MultiAgentCoordinator:
    """Orchestrates autonomous multi-agent swarms with LangChain tracing, worktree sandboxing, and DAGs."""

    def __init__(
        self,
        config: RunnerConfig,
        client: LinearClient,
        components: CoordinatorComponents | StateManager | None = None,
    ):
        if isinstance(components, StateManager):
            comps = CoordinatorComponents(state_mgr=components)
        else:
            comps = components or CoordinatorComponents()
        self.config = config
        self.client = client
        self.state_mgr = comps.state_mgr or StateManager()
        self.foresight = ForesightBridge(enabled=config.enable_foresight_memory)
        self.triage_engine = AutoTriageEngine(self.client, self.config, self.state_mgr)
        self.skeptic_reviewer = SkepticReviewer(self.client, self.config, self.state_mgr)
        self.guardrails = GuardrailsEngine(config.guardrails)
        self.verifier = VerificationEngine(config.verification)
        self.deliberation = DeliberationEngine()
        self.compactor = ThreadCompactor()
        self.worktree_pool = GitWorktreePool()
        self.pr_bridge = PullRequestBridge(enabled=config.enable_git_pr_creation)
        self.subagents = SubAgentHarness(config.agents)
        self.skills = SkillsBridge()
        self.cluster = ClusterRegistry(self.state_mgr, self.config)
        self.event_bus = comps.event_bus or EventBus()
        self.telemetry = TelemetryCollector()
        self.tracer = LangChainAgentTracer(
            project_name=config.langchain_project,
            enabled=config.enable_langchain_tracing,
        )
        self.loop_auditor = WorkLoopAuditor()
        self.sensor_engine = SensorHookEngine()
        self.trace_analyzer = TraceAnalyzer(config.langchain_project)
        self.lineage = comps.lineage_tracker or LineageTracker()
        self.evolution = comps.self_evolution or SelfEvolutionEngine(self.foresight, self.event_bus)
        self.harness = AgentExecutionHarness(
            config=config,
            foresight=self.foresight,
            tracer=self.tracer,
            event_bus=self.event_bus,
            self_evolution=self.evolution,
        )
        self._shutdown_requested = False

    def request_shutdown(self) -> None:
        """Signal graceful shutdown."""
        self._shutdown_requested = True
        logger.info("Shutdown requested. Finishing active tasks...")

    def resolve_workdir_for_issue(self, project: ProjectConfig, issue: LinearIssue) -> str:
        """Resolve local repository checkout path for an issue based on repo labels."""
        repo_name = project.default_repo
        for lbl in issue.labels:
            if lbl.startswith("repo:"):
                repo_name = lbl.split(":", 1)[1]
                break

        path = project.repos.get(repo_name) or project.repos.get(project.default_repo)
        if not path or not os.path.exists(path):
            raise FileNotFoundError(
                f"Local repo path for repo '{repo_name}' not found in project '{project.team_key}' config."
            )
        return os.path.abspath(path)

    def _format_ticket_prompt(
        self,
        agent: AgentConfig,
        project: ProjectConfig,
        issue: LinearIssue,
        workdir: str,
        coord_thread_digest: str,
    ) -> str:
        hostname = os.uname().nodename
        foresight_text = ""
        if self.config.enable_foresight_memory:
            relevant = self.foresight.get_relevant_context(f"{issue.title} {issue.description}")
            if relevant:
                foresight_text = f"ARCHITECTURAL MEMORY & CONTEXT:\n{relevant}"

        matching_skills = self.skills.find_matching_skills(f"{issue.title} {issue.description}")
        skills_text = ""
        if matching_skills:
            skill_lines = [f"- **{name}**: {desc}" for name, desc in matching_skills]
            skills_text = "RECOMMENDED LOCAL SKILLS:\n" + "\n".join(skill_lines)

        lessons_text = self.evolution.format_lessons_for_prompt(limit=5)
        role_prompt = agent.system_prompt_override or get_role_prompt(agent.role)

        return TICKET_PROMPT_TEMPLATE.format(
            name=agent.name,
            role_guidelines=role_prompt,
            team_key=project.team_key,
            workdir=workdir,
            server_label=self.config.server_label,
            hostname=hostname,
            identifier=issue.identifier,
            title=issue.title,
            description=issue.description or "(No description provided)",
            skills_context=skills_text,
            foresight_context=foresight_text,
            lessons_context=lessons_text,
            coord_thread=coord_thread_digest,
        )

    def _handle_execution_actions(
        self,
        result: ExecutionResult,
        project: ProjectConfig,
        agent: AgentConfig,
        issue: LinearIssue,
        action_ctx: dict[str, Any],
    ) -> None:
        team: LinearTeam = action_ctx["team"]
        workdir: str = action_ctx["workdir"]

        for action in result.actions:
            if action.action_type in (ActionType.CREATE_TICKET, ActionType.SUBTASK, ActionType.TASK_GRAPH):
                label_ids = [self.client.get_or_create_label(team.id, lbl_name) for lbl_name in action.labels]
                if action.target_agent:
                    agent_lbl_id = self.client.get_or_create_label(team.id, action.target_agent)
                    if agent_lbl_id not in label_ids:
                        label_ids.append(agent_lbl_id)

                triage_or_todo = team.states.get(self.config.triage_state) or team.states.get(self.config.ready_state)
                desc = (
                    f"{action.content}\n\n*Created by agent `{agent.name}` during [{issue.identifier}]({issue.url}).*"
                )
                if action.dependencies:
                    desc += f"\nDEPENDS_ON: {', '.join(action.dependencies)}"

                new_sub = self.client.create_issue(
                    team_id=team.id,
                    title=action.title,
                    description=desc,
                    state_id=triage_or_todo,
                    extra={
                        "label_ids": label_ids if label_ids else None,
                        "priority": action.priority or issue.priority or 2,
                    },
                )
                self.lineage.record_node(
                    new_sub.identifier,
                    "ticket",
                    new_sub.title,
                    metadata={"creator": agent.name, "parent": issue.identifier},
                    parent_id=issue.identifier,
                )
                self.event_bus.publish(
                    EventType.TICKET_DISPATCHED,
                    agent_name=agent.name,
                    ticket_identifier=new_sub.identifier,
                    server_label=self.config.server_label,
                    payload={"title": new_sub.title, "parent": issue.identifier},
                )
                logger.info("Spawned issue %s: '%s'", new_sub.identifier, new_sub.title)

            elif action.action_type == ActionType.DELEGATE and action.target_agent:
                delegation_res = self.subagents.delegate_subtask(
                    target_agent_name=action.target_agent,
                    subtask_prompt=action.content,
                    workdir=workdir,
                    parent_ticket=issue.identifier,
                )
                if delegation_res:
                    sub_comment = (
                        f"🤝 **Sub-Agent Delegation Result (`{delegation_res.target_agent}`)**:\n\n"
                        f"{delegation_res.execution_result.output}"
                    )
                    self.client.post_comment(issue.id, sub_comment)

            elif action.action_type == ActionType.BROADCAST:
                coord_ref = project.coordination_ticket
                if coord_ref:
                    coord_id, _ = self.client.get_issue_comments(coord_ref, limit=1)
                    clean_msg = self.guardrails.redact_secrets_and_phi(action.content)
                    broadcast_body = (
                        f"📢 **Broadcast from `{agent.name}`** (during work on [{issue.identifier}]({issue.url})):\n\n"
                        f"{clean_msg}"
                    )
                    self.client.post_comment(coord_id, broadcast_body)

            elif action.action_type == ActionType.PROPOSE:
                coord_ref = project.coordination_ticket
                if coord_ref:
                    coord_id, _ = self.client.get_issue_comments(coord_ref, limit=1)
                    prop_id = f"PROP-{int(time.time())}"
                    self.deliberation.register_proposal(
                        prop_id=prop_id,
                        title=action.title,
                        description=action.content,
                        proposer=agent.name,
                        created_at=datetime.now(timezone.utc).isoformat(),
                    )
                    self.event_bus.publish(
                        EventType.PROPOSAL_REGISTERED,
                        agent_name=agent.name,
                        ticket_identifier=issue.identifier,
                        server_label=self.config.server_label,
                        payload={"proposal_id": prop_id, "title": action.title},
                    )
                    msg = (
                        f"💡 **New Proposal [{prop_id}] from `{agent.name}`**:\n\n"
                        f"**{action.title}**\n{action.content}\n\n"
                        f"*Agents can vote using:* `VOTE: {prop_id} | APPROVE/REJECT | <reason>`"
                    )
                    self.client.post_comment(coord_id, msg)

            elif action.action_type == ActionType.STORE_MEMORY:
                self.foresight.store_decision(
                    category=action.title,
                    content=action.content,
                    ticket_ref=issue.identifier,
                )
                self.lineage.record_node(
                    f"MEM-{int(time.time())}",
                    "memory",
                    action.title,
                    metadata={"content": action.content},
                    parent_id=issue.identifier,
                )

    def _run_verification_and_repair(
        self,
        adapter: Any,
        workdir: str,
        issue: LinearIssue,
        agent: AgentConfig,
        initial_result: ExecutionResult,
    ) -> ExecutionResult:
        result = initial_result
        if not self.config.verification.enabled:
            return result

        outcome = self.verifier.run_checks(workdir)
        result.verification_passed = outcome.passed
        result.verification_logs = outcome.summary

        repair_attempts = 0
        while not outcome.passed and repair_attempts < self.config.verification.max_repair_attempts:
            repair_attempts += 1
            self.event_bus.publish(
                EventType.AUTO_REPAIR_TRIGGERED,
                agent_name=agent.name,
                ticket_identifier=issue.identifier,
                server_label=self.config.server_label,
                payload={"attempt": repair_attempts, "max": self.config.verification.max_repair_attempts},
            )
            logger.warning(
                "Verification failed on %s. Launching auto-repair loop (attempt %d/%d)...",
                issue.identifier,
                repair_attempts,
                self.config.verification.max_repair_attempts,
            )
            repair_prompt = self.verifier.generate_repair_prompt(agent.name, issue.identifier, outcome)
            repair_result = adapter.run(
                prompt=repair_prompt,
                workdir=workdir,
                ticket_identifier=f"{issue.identifier}-repair-{repair_attempts}",
                enable_branching=False,
            )
            outcome = self.verifier.run_checks(workdir)
            result = repair_result
            result.verification_passed = outcome.passed
            result.verification_logs = outcome.summary

        if not outcome.passed or repair_attempts > 0:
            self.evolution.process_execution_friction(issue, agent.name, result, repair_attempts)

        if outcome.passed:
            self.event_bus.publish(
                EventType.VERIFICATION_PASSED,
                agent_name=agent.name,
                ticket_identifier=issue.identifier,
                server_label=self.config.server_label,
            )
        else:
            self.event_bus.publish(
                EventType.VERIFICATION_FAILED,
                agent_name=agent.name,
                ticket_identifier=issue.identifier,
                server_label=self.config.server_label,
            )

        return result

    def _format_comment_blocks(
        self,
        result: ExecutionResult,
        agent: AgentConfig,
        pr_res: Any | None,
        audit_report: WorkLoopAuditReport | None = None,
    ) -> str:
        clean_output = self.guardrails.redact_secrets_and_phi(result.output)
        verification_status = "✅ Passed" if result.verification_passed else "❌ Failed"

        comment_parts = [
            f"### 🏁 Agent `{agent.name}` ({agent.role.value}) Execution Result",
            f"- **Execution:** {'✅ Succeeded' if result.success else '❌ Failed'} (Exit Code: `{result.exit_code}` in `{result.duration_seconds:.1f}s`)",
            f"- **Verification Gate:** {verification_status}",
        ]

        if audit_report:
            comment_parts.append(f"- **Work Loop Audit:** {audit_report.summary_badge}")

        if pr_res and pr_res.pr_url:
            comment_parts.append(f"- **Pull Request:** [{pr_res.pr_url}]({pr_res.pr_url})")

        comment_parts.extend(["", "#### Output / Findings:", clean_output])

        if audit_report:
            comment_parts.extend(["", "#### 📊 5-Dimension Work Loop Audit:", audit_report.markdown_table])

        if result.verification_logs:
            comment_parts.extend(["", "#### Verification Checks:", result.verification_logs])

        if result.git_diff_summary:
            comment_parts.extend(["", "#### Working Tree Changes:", result.git_diff_summary])

        if result.guardrail_violations:
            comment_parts.extend(
                ["", "⚠️ **Guardrail / Anti-Suppression Warnings:**"] + [f"- {v}" for v in result.guardrail_violations]
            )

        return "\n".join(comment_parts)

    def _finalize_ticket_state(
        self,
        issue: LinearIssue,
        team: LinearTeam,
        agent: AgentConfig,
        result: ExecutionResult,
        pr_res: PRCreationResult | None = None,
    ) -> None:
        done_state_id = team.states.get(self.config.done_state)
        has_file_changes = bool(result.git_diff_summary or (pr_res and pr_res.commit_sha))
        overall_success = (
            result.success
            and result.verification_passed
            and has_file_changes
            and (not result.guardrail_violations or not self.config.guardrails.anti_suppression_enforcement)
        )

        if overall_success and done_state_id:
            self.client.set_issue_state(issue.id, done_state_id)
            self.state_mgr.increment_metric("total_completed")
            self.event_bus.publish(
                EventType.TICKET_COMPLETED,
                agent_name=agent.name,
                ticket_identifier=issue.identifier,
                server_label=self.config.server_label,
            )
            logger.info("Moved %s to '%s'", issue.identifier, self.config.done_state)
        else:
            self.state_mgr.increment_metric("total_failed")
            self.event_bus.publish(
                EventType.TICKET_FAILED,
                agent_name=agent.name,
                ticket_identifier=issue.identifier,
                server_label=self.config.server_label,
            )
            if self.config.failed_state and self.config.failed_state in team.states:
                self.client.set_issue_state(issue.id, team.states[self.config.failed_state])

    def _post_ticket_claim(self, issue: LinearIssue, team: LinearTeam, agent: AgentConfig) -> None:
        hostname = os.uname().nodename
        active_state_id = team.states.get(self.config.active_state)
        if active_state_id:
            self.client.set_issue_state(issue.id, active_state_id)

        self.state_mgr.record_claim(issue.identifier, agent.name, self.config.server_label)
        claim_ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
        claim_msg = (
            f"⚡ **Claimed by Agent `{agent.name}`** ({agent.role.value}) on `{self.config.server_label}` ({hostname}) at `{claim_ts}` UTC.\n"
            f"Working on ticket in local repository checkout..."
        )
        self.client.post_comment(issue.id, claim_msg)
        self.event_bus.publish(
            EventType.TICKET_CLAIMED,
            agent_name=agent.name,
            ticket_identifier=issue.identifier,
            server_label=self.config.server_label,
        )

    def process_ticket(
        self,
        project: ProjectConfig,
        agent: AgentConfig,
        issue: LinearIssue,
        coord_thread_digest: str,
        parent_trace: Any | None = None,
    ) -> ExecutionResult:
        """Execute a single ticket with LangChain tracing, sensor hooks, worktree sandboxing, and audit scorecards."""
        team = self.client.resolve_team(project.team_key)

        ticket_trace = self.tracer.start_ticket_execution_trace(parent_trace, project, agent, issue)
        span = self.telemetry.start_span(agent.name, issue.identifier, {"role": agent.role.value})
        self.lineage.record_node(
            issue.identifier, "ticket", issue.title, {"agent": agent.name, "role": agent.role.value}
        )

        self._post_ticket_claim(issue, team, agent)

        raw_workdir = self.resolve_workdir_for_issue(project, issue)
        worktree_lease = None
        if self.config.enable_git_branching:
            worktree_lease = self.worktree_pool.acquire_worktree(raw_workdir, issue.identifier, agent.name)
            active_workdir = worktree_lease.worktree_path
            self.lineage.record_node(
                worktree_lease.branch_name,
                "worktree",
                f"Worktree for {issue.identifier}",
                parent_id=issue.identifier,
            )
        else:
            active_workdir = raw_workdir

        # Pre-Flight Sensors
        pre_flight = self.sensor_engine.run_pre_flight_checks(active_workdir, agent, issue)
        if pre_flight.warnings:
            logger.warning("Pre-flight warnings for %s: %s", issue.identifier, pre_flight.warnings)

        try:
            prompt = self._format_ticket_prompt(agent, project, issue, active_workdir, coord_thread_digest)
            matching_skills = self.skills.find_matching_skills(f"{issue.title} {issue.description}")
            self.tracer.record_retrieval(
                ticket_trace,
                query=f"{issue.title} {issue.description}",
                foresight_context=self.foresight.get_relevant_context(f"{issue.title} {issue.description}"),
                skills_matched=matching_skills,
            )

            # Execute through the rigorous 6-stage Execution Harness
            result, harness_report = self.harness.run_harness(
                agent_cfg=agent,
                issue=issue,
                workdir=active_workdir,
                prompt=prompt,
                parent_trace=ticket_trace,
            )

            # Post-Flight Sensors & Work Loop 5D Audit
            self.sensor_engine.run_post_flight_sensors(active_workdir)
            audit_report = harness_report.audit_report or self.loop_auditor.evaluate_execution(
                issue, result, is_sandboxed=bool(worktree_lease)
            )

            pr_res = None
            if worktree_lease and result.verification_passed:
                pr_res = self.pr_bridge.commit_and_create_pr(
                    worktree_path=active_workdir,
                    ticket_identifier=issue.identifier,
                    title=issue.title,
                    description=issue.description,
                    context={"agent_name": agent.name, "branch_name": worktree_lease.branch_name},
                )
                if pr_res and pr_res.pr_url:
                    self.lineage.record_node(
                        pr_res.pr_url,
                        "pr",
                        f"PR for {issue.identifier}",
                        parent_id=issue.identifier,
                    )

            comment_body = self._format_comment_blocks(result, agent, pr_res, audit_report)
            self.client.post_comment(issue.id, comment_body)

            action_ctx = {"team": team, "workdir": active_workdir}
            self._handle_execution_actions(result, project, agent, issue, action_ctx)
            self._finalize_ticket_state(issue, team, agent, result, pr_res=pr_res)

            self.telemetry.end_span(span, success=result.success, verification_passed=result.verification_passed)
            self.tracer.end_ticket_execution_trace(ticket_trace, result, {"pr_url": pr_res.pr_url if pr_res else ""})

            return result

        finally:
            self.state_mgr.remove_claim(issue.identifier)
            if worktree_lease:
                self.worktree_pool.release_worktree(worktree_lease)

    def _resolve_project_coord_digest(self, project: ProjectConfig) -> str:
        coord_ref = project.coordination_ticket
        if not coord_ref:
            try:
                coord_ref = self.client.find_or_create_coordination_ticket(
                    team_key=project.team_key,
                    title=project.coordination_title,
                    create_if_missing=project.auto_create_coordination_ticket,
                )
                project.coordination_ticket = coord_ref
            except Exception as e:
                logger.warning("Could not resolve coordination ticket for %s: %s", project.team_key, e)

        coord_comments = []
        if coord_ref:
            try:
                _, coord_comments = self.client.get_issue_comments(coord_ref, limit=50)
            except Exception as e:
                logger.warning("Error fetching coordination comments for %s: %s", project.team_key, e)

        return self.compactor.compact_thread(coord_comments)

    def _collect_tasks_for_project(
        self,
        project: ProjectConfig,
        ticket_agents: list[AgentConfig],
        coord_digest: str,
    ) -> list[tuple[ProjectConfig, AgentConfig, LinearIssue, str]]:
        tasks = []
        for agent in ticket_agents:
            try:
                ready_issues = self.client.get_issues_by_state_and_label(
                    team_key=project.team_key,
                    state_name=self.config.ready_state,
                    label_name=agent.label,
                    limit=10,
                )
                for issue in ready_issues:
                    if self.config.server_label and self.config.server_label not in issue.labels:
                        continue
                    try:
                        self.resolve_workdir_for_issue(project, issue)
                    except FileNotFoundError:
                        continue

                    tasks.append((project, agent, issue, coord_digest))
            except Exception as e:
                logger.exception("Error querying ready issues for %s on %s: %s", agent.name, project.team_key, e)
        return tasks

    def tick(self) -> dict[str, int]:
        """Perform one complete evaluation tick with LangChain tracing across cluster, triage, workers, and skeptic."""
        stats = {
            "triaged": 0,
            "tickets_processed": 0,
            "skeptic_tickets_spawned": 0,
            "stale_reclaimed": 0,
        }

        root_trace = self.tracer.start_tick_trace(self.config.server_label, self.config.projects)

        try:
            self.cluster.record_heartbeat()
            reclaimed = self.cluster.reclaim_stale_claims()
            stats["stale_reclaimed"] = len(reclaimed)
        except Exception as e:
            logger.warning("Error during cluster heartbeat: %s", e)

        for project in self.config.projects:
            try:
                triaged = self.triage_engine.process_triage_for_project(project)
                stats["triaged"] += triaged
            except Exception as e:
                logger.exception("Error in auto-triage for project %s: %s", project.team_key, e)

        ticket_agents = [a for a in self.config.agents if a.watch != "coordination"]
        tasks_to_run = []
        for project in self.config.projects:
            coord_digest = self._resolve_project_coord_digest(project)
            tasks_to_run.extend(self._collect_tasks_for_project(project, ticket_agents, coord_digest))

        if tasks_to_run:
            max_workers = min(len(tasks_to_run), self.config.max_concurrent_workers)
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_task = {
                    executor.submit(self.process_ticket, proj, ag, iss, digest, root_trace): (ag.name, iss.identifier)
                    for (proj, ag, iss, digest) in tasks_to_run
                }
                for future in concurrent.futures.as_completed(future_to_task):
                    ag_name, iss_id = future_to_task[future]
                    try:
                        future.result()
                        stats["tickets_processed"] += 1
                    except Exception as e:
                        logger.exception("Task for %s on %s failed: %s", ag_name, iss_id, e)

        skeptics = [a for a in self.config.agents if a.watch == "coordination"]
        for project in self.config.projects:
            for skeptic in skeptics:
                try:
                    spawned = self.skeptic_reviewer.process_skeptic_for_project(project, skeptic)
                    stats["skeptic_tickets_spawned"] += spawned
                    self.tracer.record_skeptic_trace(
                        root_trace,
                        project,
                        skeptic.name,
                        metrics={
                            "comments_reviewed": 0,
                            "tickets_spawned": spawned,
                            "review_output": f"Spawned {spawned} tickets",
                        },
                    )
                except Exception as e:
                    logger.exception("Error in skeptic %s on %s: %s", skeptic.name, project.team_key, e)

        self.tracer.end_tick_trace(root_trace, stats)
        return stats

    def run_loop(self) -> None:
        """Continuous polling loop."""
        logger.info(
            "Starting Linear Multi-Agent Coordinator Loop (server: %s, poll: %ds, LangChain: %s)...",
            self.config.server_label,
            self.config.poll_seconds,
            "Enabled" if self.config.enable_langchain_tracing else "Disabled",
        )

        while not self._shutdown_requested:
            try:
                stats = self.tick()
                if any(v > 0 for v in stats.values()):
                    logger.info("Tick stats: %s", stats)
            except Exception as e:
                logger.exception("Unexpected error during coordinator tick: %s", e)

            for _ in range(self.config.poll_seconds):
                if self._shutdown_requested:
                    break
                time.sleep(1)

        logger.info("Coordinator loop exited cleanly.")
