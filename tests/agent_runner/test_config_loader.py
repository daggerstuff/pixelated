"""Unit tests for config loader and env substitution."""

import json
import os
import tempfile

from tools.agent_runner.config_loader import load_config, substitute_env_vars


def test_substitute_env_vars(monkeypatch):
    monkeypatch.setenv("TEST_VAR", "interpolated_value")
    data = {
        "key": "prefix_${TEST_VAR}_suffix",
        "nested": {"val": "$TEST_VAR"},
        "fallback": "${NON_EXISTENT_VAR:-default_fallback}",
    }
    res = substitute_env_vars(data)
    assert res["key"] == "prefix_interpolated_value_suffix"
    assert res["nested"]["val"] == "interpolated_value"
    assert res["fallback"] == "default_fallback"


def test_load_config_from_file():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf:
        json.dump(
            {
                "server_label": "srv:test",
                "poll_seconds": 30,
                "projects": [{"team_key": "PIX", "default_repo": "main"}],
                "agents": [{"name": "opencode", "role": "backend_engineer", "cmd": ["opencode", "run"]}],
            },
            tf,
        )
        cfg_file = tf.name

    try:
        cfg = load_config(cfg_file)
        assert cfg.server_label == "srv:test"
        assert cfg.poll_seconds == 30
        assert len(cfg.projects) == 1
        assert len(cfg.agents) == 1
        assert cfg.agents[0].name == "opencode"
    finally:
        os.remove(cfg_file)
