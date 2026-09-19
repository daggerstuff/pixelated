"""Unit tests for PullRequestBridge."""

import json
import subprocess
from unittest.mock import MagicMock

from tools.agent_runner.pr_bridge import PullRequestBridge


def test_format_commit_message():
    bridge = PullRequestBridge()
    msg = bridge.format_commit_message(
        "PIX-101", "Fix JWT Expiration Bug", "Token expiration was in seconds instead of ms."
    )
    assert msg.startswith("fix(PIX-101): Fix JWT Expiration Bug")
    assert "Closes PIX-101" in msg

    msg_refactor = bridge.format_commit_message("PIX-102", "Refactor Auth Module")
    assert msg_refactor.startswith("refactor(PIX-102): Refactor Auth Module")

    msg_test = bridge.format_commit_message("PIX-103", "Add E2E Tests")
    assert msg_test.startswith("test(PIX-103): Add E2E Tests")

    msg_docs = bridge.format_commit_message("PIX-104", "Update Docs")
    assert msg_docs.startswith("docs(PIX-104): Update Docs")

    msg_sec = bridge.format_commit_message("PIX-105", "Security Audit Fixes")
    assert msg_sec.startswith("sec(PIX-105): Security Audit Fixes")


def test_pr_bridge_disabled(monkeypatch):
    bridge = PullRequestBridge(enabled=False)

    def fake_subprocess_run(cmd, *_args, **_kwargs):
        if "status" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout=" M file.py\n", stderr="")
        if "rev-parse" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="mock_sha_123\n", stderr="")
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr("tools.agent_runner.pr_bridge.subprocess.run", fake_subprocess_run)

    res = bridge.commit_and_create_pr(".", "PIX-1", "Title")
    assert res.success is True
    assert res.commit_sha == "mock_sha_123"
    assert res.pr_url == ""


def test_pr_bridge_disabled_no_changes(monkeypatch):
    bridge = PullRequestBridge(enabled=False)
    mock_run = MagicMock()
    mock_run.return_value = subprocess.CompletedProcess(args=["git", "status"], returncode=0, stdout="", stderr="")
    monkeypatch.setattr("tools.agent_runner.pr_bridge.subprocess.run", mock_run)

    res = bridge.commit_and_create_pr(".", "PIX-1", "Title")
    assert res.success is True
    assert res.pr_url == ""
    assert res.error == "No file changes detected to commit."


def test_pr_bridge_enabled_success(monkeypatch):
    bridge = PullRequestBridge(enabled=True)

    def fake_subprocess_run(cmd, *_args, **_kwargs):
        if "status" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout=" M file.py\n", stderr="")
        if "rev-parse" in cmd and "HEAD" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="mock_sha_123\n", stderr="")
        if "rev-parse" in cmd and "--abbrev-ref" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="agent/pix-1\n", stderr="")
        if "push" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")
        if "pr" in cmd and "create" in cmd:
            return subprocess.CompletedProcess(
                args=cmd, returncode=0, stdout="https://github.com/org/repo/pull/42\n", stderr=""
            )
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr("tools.agent_runner.pr_bridge.subprocess.run", fake_subprocess_run)

    res = bridge.commit_and_create_pr(".", "PIX-1", "Title", context={"branch_name": "agent/pix-1"})
    assert res.success is True
    assert res.commit_sha == "mock_sha_123"
    assert res.pr_url == "https://github.com/org/repo/pull/42"


def test_pr_bridge_git_push_failure(monkeypatch):
    bridge = PullRequestBridge(enabled=True)

    def fake_subprocess_run(cmd, *_args, **_kwargs):
        if "status" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout=" M file.py\n", stderr="")
        if "rev-parse" in cmd and "HEAD" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="mock_sha_123\n", stderr="")
        if "push" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=1, stdout="", stderr="Permission denied")
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr("tools.agent_runner.pr_bridge.subprocess.run", fake_subprocess_run)

    res = bridge.commit_and_create_pr(".", "PIX-1", "Title", context={"branch_name": "agent/pix-1"})
    assert res.success is False
    assert "Git push failed" in res.error


