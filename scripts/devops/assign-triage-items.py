#!/usr/bin/env python3
"""Assign all 65 unassigned triage items to correct Linear projects."""

import logging
import os
import sys
import time

sys.path.insert(0, os.getcwd())
from scripts.task_sync.provider_bridge import (
    _extract_graphql_payload,
    _linear_graphql_query,
    export_linear_issues,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Project IDs (from .agent/internal/config + improve-linear-workspace.py)
PROJECTS = {
    "Training Pipeline Improvements": "70c0c2a7-35d9-492a-bba5-0531ed028ea7",
    "Foresight Memory Architecture": "8f9aad1c-fd4c-4cf6-9a3b-2ceb267ef133",
    "AutoReview Workflow Improvements": "2889fe87-ad71-4edf-99c5-75224ee3f18f",
    "CI Federation & Release Readiness": "f7dda0b0-c075-4fe7-a17e-8046a850f6b6",
    "Platform Foundations & Operations": "f5dc528d-c1ff-447b-9626-b11813f0dc6e",
    "Data Governance & Compliance": "0aa3ad95-f694-4633-88c9-e127865a0ba1",
    "Test Coverage & Security Baseline": "97409cfb-e01c-4094-9728-577c79bf53ae",
    "Hybrid App Architecture Migration": "732c7ac7-4db7-4959-8bc8-bc1ab497a8e0",
    "Discovery & Backlog": "4a928f0c-ef75-4bfc-9598-bddd3490b06c",
    "Checkmate": "97b72bac-e84b-46e4-a82e-dc657030dcb9",
    "Churnmeon Reliability": "7fb7fc08-8b19-4210-8215-f73f3b559a46",
    "Memory May-Hem Expansion": "022b75fa-d681-4070-b3e3-0d152d7daf1e",
    "Modern Dataset Project": "dd29a94c-6283-4c13-9eef-0f7546321f1d",
    "Data Pipeline Recovery & External Integrations": "07810eff-50bb-4518-974a-07b4938f3264",
}

STATE_BACKLOG = "74b11563-2856-45f3-bcb7-e813702cd73f"
STATE_TODO = "d47f8fab-abb9-474e-879b-9c581a9852ed"


def update_issue(issue_id, **fields):
    mutation = """
    mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success }
    }
    """
    try:
        res = _linear_graphql_query(mutation, {"id": issue_id, "input": fields})
        data = _extract_graphql_payload(res)
        return data.get("issueUpdate", {}).get("success", False)
    except Exception as e:
        logging.error(f"Update failed: {e}")
        return False


# Title-based assignment rules - specific identifier mappings
SPECIFIC = {
    # Training Pipeline Improvements
    "PIX-3799": "Training Pipeline Improvements",
    "PIX-3797": "Training Pipeline Improvements",
    "PIX-3796": "Training Pipeline Improvements",
    "PIX-3798": "Training Pipeline Improvements",
    "PIX-3800": "Training Pipeline Improvements",
    "PIX-3795": "Training Pipeline Improvements",
    "PIX-3793": "Training Pipeline Improvements",
    "PIX-3823": "Training Pipeline Improvements",
    "PIX-3792": "Training Pipeline Improvements",
    "PIX-3820": "Training Pipeline Improvements",
    "PIX-3822": "Training Pipeline Improvements",
    "PIX-3815": "Training Pipeline Improvements",
    "PIX-3821": "Training Pipeline Improvements",
    "PIX-3816": "Training Pipeline Improvements",
    "PIX-3788": "Training Pipeline Improvements",
    "PIX-3824": "Training Pipeline Improvements",
    "PIX-3770": "Training Pipeline Improvements",
    "PIX-3772": "Training Pipeline Improvements",
    "PIX-3773": "Training Pipeline Improvements",
    "PIX-3771": "Modern Dataset Project",
    "PIX-3768": "Training Pipeline Improvements",
    "PIX-3767": "Modern Dataset Project",
    "PIX-3811": "Training Pipeline Improvements",
    "PIX-3818": "Training Pipeline Improvements",
    # Foresight Memory Architecture
    "PIX-3819": "Foresight Memory Architecture",
    "PIX-3785": "Foresight Memory Architecture",
    "PIX-3786": "Foresight Memory Architecture",
    "PIX-3787": "Foresight Memory Architecture",
    "PIX-3790": "Foresight Memory Architecture",
    "PIX-3784": "Foresight Memory Architecture",
    "PIX-3805": "Foresight Memory Architecture",
    "PIX-3791": "Foresight Memory Architecture",
    "PIX-3794": "Foresight Memory Architecture",
    "PIX-3782": "Foresight Memory Architecture",
    "PIX-3817": "Foresight Memory Architecture",
    "PIX-3783": "Foresight Memory Architecture",
    "PIX-3779": "Foresight Memory Architecture",
    "PIX-3813": "Foresight Memory Architecture",
    "PIX-3801": "Foresight Memory Architecture",
    "PIX-3814": "Foresight Memory Architecture",
    "PIX-3808": "Foresight Memory Architecture",
    # AutoReview
    "PIX-3780": "AutoReview Workflow Improvements",
    "PIX-3781": "AutoReview Workflow Improvements",
    "PIX-3777": "AutoReview Workflow Improvements",
    # CI Federation
    "PIX-3806": "CI Federation & Release Readiness",
    "PIX-3807": "CI Federation & Release Readiness",
    "PIX-3809": "CI Federation & Release Readiness",
    "PIX-3802": "CI Federation & Release Readiness",
    # Platform
    "PIX-3769": "Platform Foundations & Operations",
    "PIX-3778": "Platform Foundations & Operations",
    "PIX-3775": "Platform Foundations & Operations",
    "PIX-3810": "Platform Foundations & Operations",
    # Data Governance
    "PIX-3812": "Data Governance & Compliance",
    "PIX-3825": "Data Governance & Compliance",
    "PIX-3766": "Data Governance & Compliance",
    # Test Coverage & Security
    "PIX-3765": "Test Coverage & Security Baseline",
    "PIX-3764": "Test Coverage & Security Baseline",
    "PIX-3763": "Test Coverage & Security Baseline",
    # Hybrid App
    "PIX-3826": "Hybrid App Architecture Migration",
    "PIX-3803": "Hybrid App Architecture Migration",
    # Discovery
    "PIX-3804": "Discovery & Backlog",
    # Checkmate
    "PIX-3789": "Checkmate",
    # Churnmeon
    "PIX-3774": "Churnmeon Reliability",
    # Platform (tri-sync sentinel)
    "PIX-3827": "Platform Foundations & Operations",
}


def main():
    logging.info("=" * 60)
    logging.info("Assigning Triage items to projects")
    logging.info("=" * 60)

    issues = export_linear_issues()
    issue_map = {i.get("identifier"): i for i in issues if i.get("identifier")}

    assigned = 0
    errors = 0
    skipped = 0

    for key, project_name in sorted(SPECIFIC.items()):
        issue = issue_map.get(key)
        if not issue:
            logging.warning(f"  {key}: not found in Linear, skipping")
            skipped += 1
            continue

        uuid = issue["id"]
        project_id = PROJECTS[project_name]

        proj = issue.get("project") or {}
        current_proj = proj.get("name") if isinstance(proj, dict) else None

        # Assign to project and move from Triage to Backlog
        if current_proj:
            logging.info(f"  {key}: already in project '{current_proj}', skipping")
            skipped += 1
            continue

        # Assign to project and move from Triage to Backlog
        updates = {"projectId": project_id, "stateId": STATE_BACKLOG}

        logging.info(f" Assigning {key} ({issue.get('title', '')[:50]}...) -> {project_name}")

        success = update_issue(uuid, **updates)
        if success:
            assigned += 1
            logging.info(" ✅ Done")
        else:
            errors += 1
            logging.error(" ❌ Failed")

        # Small rate-limit delay
        time.sleep(0.25)

    logging.info(f"\n{'=' * 60}")
    logging.info(f"Results: {assigned} assigned, {errors} errors, {skipped} skipped")
    logging.info(f"{'=' * 60}")

    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
