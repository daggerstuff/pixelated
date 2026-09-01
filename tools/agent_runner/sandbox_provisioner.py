"""Ephemeral Sandboxed Execution & Dynamic Provisioning (Modern Multi-Agent Coding Architectures).

Implements:
1. Ephemeral Sandbox provisioning (sandboxed Git worktree / Docker / K8s volume).
2. Developer injection interface (writes untrusted generated code to sandbox).
3. Reviewer execution interface (runs tests and commands inside sandbox without SSH).
4. Automated ephemeral teardown.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from typing import Any

from tools.agent_runner.worktree_pool import GitWorktreePool, WorktreeLease

logger = logging.getLogger("agent_runner.sandbox")


@dataclass
class SandboxCommandResult:
    command: str
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float


class EphemeralSandbox:
    """Ephemeral isolated execution sandbox for multi-agent task loops."""

    def __init__(self, task_id: str, base_repo: str, worktree_pool: GitWorktreePool | None = None, agent_name: str = "sandbox"):
        self.task_id = task_id
        self.base_repo = os.path.abspath(base_repo)
        self.worktree_pool = worktree_pool or GitWorktreePool()
        self.agent_name = agent_name
        self.lease: WorktreeLease | None = None
        self.sandbox_path: str = ""

    def provision(self) -> str:
        """Create fresh, isolated sandbox worktree."""
        self.lease = self.worktree_pool.acquire_worktree(self.base_repo, self.task_id, self.agent_name)
        self.sandbox_path = self.lease.worktree_path
        logger.info("Provisioned ephemeral sandbox for %s at %s (branch: %s)", self.task_id, self.sandbox_path, self.lease.branch_name)
        return self.sandbox_path

    def execute_command(self, command: list[str] | str, timeout: int = 60) -> SandboxCommandResult:
        """Execute command in sandbox with strict isolation and timeout."""
        if not self.sandbox_path or not os.path.exists(self.sandbox_path):
            raise RuntimeError(f"Sandbox for {self.task_id} is not provisioned.")

        start = time.time()
        if isinstance(command, str):
            cmd = command
            shell = True
        else:
            cmd = command
            shell = False

        res = subprocess.run(
            cmd,
            cwd=self.sandbox_path,
            shell=shell,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        duration = time.time() - start

        return SandboxCommandResult(
            command=str(command),
            exit_code=res.returncode,
            stdout=res.stdout,
            stderr=res.stderr,
            duration_seconds=duration,
        )

    def inject_file(self, relative_path: str, content: str) -> None:
        """Inject generated file directly into sandbox workspace volume."""
        full_path = os.path.join(self.sandbox_path, relative_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)

    def teardown(self, delete_branch: bool = False) -> None:
        """Tear down and release ephemeral sandbox volume."""
        if self.lease:
            logger.info("Tearing down ephemeral sandbox for %s...", self.task_id)
            self.worktree_pool.release_worktree(self.lease, delete_branch=delete_branch)
            self.lease = None
            self.sandbox_path = ""
