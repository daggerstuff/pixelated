#!/usr/bin/env python
"""Systematically cleanup, optimize, and enhance Linear tickets."""

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
    export_linear_issues,
)

# Status IDs
STATUS_DUPLICATE = "0b40a450-946c-48b0-9e85-d0676c800b76"
STATUS_DONE = "6024760d-da33-4bf4-b3bf-463546bbef4a"
STATUS_CANCELED = "1a98745d-dd54-4796-bc6d-12fc794f8cea"

# Project IDs
PROJECTS = {
    "Foresight Memory Architecture": "8f9aad1c-fd4c-4cf6-9a3b-2ceb267ef133",
    "Platform Foundations & Operations": "f5dc528d-c1ff-447b-9626-b11813f0dc6e",
    "Memory May-Hem Expansion": "022b75fa-d681-4070-b3e3-0d152d7daf1e",
    "Modern Dataset Project": "dd29a94c-6283-4c13-9eef-0f7546321f1d",
    "Data Pipeline Recovery & External Integrations": "07810eff-50bb-4518-974a-07b4938f3264",
    "CI Federation & Release Readiness": "f7dda0b0-c075-4fe7-a17e-8046a850f6b6",
    "Data Governance & Compliance": "0aa3ad95-f694-4633-88c9-e127865a0ba1",
}

# 1. Project Re-assignments
PROJECT_REASSIGNMENTS = {
    "PIX-1919": "Foresight Memory Architecture",
    "PIX-1895": "Foresight Memory Architecture",
    "PIX-1905": "Foresight Memory Architecture",
    "PIX-509": "Platform Foundations & Operations",
    "PIX-1636": "Memory May-Hem Expansion",
    "PIX-1634": "Memory May-Hem Expansion",
    "PIX-1627": "Modern Dataset Project",
    "PIX-1631": "Modern Dataset Project",
    "PIX-1366": "Modern Dataset Project",
    "PIX-1865": "Modern Dataset Project",
    "PIX-1367": "Modern Dataset Project",
    "PIX-1866": "Modern Dataset Project",
    "PIX-1622": "Platform Foundations & Operations",
    "PIX-1900": "Platform Foundations & Operations",
    "PIX-1623": "Data Pipeline Recovery & External Integrations",
}

# 2. Status Updates (Duplicates or Done)
STATUS_UPDATES = {
    # Duplicate stubs of Done/completed tasks -> Duplicate
    "PIX-1903": (STATUS_DUPLICATE, "Duplicate of completed Sprint 1 task PIX-510"),
    "PIX-225": (STATUS_DUPLICATE, "Duplicate of completed task PIX-320"),
    "PIX-1885": (STATUS_DUPLICATE, "Duplicate of completed task PIX-231"),
    "PIX-1906": (STATUS_DUPLICATE, "Duplicate of active task PIX-317"),
    "PIX-1895": (STATUS_DUPLICATE, "Duplicate of active task PIX-355"),
    "PIX-1904": (STATUS_DUPLICATE, "Duplicate of active task PIX-215"),
    "PIX-229": (STATUS_DUPLICATE, "Duplicate of completed task PIX-316"),
    "PIX-1905": (STATUS_DUPLICATE, "Duplicate of completed SQLite connection pooling task PIX-393"),
    "PIX-520": (STATUS_DUPLICATE, "Duplicate of completed Socratic gate integration task PIX-522"),
    "PIX-1636": (STATUS_DUPLICATE, "Duplicate of completed gate unit tests task PIX-524"),
    "PIX-1919": (STATUS_DUPLICATE, "Duplicate of completed crisis detection refactor task PIX-354"),
    "PIX-1627": (STATUS_DUPLICATE, "Duplicate of completed privacy gates task PIX-248"),
    "PIX-1631": (STATUS_DUPLICATE, "Duplicate of completed normalization task PIX-247"),
    "PIX-1366": (STATUS_DUPLICATE, "Duplicate of completed reprioritization task PIX-536"),
    "PIX-1865": (STATUS_DUPLICATE, "Duplicate of completed reprioritization task PIX-536"),
    "PIX-1367": (STATUS_DUPLICATE, "Duplicate of completed steering integration task PIX-537"),
    "PIX-1866": (STATUS_DUPLICATE, "Duplicate of completed steering integration task PIX-537"),
    "PIX-1899": (STATUS_DUPLICATE, "Duplicate of tri-sync sentinel task PIX-240"),
    "PIX-1622": (STATUS_DUPLICATE, "Duplicate of tri-sync sentinel task PIX-240"),
    "PIX-1900": (STATUS_DUPLICATE, "Duplicate of tri-sync sentinel task PIX-240"),
    "PIX-227": (STATUS_DUPLICATE, "Duplicate of completed task PIX-277"),
    # Already completed but marked In Progress/Todo
    "PIX-408": (STATUS_DONE, "threading import replacement is already completed in codebase"),
}

