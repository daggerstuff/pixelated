"""Configuration loading tests for all source-grounded product builders."""

from __future__ import annotations

import importlib

import pytest

CONFIG_MODULES = [
    "therapeutic_sft",
    "long_running_therapy",
    "cptsd_dialogues",
    "edge_cases",
    "crisis_safety",
    "dpo_preferences",
    "knowledge_tasks",
]


@pytest.mark.parametrize("module_name", CONFIG_MODULES)
def test_config_builds_with_seed_analysis_judge_validator_and_transform(module_name: str) -> None:
    module = importlib.import_module(f"scripts.data.designer.configs.{module_name}")

    config = module.load_config_builder().build()
    serialized = config.model_dump(mode="json")
    column_types = [column["column_type"] for column in serialized["columns"]]

    assert serialized["seed_config"]["source"]["path"].endswith("representative_sources.jsonl")
    assert column_types.count("llm-structured") == 2
    assert "llm-judge" in column_types
    assert "validation" in column_types
    assert serialized["processors"][0]["processor_type"] == "schema_transform"
    assert "nvidia-text" in str(serialized)
    assert "nvidia-reasoning" in str(serialized)
    assert "api_key" not in str(serialized).casefold()


def test_configs_do_not_import_direct_provider_clients() -> None:
    for module_name in CONFIG_MODULES:
        module = importlib.import_module(f"scripts.data.designer.configs.{module_name}")
        source_names = set(module.__dict__)

        assert "OpenAI" not in source_names
        assert "requests" not in source_names
        assert "httpx" not in source_names
