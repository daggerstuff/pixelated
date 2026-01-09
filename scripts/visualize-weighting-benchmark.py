#!/usr/bin/env python3
"""
Visualize Dynamic Weighting Benchmark Results
Generates graphs for performance analysis
"""

import json
import logging
import sys
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.axes import Axes


def load_benchmark_data(json_file: str) -> dict[str, Any]:
    """Load benchmark data from a JSON file.

    Parameters:
    json_file (str): Path to the benchmark results JSON file.

    Returns:
    Dict[str, Any]: Parsed benchmark data.
    """
    with open(json_file) as f:
        return json.load(f)


def plot_performance_summary(data: dict[str, Any], output_dir: Path | str) -> None:
    """Plot performance summary bar chart."""
    summary = data["summary"]

    test_names = [r["testName"] for r in summary]
    avg_times = [r["avgTimeMs"] for r in summary]
    p50_times = [r["p50TimeMs"] for r in summary]
    p95_times = [r["p95TimeMs"] for r in summary]
    p99_times = [r["p99TimeMs"] for r in summary]

    x = np.arange(len(test_names))
    width = 0.2

    _fig, ax = plt.subplots(figsize=(14, 8))

    bars1 = ax.bar(x - width * 1.5, avg_times, width, label="Average", color="#3498db")
    bars2 = ax.bar(x - width * 0.5, p50_times, width, label="P50", color="#2ecc71")
    bars3 = ax.bar(x + width * 0.5, p95_times, width, label="P95", color="#f39c12")
    bars4 = ax.bar(x + width * 1.5, p99_times, width, label="P99", color="#e74c3c")

    # Add threshold line
    ax.axhline(y=250, color="red", linestyle="--", linewidth=2, label="250ms Threshold")

    ax.set_xlabel("Test Name", fontsize=12, fontweight="bold")
    ax.set_ylabel("Time (ms)", fontsize=12, fontweight="bold")
    ax.set_title("Dynamic Weighting Performance - Response Times", fontsize=14, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels([name.replace(" ", "\n") for name in test_names], rotation=0, ha="center")
    ax.legend(loc="upper left")
    ax.grid(axis="y", alpha=0.3)

    # Add value labels on bars
    for bars in [bars1, bars2, bars3, bars4]:
        for bar in bars:
            height = bar.get_height()
            ax.text(
                bar.get_x() + bar.get_width() / 2.0,
                height,
                f"{height:.1f}",
                ha="center",
                va="bottom",
                fontsize=8,
            )

    plt.tight_layout()
    plt.savefig(f"{output_dir}/performance_summary.png", dpi=300, bbox_inches="tight")
    logger.info("✓ Saved: %s/performance_summary.png", output_dir)
    plt.close()


def plot_time_series(data: dict[str, Any], output_dir: Path | str) -> None:
    """Plot time series of weight updates."""
    time_series = data["timeSeries"]

    iterations = [t["iteration"] for t in time_series]
    update_times = [t["updateTimeMs"] for t in time_series]
    contexts = [t["context"] for t in time_series]

    # Create context color map
    context_colors = {
        "CRISIS": "#e74c3c",
        "CLINICAL_ASSESSMENT": "#e67e22",
        "SUPPORT": "#9b59b6",
        "EDUCATIONAL": "#3498db",
        "INFORMATIONAL": "#1abc9c",
        "GENERAL": "#95a5a6",
    }

    colors = [context_colors.get(c, "#95a5a6") for c in contexts]

    _fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10))

    # Plot 1: Update times
    ax1.scatter(iterations, update_times, c=colors, alpha=0.6, s=50)
    ax1.axhline(y=250, color="red", linestyle="--", linewidth=2, label="250ms Threshold")
    set_axes_labels_title(ax1, "Update Time (ms)", "Update Time Across Context Transitions")
    ax1.grid(alpha=0.3)
    ax1.legend()

    # Plot 2: Weight evolution for key objectives
    safety_weights = [t["weights"].get("safety", 0) for t in time_series]
    empathy_weights = [t["weights"].get("empathy", 0) for t in time_series]
    correctness_weights = [t["weights"].get("correctness", 0) for t in time_series]

    ax2.plot(iterations, safety_weights, label="Safety", linewidth=2, marker="o", markersize=4)
    ax2.plot(iterations, empathy_weights, label="Empathy", linewidth=2, marker="s", markersize=4)
    ax2.plot(
        iterations, correctness_weights, label="Correctness", linewidth=2, marker="^", markersize=4
    )

    set_axes_labels_title(ax2, "Weight", "Objective Weight Evolution with Smoothing")
    ax2.legend()
    ax2.grid(alpha=0.3)

    # Add context change markers
    for i in range(1, len(contexts)):
        if contexts[i] != contexts[i - 1]:
            ax2.axvline(x=i, color="gray", linestyle=":", alpha=0.5)

    plt.tight_layout()
    plt.savefig(f"{output_dir}/time_series.png", dpi=300, bbox_inches="tight")
    logger.info("✓ Saved: %s/time_series.png", output_dir)
    plt.close()


