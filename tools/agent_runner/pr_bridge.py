"""Pull Request bridge generating conventional commits and opening PRs via GitHub CLI."""

from __future__ import annotations

import json
import logging
import os
import subprocess
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("agent_runner.pr_bridge")


@dataclass
class PRCreationResult:
    success: bool
    pr_url: str = ""
    commit_sha: str = ""
    error: str = ""


class PullRequestBridge:
    """Automates conventional commit formatting and pull request creation via gh CLI."""

    def __init__(self, enabled: bool = True, checkpoint_path: str | None = None):
        self.enabled = enabled
        self.checkpoint_path = checkpoint_path

    def format_commit_message(
        self,
        ticket_identifier: str,
        title: str,
        description: str = "",
        context: dict[str, Any] | None = None,
    ) -> str:
        """Format conventional commit message linking Linear ticket."""
        clean_title = title.strip()
        prefix = "feat"
        lower_t = clean_title.lower()
        if "security" in lower_t or "audit" in lower_t:
            prefix = "sec"
        elif "fix" in lower_t or "bug" in lower_t:
            prefix = "fix"
        elif "refactor" in lower_t or "clean" in lower_t:
            prefix = "refactor"
        elif "test" in lower_t or "e2e" in lower_t:
            prefix = "test"
        elif "docs" in lower_t:
            prefix = "docs"

        summary = f"{prefix}({ticket_identifier}): {clean_title}"
        body_parts: list[str] = []
        if description.strip():
            body_parts.append(description.strip())

        thinking = ""
        if context:
            raw_thinking = context.get("thinking")
            if isinstance(raw_thinking, str):
                thinking = raw_thinking.strip()

        if thinking:
            body_parts.append(f"<thinking>\n{thinking}\n</thinking>")

        body_parts.append(f"Closes {ticket_identifier}")
        body = "\n\n".join(body_parts)
        return f"{summary}\n\n{body}"

    def rebase_branch(self, worktree_path: str, base_branch: str = "staging") -> bool:
        fetch_res = subprocess.run(
            ["git", "fetch", "origin", base_branch],
            cwd=worktree_path,
            capture_output=True,
            text=True,
            check=False,
        )
        if fetch_res.returncode != 0:
            logger.warning("Could not fetch origin %s: %s", base_branch, fetch_res.stderr)
            return False

        rebase_res = subprocess.run(
            ["git", "rebase", f"origin/{base_branch}"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
            check=False,
        )
        if rebase_res.returncode != 0:
            logger.warning("Could not rebase onto origin/%s: %s", base_branch, rebase_res.stderr)
            return False

        return True

    def _write_checkpoint(
        self,
        worktree_path: str,
        ticket_identifier: str,
        branch_name: str,
        commit_sha: str,
        pr_url: str,
    ) -> None:
        checkpoint_path = self.checkpoint_path
        if not checkpoint_path:
            checkpoint_path = os.path.join(worktree_path, ".agent-runner", "pr-checkpoints.json")

        os.makedirs(os.path.dirname(checkpoint_path), exist_ok=True)
        existing: dict[str, Any] = {}
        if os.path.exists(checkpoint_path):
            try:
                with open(checkpoint_path, encoding="utf-8") as f:
                    existing = json.load(f)
            except (OSError, json.JSONDecodeError):
                existing = {}

        existing[ticket_identifier] = {
            "branch_name": branch_name,
            "commit_sha": commit_sha,
            "pr_url": pr_url,
            "status": "created",
        }
        with open(checkpoint_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)

    def merge_clean_pr(self, pr_number: str, worktree_path: str = ".") -> bool:
        view_res = subprocess.run(
            [
                "gh",
                "pr",
                "view",
                pr_number,
                "--json",
                "mergeable,state,reviewDecision,statusCheckRollup",
            ],
            cwd=worktree_path,
            capture_output=True,
            text=True,
            check=False,
        )
        if view_res.returncode != 0:
            logger.warning("Could not inspect PR %s: %s", pr_number, view_res.stderr)
            return False

        try:
            pr_state = json.loads(view_res.stdout)
        except json.JSONDecodeError:
            logger.warning("PR %s returned non-JSON state", pr_number)
            return False

        checks_ok = all(check.get("state") == "SUCCESS" for check in pr_state.get("statusCheckRollup", []))
        mergeable = pr_state.get("mergeable") == "MERGEABLE"
        open_state = pr_state.get("state") == "OPEN"
        no_requested_changes = pr_state.get("reviewDecision") != "CHANGES_REQUESTED"

        if not (checks_ok and mergeable and open_state and no_requested_changes):
            return False

        merge_res = subprocess.run(
            ["gh", "pr", "merge", pr_number, "--squash", "--delete-branch"],
            cwd=worktree_path,
            capture_output=True,
            text=True,
            check=False,
        )
        if merge_res.returncode != 0:
            logger.warning("Could not merge PR %s: %s", pr_number, merge_res.stderr)
            return False

        return True

    def commit_and_create_pr(
        self,
        worktree_path: str,
        ticket_identifier: str,
        title: str,
        description: str = "",
        context: dict[str, Any] | None = None,
    ) -> PRCreationResult:
        """Commit changes in worktree, and optionally push branch and open GitHub PR."""
        try:
            # Check if there are changes to commit
            status_res = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=worktree_path,
                capture_output=True,
                text=True,
                check=False,
            )
            if not status_res.stdout.strip():
                return PRCreationResult(success=True, pr_url="", error="No file changes detected to commit.")

            # Format commit
            self.rebase_branch(worktree_path)

            commit_msg = self.format_commit_message(ticket_identifier, title, description, context)

            # Stage and commit in any modified submodules first
            subprocess.run(
                [
                    "git",
                    "submodule",
                    "foreach",
                    "--recursive",
                    f"git add -A && git commit --no-verify -m {json.dumps(commit_msg)} || true",
                ],
                cwd=worktree_path,
                capture_output=True,
                check=False,
            )

            # Stage all changes (including updated submodule pointers)
            subprocess.run(["git", "add", "-A"], cwd=worktree_path, check=True)
            subprocess.run(["git", "commit", "--no-verify", "-m", commit_msg], cwd=worktree_path, check=True)

            # Get commit sha
            sha_res = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=worktree_path,
                capture_output=True,
                text=True,
                check=True,
            )
            commit_sha = sha_res.stdout.strip()

            if not self.enabled:
                return PRCreationResult(success=True, commit_sha=commit_sha, error="")

            # Push branch
            branch_name = context.get("branch_name") if context else None
            if not branch_name:
                branch_res = subprocess.run(
                    ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                    cwd=worktree_path,
                    capture_output=True,
                    text=True,
                    check=True,
                )
                branch_name = branch_res.stdout.strip()

            push_res = subprocess.run(
                ["git", "push", "-u", "origin", branch_name],
                cwd=worktree_path,
                capture_output=True,
                text=True,
                check=False,
                timeout=60,
            )
            if push_res.returncode != 0:
                logger.warning("Could not push branch %s to remote: %s", branch_name, push_res.stderr)
                return PRCreationResult(
                    success=False, commit_sha=commit_sha, error=f"Git push failed: {push_res.stderr}"
                )

            # Open PR via gh cli
            pr_cmd = [
                "gh",
                "pr",
                "create",
                "--title",
                f"[{ticket_identifier}] {title}",
                "--body",
                f"Automated PR created by agent harness for Linear issue **{ticket_identifier}**.\n\n{description}",
                "--head",
                branch_name,
            ]
            pr_res = subprocess.run(
                pr_cmd,
                cwd=worktree_path,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            if pr_res.returncode == 0:
                pr_url = pr_res.stdout.strip()
                logger.info("Created GitHub PR for %s: %s", ticket_identifier, pr_url)
                self._write_checkpoint(worktree_path, ticket_identifier, branch_name, commit_sha, pr_url)
                return PRCreationResult(success=True, pr_url=pr_url, commit_sha=commit_sha)
            logger.warning("GitHub CLI PR creation failed: %s", pr_res.stderr)
            return PRCreationResult(success=False, commit_sha=commit_sha, error=pr_res.stderr)

        except Exception as e:
            logger.exception("Error creating PR for %s: %s", ticket_identifier, e)
            return PRCreationResult(success=False, error=str(e))
