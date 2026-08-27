"""Unit tests for ThreadCompactor."""

from tools.agent_runner.compactor import ThreadCompactor
from tools.agent_runner.models import LinearComment


def test_thread_compactor_recent_window():
    compactor = ThreadCompactor(recent_window_size=3)
    comments = [
        LinearComment(id=f"c-{i}", body=f"Message {i}", created_at=f"2026-08-27T10:0{i}:00Z", author_name=f"Agent{i}")
        for i in range(10)
    ]
    digest = compactor.compact_thread(comments)
    assert "Summary of 7 earlier coordination messages archived" in digest
    assert "Message 9" in digest
    assert "Message 8" in digest
    assert "Message 7" in digest
