import json
from contextlib import suppress
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


def plot_flow_dynamics(flow_data, output_dir):
    """Plot flow dynamics data."""
    velocity = np.array(flow_data["velocity"])
    acceleration = np.array(flow_data["acceleration"])

    plt.figure(figsize=(10, 5))
    # We take the norm for simplicity to have a 1D plot over the sequence
    plt.plot(np.linalg.norm(velocity, axis=1), label="Velocity Norm")
    plt.plot(np.linalg.norm(acceleration, axis=1), label="Acceleration Norm")
    plt.title("Emotional Flow Dynamics")
    plt.xlabel("Time Step")
    plt.ylabel("Magnitude")
    plt.legend()
    plt.grid(True)
    plt.savefig(output_dir / "flow_dynamics.png")
    plt.close()


def plot_meta_intelligence(meta_data, output_dir):
    """Plot meta intelligence metrics."""
    metrics = {
        "Deviation": meta_data["deviation"],
        "Reflection Score": meta_data["reflection_score"]
    }

    plt.figure(figsize=(6, 5))
    plt.bar(list(metrics.keys()), list(metrics.values()), color=["skyblue", "lightgreen"])
    plt.title("Meta-Emotional Intelligence")
    plt.ylabel("Score")
    plt.ylim(0, 1)
    plt.savefig(output_dir / "meta_intelligence.png")
    plt.close()


def visualize_latest_run():
    log_file = Path("logs/pipeline_runs.jsonl")
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    if not log_file.exists():
        print(f"Log file not found at {log_file}")
        # Create a dummy log file for demonstration purposes
        dummy_data = {
            "output": {
                "flow_dynamics": {
                    "velocity": [[0.1, 0.2, -0.1]],
                    "acceleration": [[0.05, -0.02, 0.03]]
                },
                "meta_intelligence": {
                    "deviation": 0.5,
                    "reflection_score": 0.8
                }
            }
        }
        with log_file.open("w") as f:
            f.write(json.dumps(dummy_data) + "\n")

    # Use contextlib.suppress to handle potential file reading errors gracefully
    latest_run = None
    with suppress(Exception):
        with log_file.open() as f:
            if lines := f.readlines():
                latest_run = lines[-1]

    if latest_run:
        data = json.loads(latest_run)
        output_data = data["output"]

        # Plot 1: Flow Dynamics
        plot_flow_dynamics(output_data["flow_dynamics"], output_dir)

        # Plot 2: Meta Intelligence
        plot_meta_intelligence(output_data["meta_intelligence"], output_dir)

        print(f"Visualizations saved to {output_dir}")
    else:
        print("Could not read log file data")

if __name__ == "__main__":
    visualize_latest_run()