def test_format_commit_message_includes_thinking_block():
    bridge = PullRequestBridge()

    msg = bridge.format_commit_message(
        "PIX-1",
        "Fix JWT Expiration Bug",
        "Token expiration was in seconds instead of ms.",
        {"thinking": "Checked token expiry semantics before changing the value."},
    )

    assert msg.startswith("fix(PIX-1): Fix JWT Expiration Bug")
    assert "<thinking>" in msg
    assert "Checked token expiry semantics" in msg
    assert "Closes PIX-1" in msg


def test_pr_bridge_rebases_before_commit(monkeypatch):
    bridge = PullRequestBridge()
    calls: list[list[str]] = []

    def fake_subprocess_run(cmd, *_args, **_kwargs):
        calls.append(cmd)
        if "status" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout=" M file.py\n", stderr="")
        if "rev-parse" in cmd and "HEAD" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="mock_sha_123\n", stderr="")
        if "push" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")
        if "pr" in cmd and "create" in cmd:
            return subprocess.CompletedProcess(
                args=cmd, returncode=0, stdout="https://github.com/org/repo/pull/42\n", stderr=""
            )
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr("tools.agent_runner.pr_bridge.subprocess.run", fake_subprocess_run)

    res = bridge.commit_and_create_pr(".", "PIX-1", "Title")

    assert res.success is True
    assert ["git", "fetch", "origin", "staging"] in calls
    assert ["git", "rebase", "origin/staging"] in calls


def test_pr_bridge_writes_checkpoint(monkeypatch, tmp_path):
    bridge = PullRequestBridge(checkpoint_path=str(tmp_path / "checkpoints.json"))
    calls: list[list[str]] = []

    def fake_subprocess_run(cmd, *_args, **_kwargs):
        calls.append(cmd)
        if "status" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout=" M file.py\n", stderr="")
        if "rev-parse" in cmd and "HEAD" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="mock_sha_123\n", stderr="")
        if "push" in cmd:
            return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")
        if "pr" in cmd and "create" in cmd:
            return subprocess.CompletedProcess(
                args=cmd, returncode=0, stdout="https://github.com/org/repo/pull/42\n", stderr=""
            )
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr("tools.agent_runner.pr_bridge.subprocess.run", fake_subprocess_run)

    res = bridge.commit_and_create_pr(".", "PIX-1", "Title", context={"branch_name": "agent/pix-1"})

    assert res.success is True
    checkpoint = json.loads((tmp_path / "checkpoints.json").read_text(encoding="utf-8"))
    assert checkpoint["PIX-1"] == {
        "branch_name": "agent/pix-1",
        "commit_sha": "mock_sha_123",
        "pr_url": "https://github.com/org/repo/pull/42",
        "status": "created",
    }


def test_pr_bridge_merge_clean_pr(monkeypatch):
    bridge = PullRequestBridge()
    calls: list[list[str]] = []

    def fake_subprocess_run(cmd, *_args, **_kwargs):
        calls.append(cmd)
        if "view" in cmd:
            return subprocess.CompletedProcess(
                args=cmd,
                returncode=0,
                stdout=json.dumps(
                    {
                        "mergeable": "MERGEABLE",
                        "state": "OPEN",
                        "reviewDecision": "APPROVED",
                        "statusCheckRollup": [{"state": "SUCCESS"}],
                    }
                ),
                stderr="",
            )
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr("tools.agent_runner.pr_bridge.subprocess.run", fake_subprocess_run)

    assert bridge.merge_clean_pr("42") is True
    assert ["gh", "pr", "merge", "42", "--squash", "--delete-branch"] in calls


def test_pr_bridge_merge_clean_pr_blocks_on_failed_check(monkeypatch):
    bridge = PullRequestBridge()

    def fake_subprocess_run(cmd, *_args, **_kwargs):
        if "view" in cmd:
            return subprocess.CompletedProcess(
                args=cmd,
                returncode=0,
                stdout=json.dumps(
                    {
                        "mergeable": "MERGEABLE",
                        "state": "OPEN",
                        "reviewDecision": "APPROVED",
                        "statusCheckRollup": [{"state": "FAILURE"}],
                    }
                ),
                stderr="",
            )
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr("tools.agent_runner.pr_bridge.subprocess.run", fake_subprocess_run)

    assert bridge.merge_clean_pr("42") is False