# 3. Restored/Enhanced Descriptions
ENHANCED_DESCRIPTIONS = {
    "PIX-1916": """### Core Objective
Implement the real-time clinical safety and data ingestion gating layer to screen all conversational inputs, evaluate safety levels, detect high emotional arousal, and route messages dynamically.

### Technical Design Specs
- **Ingestion Pipeline**:
  - Build an async ingestion pipeline using Fast API in `ai-services` that intermediates between the React UI layer and the core memory storage adapter.
  - Integrate an LLM-based safety classifier that screens patient inputs against defined diagnostic criteria.
- **React UI Gating Integration**:
  - Design React components displaying real-time screening states (Ingesting, Gating, Safety Verified, Routed) using micro-animations.
  - Provide immediate feedback to the therapist if critical safety flags (e.g. self-harm, severe crisis) are detected.
- **Safety Routing Engine**:
  - Route standard messages to standard memory collections and flag high-arousal messages for immediate professional escalation.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-20: AI Ingestion and Safety Protocols](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Fast API Gate Controller: `ai-services/ingestion/gate.py`
  - React Chat Screen: `src/components/chat/TherapyGate.tsx`
  - Database collection schemas: `packages/memory-schema/src/gate-types.ts`

### Verification & Testing Checklist
- [ ] **End-to-End Specs**: Create a Playwright integration test at `e2e/chat-gating.spec.ts` asserting that safety blocks render instantly when flagged input is injected.
- [ ] **Performance Profiling**: Run load testing simulating 100 concurrent chat session ingestions and verify average response time remains `< 200ms`.
- [ ] **Safety Rule Verification**: Ensure all boundary inputs (empty messages, massive blocks of text, special markdown characters) are correctly handled without crashing.
""",
    "PIX-1915": """### Core Objective
Build the background memory consolidation and summarization engine ("Dreaming") that runs offline to analyze daily interaction logs, synthesize long-term semantic understandings, and execute database garbage collection.

### Technical Design Specs
- **Offline Dream Scheduler**:
  - Implement a cron-based scheduler using BullMQ (backed by local Redis container) to trigger dream consolidation cycles during off-peak hours.
- **Cognitive Summarization Model**:
  - Utilize pre-trained text transformers to extract core therapeutic themes, patient emotional progress markers, and key cognitive behavioral milestones.
  - Save unified, high-level summaries to the patient's long-term memory store in MongoDB.
- **Data Compaction & Garbage Collection**:
  - Prune obsolete, redundant chat logs and temporary caches to keep database storage footprint optimized.
  - Ensure correct primary key references are maintained across compacted collections.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-21: Cognitive Reflection and Offline Processing](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Dream Scheduler Service: `src/services/dream_scheduler.ts`
  - ML Summarization Task: `ai-services/dream/consolidation.py`
  - Worker Handler: `src/workers/dream_worker.ts`

### Verification & Testing Checklist
- [ ] **Integration Tests**: Write an integration suite verifying that a completed dream consolidation cycle successfully:
  - Produces a coherent long-term memory document.
  - Deletes raw session caches as configured.
  - Maintains strict referential integrity.
- [ ] **Memory Indexing Performance**: Audit read/write query latency before and after running a dream cycle, ensuring indexing speeds are improved by at least 15%.
- [ ] **Failure Recovery**: Interrupt a dream worker mid-processing and confirm that the system handles job retries via Redis seamlessly without duplicating summaries.
""",
    "PIX-1914": """### Core Objective
Build the client-side/agent-side self-reflection and learning logic that analyzes recent actions, evaluates outcomes, detects cognitive patterns, and automatically updates the active Foresight guidance.

### Technical Design Specs
- **Reflection Engine Integration**:
  - Implement the reflection triggers based on task completion and user feedback signals.
  - Set up a prompt provider that constructs a rich evaluation context using execution logs and database updates.
- **Guidance & Preferences Update**:
  - Implement the automated logic that translates reflection insights into concrete updates in the `self_improvement` and `guidance` context blocks.
  - Prevent duplicate or contradicting guidelines through similarity checks and curation scoring.
- **Performance Evaluation**:
  - Add standard metrics tracking for self-reflection loops (token cost, generation latency, revision counts, user approval rates).

### Atlassian & Code Linkages
- **Primary Source Code**:
  - Reflection client: `ai/memory/reflection_memory.py`
  - Prompts & Prompts Provider: `ai/memory/reflection_prompts.py`, `ai/memory/reflection_prompt_provider.py`
  - Subagent Handler: `ai/memory/reflection_subagent.py`

### Verification & Testing Checklist
- [ ] **Unit and Integration Tests**: Run `uv run pytest ai/tests/test_reflection_memory.py` and verify all reflection generation, parsing, and update tests pass.
- [ ] **Mock Loop Execution**: Trigger a mock reflection loop and confirm that new guidance blocks are successfully generated and saved to the database.
""",
    "PIX-408": """### Core Objective
Replace the dynamic `__import__('threading')` call with a standard, explicit `import threading` statement at the top of the module, cleaning up import patterns and improving static type analysis.

### Status
Completed. The reflection/reprioritization module now uses standard, static imports for the `threading` library, and `__import__('threading')` has been completely removed.
""",
    "PIX-1904": """### Core Objective
Refactor the user profile data model to consolidate legacy authentication fields, support multi-org/multi-workspace scoping, and implement a safe, rollback-enabled database migration plan.

### Technical Design Specs
- **Data Model Overhaul**:
  - Update user schema to support `workspace_id` and role-based access control (RBAC).
  - Migrate legacy auth fields (auth0/supabase references) into a unified identity provider object.
- **Migration Pipeline**:
  - Write database migration scripts to transition existing user profiles without data loss.
  - Implement a dual-write phase or backward-compatibility layer during transition to prevent service disruption.
  - Setup automated rollback checks in case migration verification fails.

### Verification & Testing Checklist
- [ ] **Unit and Integration Tests**:
  - Run database migration scripts against a mock database populated with legacy user profiles and verify all profiles migrate successfully.
  - Assert that query performance for user profiles remains stable or improves.
- [ ] **Compatibility Check**:
  - Verify that the target SPA and mobile app can authenticate and load profiles correctly under both old and new data model formats.
""",
    "PIX-215": """### Core Objective
Refactor the user profile data model to consolidate legacy authentication fields, support multi-org/multi-workspace scoping, and implement a safe, rollback-enabled database migration plan.

### Technical Design Specs
- **Data Model Overhaul**:
  - Update user schema to support `workspace_id` and role-based access control (RBAC).
  - Migrate legacy auth fields (auth0/supabase references) into a unified identity provider object.
- **Migration Pipeline**:
  - Write database migration scripts to transition existing user profiles without data loss.
  - Implement a dual-write phase or backward-compatibility layer during transition to prevent service disruption.
  - Setup automated rollback checks in case migration verification fails.

### Verification & Testing Checklist
- [ ] **Unit and Integration Tests**:
  - Run database migration scripts against a mock database populated with legacy user profiles and verify all profiles migrate successfully.
  - Assert that query performance for user profiles remains stable or improves.
- [ ] **Compatibility Check**:
  - Verify that the target SPA and mobile app can authenticate and load profiles correctly under both old and new data model formats.
""",
}


