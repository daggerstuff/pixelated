"""Spec-to-Project Initializer and Architect Plan Generator (Multi-Stage Deliberative Engine)."""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any

from tools.agent_runner.adapters import get_agent_adapter
from tools.agent_runner.client import LinearClient
from tools.agent_runner.dag_engine import DAGEngine, TaskGraphNode
from tools.agent_runner.models import AgentConfig, AgentRole, LinearIssue, LinearTeam, RunnerConfig
from tools.agent_runner.personas import get_role_prompt

logger = logging.getLogger("agent_runner.initializer")

INITIALIZER_PROMPT_TEMPLATE = """You are the Lead Software Architect initializing a new production initiative in Linear.

{role_guidelines}

APPLICATION / FEATURE SPECIFICATION:
{spec_content}

YOUR ARCHITECTURAL MISSION:
1. Analyze the specification deeply against industry best practices, clinical HIPAA data isolation, and clean architecture.
2. Structure the entire implementation into a discrete, modular, and non-overlapping Task Graph (DAG) organized into logical execution PHASES.
3. Ensure every step has an assigned specialist agent (e.g. agent:backend_engineer, agent:security_sentinel, agent:frontend_engineer, agent:qa_automator, agent:refactor_specialist).
4. Clearly define dependency order (`depends: [1, 2]`) so agents do not encounter race conditions.
5. Provide detailed acceptance criteria, target file scopes, complexity estimate (S/M/L/XL), and exact test verification commands.

OUTPUT FORMAT REQUIREMENTS:
Output your high-level architectural overview, followed by the structured task graph block:

TASK_GRAPH:
- id: 1, phase: 1, title: <concise title>, agent: <agent_name>, priority: <1-3>, estimate: M, labels: [backend, db], depends: [], files: [src/db/schema.ts]
- id: 2, phase: 2, title: <concise title>, agent: <agent_name>, priority: <1-3>, estimate: L, labels: [security], depends: [1], files: [src/api/auth.ts]

Followed by detailed task specifications:
### Task 1: <title>
- Phase: <Phase Name>
- Complexity: <S|M|L|XL>
- Target Files: <file paths>
- Description: <details>
- Acceptance Criteria: <criteria>
- Verification Commands: <test commands>

### Task 2: <title>
- Phase: <Phase Name>
- Complexity: <S|M|L|XL>
- Target Files: <file paths>
- Description: <details>
- Acceptance Criteria: <criteria>
- Verification Commands: <test commands>
"""

SKEPTIC_REDTEAM_PROMPT = """You are the Senior Skeptic & Adversarial Systems Critic reviewing a newly proposed project plan.

SPECIFICATION:
{spec_content}

PROPOSED ARCHITECTURAL PLAN:
{architect_plan}

YOUR MISSION:
Red-team this project plan aggressively. Challenge flaws before code is written:
1. Are there missing migration steps, database schema dependencies, or rollback strategies?
2. Are there security vulnerabilities, unaddressed clinical HIPAA/PHI concerns, or auth bypasses?
3. Are the task dependencies realistic? Are there hidden circular prerequisites or parallel race conditions?
4. Are testing, QA automation, and performance benchmarks properly accounted for?
5. Are task boundaries clean and small enough for individual autonomous agents?

Provide a concise, numbered list of critical improvements and missing tasks.
"""

REFINEMENT_PROMPT_TEMPLATE = """You are the Lead Software Architect refining your implementation plan based on critical red-team review.

ORIGINAL SPECIFICATION:
{spec_content}

YOUR INITIAL PLAN:
{initial_plan}

SKEPTIC RED-TEAM CRITIQUE:
{skeptic_critique}

YOUR MISSION:
Incorporate valid feedback, harden security and testing gates, eliminate any circular dependencies, and output the final, battle-tested TASK_GRAPH and task specifications following the exact TASK_GRAPH format:

TASK_GRAPH:
- id: 1, phase: 1, title: <concise title>, agent: <agent_name>, priority: <1-3>, estimate: M, labels: [backend, db], depends: []
- id: 2, phase: 2, title: <concise title>, agent: <agent_name>, priority: <1-3>, estimate: L, labels: [security], depends: [1]

Followed by detailed task specifications (### Task 1: ...).
"""


@dataclass
class InitializedProjectResult:
    project_id: str
    project_name: str
    project_url: str
    meta_issue: LinearIssue
    created_issues: list[LinearIssue] = field(default_factory=list)
    mermaid_diagram: str = ""
    deliberation_summary: str = ""
    is_dry_run: bool = False


