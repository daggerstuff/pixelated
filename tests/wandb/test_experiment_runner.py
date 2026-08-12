import pytest

from wandb.experiments.experiment_runner import run_experiment_pair


@pytest.mark.asyncio
async def test_ab_tags_set():
    config = {"base_model": "Qwen/Qwen3-30B-A3B-Instruct-2507"}
    a_model, b_model = await run_experiment_pair("t1", config, config)
    assert "A" in a_model.tags
    assert "B" in b_model.tags
    assert "group:t1" in a_model.tags
