"""
Tests for Neo4j usage/performance recording (neo4j_usage module).

Load neo4j_usage in isolation so we do not trigger mcp_server package imports
(flask-socketio, auth, etc.) when collecting tests.
"""

import asyncio
import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Repo root: tests/unit/ai -> tests/unit -> tests -> root
_repo_root = Path(__file__).resolve().parent.parent.parent.parent
_neo4j_usage_path = _repo_root / "ai" / "core" / "api" / "mcp_server" / "neo4j_usage.py"
_spec = spec_from_file_location("neo4j_usage", _neo4j_usage_path)
neo4j_usage = module_from_spec(_spec)
sys.modules["neo4j_usage"] = neo4j_usage
_spec.loader.exec_module(neo4j_usage)


@pytest.fixture(autouse=True)
def reset_neo4j_state(monkeypatch):
    """Reset driver and config override before/after each test."""
    neo4j_usage.reset_driver()
    neo4j_usage.set_neo4j_config(None)
    yield
    neo4j_usage.reset_driver()
    neo4j_usage.set_neo4j_config(None)
    monkeypatch.delenv("NEO4J_URI", raising=False)
    monkeypatch.delenv("NEO4J_USER", raising=False)
    monkeypatch.delenv("NEO4J_PASSWORD", raising=False)


@pytest.mark.asyncio
async def test_record_tool_call_no_config_no_op():
    """When Neo4j is not configured, record_tool_call returns without error."""
    await neo4j_usage.record_tool_call(
        "search_memory", 100.0, True, user_id="u1", session_id="s1"
    )


def test_schedule_record_tool_call_no_loop_no_op():
    """When no event loop is running, schedule_record_tool_call does not raise."""
    neo4j_usage.schedule_record_tool_call(
        "add_memory", 50.0, True, user_id="u1"
    )


@pytest.mark.asyncio
async def test_record_tool_call_with_config_override_disabled():
    """set_neo4j_config(uri=None) disables recording."""
    neo4j_usage.set_neo4j_config(None, "neo4j", "pass")
    await neo4j_usage.record_tool_call("search_memory", 10.0, True)


@pytest.mark.asyncio
async def test_record_tool_call_with_mock_driver():
    """When driver is mocked, record_tool_call runs Cypher with expected params."""
    mock_run = AsyncMock()
    mock_consume = AsyncMock()
    mock_run.return_value.consume = mock_consume
    mock_session = AsyncMock()
    mock_session.run = mock_run
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)
    mock_driver = MagicMock()
    mock_driver.session.return_value = mock_session

    neo4j_usage.set_neo4j_config("bolt://localhost:7687", "neo4j", "secret")
    with patch.object(
        neo4j_usage,
        "_get_driver",
        return_value=mock_driver,
    ):
        await neo4j_usage.record_tool_call(
            "search_memory",
            42.5,
            True,
            user_id="user-1",
            session_id="sess-1",
        )

    mock_run.assert_called_once()
    call_kw = mock_run.call_args.kwargs
    assert call_kw["tool_name"] == "search_memory"
    assert call_kw["latency_ms"] == 42.5
    assert call_kw["success"] is True
    assert call_kw["user_id"] == "user-1"
    assert call_kw["session_id"] == "sess-1"
    assert "MERGE (t:Tool" in mock_run.call_args.args[0]
    mock_consume.assert_called_once()


@pytest.mark.asyncio
async def test_get_tool_call_stats_no_driver_returns_empty():
    """get_tool_call_stats returns [] when Neo4j is not configured."""
    neo4j_usage.set_neo4j_config(None)
    result = await neo4j_usage.get_tool_call_stats(since_ts_seconds=0)
    assert result == []


@pytest.mark.asyncio
async def test_get_tool_call_stats_with_mock_returns_aggregates():
    """get_tool_call_stats returns parsed aggregates when driver returns rows."""
    mock_result = AsyncMock()
    # Deterministic: 10 values avg 10.0, p95 idx 8 → 12.0
    search_lats = [8.0, 8.0, 9.0, 9.0, 10.0, 10.0, 11.0, 11.0, 12.0, 12.0]
    mock_result.values = AsyncMock(
        return_value=[
            ("search_memory", 10, 9, list(search_lats)),
            ("add_memory", 2, 2, [100.0, 200.0]),
        ]
    )
    mock_session = AsyncMock()
    mock_session.run = AsyncMock(return_value=mock_result)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)
    mock_driver = MagicMock()
    mock_driver.session.return_value = mock_session

    with patch.object(
        neo4j_usage,
        "_get_driver",
        return_value=mock_driver,
    ):
        result = await neo4j_usage.get_tool_call_stats(
            since_ts_seconds=1,
        )

    assert len(result) == 2
    assert result[0]["tool_name"] == "search_memory"
    assert result[0]["call_count"] == 10
    assert result[0]["success_count"] == 9
    assert result[0]["avg_latency_ms"] == 10.0  # sum 100 / 10
    assert result[0]["p95_latency_ms"] == 12.0  # sorted index 8
    assert result[1]["tool_name"] == "add_memory"
    assert result[1]["call_count"] == 2
    assert result[1]["success_count"] == 2
    assert result[1]["avg_latency_ms"] == 150.0
    # n=2 → p95 idx 0 → 100.0
    assert result[1]["p95_latency_ms"] == 100.0


@pytest.mark.asyncio
async def test_schedule_record_tool_call_from_async_schedules_task():
    """From async context, schedule_record_tool_call creates a task that runs."""
    recorded: list[tuple] = []

    async def capture_record(
        tool_name, latency_ms, success, user_id=None, session_id=None
    ):
        recorded.append((tool_name, latency_ms, success, user_id, session_id))

    with patch.object(
        neo4j_usage,
        "record_tool_call",
        side_effect=capture_record,
    ):
        neo4j_usage.schedule_record_tool_call(
            "get_all_memories", 33.0, False, user_id="u", session_id="s"
        )
        await asyncio.sleep(0.05)

    assert len(recorded) == 1
    assert recorded[0] == ("get_all_memories", 33.0, False, "u", "s")
