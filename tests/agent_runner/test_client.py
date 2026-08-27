"""Unit tests for LinearClient."""

from unittest.mock import MagicMock

import pytest

from tools.agent_runner.client import LinearClient


def test_linear_client_initialization():
    client = LinearClient(api_key="lin_api_test")
    assert client.api_key.startswith("lin_api_")


def test_linear_client_empty_key_raises():
    with pytest.raises(ValueError, match="LINEAR_API_KEY"):
        LinearClient(api_key="")


def test_resolve_team(monkeypatch):
    client = LinearClient(api_key="lin_api_test")
    mock_gql = MagicMock(
        return_value={
            "teams": {
                "nodes": [
                    {
                        "id": "team-1",
                        "key": "PIX",
                        "name": "Pixelated",
                        "states": {"nodes": [{"id": "state-1", "name": "Todo", "type": "unstarted"}]},
                    }
                ]
            }
        }
    )
    monkeypatch.setattr(client, "execute_gql", mock_gql)
    team = client.resolve_team("PIX")
    assert team.key == "PIX"
    assert team.states["Todo"] == "state-1"
