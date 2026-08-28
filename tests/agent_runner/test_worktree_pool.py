"""Unit tests for GitWorktreePool."""

import tempfile

from tools.agent_runner.worktree_pool import GitWorktreePool


def test_worktree_pool_paths():
    with tempfile.TemporaryDirectory() as tmp_repo:
        pool = GitWorktreePool()
        lease = pool.acquire_worktree(tmp_repo, "PIX-99", "opencode")
        assert lease.ticket_identifier == "PIX-99"
        assert lease.branch_name == "main" or "agent/opencode/pix-99" in lease.branch_name
        pool.release_worktree(lease)
