"""Pull Request bridge generating conventional commits and opening PRs via GitHub CLI."""

from __future__ import annotations

import logging
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

    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    def format_commit_message(self, ticket_identifier: str, title: str, description: str = "") -> str:
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
        body = f"{description.strip()}\n\nCloses {ticket_identifier}" if description else f"Closes {ticket_identifier}"
        return f"{summary}\n\n{body}"

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
            commit_msg = self.format_commit_message(ticket_identifier, title, description)

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
                return PRCreationResult(success=True, pr_url=pr_url, commit_sha=commit_sha)
            logger.warning("GitHub CLI PR creation failed: %s", pr_res.stderr)
            return PRCreationResult(success=False, commit_sha=commit_sha, error=pr_res.stderr)

        except Exception as e:
            logger.exception("Error creating PR for %s: %s", ticket_identifier, e)
            return PRCreationResult(success=False, error=str(e))