class SpecProjectInitializer:
    """Ingests specification documents and orchestrates multi-stage deliberative planning."""

    def __init__(self, client: LinearClient, config: RunnerConfig):
        self.client = client
        self.config = config

    def _find_agent_by_role(self, role: AgentRole) -> AgentConfig:
        """Find the designated specialist agent or fallback."""
        for agent in self.config.agents:
            if agent.role == role or role.value in agent.capabilities:
                return agent
        for agent in self.config.agents:
            if agent.watch != "coordination":
                return agent
        return self.config.agents[0]

    def _extract_task_details(self, raw_output: str) -> dict[str, dict[str, Any]]:
        """Extract structured metadata per task section."""
        details: dict[str, dict[str, Any]] = {}
        sections = re.split(r"(?=###\s+Task\s+\d+)", raw_output)
        for sec in sections:
            match = re.search(r"###\s+Task\s+(\d+)\s*:\s*([^\n]+)", sec)
            if match:
                task_id = match.group(1).strip()
                title = match.group(2).strip()

                phase_match = re.search(r"-?\s*Phase:\s*([^\n]+)", sec, re.IGNORECASE)
                phase = phase_match.group(1).strip() if phase_match else "Phase 1"

                est_match = re.search(r"-?\s*Complexity:\s*([^\n]+)", sec, re.IGNORECASE)
                estimate = est_match.group(1).strip() if est_match else "M"

                files_match = re.search(r"-?\s*Target Files:\s*([^\n]+)", sec, re.IGNORECASE)
                target_files = [f.strip() for f in files_match.group(1).split(",") if f.strip()] if files_match else []

                crit_match = re.search(
                    r"-?\s*Acceptance Criteria:\s*([^\n]+(?:\n(?!\s*-?\s*[A-Z][a-zA-Z\s]*:)[^\n]+)*)",
                    sec,
                    re.IGNORECASE,
                )
                criteria = crit_match.group(1).strip() if crit_match else ""

                verif_match = re.search(
                    r"-?\s*Verification(?: Commands)?:\s*([^\n]+(?:\n(?!\s*-?\s*[A-Z][a-zA-Z\s]*:)[^\n]+)*)",
                    sec,
                    re.IGNORECASE,
                )
                verif = verif_match.group(1).strip() if verif_match else ""

                details[task_id] = {
                    "raw_section": sec.strip(),
                    "title": title,
                    "phase": phase,
                    "estimate": estimate,
                    "target_files": target_files,
                    "criteria": criteria,
                    "verification": verif,
                }
        return details

    def _generate_phased_mermaid_dag(
        self, nodes: list[TaskGraphNode], id_map: dict[str, str], details: dict[str, dict[str, Any]]
    ) -> str:
        """Generate a phased Mermaid flowchart diagram with subgraphs."""
        phases: dict[str, list[TaskGraphNode]] = {}
        for node in nodes:
            node_detail = details.get(node.key, {})
            phase_name = node_detail.get("phase", "Phase 1")
            phases.setdefault(phase_name, []).append(node)

        lines = ["```mermaid", "flowchart TD"]
        for p_idx, (phase_name, p_nodes) in enumerate(phases.items(), start=1):
            lines.append(f'    subgraph Sub_{p_idx}["{phase_name}"]')
            for node in p_nodes:
                real_id = id_map.get(node.key, node.key)
                clean_title = node.title.replace('"', "'")
                lines.append(f'        {real_id}["{real_id}: {clean_title} ({node.agent_label})"]')
            lines.append("    end")

        for node in nodes:
            real_id = id_map.get(node.key, node.key)
            for dep in node.dependencies:
                dep_real = id_map.get(dep, dep)
                lines.append(f"    {dep_real} --> {real_id}")

        lines.append("```")
        return "\n".join(lines)

    def _conduct_deliberation(
        self,
        spec_content: str,
        architect: AgentConfig,
        skeptic: AgentConfig,
        workdir: str,
    ) -> tuple[str, str]:
        """Conduct multi-turn architect vs. skeptic deliberation."""
        logger.info("Stage 1: Architect '%s' drafting initial plan...", architect.name)
        arch_adapter = get_agent_adapter(architect)
        initial_prompt = INITIALIZER_PROMPT_TEMPLATE.format(
            role_guidelines=get_role_prompt(AgentRole.ARCHITECT),
            spec_content=spec_content,
        )
        initial_res = arch_adapter.run(
            prompt=initial_prompt,
            workdir=workdir,
            ticket_identifier="Plan-Init",
            enable_branching=False,
        )

        logger.info("Stage 2: Skeptic Critic '%s' red-teaming plan...", skeptic.name)
        skeptic_adapter = get_agent_adapter(skeptic)
        skeptic_prompt = SKEPTIC_REDTEAM_PROMPT.format(
            spec_content=spec_content,
            architect_plan=initial_res.output,
        )
        skeptic_res = skeptic_adapter.run(
            prompt=skeptic_prompt,
            workdir=workdir,
            ticket_identifier="Plan-RedTeam",
            enable_branching=False,
        )

        logger.info("Stage 3: Architect '%s' hardening plan with critique...", architect.name)
        refine_prompt = REFINEMENT_PROMPT_TEMPLATE.format(
            spec_content=spec_content,
            initial_plan=initial_res.output,
            skeptic_critique=skeptic_res.output,
        )
        final_res = arch_adapter.run(
            prompt=refine_prompt,
            workdir=workdir,
            ticket_identifier="Plan-Final",
            enable_branching=False,
        )

        delib_summary = (
            f"### 🛡️ Deliberative Planning Record\n"
            f"- **Architect:** `{architect.name}`\n"
            f"- **Skeptic Critic:** `{skeptic.name}`\n\n"
            f"#### 🔍 Key Red-Team Findings Addressed:\n{skeptic_res.output[:1500]}\n"
        )
        return final_res.output, delib_summary

    def _generate_dry_run_result(
        self,
        project_name: str,
        task_nodes: list[TaskGraphNode],
        task_details: dict[str, dict[str, Any]],
        delib_summary: str,
    ) -> InitializedProjectResult:
        mock_id_map = {node.key: f"PREVIEW-{idx}" for idx, node in enumerate(task_nodes, start=1)}
        preview_issues = [
            LinearIssue(
                id=f"preview-{idx}",
                identifier=f"PREVIEW-{idx}",
                title=node.title,
                description=task_details.get(node.key, {}).get("raw_section", node.description or node.title),
                state_name="Todo",
                labels=[node.agent_label, *node.labels],
                priority=node.priority,
                url="https://linear.app/preview",
            )
            for idx, node in enumerate(task_nodes, start=1)
        ]
        mermaid_dag = self._generate_phased_mermaid_dag(task_nodes, mock_id_map, task_details)
        meta_issue = LinearIssue(
            id="preview-meta",
            identifier="PREVIEW-META",
            title=f"META: {project_name} Orchestration & Tracking",
            description=f"Preview Plan for {project_name}\n\n{mermaid_dag}",
            url="https://linear.app/preview",
        )
        return InitializedProjectResult(
            project_id="preview-proj",
            project_name=project_name,
            project_url="https://linear.app/preview",
            meta_issue=meta_issue,
            created_issues=preview_issues,
            mermaid_diagram=mermaid_dag,
            deliberation_summary=delib_summary,
            is_dry_run=True,
        )

    def _deploy_to_linear(
        self,
        team: LinearTeam,
        project_name: str,
        architect: AgentConfig,
        plan_data: dict[str, Any],
    ) -> InitializedProjectResult:
        task_nodes: list[TaskGraphNode] = plan_data["task_nodes"]
        task_details: dict[str, dict[str, Any]] = plan_data["task_details"]
        delib_summary: str = plan_data.get("delib_summary", "")

        proj_data = self.client.create_project(
            team_id=team.id,
            name=project_name,
            description=f"Specification Implementation Plan created by Architect `{architect.name}`.",
        )
        project_id = proj_data.get("id", "")
        project_url = proj_data.get("url", "")
        logger.info("Created Linear Project: %s (%s)", project_name, project_url)

        triage_or_todo = team.states.get(self.config.triage_state) or team.states.get(self.config.ready_state)
        created_issues: list[LinearIssue] = []
        id_to_identifier: dict[str, str] = {}

        for node in task_nodes:
            label_ids = []
            if node.agent_label:
                lbl_id = self.client.get_or_create_label(team.id, node.agent_label)
                label_ids.append(lbl_id)

            for extra_lbl in node.labels:
                lbl_id = self.client.get_or_create_label(team.id, extra_lbl)
                if lbl_id not in label_ids:
                    label_ids.append(lbl_id)

            detail = task_details.get(node.key, {})
            desc_content = detail.get("raw_section") or (node.description or node.title)
            desc_content += f"\n\n*Part of Project [{project_name}]({project_url})*"

            issue = self.client.create_issue(
                team_id=team.id,
                title=node.title,
                description=desc_content,
                state_id=triage_or_todo,
                extra={"label_ids": label_ids, "priority": node.priority, "project_id": project_id},
            )
            created_issues.append(issue)
            id_to_identifier[node.key] = issue.identifier
            logger.info("Created Project Issue [%s] %s", issue.identifier, issue.title)

        for node, issue in zip(task_nodes, created_issues, strict=False):
            if node.dependencies:
                dep_identifiers = [id_to_identifier.get(d, d) for d in node.dependencies]
                self.client.post_comment(
                    issue.id,
                    f"⚙️ **Dependency Gate:** This task depends on `{', '.join(dep_identifiers)}` before it can begin.",
                )

        mermaid_dag = self._generate_phased_mermaid_dag(task_nodes, id_to_identifier, task_details)
        meta_description = (
            f"# 🧭 Project Architecture & Execution Dashboard: {project_name}\n\n"
            f"**Linear Project:** [{project_name}]({project_url})\n"
            f"**Architect:** `{architect.name}`\n"
            f"**Total Decomposed Tasks:** {len(created_issues)}\n\n"
        )
        if delib_summary:
            meta_description += f"{delib_summary}\n\n"

        meta_description += f"### 📊 Execution Dependency Graph:\n{mermaid_dag}\n\n### 📋 Task Checklist:\n"
        for issue in created_issues:
            meta_description += f"- [ ] **[{issue.identifier}]({issue.url})**: {issue.title}\n"

        meta_issue = self.client.create_issue(
            team_id=team.id,
            title=f"META: {project_name} Orchestration & Tracking",
            description=meta_description,
            state_id=triage_or_todo,
            extra={
                "project_id": project_id,
                "priority": 1,
                "label_ids": [self.client.get_or_create_label(team.id, "meta")],
            },
        )
        logger.info("Created META Project Tracking Ticket [%s]", meta_issue.identifier)

        return InitializedProjectResult(
            project_id=project_id,
            project_name=project_name,
            project_url=project_url,
            meta_issue=meta_issue,
            created_issues=created_issues,
            mermaid_diagram=mermaid_dag,
            deliberation_summary=delib_summary,
            is_dry_run=False,
        )

    def initialize_from_spec(
        self,
        spec_content: str,
        project_name: str,
        team_key: str,
        options: dict[str, Any] | None = None,
    ) -> InitializedProjectResult:
        """Analyze spec, deliberate, create Linear project, and deploy the entire task graph."""
        opts = options or {}
        workdir = opts.get("workdir") or os.getcwd()
        enable_deliberation = opts.get("enable_deliberation", True)
        dry_run = opts.get("dry_run", False)

        team = self.client.resolve_team(team_key)
        architect = self._find_agent_by_role(AgentRole.ARCHITECT)
        skeptic = self._find_agent_by_role(AgentRole.SKEPTIC)

        delib_summary = ""
        if enable_deliberation and skeptic.name != architect.name:
            plan_output, delib_summary = self._conduct_deliberation(spec_content, architect, skeptic, workdir)
        else:
            logger.info("Invoking Architect '%s' to analyze specification...", architect.name)
            adapter = get_agent_adapter(architect)
            prompt = INITIALIZER_PROMPT_TEMPLATE.format(
                role_guidelines=get_role_prompt(AgentRole.ARCHITECT),
                spec_content=spec_content,
            )
            result = adapter.run(
                prompt=prompt,
                workdir=workdir,
                ticket_identifier="Plan-Init",
                enable_branching=False,
            )
            plan_output = result.output

        task_nodes = DAGEngine.parse_task_graph(plan_output)
        if not task_nodes:
            logger.warning("Architect did not produce structured TASK_GRAPH. Generating fallback task.")
            task_nodes = [
                TaskGraphNode(
                    key="1",
                    title=f"Implement {project_name}",
                    description=spec_content[:500],
                    agent_label=architect.label,
                )
            ]

        task_details = self._extract_task_details(plan_output)

        if dry_run:
            logger.info("DRY-RUN: Generating preview for '%s'...", project_name)
            return self._generate_dry_run_result(project_name, task_nodes, task_details, delib_summary)

        plan_data = {
            "task_nodes": task_nodes,
            "task_details": task_details,
            "delib_summary": delib_summary,
        }
        return self._deploy_to_linear(team, project_name, architect, plan_data)
