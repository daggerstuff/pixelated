#!/usr/bin/env python
"""Programmatically enrich all active Linear tasks with detailed, structured context and specifications."""

import csv
import logging
import os
import re
import sys
from typing import Any

# Ensure local package imports work correctly
sys.path.insert(0, os.getcwd())

from scripts.task_sync.provider_bridge import (
    _extract_graphql_payload,
    _linear_graphql_query,
    apply_linear_action,
    export_linear_issues,
)
from scripts.task_sync.tri_sync import (
    SyncMetadata,
    merge_body_with_sync_metadata,
    parse_sync_metadata,
)

# Status IDs
STATUS_DUPLICATE = "0b40a450-946c-48b0-9e85-d0676c800b76"

# Checkpoint mappings
CHECKPOINTS_MAP = {
    "5.0": "PIX-430",
    "17.0": "PIX-454",
    "23.0": "PIX-464",
    "26.0": "PIX-470",
    "29.0": "PIX-478",
    "32.0": "PIX-484",
    "35.0": "PIX-487",
}

# Duplicate mappings for active issues
ACTIVE_DUPLICATES = {
    # target_key -> canonical_key
    "PIX-273": "PIX-1894",  # Kickoff: CI Federation Initiative
    # PIX-292 → PIX-1898 removed (Azure decommissioned)
    "PIX-299": "PIX-1879",  # Write runbook and escalation map
    "PIX-222": "PIX-1879",  # Write runbook and escalation map (second duplicate)
    "PIX-252": "PIX-1890",  # Home Directory Backup System Redesign - implementation
    "PIX-280": "PIX-1902",  # Create pipeline inventory across providers
    "PIX-312": "PIX-1883",  # Promote recovered feeders into live pixel-data source config
    "PIX-251": "PIX-1896",  # FHE Emotional Intelligence Integration - execution backlog
    "PIX-1874": "PIX-314",  # Implement context optimization architecture
    "PIX-325": "PIX-1877",  # Document idea archival policy and backlog cleanup workflow
    "PIX-226": "PIX-294",  # Scrambled duplicate of Define weekly operating review
    "PIX-371": "PIX-514",  # Redundant duplicate of Update Pixelated Memory Service / Checkmate align
}


