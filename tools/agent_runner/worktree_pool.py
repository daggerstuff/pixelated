"""Git Worktree Pool manager for concurrent, race-free sandboxed executions."""

from __future__ import annotations

import contextlib
import logging
import os
import shutil
import subprocess
import threading
from dataclasses import dataclass

logger = logging.getLogger("agent_runner.worktree")


@dataclass
class WorktreeLease:
    ticket_identifier: str
    branch_name: str
    worktree_path: str
    original_repo: str


class GitWorktreePool:
    """Manages ephemeral git worktrees ensuring agents never race on working directories."""

    def __init__(self, worktrees_dir: str | None = None):
        self.worktrees_dir = os.path.abspath(worktrees_dir) if worktrees_dir else None
        self._lock = threading.Lock()

    def acquire_worktree(self, repo_path: str, ticket_identifier: str, agent_name: str) -> WorktreeLease:
        """Create a dedicated git worktree and branch for a ticket."""
        with self._lock:
            clean_ticket = ticket_identifier.lower().replace(":", "_").replace("/", "_")
            branch_name = f"agent/{agent_name}/{clean_ticket}"
            base_dir = self.worktrees_dir or os.path.join(repo_path, "worktrees")
            os.makedirs(base_dir, exist_ok=True)
            worktree_path = os.path.join(base_dir, f"{clean_ticket}_{agent_name}")

            # Clean up existing worktree if present
            if os.path.exists(worktree_path):
                with contextlib.suppress(Exception):
                    subprocess.run(
                        ["git", "worktree", "remove", "--force", worktree_path],
                        cwd=repo_path,
                        capture_output=True,
                        check=False,
                        timeout=15,
                    )
                if os.path.exists(worktree_path):
                    shutil.rmtree(worktree_path, ignore_errors=True)

            # Check if target branch is currently checked out in any other worktree
            wt_res = subprocess.run(
                ["git", "worktree", "list", "--porcelain"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                check=False,
            )
            if wt_res.returncode == 0:
                current_wt = ""
                for line in wt_res.stdout.splitlines():
                    if line.startswith("worktree "):
                        current_wt = line.split(" ", 1)[1]
                    elif line.startswith("branch ") and branch_name in line and current_wt and current_wt != repo_path:
                        subprocess.run(
                            ["git", "worktree", "remove", "--force", current_wt],
                            cwd=repo_path,
                            capture_output=True,
                            check=False,
                        )

            subprocess.run(["git", "worktree", "prune"], cwd=repo_path, capture_output=True, check=False)
            logger.info("Provisioning isolated worktree for %s at %s...", ticket_identifier, worktree_path)

            # Check if branch exists
            chk_res = subprocess.run(
                ["git", "rev-parse", "--verify", branch_name],
                cwd=repo_path,
                capture_output=True,
                check=False,
            )
            if chk_res.returncode == 0:
                cmd = ["git", "worktree", "add", worktree_path, branch_name]
            else:
                cmd = ["git", "worktree", "add", "-b", branch_name, worktree_path, "HEAD"]

            proc = subprocess.run(
                cmd,
                cwd=repo_path,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            if proc.returncode != 0:
                logger.warning(
                    "Git worktree add failed (%s): %s. Falling back to repo dir.", proc.returncode, proc.stderr
                )
                return WorktreeLease(
                    ticket_identifier=ticket_identifier,
                    branch_name="main",
                    worktree_path=repo_path,
                    original_repo=repo_path,
                )

            # Initialize submodules in worktree so submodule edits remain isolated
            with contextlib.suppress(Exception):
                subprocess.run(
                    ["git", "submodule", "update", "--init"],
                    cwd=worktree_path,
                    capture_output=True,
                    check=False,
                    timeout=15,
                )
                # Ensure isolated worktree starts completely clean
                subprocess.run(
                    ["git", "clean", "-fd"],
                    cwd=worktree_path,
                    capture_output=True,
                    check=False,
                    timeout=10,
                )

            return WorktreeLease(
                ticket_identifier=ticket_identifier,
                branch_name=branch_name,
                worktree_path=worktree_path,
                original_repo=repo_path,
            )

    def release_worktree(self, lease: WorktreeLease, delete_branch: bool = False) -> None:
        """Release and clean up an ephemeral worktree."""
        if lease.worktree_path == lease.original_repo:
            return

        with self._lock:
            try:
                subprocess.run(
                    ["git", "worktree", "remove", "--force", lease.worktree_path],
                    cwd=lease.original_repo,
                    capture_output=True,
                    check=False,
                    timeout=15,
                )
            except Exception as e:
                logger.warning("Error removing worktree %s: %s", lease.worktree_path, e)

            if delete_branch:
                with contextlib.suppress(Exception):
                    subprocess.run(
                        ["git", "branch", "-D", lease.branch_name],
                        cwd=lease.original_repo,
                        capture_output=True,
                        check=False,
                        timeout=10,
                    )