# Normalize text for description comparison to handle Linear's markdown parser conversions
def normalize_text_for_comparison(text: str) -> str:
    if not text:
        return ""
    main_part = text.split("<!-- pixelated-sync", 1)[0]
    cleaned = re.sub(r"\\", "", main_part)
    cleaned = re.sub(r"[*#_\-\[\]()]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip().lower()


# Repair corrupted backtick code block headers in list/scope/checklist items
def repair_description_formatting(desc: str) -> str:
    if not desc:
        return desc

    # Pattern 1: ```\n1. Task Overview\n``` -> ### 1. Task Overview
    desc = re.sub(r"```\s*\n\s*(\d+\.\s+Task Overview)\s*\n\s*```", r"### \1", desc)
    # Pattern 2: ```\n1. Implementation Checklist\n``` -> ### 2. Implementation Checklist
    desc = re.sub(r"```\s*\n\s*(\d+\.\s+Implementation Checklist)\s*\n\s*```", r"### \1", desc)
    # Pattern 3: ```\n  1. Remediation Scope\n``` -> ### 1. Remediation Scope
    desc = re.sub(r"```\s*\n\s*(\d+\.\s+Remediation Scope)\s*\n\s*```", r"### \1", desc)

    # Generic fix for any of the main headers wrapped in backticks:
    headers = [
        "Task Overview",
        "Implementation Checklist",
        "Objective",
        "Milestones",
        "Success Metrics",
        "Definition of Done",
        "Verified Files",
        "Path Notes",
        "Dependencies",
        "Status",
        "Background",
        "Target Release",
        "Remediation Scope",
    ]
    for header in headers:
        desc = re.sub(
            r"```\s*\n\s*(\d+\.\s+" + re.escape(header) + r")\s*\n\s*```",
            r"### \1",
            desc,
            flags=re.IGNORECASE,
        )
        desc = re.sub(
            r"```\s*\n\s*(" + re.escape(header) + r")\s*\n\s*```",
            r"### \1",
            desc,
            flags=re.IGNORECASE,
        )
    return desc


def _check_project_reassignment(key: str, curr_proj_id: str | None) -> str | None:
    proj_name = PROJECT_REASSIGNMENTS.get(key)
    if proj_name:
        proj_id = PROJECTS[proj_name]
        if curr_proj_id != proj_id:
            return proj_id
    return None


def _check_status_update(
    key: str, curr_state_id: str | None, issue_key_to_uuid: dict[str, str]
) -> tuple[str | None, str | None, str | None]:
    if key not in STATUS_UPDATES:
        return None, None, None
    status_id, explanation = STATUS_UPDATES[key]
    if curr_state_id == status_id:
        return None, None, None

    target_uuid = None
    if status_id == STATUS_DUPLICATE:
        m = re.search(r"PIX-\d+", explanation)
        if m:
            target_uuid = issue_key_to_uuid.get(m.group(0))
    return status_id, explanation, target_uuid


def _check_description_update(key: str, curr_desc: str) -> tuple[str | None, str | None]:
    new_desc = ENHANCED_DESCRIPTIONS.get(key)
    if new_desc:
        if "<!-- pixelated-sync" in curr_desc:
            sync_part = curr_desc.split("<!-- pixelated-sync", 1)[1]
            new_desc = new_desc.strip() + "\n\n<!-- pixelated-sync" + sync_part
        if normalize_text_for_comparison(new_desc) != normalize_text_for_comparison(curr_desc):
            return new_desc, "Update/restore correct technical description"
    else:
        repaired_desc = repair_description_formatting(curr_desc)
        if repaired_desc != curr_desc:
            return repaired_desc, "Repair corrupted backtick headers/lists in description"
    return None, None


def _check_title_normalization(key: str, curr_title: str) -> tuple[str | None, str | None]:
    repaired_title = re.sub(r"^\*(\d+\.\d+)([A-Za-z])", r"*\1 \2", curr_title)
    repaired_title = re.sub(r"^‡(\d+\.\d+)([A-Za-z])", r"‡\1 \2", repaired_title)
    reason = None
    if key == "PIX-227":
        repaired_title = "Data Governance - Task 3.1: Unified event aggregation"
        if curr_title != repaired_title:
            reason = "Fix title mismatch (was scoped scoping, should be event aggregation)"
    if repaired_title != curr_title:
        if not reason:
            reason = f"Normalize title to '{repaired_title}'"
        return repaired_title, reason
    return None, None


def check_issue_updates(
    issue: dict[str, Any], issue_key_to_uuid: dict[str, str]
) -> tuple[dict[str, Any], list[str], str | None]:
    key = issue.get("identifier")
    input_payload = {}
    reason_parts = []
    target_uuid = None

    if not key:
        return input_payload, reason_parts, target_uuid

    # 1. Project Reassignment check
    curr_proj = issue.get("project") or {}
    proj_id = _check_project_reassignment(key, curr_proj.get("id"))
    if proj_id:
        input_payload["projectId"] = proj_id
        reason_parts.append(f"Assign project to '{PROJECT_REASSIGNMENTS[key]}'")

    # 2. Status update check
    curr_state = issue.get("state") or {}
    status_id, explanation, dupe_uuid = _check_status_update(key, curr_state.get("id"), issue_key_to_uuid)
    if status_id:
        input_payload["stateId"] = status_id
        reason_parts.append(f"Set status to status_id '{status_id}' ({explanation})")
        target_uuid = dupe_uuid

    # 3. Description enhancement check
    curr_desc = issue.get("description") or ""
    desc_val, desc_reason = _check_description_update(key, curr_desc)
    if desc_val:
        input_payload["description"] = desc_val
        reason_parts.append(desc_reason)

    # 4. Title normalization check
    curr_title = issue.get("title") or ""
    title_val, title_reason = _check_title_normalization(key, curr_title)
    if title_val:
        input_payload["title"] = title_val
        reason_parts.append(title_reason)

    return input_payload, reason_parts, target_uuid


def execute_issue_update(
    uuid: str,
    input_payload: dict[str, Any],
    target_uuid: str | None,
    dry_run: bool,
):
    if dry_run:
        if target_uuid:
            logging.info("  -> [Dry Run] Would create duplicate relation")
        return

    # If marking as duplicate, create the duplicate relation first
    if target_uuid:
        logging.info("  -> Creating duplicate relation with UUID %s...", target_uuid)
        relation_mutation = (
            "mutation($issueId: String!, $relatedIssueId: String!) { "
            "issueRelationCreate(input: { issueId: $issueId, relatedIssueId: $relatedIssueId, type: duplicate }) { "
            "success } }"
        )
        relation_vars = {"issueId": uuid, "relatedIssueId": target_uuid}
        try:
            rel_res = _linear_graphql_query(relation_mutation, relation_vars)
            extracted_rel = _extract_graphql_payload(rel_res)
            logging.info(
                "  -> Relation success: %s",
                extracted_rel.get("issueRelationCreate", {}).get("success"),
            )
        except Exception as e:
            logging.error("  -> Error creating duplicate relation: %s", e)

    # Execute GraphQL mutation
    mutation = (
        "mutation($id: String!, $input: IssueUpdateInput!) { "
        "issueUpdate(id: $id, input: $input) { success issue { id title } } }"
    )
    variables = {"id": uuid, "input": input_payload}
    try:
        response = _linear_graphql_query(mutation, variables)
        extracted = _extract_graphql_payload(response)
        logging.info("  -> Success: %s", extracted.get("issueUpdate", {}).get("success"))
    except Exception as e:
        logging.error("  -> Error updating issue: %s", e)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        logging.info("===== DRY RUN MODE =====")

    logging.info("Fetching issues from Linear...")
    issues = export_linear_issues()
    logging.info("Loaded %d issues from Linear.", len(issues))

    issue_key_to_uuid = {i.get("identifier"): i.get("id") for i in issues if i.get("identifier") and i.get("id")}

    updates_count = 0
    for issue in sorted(issues, key=lambda x: x.get("identifier", "")):
        key = issue.get("identifier")
        uuid = issue.get("id")
        if not key or not uuid:
            continue

        input_payload, reason_parts, target_uuid = check_issue_updates(issue, issue_key_to_uuid)

        if input_payload:
            updates_count += 1
            curr_title = issue.get("title") or ""
            curr_state_name = issue.get("state", {}).get("name")
            curr_proj_name = issue.get("project", {}).get("name") if issue.get("project") else "None"
            logging.info(
                "[%s] Title: '%s' | Status: %s | Project: %s",
                key,
                curr_title,
                curr_state_name,
                curr_proj_name,
            )
            logging.info("  -> Required changes: %s", ", ".join(reason_parts))

            execute_issue_update(uuid, input_payload, target_uuid, dry_run)
            logging.info("-" * 80)

    logging.info("Processed %d issues needing updates.", updates_count)


if __name__ == "__main__":
    main()