def parse_md_all_tasks(md_path: str) -> dict[str, dict[str, str]]:
    """Parse all training tasks and checkpoints from the Markdown plan."""
    if not os.path.exists(md_path):
        logging.error("Plan file not found at %s", md_path)
        return {}

    with open(md_path, encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    tasks = {}
    current_task_num = None
    current_task_name = ""
    current_task_lines = []

    for line in lines:
        header_match = re.match(r"^###\s+(?:\*|†|‡)?(\d+\.\d+)\s+(.*)", line)
        if header_match:
            if current_task_num:
                tasks[current_task_num] = {
                    "num": current_task_num,
                    "name": current_task_name,
                    "body": "\n".join(current_task_lines).strip(),
                }
            current_task_num = header_match.group(1)
            current_task_name = header_match.group(2).strip()
            current_task_lines = []
            continue

        subtask_match = re.match(r"^\s*-\s*\[\s*\]\s+(?:\*|†|‡)?(\d+\.\d+)\s+(.*)", line)
        if subtask_match:
            if current_task_num:
                tasks[current_task_num] = {
                    "num": current_task_num,
                    "name": current_task_name,
                    "body": "\n".join(current_task_lines).strip(),
                }
            current_task_num = subtask_match.group(1)
            current_task_name = subtask_match.group(2).strip()
            current_task_lines = []
            continue

        if current_task_num:
            if line.strip() == "---" or line.strip().startswith("## "):
                tasks[current_task_num] = {
                    "num": current_task_num,
                    "name": current_task_name,
                    "body": "\n".join(current_task_lines).strip(),
                }
                current_task_num = None
            else:
                current_task_lines.append(line)

    if current_task_num:
        tasks[current_task_num] = {
            "num": current_task_num,
            "name": current_task_name,
            "body": "\n".join(current_task_lines).strip(),
        }

    return tasks


def get_training_mappings() -> dict[str, str]:
    """Parse task number mappings from CSV and add checkpoints."""
    mappings = {}
    csv_path = ".agent/internal/plans/asana-training-pipeline-tasks.csv"
    if os.path.exists(csv_path):
        with open(csv_path, encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # skip header
            for row in reader:
                if len(row) >= 2:
                    name = row[0]
                    match = re.match(r"^(?:\*|†|‡)?(\d+\.\d+)", name)
                    if match:
                        num = match.group(1)
                        pix = re.search(r"PIX-\d+", row[1])
                        if pix:
                            mappings[num] = pix.group(0)
    mappings.update(CHECKPOINTS_MAP)
    return mappings


def build_training_description(task_num: str, task: dict[str, str], pix_key: str) -> str:
    """Format a premium GFM description for a training pipeline task."""
    body = task["body"]

    checklist_items = []
    other_lines = []

    for line in body.splitlines():
        line_strip = line.strip()
        if line_strip.startswith(("- [ ]", "- ", "* ")):
            clean_item = re.sub(r"^[-*]\s*(\[\s*\])?\s*", "", line_strip)
            if clean_item:
                checklist_items.append(f"- [ ] {clean_item}")
        elif line_strip:
            other_lines.append(line_strip)

    if not checklist_items:
        checklist_items.append(f"- [ ] Implement and verify the capabilities for task {task_num}: {task['name']}")

    objective_text = (
        "\n".join(other_lines)
        if other_lines
        else f"Implement and configure the features specified for task {task_num} ({task['name']})."
    )

    files_mentioned = []
    file_matches = re.findall(r"`([a-zA-Z0-9_\-\/]+\.(?:py|ts|tsx|json|yml|yaml|md|jsonl|ipynb))`", body)
    for fm in file_matches:
        if fm not in files_mentioned:
            files_mentioned.append(fm)

    specs_section = f"""- **Sprint Scope**: Training Pipeline Improvements (Phase {task_num.split(".", 1)[0]})
- **Runtime Environment**: Python v3.13 (`uv` managed), PyTorch, Hugging Face transformers, TRL API.
- **Key Objectives**: {task["name"]}."""

    linkages_section = f"""- **Linear Key**: {pix_key}
- **Source Plan File**: [TRAINING-PIPELINE-TASKS-2026-04-29.md](file:///.agent/internal/plans/TRAINING-PIPELINE-TASKS-2026-04-29.md)"""
    if files_mentioned:
        for file in files_mentioned:
            linkages_section += f"\n- **Source File**: [{os.path.basename(file)}](file:///home/vivi/pixelated/{file})"

    return f"""### Core Objective
{objective_text}

### Technical Design Specs
{specs_section}

### Atlassian & Code Linkages
{linkages_section}

### Verification & Testing Checklist
{"\n".join(checklist_items)}"""


# Custom specifications for DevOps and Platform tasks
DEVOPS_PLATFORM_SPECS = {
    "Write runbook and escalation map": {
        "body": """### Core Objective
Document where each pipeline check lives, their owners, the break/fix resolution process, and the designated escalation path.

### Technical Design Specs
- **Operational Matrix**:
  - Map every build/test check across GitHub Actions, GitLab CI, and Bitbucket Pipelines.
  - Define clear severity levels, owner contact information, and target SLAs.
- **Failover & Escalation**:
  - Establish fallback protocols in case of primary runner outage.
  - Detail procedures for notifying the on-call engineer and logging incident reports.

### Atlassian & Code Linkages
- **Primary Runbook**: [RUNBOOK.md](file:///home/vivi/pixelated/docs/RUNBOOK.md)
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Map all pipeline checks across GitHub, GitLab, and Bitbucket.
- [ ] Define step-by-step resolution steps for common build/test failures.
- [ ] Establish ownership matrix and contact paths for critical alerts.""",
    },
    "Publish CI operating model RFC": {
        "body": """### Core Objective
Author and publish a consensus RFC standardizing the federated CI operating rules and pipeline architecture.

### Technical Design Specs
- **Operating Rules**:
  - Enforce artifact provenance and validation.
  - Lock one owner per pipeline capability.

### Atlassian & Code Linkages
- **RFC Document**: [CI-OPERATING-MODEL.md](file:///home/vivi/pixelated/docs/rfc/CI-OPERATING-MODEL.md)
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Draft the RFC covering deployment authority and build lineage.
- [ ] Circulate for team review and collect feedback.
- [ ] Publish the final version to the documentation repository.""",
    },
    "Implement readiness aggregator endpoint/script": {
        "body": """### Core Objective
Build a lightweight status collector to aggregate pipeline check results from multiple providers (GitHub, GitLab, Bitbucket) into a unified readiness status.

### Technical Design Specs
- **Status Collector**:
  - Create python aggregator script `scripts/devops/aggregate-readiness.py`.
  - Collect status outputs (lint, typecheck, tests) from all active validation lanes.
  - Output a consolidated JSON payload outlining current pass/fail status.

### Atlassian & Code Linkages
- **Aggregator Script**: [aggregate-readiness.py](file:///home/vivi/pixelated/scripts/devops/aggregate-readiness.py)
- **Schema Reference**: [release-readiness-schema.json](file:///home/vivi/pixelated/config/release-readiness-schema.json)
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Implement the aggregation logic querying provider APIs.
- [ ] Format the output according to the release-readiness schema.
- [ ] Write unit tests verifying correct status parsing under API failures.""",
    },
    "Kickoff: CI Federation Initiative": {
        "body": """### Core Objective
Align the team on the scope, goals, and timeline of the CI federation initiative.

### Technical Design Specs
- **Scope Definition**:
  - Align GitHub Actions and Bitbucket Pipelines into a unified release flow.

### Atlassian & Code Linkages
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Coordinate kickoff meeting and align stakeholders.
- [ ] Finalize sprint schedules and milestones.""",
    },
    "Final acceptance review": {
        "body": """### Core Objective
Execute the final review of the CI federation gates and transition the operations to BAU (Business as Usual).

### Technical Design Specs
- Verify all validation lanes are successfully reporting to the readiness aggregator.
- Confirm all pre-deployment gates block releases on failure.

### Atlassian & Code Linkages
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Verify all gates are active and stable.
- [ ] Hand over runbooks and escalation contacts to operations.""",
    },
    "Disable duplicate non-owner jobs": {
        "body": """### Core Objective
Retire or disable duplicate redundant validation jobs in non-owner repositories according to the ownership matrix.

### Technical Design Specs
- Identify and decommission duplicate linter/test jobs in GitHub Actions, GitLab CI, or Bitbucket Pipelines.
- Ensure that only designated owner pipelines execute tasks to avoid duplicate token consumption and compute waste.

### Atlassian & Code Linkages
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Identify all overlapping workflows across the codebase.
- [ ] Decommission redundant linting/testing configurations.""",
    },
    "Design release-readiness schema": {
        "body": """### Core Objective
Define the structured JSON schema mapping release-readiness status, checks, and gating metrics.

### Technical Design Specs
- Formulate JSON Schema defining acceptable states (pending, success, failure), provider metadata, and validation timestamps.
- Ensure TS/Python parser compatibility.

### Atlassian & Code Linkages
- **JSON Schema**: [release-readiness-schema.json](file:///home/vivi/pixelated/config/release-readiness-schema.json)
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Draft the JSON Schema for pipeline gating states.
- [ ] Validate schema parsing in TS and Python.""",
    },
    "Create pipeline inventory across providers": {
        "body": """### Core Objective
Catalog all active workflow pipelines across GitHub and Bitbucket.

### Technical Design Specs
- Crawl all repositories and list active pipelines, build steps, trigger parameters, and status endpoints.
- Document inventory in documentation repo.

### Atlassian & Code Linkages
- **Inventory Doc**: [PIPELINE-INVENTORY.md](file:///home/vivi/pixelated/docs/PIPELINE-INVENTORY.md)
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Query all provider repositories for active pipelines.
- [ ] Compile details on runtime, trigger types, and average duration.""",
    },
    "Approval checkpoint: ownership and RFC": {
        "body": """### Core Objective
Gate to confirm formal approvals of the CI operating model and ownership matrix before execution.

### Technical Design Specs
- Verify consensus across security, devops, and development leads on the published RFC.

### Atlassian & Code Linkages
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Secure sign-offs on the CI Operating Model RFC.
- [ ] Obtain approval from engineering leadership.""",
    },
    "Consolidate Bitbucket AI validation lane": {
        "body": """### Core Objective
Keep AI, data, and governance validation checks in Bitbucket, aligning triggers with path changes.

### Technical Design Specs
- Configure Bitbucket triggers to run security and quality validations strictly on updates to the `ai/` folder, database models, or scheduling rules.

### Atlassian & Code Linkages
- **Bitbucket Config**: [bitbucket-pipelines.yml](file:///home/vivi/pixelated/bitbucket-pipelines.yml)
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Update Bitbucket pipeline triggers.
- [ ] Verify execution behavior on AI module updates.""",
    },
    "Consolidate GitHub security lane": {
        "body": """### Core Objective
Restructure GitHub Actions to handle CodeQL, SARIF, and security scanning, removing overlaps elsewhere.

### Technical Design Specs
- Deploy static security analysis in GitHub Actions.
- Ensure that GitHub handles the central reporting dashboard for CodeQL alerts.

### Atlassian & Code Linkages
- **GitHub Workflow**: [.github/workflows/security.yml](file:///home/vivi/pixelated/.github/workflows/security.yml)
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Configure GitHub security workflows.
- [ ] Confirm scans run on pull requests and main commits.""",
    },
    "Define weekly operating review": {
        "body": """### Core Objective
Establish the weekly operations review template with KPI checks, alerts, and backlog updates.

### Technical Design Specs
- Standardize a review runbook to audit system availability, performance latencies, and security incidents.

### Atlassian & Code Linkages
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] Create operations review runbook template.
- [ ] Set up recurring meeting.""",
    },
    "Home Directory Backup System Redesign - implementation": {
        "body": """### Core Objective
Redesign and implement a secure, HIPAA-compliant home directory backup system using `google-drive-ocamlfuse`, `rsync` mirroring, and twice-daily execution.

### Technical Design Specs
- **Encryption**:
  - Enforce end-to-end encryption with AES-256 for all ePHI/PII.
  - Store keys separately from data (geographic/provider separation).
- **Automation & Alerts**:
  - Run rsync mirroring scripts twice daily via systemd timers.
  - Configure instant Slack webhooks on backup failure.

### Atlassian & Code Linkages
- **Backup Script**: [backup-home-vivi.sh](file:///home/vivi/pixelated/scripts/backup/backup-home-vivi.sh)
- **Security Plan**: [backup-security-plan.md](file:///home/vivi/pixelated/artifacts/training-task-discovery/archived_task_files_flat/.agent__internal__train__.notes__.notes__backup-security-plan.md)
- **Source Plan**: [2026-03-21-home-backup-redesign.md](http://2026-03-21-home-backup-redesign.md)

### Verification & Testing Checklist
- [ ] Configure `google-drive-ocamlfuse` for secure GDrive mounting.
- [ ] Deploy the backup script to run twice daily via systemd timers.
- [ ] Verify AES-256 encryption using local test keys.
- [ ] Validate failure notification alerts.""",
    },
    "Implement context optimization architecture": {
        "body": """### Core Objective
Refactor the agent's workspace configuration, dependencies, and rules loading to optimize context window footprint.

### Technical Design Specs
- **Lazy Loading**:
  - Transition optional, heavy-duty MCP tools to lazy loading.
  - Profile and optimize system memory footprint on startup.
- **Rule Hierarchy**:
  - Re-organize rule configurations to follow a hub-and-spoke model.

### Atlassian & Code Linkages
- **Optimization Code**: `src/lib/context/optimization.ts`
- **Source Plan**: context-optimization-architecture-implementation

### Verification & Testing Checklist
- [ ] Profile startup context consumption.
- [ ] Implement lazy-loading for all optional tool groups.
- [ ] Restructure rules directory to follow hub-and-spoke model.""",
    },
    "Refactor user profile data model and migration plan": {
        "body": """### Core Objective
Refactor the user profile model to consolidate legacy auth fields, support workspace scoping, and execute rollback-enabled migration.

### Technical Design Specs
- **Schema Overhaul**:
  - Add role-based access control (RBAC) and `workspace_id` constraints.
- **Migration Plan**:
  - Write database migration scripts to transition profiles without downtime.
  - Establish a dual-write phase and automated rollback triggers.

### Atlassian & Code Linkages
- **Profile Schema**: `packages/db-schema/src/user-profile.ts`

### Verification & Testing Checklist
- [ ] Update schema to support role-based access control (RBAC).
- [ ] Write rollback-enabled DB migration scripts.
- [ ] Verify backward compatibility during dual-write phase.""",
    },
}


# Custom specifications for Memory May-Hem Expansion tasks
MAY_HEM_SPECS = {
    "Design Unified Memory Schema": {
        "body": """### Core Objective
Establish a single, typed memory schema structure shared across Astro UI, library packages, and Python ML adapters.

### Technical Design Specs
- **Zod & Pydantic**:
  - Define schema types and defaults under `@pixelated/memory-schema` package.
  - Validate bidirectional serialization/deserialization.

### Atlassian & Code Linkages
- **Schema Defaults**: [defaults.ts](file:///home/vivi/pixelated/packages/memory-schema/src/defaults.ts)

### Verification & Testing Checklist
- [ ] Consolidate schemas into shared package `@pixelated/memory-schema`.
- [ ] Add Zod type assertions for serialization/deserialization.""",
    },
    "Update AI Repository Memory": {
        "body": """### Core Objective
Update python adapters to integrate the new unified memory schema.

### Technical Design Specs
- **Python Integration**:
  - Implement Pydantic model parsing in python memory adapters.
  - Assert query serialization matches TS models.

### Atlassian & Code Linkages
- **Memory Adapter**: [memory_adapter.py](file:///home/vivi/pixelated/ai-services/memory_adapter.py)

### Verification & Testing Checklist
- [ ] Replace custom dict parsing with Pydantic model validation.
- [ ] Assert correct field mapping during memory load.""",
    },
    "Update Pixelated Memory Service": {
        "body": """### Core Objective
Refactor frontend-facing memory services to route queries through the new unified schema adapter.

### Technical Design Specs
- **Astro Routes**:
  - Update SSR endpoints to load, format, and push data based on new schemas.

### Verification & Testing Checklist
- [ ] Update Astro routes under `src/pages/api/memory`.
- [ ] Verify that UI renders patients' episodic memories correctly.""",
    },
    "Design Cross-Language Memory API": {
        "body": """### Core Objective
Establish cross-language compatibility for memory reads/writes.

### Technical Design Specs
- Define API contracts using JSON Schema.
- Implement validation checks on both TS and Python.

### Verification & Testing Checklist
- [ ] Define API contracts using JSON Schema.
- [ ] Implement validation checks on both TS and Python.""",
    },
    "Integrate Gate into Pixelated Ingestion": {
        "body": """### Core Objective
Intercept conversational inputs at the gate, checking safety levels and routing them dynamically.

### Technical Design Specs
- Integrate fast API gate controllers with screening interfaces in React.

### Verification & Testing Checklist
- [ ] Intercept messages in fast API gate controller.
- [ ] Add real-time UI screening state indicators.""",
    },
    "Develop Dream Scheduler Service": {
        "body": """### Core Objective
Build offline cron-based schedulers utilizing BullMQ and Redis.

### Technical Design Specs
- Schedule background memory consolidation during off-peak hours.

### Verification & Testing Checklist
- [ ] Set up BullMQ worker and queue for dream tasks.
- [ ] Deploy daily scheduler triggers.""",
    },
    "Create Dream Manager Module": {
        "body": """### Core Objective
Implement offline memory consolidation, summarization, and data compaction logic.

### Technical Design Specs
- Compile daily logs, summarize themes, and prune MongoDB database.

### Verification & Testing Checklist
- [ ] Implement text summarization of daily logs.
- [ ] Prune redundant database records.""",
    },
    "Wire Dream Manager into AI Memory": {
        "body": """### Core Objective
Integrate dreaming service into the main AI memory stack.

### Technical Design Specs
- Hook dream worker into MongoDB collections.

### Verification & Testing Checklist
- [ ] Hook dream worker into MongoDB collections.
- [ ] Validate referential integrity after compaction.""",
    },
    "Extend Pixelated Context Blocks": {
        "body": """### Core Objective
Implement logic to update active context blocks based on offline processing results.

### Technical Design Specs
- Expose updated guidelines in dashboard.

### Verification & Testing Checklist
- [ ] Connect dream results to context block updater.
- [ ] Expose updated guidelines in dashboard.""",
    },
    "Implement Reflection Tasks": {
        "body": """### Core Objective
Setup automated self-reflection hooks that analyze recent actions and update guidance.

### Technical Design Specs
- Build reflection evaluation prompts and automate self-improvement updates.

### Verification & Testing Checklist
- [ ] Build reflection evaluation prompts.
- [ ] Implement automated self-improvement updates.""",
    },
    "Integrate Reflection with Dream Cycles": {
        "body": """### Core Objective
Feed reflection findings back into long-term patient memories.

### Technical Design Specs
- Save consolidated insights to MongoDB.

### Verification & Testing Checklist
- [ ] Hook reflection tasks into dream scheduler.
- [ ] Save consolidated insights to MongoDB.""",
    },
    "Prepare Fine-Tuning Dataset": {
        "body": """### Core Objective
Format cleaned conversational dialogue into training-ready shards.

### Technical Design Specs
- Format training targets in ChatML.

### Verification & Testing Checklist
- [ ] Extract dialogue turns from database.
- [ ] Format training targets in ChatML.""",
    },
    "Fine-Tune the Model": {
        "body": """### Core Objective
Run QLoRA training scripts on serverless GPU containers.

### Technical Design Specs
- Export checkpoints to S3.

### Verification & Testing Checklist
- [ ] Launch Modal serverless GPU runner.
- [ ] Export checkpoints to S3.""",
    },
    "Evaluate Memory Performance": {
        "body": """### Core Objective
Run validation benchmarks on final models.

### Technical Design Specs
- Measure latency of query lookups and verify validity rates.

### Verification & Testing Checklist
- [ ] Measure latency of query lookups.
- [ ] Verify clinical validity rates.""",
    },
    "Iterate & Refine": {
        "body": """### Core Objective
Resolve remaining performance anomalies and edge cases.

### Technical Design Specs
- Profile resource footprints.

### Verification & Testing Checklist
- [ ] Profile resource footprints.
- [ ] Apply corrections to prompt templates.""",
    },
}


def execute_relation_and_status(uuid: str, canonical_uuid: str, identifier: str, dry_run: bool) -> None:
    """Establish a duplicate relation and mark as Duplicate."""
    if dry_run:
        logging.info("  -> [Dry Run] Would mark %s as duplicate of %s", identifier, canonical_uuid)
        return

    logging.info("  -> Creating duplicate relation for %s with canonical UUID %s...", identifier, canonical_uuid)
    relation_mutation = (
        "mutation($issueId: String!, $relatedIssueId: String!) { "
        "issueRelationCreate(input: { issueId: $issueId, relatedIssueId: $relatedIssueId, type: duplicate }) { "
        "success } }"
    )
    relation_vars = {"issueId": uuid, "relatedIssueId": canonical_uuid}
    try:
        rel_res = _linear_graphql_query(relation_mutation, relation_vars)
        extracted_rel = _extract_graphql_payload(rel_res)
        logging.info(
            "  -> Relation success: %s",
            extracted_rel.get("issueRelationCreate", {}).get("success"),
        )
    except Exception as e:
        logging.error("  -> Error creating duplicate relation: %s", e)

    mutation = (
        "mutation($id: String!, $input: IssueUpdateInput!) { "
        "issueUpdate(id: $id, input: $input) { success issue { id title } } }"
    )
    variables = {"id": uuid, "input": {"stateId": STATUS_DUPLICATE}}
    try:
        response = _linear_graphql_query(mutation, variables)
        extracted = _extract_graphql_payload(response)
        logging.info("  -> Status update success: %s", extracted.get("issueUpdate", {}).get("success"))
    except Exception as e:
        logging.error("  -> Error updating issue state to Duplicate: %s", e)


def check_for_mismatch(title: str, clean_body: str) -> bool:
    """Verify if a description template is mismatched from its title."""
    # Find any bold-italic title like ***Title*** in the text
    match = re.search(r"\*\*\*(.*?)\*\*\*", clean_body)
    if match:
        bp_task = match.group(1)
        t_clean = re.sub(r"[^a-zA-Z0-9]", "", title).lower()
        bp_clean = re.sub(r"[^a-zA-Z0-9]", "", bp_task).lower()
        bp_clean = re.sub(r"^\d+\.\d+", "", bp_clean)
        if bp_clean and bp_clean not in t_clean and t_clean not in bp_clean:
            return True

    # Also check if it contains the generic placeholder block but the title doesn't match
    if "This task represents a core pipeline enhancement or feature implementation item:" in clean_body:
        match = re.search(
            r"This task represents a core pipeline enhancement or feature implementation item:\s+\*\*\*(.*?)\*\*\*",
            clean_body,
        )
        if match:
            bp_task = match.group(1)
            t_clean = re.sub(r"[^a-zA-Z0-9]", "", title).lower()
            bp_clean = re.sub(r"[^a-zA-Z0-9]", "", bp_task).lower()
            if bp_clean and bp_clean not in t_clean and t_clean not in bp_clean:
                return True

    return False


def _extract_linkages(clean_body: str) -> tuple[list[str], str]:
    linkages = []
    remaining_lines = []
    for line in clean_body.splitlines():
        line_strip = line.strip()
        if (
            "russianvodka.atlassian.net" in line_strip.lower()
            or "jira:" in line_strip.lower()
            or "asana:" in line_strip.lower()
            or "migrated from" in line_strip.lower()
            or "source priority:" in line_strip.lower()
            or "source status:" in line_strip.lower()
            or "source type:" in line_strip.lower()
            or "linear:" in line_strip.lower()
        ):
            linkages.append(line_strip)
        else:
            remaining_lines.append(line)
    return linkages, "\n".join(remaining_lines).strip()


def _parse_sections(body_text: str) -> dict[str, str]:
    sections = {}
    current_section = "General"
    current_lines = []
    for line in body_text.splitlines():
        header_match = re.match(r"^##+\s+(.*)", line)
        if header_match:
            sections[current_section] = "\n".join(current_lines).strip()
            current_section = header_match.group(1).strip().lower()
            current_lines = []
        else:
            current_lines.append(line)
    if current_lines:
        sections[current_section] = "\n".join(current_lines).strip()
    return sections


def _append_checklist_line(line: str, checklist_items: list[str]) -> None:
    lstrip = line.strip()
    if not lstrip:
        return
    if lstrip.startswith(("- [ ]", "- [x]", "- [X]", "* [ ]", "* [x]", "* [X]")):
        checklist_items.append(lstrip)
    elif lstrip.startswith(("- ", "* ")):
        clean_item = re.sub(r"^[-*]\s*", "", lstrip)
        checklist_items.append(f"- [ ] {clean_item}")
    else:
        checklist_items.append(f"- [ ] {lstrip}")


def _add_bullets_to_checklist(sec_content: str, sec_name: str, checklist_items: list[str]) -> None:
    has_bullets = False
    for line in sec_content.splitlines():
        lstrip = line.strip()
        if lstrip.startswith(("- ", "* ", "- [ ]", "- [x]", "- [X]")):
            has_bullets = True
            break
    if has_bullets and sec_name in {"scope", "operational responsibility"}:
        for line in sec_content.splitlines():
            _append_checklist_line(line, checklist_items)


def _build_sections_data(sections: dict[str, str]) -> tuple[list[str], list[str], list[str]]:
    objective_parts = []
    specs_parts = []
    checklist_items = []
    for sec_name, sec_content in list(sections.items()):
        content = sec_content.strip()
        if not content:
            continue
        sec_name_lower = sec_name.lower()
        if sec_name_lower in {"general", "objective", "problem", "background", "current state", "current-truth"}:
            if sec_name_lower == "current state":
                objective_parts.append(f"**Current State**:\n{content}")
            else:
                objective_parts.append(content)
        elif sec_name_lower in {
            "scope",
            "implementation",
            "solution",
            "operational responsibility",
            "technical specs",
            "target state",
        }:
            if sec_name_lower == "target state":
                objective_parts.append(f"**Target State**:\n{content}")
                continue
            _add_bullets_to_checklist(content, sec_name_lower, checklist_items)
            specs_parts.append(content)
        elif sec_name_lower in {
            "definition of done",
            "completion criteria",
            "acceptance criteria",
            "checklist",
            "tasks",
        }:
            for line in content.splitlines():
                _append_checklist_line(line, checklist_items)
        else:
            specs_parts.append(f"**{sec_name}**:\n{content}")
    return objective_parts, specs_parts, checklist_items


def _process_bullets_fallback(specs_parts: list[str], checklist_items: list[str]) -> list[str]:
    temp_specs_parts = []
    for part in specs_parts:
        remaining_specs = []
        for line in part.splitlines():
            lstrip = line.strip()
            if lstrip.startswith(("- [ ]", "- [x]", "- [X]")):
                checklist_items.append(lstrip)
            elif lstrip.startswith(("- ", "* ")):
                clean_item = re.sub(r"^[-*]\s*", "", lstrip)
                checklist_items.append(f"- [ ] {clean_item}")
            else:
                remaining_specs.append(line)
        if remaining_specs:
            temp_specs_parts.append("\n".join(remaining_specs).strip())
    return temp_specs_parts


def parse_and_reformat_generic_issue(title: str, clean_body: str, key: str) -> str:
    """Intelligently parse the existing description and format it into the 4 GFM headings."""
    linkages, body_text = _extract_linkages(clean_body)
    sections = _parse_sections(body_text)
    obj_parts, specs_parts, checklist = _build_sections_data(sections)

    if not checklist:
        specs_parts = _process_bullets_fallback(specs_parts, checklist)

    is_placeholder = (
        not clean_body.strip()
        or "This task represents a core pipeline" in clean_body
        or clean_body.strip() == "Migrated from slimshadyme"
    )

    if is_placeholder:
        objective = f"Design, implement, and verify the capabilities for the task: '{title}'."
        specs = f"- **Sprint Scope**: General Feature Implementation\n- **Runtime Stack**: Astro 6, React 19, TypeScript, and Python (`uv` managed)\n- **Title Context**: {title}"
        checklist = [
            f"- [ ] Implement the core requirements for: {title}",
            "- [ ] Add unit/integration tests to verify functionality",
            "- [ ] Confirm that no TypeScript/Python compile errors or lint issues are introduced",
        ]
    else:
        objective = (
            "\n\n".join(obj_parts).strip() if obj_parts else f"Implement and verify the capabilities for: {title}"
        )
        specs = (
            "\n\n".join(specs_parts).strip()
            if specs_parts
            else f"- **Sprint Scope**: Backlog Improvement\n- **Title Context**: {title}"
        )

    if not checklist:
        checklist = [f"- [ ] Implement and verify the capabilities for: {title}"]

    # Clean checklist items
    cleaned_checklist = []
    for item in checklist:
        item_strip = item.strip()
        if item_strip.startswith(("- [ ]", "- [x]", "- [X]")):
            cleaned_checklist.append(item_strip)
        elif item_strip.startswith(("- ", "* ")):
            clean_item = re.sub(r"^[-*]\s*", "", item_strip)
            cleaned_checklist.append(f"- [ ] {clean_item}")
        else:
            cleaned_checklist.append(f"- [ ] {item_strip}")

    new_desc = (
        f"### Core Objective\n{objective}\n\n### Technical Design Specs\n{specs}\n\n### Atlassian & Code Linkages\n"
    )
    if linkages:
        new_desc += "\n".join(linkages) + "\n"
    else:
        new_desc += f"- **Linear Key**: {key}\n"

    new_desc += "\n### Verification & Testing Checklist\n" + "\n".join(cleaned_checklist)
    return new_desc.strip()


def enrich_issue(issue: dict[str, Any], pix_to_task: dict[str, Any]) -> tuple[str | None, str | None]:
    """Examine if the issue needs enrichment and return the body/source."""
    title = issue.get("title") or ""
    desc = issue.get("description") or ""
    key = issue.get("identifier") or ""

    clean_body, meta = parse_sync_metadata(desc)
    new_clean_desc = None
    match_source = None

    norm_title = title.replace("\u2011", "-").strip()

    if key in pix_to_task:
        task_num, task = pix_to_task[key]
        new_clean_desc = build_training_description(task_num, task, key)
        match_source = f"Training Plan Task {task_num}"
    elif norm_title in DEVOPS_PLATFORM_SPECS:
        new_clean_desc = DEVOPS_PLATFORM_SPECS[norm_title]["body"]
        match_source = f"DevOps Specs for '{title}'"
    elif norm_title in MAY_HEM_SPECS:
        new_clean_desc = MAY_HEM_SPECS[norm_title]["body"]
        match_source = f"May-Hem Specs for '{title}'"
    else:
        # Generic fallback parser
        new_clean_desc = parse_and_reformat_generic_issue(title, clean_body, key)
        match_source = "Generic Fallback Parser"

    if not new_clean_desc:
        return None, None

    if (
        "### Core Objective" in clean_body
        and "### Verification & Testing Checklist" in clean_body
        and not check_for_mismatch(title, clean_body)
    ):
        return None, None

    sync_meta = SyncMetadata(
        key=meta.get("key", key.lower()),
        status=meta.get("status", "open"),
        source_provider=meta.get("source-provider", "jira" if "Source plan" in desc else "linear"),
        source_id=meta.get("source-id", key),
        provider_ids={
            k: v for k, v in meta.items() if k not in {"key", "status", "source-provider", "source-id", "updated-at"}
        },
        updated_at=meta.get("updated-at"),
    )

    enriched_body = merge_body_with_sync_metadata(new_clean_desc.strip(), sync_meta)
    return enriched_body, match_source


def process_active_issues(
    active_issues: list[dict[str, Any]],
    issue_key_to_uuid: dict[str, str],
    pix_to_task: dict[str, Any],
    dry_run: bool,
) -> tuple[int, int]:
    """Loop through active issues to enrich them or mark them as duplicates."""
    enriched_count = 0
    duplicate_count = 0

    for issue in sorted(active_issues, key=lambda x: x.get("identifier", "")):
        key = issue.get("identifier")
        uuid = issue.get("id")
        title = issue.get("title") or ""

        if not key or not uuid:
            continue

        if key in ACTIVE_DUPLICATES:
            canonical_key = ACTIVE_DUPLICATES[key]
            canonical_uuid = issue_key_to_uuid.get(canonical_key)
            if canonical_uuid:
                logging.info("[%s] Marking duplicate of %s ('%s')...", key, canonical_key, title)
                execute_relation_and_status(uuid, canonical_uuid, key, dry_run)
                duplicate_count += 1
                logging.info("-" * 80)
            continue

        enriched_body, match_source = enrich_issue(issue, pix_to_task)
        if not enriched_body:
            continue

        logging.info("[%s] Enriching context using %s | Title: '%s'...", key, match_source, title)

        if dry_run:
            logging.info("  -> [Dry Run] Would update issue in Linear")
            logging.info("  -> Enriched Description Preview:\n%s", enriched_body[:400] + "...")
        else:
            action = {"action": "update", "target_id": uuid, "title": title, "body": enriched_body}
            try:
                apply_linear_action(action)
                logging.info("  -> Success!")
                enriched_count += 1
            except Exception as e:
                logging.error("  -> Error enriching issue: %s", e)

        logging.info("-" * 80)

    return enriched_count, duplicate_count


def main() -> int:
    """Execute task enrichment and duplicate resolution."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        logging.info("===== DRY RUN MODE =====")

    md_path = ".agent/internal/plans/TRAINING-PIPELINE-TASKS-2026-04-29.md"
    md_tasks = parse_md_all_tasks(md_path)
    training_mappings = get_training_mappings()

    pix_to_task = {}
    for num, task in md_tasks.items():
        pix_key = training_mappings.get(num)
        if pix_key:
            pix_to_task[pix_key] = (num, task)

    logging.info("Fetching issues from Linear...")
    try:
        issues = export_linear_issues()
    except Exception as e:
        logging.error("Error fetching Linear issues: %s", e)
        return 1

    logging.info("Loaded %d issues from Linear.", len(issues))

    issue_key_to_uuid: dict[str, str] = {
        str(i.get("identifier")): str(i.get("id")) for i in issues if i.get("identifier") and i.get("id")
    }

    active_statuses = {"Todo", "In Progress", "Triage", "Backlog"}
    active_issues = [i for i in issues if (i.get("state") or {}).get("name") in active_statuses]

    logging.info("Found %d active issues.", len(active_issues))

    enriched_count, duplicate_count = process_active_issues(active_issues, issue_key_to_uuid, pix_to_task, dry_run)

    logging.info(
        "Enrichment complete. Enriched %d active issues. Resolved %d duplicates.",
        enriched_count,
        duplicate_count,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
