"""Configuration & syntax integrity tests.

Ensures local configuration files parse cleanly against schema constraints
before runtime loading:

- Repository root ``config.toml``: TOML syntax + required local-runner tables.
- Repository root ``settings.json``: JSON syntax + required top-level keys.
- ``tests/fixtures/mock_configs/``: the shipped mock configs must stay valid
  as schema references for the root files.

Run with: ``pytest tests/test_config_lint.py -v``
"""

from __future__ import annotations

import json
import tomllib
from pathlib import Path

import pytest

CONFIG_ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "mock_configs"

CONFIG_TOML_PATH = CONFIG_ROOT / "config.toml"
SETTINGS_JSON_PATH = CONFIG_ROOT / "settings.json"
FIXTURE_CONFIG_TOML_PATH = FIXTURES_DIR / "config.valid.toml"
FIXTURE_SETTINGS_JSON_PATH = FIXTURES_DIR / "settings.valid.json"


def _load_toml(path: Path) -> dict:
    assert path.exists(), f"{path.name} not found at {path.parent}"
    with open(path, "rb") as f:
        return tomllib.load(f)


def _load_json(path: Path) -> dict:
    assert path.exists(), f"{path.name} not found at {path.parent}"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _assert_valid_assistant_config(data: dict, label: str) -> None:
    """Schema constraints shared by the root and fixture config.toml files."""
    assert "assistant" in data, f"{label}: missing [assistant] table"
    assert "routing" in data, f"{label}: missing [routing] table"
    assistant = data["assistant"]
    assert isinstance(assistant, dict), f"{label}: [assistant] must be a table"
    assert isinstance(assistant.get("context_window"), int), f"{label}: assistant.context_window must be an integer"
    assert isinstance(data["routing"], dict), f"{label}: [routing] must be a table"


def _assert_valid_settings(data: dict, label: str) -> None:
    """Schema constraints shared by the root and fixture settings.json files."""
    assert "active_profiles" in data, f"{label}: missing 'active_profiles' key"
    assert isinstance(data["active_profiles"], list), f"{label}: 'active_profiles' must be a list"


# ── Repository root configs ─────────────────────────────────


def test_config_toml_validity() -> None:
    data = _load_toml(CONFIG_TOML_PATH)
    _assert_valid_assistant_config(data, "config.toml")


def test_settings_json_validity() -> None:
    data = _load_json(SETTINGS_JSON_PATH)
    _assert_valid_settings(data, "settings.json")


# ── Shipped mock configs (schema references) ────────────────


def test_fixture_config_toml_validity() -> None:
    data = _load_toml(FIXTURE_CONFIG_TOML_PATH)
    _assert_valid_assistant_config(data, "config.valid.toml")


def test_fixture_settings_json_validity() -> None:
    data = _load_json(FIXTURE_SETTINGS_JSON_PATH)
    _assert_valid_settings(data, "settings.valid.json")


@pytest.mark.parametrize(
    ("path", "loader"),
    [
        pytest.param(FIXTURE_CONFIG_TOML_PATH, _load_toml, id="fixture-config-toml"),
        pytest.param(FIXTURE_SETTINGS_JSON_PATH, _load_json, id="fixture-settings-json"),
    ],
)
def test_fixture_configs_are_non_empty(path: Path, loader) -> None:
    """A mock config that parses to nothing is useless as a schema reference."""
    data = loader(path)
    assert data, f"{path.name} parsed to an empty document"
