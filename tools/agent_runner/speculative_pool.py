"""Speculative & Parallel Multi-Agent Worktree Execution Pool."""

from __future__ import annotations

import concurrent.futures
import logging
import os
import subprocess
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from tools.agent_runner.execution_harness import AgentExecutionHarness, HarnessRunReport
from tools.agent_runner.models import AgentConfig, ExecutionResult, LinearIssue
from tools.agent_runner.worktree_pool import GitWorktreePool, WorktreeLease

logger = logging.getLogger("agent_runner.speculative_pool")


@dataclass
class ParallelTaskExecution:
    issue: LinearIssue
    agent_cfg: AgentConfig
    lease: WorktreeLease
    result: ExecutionResult | None = None
    report: HarnessRunReport | None = None
    error: str | None = None


class ParallelSpeculativeExecutor:
    """Dispatches independent DAG tasks concurrently across isolated git worktrees."""

    def __init__(
        self,
        base_repo: str,
        harness: AgentExecutionHarness,
        worktree_pool: GitWorktreePool | None = None,
        max_concurrency: int = 4,
    ):
        self.base_repo = os.path.abspath(base_repo)
        self.harness = harness
        self.worktree_pool = worktree_pool or GitWorktreePool()
        self.max_concurrency = max_concurrency

    def execute_parallel_batch(
        self,
        batch: list[tuple[LinearIssue, AgentConfig, str]],  # (issue, agent_cfg, prompt)
    ) -> list[ParallelTaskExecution]:
        """Run a batch of independent tickets concurrently in dedicated worktrees."""
        if not batch:
            return []

        logger.info("Executing parallel speculative batch of %d tasks (max concurrency: %d)...", len(batch), self.max_concurrency)
        executions: list[ParallelTaskExecution] = []

        # Provision worktree leases
        for issue, agent_cfg, _ in batch:
            lease = self.worktree_pool.acquire_worktree(self.base_repo, issue.identifier, agent_cfg.name)
            executions.append(ParallelTaskExecution(issue=issue, agent_cfg=agent_cfg, lease=lease))

        def _worker(exec_item: ParallelTaskExecution, prompt: str) -> ParallelTaskExecution:
            try:
                res, rep = self.harness.run_harness(
                    agent_cfg=exec_item.agent_cfg,
                    issue=exec_item.issue,
                    workdir=exec_item.lease.worktree_path,
                    prompt=prompt,
                )
                exec_item.result = res
                exec_item.report = rep
            except Exception as e:
                logger.error("Parallel task execution failed for %s: %s", exec_item.issue.identifier, e)
                exec_item.error = str(e)
            return exec_item

        # Execute concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(batch), self.max_concurrency)) as executor:
            futures = [
                executor.submit(_worker, exec_item, prompt)
                for exec_item, (_, _, prompt) in zip(executions, batch)
            ]
            concurrent.futures.wait(futures)

        # Cleanup & release worktree leases
        for exec_item in executions:
            try:
                # If passed, merge branch into local staging
                if exec_item.report and exec_item.report.overall_passed:
                    logger.info("Integrating passed branch %s for %s...", exec_item.lease.branch_name, exec_item.issue.identifier)
                    subprocess.run(
                        ["git", "merge", exec_item.lease.branch_name, "--no-edit"],
                        cwd=self.base_repo,
                        capture_output=True,
                        check=False,
                    )
                self.worktree_pool.release_worktree(exec_item.lease, delete_branch=True)
            except Exception as e:
                logger.warning("Error releasing worktree for %s: %s", exec_item.issue.identifier, e)

        return executions
