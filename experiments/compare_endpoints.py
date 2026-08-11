# wandb/experiments/compare_endpoints.py
# Endpoint Comparison for Experiment #5: SFT → endpoint
# Compares best-eval step endpoint (A) vs final-step endpoint (B)

import os
import wandb
from openai import AsyncOpenAI
from typing import Any


async def compare_best_vs_final(
    entity: str,
    project: str,
    model_name: str,
    best_step: int,
    final_step: int,
    prompt: str,
) -> dict[str, Any]:
    """
    Compare best-eval step endpoint (A) vs final-step endpoint (B) for Experiment #5.

    Args:
        entity: W&B entity name
        project: W&B project name
        model_name: Base model name (e.g., "Qwen/Qwen3-30B-A3B-Instruct-2507")
        best_step: The best evaluation step number
        final_step: The final training step number
        prompt: Prompt to evaluate both endpoints with

    Returns:
        Dict containing comparison results for both endpoints
    """
    api = wandb.Api(api_key=os.environ.get("WANDB_API_KEY"))  # type: ignore[attr-defined]
    
    # Construct artifact names for the two endpoints
    # Based on the serverless backend pattern: wandb-artifact://{entity}/{project}/{model}:{step}
    artifact_a_name = f"{entity}/{project}/{model_name}:step-{best_step}"
    artifact_b_name = f"{entity}/{project}/{model_name}:step-{final_step}"

    results: dict[str, Any] = {"endpoint_a": None, "endpoint_b": None, "comparison": None}

    # Get the artifact paths from W&B
    try:
        artifact_a = api.artifact(artifact_a_name)
        artifact_a.download()
        _ = artifact_a.get_path("model").download()
        results["endpoint_a"] = {"artifact": artifact_a_name, "status": "retrieved"}
    except Exception as e:
        results["endpoint_a"] = {"error": f"Failed to retrieve artifact A: {str(e)}"}

    try:
        artifact_b = api.artifact(artifact_b_name)
        artifact_b.download()
        _ = artifact_b.get_path("model").download()
        results["endpoint_b"] = {"artifact": artifact_b_name, "status": "retrieved"}
    except Exception as e:
        results["endpoint_b"] = {"error": f"Failed to retrieve artifact B: {str(e)}"}

    # If both artifacts retrieved successfully, run comparison
    if results["endpoint_a"] and results["endpoint_b"] and "error" not in results["endpoint_a"] and "error" not in results["endpoint_b"]:
        # Use OpenAI-compatible endpoint to run inference
        # The serverless backend serves via wandb-artifact:// endpoints
        client = AsyncOpenAI(
            api_key=os.environ.get("OPENPIPE_API_KEY") or os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("INFERENCE_BASE_URL", "https://api.openai.com/v1"),
        )

        async def query_endpoint(artifact_path: str, label: str) -> dict[str, Any]:
            # For serverless backend, the endpoint would be the artifact URI
            endpoint_uri = f"wandb-artifact://{artifact_path}"
            try:
                response = await client.chat.completions.create(
                    model=endpoint_uri,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=512,
                    temperature=0.7,
                )
                usage = response.usage
                return {
                    "label": label,
                    "artifact_uri": endpoint_uri,
                    "response": response.choices[0].message.content,
                    "usage": {
                        "prompt_tokens": usage.prompt_tokens if usage else 0,
                        "completion_tokens": usage.completion_tokens if usage else 0,
                        "total_tokens": usage.total_tokens if usage else 0,
                    },
                }
            except Exception as e:
                return {"label": label, "error": str(e)}

        results["endpoint_a"] = await query_endpoint(artifact_a_name, "best_eval")
        results["endpoint_b"] = await query_endpoint(artifact_b_name, "final_step")

        # Simple comparison - could be extended with more sophisticated evaluation
        results["comparison"] = {
            "prompt": prompt,
            "best_eval_response": results["endpoint_a"].get("response", ""),
            "final_step_response": results["endpoint_b"].get("response", ""),
            "best_eval_tokens": results["endpoint_a"].get("usage", {}),
            "final_step_tokens": results["endpoint_b"].get("usage", {}),
        }

    return results


async def compare_experiment_5_endpoints(
    entity: str = "default-entity",
    project: str = "serverless-ab",
    model_name: str = "Qwen/Qwen3-30B-A3B-Instruct-2507",
    best_step: int = 1500,
    final_step: int = 2500,
    prompt: str = "Explain the concept of LoRA fine-tuning in simple terms.",
) -> dict[str, Any]:
    """
    Convenience function to compare Experiment #5 endpoints with defaults.
    
    Experiment #5: SFT → endpoint
    - A: best-eval step endpoint
    - B: final-step endpoint
    """
    return await compare_best_vs_final(
        entity=entity,
        project=project,
        model_name=model_name,
        best_step=best_step,
        final_step=final_step,
        prompt=prompt,
    )


if __name__ == "__main__":
    import asyncio
    
    # Example usage
    async def main():
        result = await compare_experiment_5_endpoints()
        print(result)
    
    asyncio.run(main())