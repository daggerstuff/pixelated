import os

from art import TrainableModel
from art.serverless.backend import ServerlessBackend

WANDB_API_KEY = os.environ.get("WANDB_API_KEY")


async def run_experiment_pair(exp_id: str, a_config: dict, b_config: dict):
    """Run A/B pair. Returns tuple (run_a, run_b)."""
    backend = ServerlessBackend(api_key=WANDB_API_KEY)
    # A variant
    model_a = TrainableModel(
        name=f"exp-{exp_id}-A",
        project="serverless-ab",
        base_model=a_config.get("base_model", "Qwen/Qwen3-30B-A3B-Instruct-2507"),
    )
    await model_a.register(backend)
    # B variant
    model_b = TrainableModel(
        name=f"exp-{exp_id}-B",
        project="serverless-ab",
        base_model=b_config.get("base_model", "Qwen/Qwen3-30B-A3B-Instruct-2507"),
    )
    await model_b.register(backend)
    # A/B tags assigned after register; training invocation deferred to Tasks 2-6
    # Note: TrainableModel lacks native `tags`; label enforcement uses
    # external artifact/run metadata (Tasks 2-6).
    model_a.tags = ["A", f"group:{exp_id}"]
    model_b.tags = ["B", f"group:{exp_id}"]
    return model_a, model_b
