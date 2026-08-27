"""Unit tests for PullRequestBridge."""

from tools.agent_runner.pr_bridge import PullRequestBridge


def test_format_commit_message():
    bridge = PullRequestBridge()
    msg = bridge.format_commit_message(
        "PIX-101", "Fix JWT Expiration Bug", "Token expiration was in seconds instead of ms."
    )
    assert msg.startswith("fix(PIX-101): Fix JWT Expiration Bug")
    assert "Closes PIX-101" in msg


def test_pr_bridge_disabled():
    bridge = PullRequestBridge(enabled=False)
    res = bridge.commit_and_create_pr(".", "PIX-1", "Title")
    assert res.success is True
    assert res.pr_url == ""
