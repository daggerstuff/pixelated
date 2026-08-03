"""Benchmark slice helpers for the fresh training corpus builder."""

from __future__ import annotations

from collections import Counter

from .model import CorpusEntry

_VALID_BENCHMARK_SLICES = {
    "benchmark_core",
    "benchmark_crisis",
    "benchmark_edge_cases",
    "benchmark_persona_texture",
    "benchmark_supervisor_rubrics",
    "benchmark_multilingual",
    "benchmark_long_running_continuity",
    "benchmark_specialized_domains",
}


def benchmark_slice_name(entry: CorpusEntry) -> str | None:
    if entry.lane != "benchmark":
        return None

    explicit = entry.attributes.get("benchmark_slice")
    if isinstance(explicit, str) and explicit in _VALID_BENCHMARK_SLICES:
        return explicit

    result = "benchmark_core"
    if entry.stage in {"stage4_voice", "stage4_voice_persona"}:
        result = "benchmark_persona_texture"
    elif entry.stage == "stage3_edge_stress_test":
        result = "benchmark_edge_cases"
    elif entry.stage in {"stage2_specialist", "stage2_therapeutic_expertise"}:
        result = "benchmark_specialized_domains"
    else:
        rubric_items = entry.attributes.get("rubric_items")
        if isinstance(rubric_items, list) and rubric_items:
            result = "benchmark_supervisor_rubrics"

    return result


def build_benchmark_summary(entries: tuple[CorpusEntry, ...]) -> dict[str, object]:
    slices = [slice_name for entry in entries if (slice_name := benchmark_slice_name(entry))]
    return {
        "benchmark_entries": len(slices),
        "by_slice": dict(Counter(slices)),
    }