def set_axes_labels_title(ax: Axes, ylabel: str, title: str) -> None:
    """Set standard axis labels and title for plots.

    Parameters:
    ax (Axes): Matplotlib axes to configure.
    ylabel (str): Label for the Y axis.
    title (str): Plot title.
    """
    ax.set_xlabel("Iteration", fontsize=12, fontweight="bold")
    ax.set_ylabel(ylabel, fontsize=12, fontweight="bold")
    ax.set_title(title, fontsize=14, fontweight="bold")


def plot_performance_distribution(data: dict[str, Any], output_dir: Path | str) -> None:
    """Plot performance distribution histogram."""
    dist = data["performanceDistribution"]

    buckets = dist["buckets"]
    labels = [f"{b['min']}-{b['max'] if b['max'] != float('inf') else '250+'}ms" for b in buckets]
    counts = [b["count"] for b in buckets]

    _fig, ax = plt.subplots(figsize=(12, 7))

    colors = ["#2ecc71" if i < 5 else "#e74c3c" for i in range(len(buckets))]
    bars = ax.bar(labels, counts, color=colors, alpha=0.7, edgecolor="black")

    ax.set_xlabel("Time Range (ms)", fontsize=12, fontweight="bold")
    ax.set_ylabel("Count", fontsize=12, fontweight="bold")
    ax.set_title("Performance Distribution", fontsize=14, fontweight="bold")
    ax.grid(axis="y", alpha=0.3)

    # Add value labels
    for bar in bars:
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            height,
            f"{int(height)}",
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
        )

    # Add statistics
    mean = dist["mean"]
    std_dev = dist["stdDev"]
    ax.text(
        0.98,
        0.98,
        f"Mean: {mean:.2f}ms\nStd Dev: {std_dev:.2f}ms",
        transform=ax.transAxes,
        fontsize=11,
        verticalalignment="top",
        horizontalalignment="right",
        bbox={"boxstyle": "round", "facecolor": "wheat", "alpha": 0.5},
    )

    plt.tight_layout()
    plt.savefig(f"{output_dir}/performance_distribution.png", dpi=300, bbox_inches="tight")
    logger.info("✓ Saved: %s/performance_distribution.png", output_dir)
    plt.close()


def plot_weight_transitions(data: dict[str, Any], output_dir: Path | str) -> None:
    """Plot weight transitions between contexts."""
    transitions = data["weightTransitions"]

    if not transitions:
        logger.warning("⚠ No transition data available")
        return

    _fig, ax = plt.subplots(figsize=(14, 8))

    transition_labels = [f"{t['fromContext']}\n→\n{t['toContext']}" for t in transitions]
    smoothing_effects = [t["smoothingEffect"] * 100 for t in transitions]

    x = np.arange(len(transition_labels))
    bars = ax.bar(x, smoothing_effects, color="#3498db", alpha=0.7, edgecolor="black")

    ax.set_xlabel("Context Transition", fontsize=12, fontweight="bold")
    ax.set_ylabel("Smoothing Effect (%)", fontsize=12, fontweight="bold")
    ax.set_title("Smoothing Effect Across Context Transitions", fontsize=14, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(transition_labels, rotation=0, ha="center", fontsize=9)
    ax.grid(axis="y", alpha=0.3)

    # Add value labels
    for bar in bars:
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            height,
            f"{height:.1f}%",
            ha="center",
            va="bottom",
            fontsize=9,
        )

    plt.tight_layout()
    plt.savefig(f"{output_dir}/weight_transitions.png", dpi=300, bbox_inches="tight")
    logger.info("✓ Saved: %s/weight_transitions.png", output_dir)
    plt.close()


def main() -> None:
    if len(sys.argv) < 2:
        logger.error("Usage: python visualize-weighting-benchmark.py <benchmark-results.json>")
        logger.error("\nExample:")
        logger.error("  python scripts/visualize-weighting-benchmark.py benchmark-results.json")
        sys.exit(1)

    json_file = sys.argv[1]

    if not Path(json_file).exists():
        logger.error("Error: File not found: %s", json_file)
        sys.exit(1)

    # Create output directory
    output_dir = Path("benchmark-visualizations")
    output_dir.mkdir(exist_ok=True)

    logger.info("\n📊 Visualizing benchmark data from: %s\n", json_file)

    # Load data
    data = load_benchmark_data(json_file)

    # Generate plots
    plot_performance_summary(data, output_dir)
    plot_time_series(data, output_dir)
    plot_performance_distribution(data, output_dir)
    plot_weight_transitions(data, output_dir)

    logger.info("\n✅ All visualizations saved to: %s/\n", output_dir)
    logger.info("Generated files:")
    logger.info("  - performance_summary.png")
    logger.info("  - time_series.png")
    logger.info("  - performance_distribution.png")
    logger.info("  - weight_transitions.png")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    main()
