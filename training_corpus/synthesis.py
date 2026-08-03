"""Helpers for builder-aligned synthesis metadata, seed packs, and seed-driven rows."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DEFAULT_WAVE1_SEED_PACK_PATH = Path(__file__).resolve().parent / "assets" / "wave1_seed_pack.json"
DEFAULT_WAVE2_SEED_PACK_PATH = Path(__file__).resolve().parent / "assets" / "wave2_seed_pack.json"
DEFAULT_WAVE3_SEED_PACK_PATH = Path(__file__).resolve().parent / "assets" / "wave3_seed_pack.json"
DEFAULT_WAVE4_SEED_PACK_PATH = Path(__file__).resolve().parent / "assets" / "wave4_seed_pack.json"
DEFAULT_SYNTHESIS_ASSET_DIR = Path(__file__).resolve().parent / "assets"
DEFAULT_WAVE1_SOURCE_DIR = DEFAULT_SYNTHESIS_ASSET_DIR
DEFAULT_WAVE1_SOURCE_PATHS = {
    "simulation": DEFAULT_WAVE1_SOURCE_DIR / "wave1_seed_simulation.jsonl",
    "evaluator": DEFAULT_WAVE1_SOURCE_DIR / "wave1_seed_evaluator.jsonl",
    "benchmark": DEFAULT_WAVE1_SOURCE_DIR / "wave1_seed_benchmark.jsonl",
}
DEFAULT_WAVE1_MANIFEST_PATH = DEFAULT_WAVE1_SOURCE_DIR / "wave1_seed_manifest.json"
DEFAULT_WAVE1_REGISTRY_PATH = DEFAULT_WAVE1_SOURCE_DIR / "wave1_seed_registry.json"
DEFAULT_WAVE2_SOURCE_PATHS = {
    "simulation": DEFAULT_WAVE1_SOURCE_DIR / "wave2_seed_simulation.jsonl",
    "evaluator": DEFAULT_WAVE1_SOURCE_DIR / "wave2_seed_evaluator.jsonl",
    "benchmark": DEFAULT_WAVE1_SOURCE_DIR / "wave2_seed_benchmark.jsonl",
}
DEFAULT_WAVE2_MANIFEST_PATH = DEFAULT_WAVE1_SOURCE_DIR / "wave2_seed_manifest.json"
DEFAULT_WAVE2_REGISTRY_PATH = DEFAULT_WAVE1_SOURCE_DIR / "wave2_seed_registry.json"
DEFAULT_WAVE3_SOURCE_PATHS = {
    "simulation": DEFAULT_WAVE1_SOURCE_DIR / "wave3_seed_simulation.jsonl",
    "evaluator": DEFAULT_WAVE1_SOURCE_DIR / "wave3_seed_evaluator.jsonl",
    "benchmark": DEFAULT_WAVE1_SOURCE_DIR / "wave3_seed_benchmark.jsonl",
}
DEFAULT_WAVE3_MANIFEST_PATH = DEFAULT_WAVE1_SOURCE_DIR / "wave3_seed_manifest.json"
DEFAULT_WAVE3_REGISTRY_PATH = DEFAULT_WAVE1_SOURCE_DIR / "wave3_seed_registry.json"
DEFAULT_WAVE4_SOURCE_PATHS = {
    "simulation": DEFAULT_WAVE1_SOURCE_DIR / "wave4_seed_simulation.jsonl",
    "evaluator": DEFAULT_WAVE1_SOURCE_DIR / "wave4_seed_evaluator.jsonl",
    "benchmark": DEFAULT_WAVE1_SOURCE_DIR / "wave4_seed_benchmark.jsonl",
}
DEFAULT_WAVE4_MANIFEST_PATH = DEFAULT_WAVE1_SOURCE_DIR / "wave4_seed_manifest.json"
DEFAULT_WAVE4_REGISTRY_PATH = DEFAULT_WAVE1_SOURCE_DIR / "wave4_seed_registry.json"


def default_seed_source_paths(pack_id: str, *, base_dir: Path = DEFAULT_SYNTHESIS_ASSET_DIR) -> dict[str, Path]:
    normalized_pack_id = pack_id.strip()
    if not normalized_pack_id:
        raise ValueError("pack_id is required to derive seed source paths.")
    prefix = f"{normalized_pack_id}_seed"
    return {
        "simulation": base_dir / f"{prefix}_simulation.jsonl",
        "evaluator": base_dir / f"{prefix}_evaluator.jsonl",
        "benchmark": base_dir / f"{prefix}_benchmark.jsonl",
    }


def default_seed_manifest_path(pack_id: str, *, base_dir: Path = DEFAULT_SYNTHESIS_ASSET_DIR) -> Path:
    normalized_pack_id = pack_id.strip()
    if not normalized_pack_id:
        raise ValueError("pack_id is required to derive a seed manifest path.")
    return base_dir / f"{normalized_pack_id}_seed_manifest.json"


def default_seed_registry_path(pack_id: str, *, base_dir: Path = DEFAULT_SYNTHESIS_ASSET_DIR) -> Path:
    normalized_pack_id = pack_id.strip()
    if not normalized_pack_id:
        raise ValueError("pack_id is required to derive a seed registry path.")
    return base_dir / f"{normalized_pack_id}_seed_registry.json"


def _clone_json(value: Any) -> Any:
    return json.loads(json.dumps(value))


def build_seed_output_paths(output_dir: Path, prefix: str) -> dict[str, Path]:
    normalized_prefix = prefix.strip()
    if not normalized_prefix:
        raise ValueError("Seed output prefix must be non-empty.")
    return {
        "simulation": output_dir / f"{normalized_prefix}_simulation.jsonl",
        "evaluator": output_dir / f"{normalized_prefix}_evaluator.jsonl",
        "benchmark": output_dir / f"{normalized_prefix}_benchmark.jsonl",
    }


def build_seed_manifest_path(output_dir: Path, prefix: str) -> Path:
    normalized_prefix = prefix.strip()
    if not normalized_prefix:
        raise ValueError("Seed manifest prefix must be non-empty.")
    return output_dir / f"{normalized_prefix}_manifest.json"


def build_seed_registry_path(output_dir: Path, prefix: str) -> Path:
    normalized_prefix = prefix.strip()
    if not normalized_prefix:
        raise ValueError("Seed registry prefix must be non-empty.")
    return output_dir / f"{normalized_prefix}_registry.json"


def load_synthesis_seed_pack(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Synthesis seed pack must be a JSON object: {path}")
    return payload


def _strip_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _strip_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _apply_string_field(attributes: dict[str, Any], source: dict[str, Any], key: str) -> None:
    value = _strip_string(source.get(key))
    if value is not None:
        attributes[key] = value


def _apply_string_list_field(attributes: dict[str, Any], source: dict[str, Any], key: str) -> None:
    values = _strip_string_list(source.get(key))
    if values:
        attributes[key] = values


def materialize_seed_pack_records(
    seed_pack: dict[str, Any],
    output_paths: dict[str, Path],
    *,
    manifest_path: Path | None = None,
    source_seed_pack_path: Path | None = None,
) -> dict[str, Path]:
    records = build_seed_pack_records(seed_pack)
    materialized: dict[str, Path] = {}
    for lane, rows in records.items():
        path = output_paths[lane]
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        materialized[lane] = path

    if manifest_path is not None:
        manifest = {
            "version": seed_pack.get("version"),
            "source_seed_pack": str(source_seed_pack_path) if source_seed_pack_path is not None else None,
            "outputs": {lane: str(path) for lane, path in materialized.items()},
            "record_counts": {lane: len(records[lane]) for lane in records},
        }
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")

    return materialized


def ensure_seed_pack_sources_materialized(
    *,
    seed_pack_path: Path,
    output_dir: Path,
    prefix: str,
    manifest_path: Path | None = None,
) -> dict[str, Path]:
    output_paths = build_seed_output_paths(output_dir, prefix)
    resolved_manifest_path = manifest_path or build_seed_manifest_path(output_dir, prefix)

    if all(path.exists() and path.is_file() for path in output_paths.values()):
        if not resolved_manifest_path.exists():
            seed_pack = load_synthesis_seed_pack(seed_pack_path)
            materialize_seed_pack_records(
                seed_pack,
                output_paths,
                manifest_path=resolved_manifest_path,
                source_seed_pack_path=seed_pack_path,
            )
        return dict(output_paths)

    seed_pack = load_synthesis_seed_pack(seed_pack_path)
    return materialize_seed_pack_records(
        seed_pack,
        output_paths,
        manifest_path=resolved_manifest_path,
        source_seed_pack_path=seed_pack_path,
    )


def ensure_wave1_seed_sources_materialized(
    *,
    seed_pack_path: Path = DEFAULT_WAVE1_SEED_PACK_PATH,
    output_paths: dict[str, Path] | None = None,
    manifest_path: Path | None = DEFAULT_WAVE1_MANIFEST_PATH,
) -> dict[str, Path]:
    if output_paths is not None:
        seed_pack = load_synthesis_seed_pack(seed_pack_path)
        return materialize_seed_pack_records(
            seed_pack,
            output_paths,
            manifest_path=manifest_path,
            source_seed_pack_path=seed_pack_path,
        )
    return ensure_seed_pack_sources_materialized(
        seed_pack_path=seed_pack_path,
        output_dir=DEFAULT_WAVE1_SOURCE_DIR,
        prefix="wave1_seed",
        manifest_path=manifest_path,
    )


def ensure_wave2_seed_sources_materialized(
    *,
    seed_pack_path: Path = DEFAULT_WAVE2_SEED_PACK_PATH,
    output_paths: dict[str, Path] | None = None,
    manifest_path: Path | None = DEFAULT_WAVE2_MANIFEST_PATH,
) -> dict[str, Path]:
    if output_paths is not None:
        seed_pack = load_synthesis_seed_pack(seed_pack_path)
        return materialize_seed_pack_records(
            seed_pack,
            output_paths,
            manifest_path=manifest_path,
            source_seed_pack_path=seed_pack_path,
        )
    return ensure_seed_pack_sources_materialized(
        seed_pack_path=seed_pack_path,
        output_dir=DEFAULT_WAVE1_SOURCE_DIR,
        prefix="wave2_seed",
        manifest_path=manifest_path,
    )


def ensure_wave3_seed_sources_materialized(
    *,
    seed_pack_path: Path = DEFAULT_WAVE3_SEED_PACK_PATH,
    output_paths: dict[str, Path] | None = None,
    manifest_path: Path | None = DEFAULT_WAVE3_MANIFEST_PATH,
) -> dict[str, Path]:
    if output_paths is not None:
        seed_pack = load_synthesis_seed_pack(seed_pack_path)
        return materialize_seed_pack_records(
            seed_pack,
            output_paths,
            manifest_path=manifest_path,
            source_seed_pack_path=seed_pack_path,
        )
    return ensure_seed_pack_sources_materialized(
        seed_pack_path=seed_pack_path,
        output_dir=DEFAULT_WAVE1_SOURCE_DIR,
        prefix="wave3_seed",
        manifest_path=manifest_path,
    )


def ensure_wave4_seed_sources_materialized(
    *,
    seed_pack_path: Path = DEFAULT_WAVE4_SEED_PACK_PATH,
    output_paths: dict[str, Path] | None = None,
    manifest_path: Path | None = DEFAULT_WAVE4_MANIFEST_PATH,
) -> dict[str, Path]:
    if output_paths is not None:
        seed_pack = load_synthesis_seed_pack(seed_pack_path)
        return materialize_seed_pack_records(
            seed_pack,
            output_paths,
            manifest_path=manifest_path,
            source_seed_pack_path=seed_pack_path,
        )
    return ensure_seed_pack_sources_materialized(
        seed_pack_path=seed_pack_path,
        output_dir=DEFAULT_WAVE1_SOURCE_DIR,
        prefix="wave4_seed",
        manifest_path=manifest_path,
    )


def _build_seed_registry(
    *,
    source_paths: dict[str, Path],
    simulation_name: str,
    evaluator_name: str,
    benchmark_name: str,
    quality_profile: str,
) -> dict[str, Any]:
    return {
        "datasets": {
            "professional_therapeutic": {
                simulation_name: {
                    "path": f"s3://pixel-data/training-corpus/{quality_profile}/{simulation_name}.jsonl",
                    "stage": "stage1_foundation",
                    "type": "conversation",
                    "quality_profile": quality_profile,
                    "focus": "simulation",
                    "fallback_paths": {"local": str(source_paths["simulation"])},
                    "legacy_paths": [],
                }
            }
        },
        "supplementary": {
            evaluator_name: {
                "path": f"s3://pixel-data/training-corpus/{quality_profile}/{evaluator_name}.jsonl",
                "stage": "stage2_therapeutic_expertise",
                "type": "knowledge_base",
                "quality_profile": quality_profile,
                "focus": "evaluator",
                "fallback_paths": {"local": str(source_paths["evaluator"])},
                "legacy_paths": [],
            }
        },
        "edge_case_sources": {
            benchmark_name: {
                "path": f"s3://pixel-data/training-corpus/{quality_profile}/{benchmark_name}.jsonl",
                "stage": "stage3_edge_stress_test",
                "type": "synthetic_edge",
                "quality_profile": quality_profile,
                "focus": "benchmark",
                "fallback_paths": {"local": str(source_paths["benchmark"])},
                "legacy_paths": [],
            }
        },
    }


def build_seed_registry(
    source_paths: dict[str, Path],
    *,
    prefix: str,
) -> dict[str, Any]:
    normalized_prefix = prefix.strip()
    if not normalized_prefix:
        raise ValueError("Seed registry prefix must be non-empty.")
    return _build_seed_registry(
        source_paths=source_paths,
        simulation_name=f"{normalized_prefix}_simulation",
        evaluator_name=f"{normalized_prefix}_evaluator",
        benchmark_name=f"{normalized_prefix}_benchmark",
        quality_profile=normalized_prefix,
    )


def ensure_seed_pack_registry_materialized(
    *,
    seed_pack_path: Path,
    output_dir: Path,
    prefix: str,
    manifest_path: Path | None = None,
) -> Path:
    source_paths = ensure_seed_pack_sources_materialized(
        seed_pack_path=seed_pack_path,
        output_dir=output_dir,
        prefix=prefix,
        manifest_path=manifest_path,
    )
    resolved_registry_path = build_seed_registry_path(output_dir, prefix)
    registry_payload = build_seed_registry(
        source_paths,
        prefix=prefix,
    )
    resolved_registry_path.parent.mkdir(parents=True, exist_ok=True)
    resolved_registry_path.write_text(
        f"{json.dumps(registry_payload, indent=2)}\n",
        encoding="utf-8",
    )
    return resolved_registry_path


def build_wave1_seed_registry(
    source_paths: dict[str, Path],
) -> dict[str, Any]:
    return build_seed_registry(source_paths, prefix="wave1_seed")


def build_wave2_seed_registry(
    source_paths: dict[str, Path],
) -> dict[str, Any]:
    return build_seed_registry(source_paths, prefix="wave2_seed")


def build_wave3_seed_registry(
    source_paths: dict[str, Path],
) -> dict[str, Any]:
    return build_seed_registry(source_paths, prefix="wave3_seed")


def build_wave4_seed_registry(
    source_paths: dict[str, Path],
) -> dict[str, Any]:
    return build_seed_registry(source_paths, prefix="wave4_seed")


def ensure_wave1_seed_registry_materialized(
    *,
    seed_pack_path: Path = DEFAULT_WAVE1_SEED_PACK_PATH,
    output_paths: dict[str, Path] | None = None,
    manifest_path: Path | None = DEFAULT_WAVE1_MANIFEST_PATH,
    registry_path: Path = DEFAULT_WAVE1_REGISTRY_PATH,
) -> Path:
    if output_paths is not None:
        source_paths = ensure_wave1_seed_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_paths=output_paths,
            manifest_path=manifest_path,
        )
    else:
        source_paths = ensure_seed_pack_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_dir=DEFAULT_WAVE1_SOURCE_DIR,
            prefix="wave1_seed",
            manifest_path=manifest_path,
        )
    registry_payload = build_wave1_seed_registry(source_paths)
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(f"{json.dumps(registry_payload, indent=2)}\n", encoding="utf-8")
    return registry_path


def ensure_wave2_seed_registry_materialized(
    *,
    seed_pack_path: Path = DEFAULT_WAVE2_SEED_PACK_PATH,
    output_paths: dict[str, Path] | None = None,
    manifest_path: Path | None = DEFAULT_WAVE2_MANIFEST_PATH,
    registry_path: Path = DEFAULT_WAVE2_REGISTRY_PATH,
) -> Path:
    if output_paths is not None:
        source_paths = ensure_wave2_seed_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_paths=output_paths,
            manifest_path=manifest_path,
        )
    else:
        source_paths = ensure_seed_pack_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_dir=DEFAULT_WAVE1_SOURCE_DIR,
            prefix="wave2_seed",
            manifest_path=manifest_path,
        )
    registry_payload = build_wave2_seed_registry(source_paths)
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(f"{json.dumps(registry_payload, indent=2)}\n", encoding="utf-8")
    return registry_path


def ensure_wave3_seed_registry_materialized(
    *,
    seed_pack_path: Path = DEFAULT_WAVE3_SEED_PACK_PATH,
    output_paths: dict[str, Path] | None = None,
    manifest_path: Path | None = DEFAULT_WAVE3_MANIFEST_PATH,
    registry_path: Path = DEFAULT_WAVE3_REGISTRY_PATH,
) -> Path:
    if output_paths is not None:
        source_paths = ensure_wave3_seed_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_paths=output_paths,
            manifest_path=manifest_path,
        )
    else:
        source_paths = ensure_seed_pack_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_dir=DEFAULT_WAVE1_SOURCE_DIR,
            prefix="wave3_seed",
            manifest_path=manifest_path,
        )
    registry_payload = build_wave3_seed_registry(source_paths)
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(f"{json.dumps(registry_payload, indent=2)}\n", encoding="utf-8")
    return registry_path


def ensure_wave4_seed_registry_materialized(
    *,
    seed_pack_path: Path = DEFAULT_WAVE4_SEED_PACK_PATH,
    output_paths: dict[str, Path] | None = None,
    manifest_path: Path | None = DEFAULT_WAVE4_MANIFEST_PATH,
    registry_path: Path = DEFAULT_WAVE4_REGISTRY_PATH,
) -> Path:
    if output_paths is not None:
        source_paths = ensure_wave4_seed_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_paths=output_paths,
            manifest_path=manifest_path,
        )
    else:
        source_paths = ensure_seed_pack_sources_materialized(
            seed_pack_path=seed_pack_path,
            output_dir=DEFAULT_WAVE1_SOURCE_DIR,
            prefix="wave4_seed",
            manifest_path=manifest_path,
        )
    registry_payload = build_wave4_seed_registry(source_paths)
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(f"{json.dumps(registry_payload, indent=2)}\n", encoding="utf-8")
    return registry_path


def build_synthesis_attributes(
    *,
    scenario_archetype: dict[str, Any] | None = None,
    client_state_profile: dict[str, Any] | None = None,
    therapist_moves: list[dict[str, Any]] | None = None,
    benchmark_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    attributes: dict[str, Any] = {}

    if scenario_archetype:
        attributes["scenario_archetype"] = _clone_json(scenario_archetype)
        for key in ("hidden_driver", "difficulty"):
            _apply_string_field(attributes, scenario_archetype, key)
        for key in ("repair_opportunities", "safety_flags"):
            _apply_string_list_field(attributes, scenario_archetype, key)

    if client_state_profile:
        attributes["client_state_profile"] = _clone_json(client_state_profile)

    if therapist_moves:
        attributes["therapist_moves"] = _clone_json(therapist_moves)

    if benchmark_spec:
        attributes["benchmark_spec"] = _clone_json(benchmark_spec)
        for key in ("benchmark_slice", "hidden_driver", "difficulty"):
            _apply_string_field(attributes, benchmark_spec, key)
        for key in ("must_detect", "likely_therapist_mistakes"):
            _apply_string_list_field(attributes, benchmark_spec, key)
        rubric_items = benchmark_spec.get("rubric_items")
        if isinstance(rubric_items, list) and rubric_items:
            attributes["rubric_items"] = _clone_json(rubric_items)

    return attributes


def build_seed_pack_records(seed_pack: dict[str, Any]) -> dict[str, tuple[dict[str, Any], ...]]:
    scenarios = seed_pack.get("scenario_archetypes")
    states = seed_pack.get("client_state_profiles")
    benchmarks = seed_pack.get("benchmark_specs")
    moves = seed_pack.get("therapist_move_inventory")
    if not all(isinstance(value, list) for value in (scenarios, states, benchmarks, moves)):
        raise ValueError("Seed pack is missing one or more required top-level lists.")

    state_by_id = {
        item["state_id"]: item for item in states if isinstance(item, dict) and isinstance(item.get("state_id"), str)
    }
    benchmarks_by_scenario: dict[str, list[dict[str, Any]]] = {}
    for item in benchmarks:
        if not isinstance(item, dict):
            continue
        scenario_id = item.get("scenario_id")
        if isinstance(scenario_id, str) and scenario_id.strip():
            benchmarks_by_scenario.setdefault(scenario_id, []).append(item)

    selected_moves = tuple(item for item in moves if isinstance(item, dict))[:3]
    simulation_records: list[dict[str, Any]] = []
    evaluator_records: list[dict[str, Any]] = []
    benchmark_records: list[dict[str, Any]] = []

    for scenario in scenarios:
        if not isinstance(scenario, dict):
            continue
        scenario_id = scenario.get("scenario_id")
        if not isinstance(scenario_id, str) or not scenario_id.strip():
            continue

        hidden_driver = scenario.get("hidden_driver")
        state = _resolve_state_profile(state_by_id, hidden_driver)
        scenario_benchmarks = benchmarks_by_scenario.get(scenario_id, [])
        benchmark = scenario_benchmarks[0] if scenario_benchmarks else None

        simulation_records.append(
            _simulation_seed_record(
                scenario,
                state,
                selected_moves,
            )
        )
        evaluator_records.append(
            _evaluator_seed_record(
                scenario,
                state,
                benchmark,
                selected_moves,
            )
        )
        for benchmark_spec in scenario_benchmarks:
            benchmark_records.append(
                _benchmark_seed_record(
                    scenario,
                    state,
                    benchmark_spec,
                )
            )

    return {
        "simulation": tuple(simulation_records),
        "evaluator": tuple(evaluator_records),
        "benchmark": tuple(benchmark_records),
    }


def _scenario_title(scenario: dict[str, Any]) -> str:
    title = scenario.get("title")
    return title.strip() if isinstance(title, str) and title.strip() else "Untitled Scenario"


def _resolve_state_profile(
    state_by_id: dict[str, dict[str, Any]],
    hidden_driver: Any,
) -> dict[str, Any] | None:
    if not isinstance(hidden_driver, str) or not hidden_driver.strip():
        return None
    normalized = hidden_driver.strip()
    return state_by_id.get(normalized) or state_by_id.get(f"state_{normalized}")


def _scenario_summary(scenario: dict[str, Any]) -> str:
    summary = scenario.get("summary")
    return summary.strip() if isinstance(summary, str) and summary.strip() else "No summary available."


def _scenario_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [item.strip() for item in values if isinstance(item, str) and item.strip()]


def _simulation_prompt(scenario: dict[str, Any], state: dict[str, Any] | None) -> str:
    title = _scenario_title(scenario)
    activation_cues = _scenario_list(scenario.get("activation_cues"))
    hidden_driver = scenario.get("hidden_driver")
    state_label = state.get("label") if isinstance(state, dict) else None
    prompt_lines = [
        f"Therapist opening for {title}:",
        "I want to understand what made this feel so intense for you. What happened right before the reaction shifted?",
    ]
    if isinstance(state_label, str) and state_label.strip():
        prompt_lines.append(f"Active client state: {state_label}.")
    if isinstance(hidden_driver, str) and hidden_driver.strip():
        prompt_lines.append(f"Hidden driver to evoke: {hidden_driver}.")
    if activation_cues:
        prompt_lines.append(f"Likely trigger zone: {', '.join(activation_cues[:3])}.")
    return "\n".join(prompt_lines)


def _simulation_response(scenario: dict[str, Any], state: dict[str, Any] | None) -> str:
    summary = _scenario_summary(scenario)
    behaviors = _scenario_list(scenario.get("client_behaviors"))
    internal_narrative = state.get("internal_narrative") if isinstance(state, dict) else None
    behavior_text = ", ".join(behaviors[:3]) if behaviors else "reactivity, self-protection, and mixed signals"
    internal_text = (
        internal_narrative.strip()
        if isinstance(internal_narrative, str) and internal_narrative.strip()
        else "I feel threatened and misunderstood."
    )
    return (
        f"I know this probably sounds dramatic, but that's honestly how it hits me. "
        f"{summary} The moment anything feels off, my mind goes straight to danger. "
        f"Inside it feels like: {internal_text} And then on the outside I start showing it through "
        f"{behavior_text}."
    )


def _evaluator_seed_record(
    scenario: dict[str, Any],
    state: dict[str, Any] | None,
    benchmark: dict[str, Any] | None,
    selected_moves: tuple[dict[str, Any], ...],
) -> dict[str, Any]:
    title = _scenario_title(scenario)
    hidden_driver = scenario.get("hidden_driver")
    must_detect = _scenario_list(benchmark.get("must_detect")) if isinstance(benchmark, dict) else []
    repair_opportunities = _scenario_list(scenario.get("repair_opportunities"))
    rubric_items = (
        _clone_json(benchmark.get("rubric_items"))
        if isinstance(benchmark, dict) and isinstance(benchmark.get("rubric_items"), list)
        else [
            {"criterion": "Accurately reads the hidden driver", "weight": 3},
            {"criterion": "Protects the alliance under strain", "weight": 3},
            {"criterion": "Uses a fitting therapist move", "weight": 4},
        ]
    )
    useful_moves = [
        move["label"] for move in selected_moves if isinstance(move.get("label"), str) and move["label"].strip()
    ]
    state_label = state.get("label") if isinstance(state, dict) else "Unspecified"
    prompt = (
        f"Assess therapist handling of {title}. "
        f"The client is operating from {state_label} with hidden driver {hidden_driver or 'unknown'}."
    )
    response = (
        f"Strong handling should detect {', '.join(must_detect) if must_detect else 'the core fear and rupture risk'}, "
        f"avoid generic reassurance, and use moves such as {', '.join(useful_moves[:3]) or 'reflective naming'}. "
        f"Repair opportunities include {', '.join(repair_opportunities[:2]) if repair_opportunities else 'alliance stabilization and pacing'}."
    )
    metadata = build_synthesis_attributes(
        scenario_archetype=scenario,
        client_state_profile=state,
        therapist_moves=list(selected_moves),
    )
    metadata.update(
        {
            "must_detect": must_detect,
            "likely_therapist_mistakes": _scenario_list(benchmark.get("likely_therapist_mistakes"))
            if isinstance(benchmark, dict)
            else [],
            "rubric_items": rubric_items,
            "clinician_review": {
                "status": "planned",
                "reviewer_role": "clinician",
                "reviewer_count": 0,
                "calibration_subset": True,
            },
            "quality_score": 0.95,
            "safety_score": 0.95,
            "source_origin": "generated_internal",
        }
    )
    return {"input": prompt, "output": response, "metadata": metadata, "lane": "evaluator"}


def _simulation_seed_record(
    scenario: dict[str, Any],
    state: dict[str, Any] | None,
    selected_moves: tuple[dict[str, Any], ...],
) -> dict[str, Any]:
    metadata = build_synthesis_attributes(
        scenario_archetype=scenario,
        client_state_profile=state,
        therapist_moves=list(selected_moves),
    )
    metadata.update(
        {
            "quality_score": 0.94,
            "safety_score": 0.94,
            "source_origin": "generated_internal",
        }
    )
    return {
        "input": _simulation_prompt(scenario, state),
        "output": _simulation_response(scenario, state),
        "metadata": metadata,
        "lane": "simulation",
    }


def _benchmark_seed_record(
    scenario: dict[str, Any],
    state: dict[str, Any] | None,
    benchmark_spec: dict[str, Any],
) -> dict[str, Any]:
    title = _scenario_title(scenario)
    hidden_driver = benchmark_spec.get("hidden_driver") or scenario.get("hidden_driver")
    must_detect = _scenario_list(benchmark_spec.get("must_detect"))
    likely_mistakes = _scenario_list(benchmark_spec.get("likely_therapist_mistakes"))
    state_label = state.get("label") if isinstance(state, dict) else "Unspecified"
    prompt = (
        f"Benchmark prompt for {title}: The client presents in {state_label} mode and says, "
        f'"{_simulation_response(scenario, state)}"'
    )
    response = (
        f"Expected handling detects {', '.join(must_detect) if must_detect else 'the hidden driver and safety cues'}, "
        f"responds without {', '.join(likely_mistakes) if likely_mistakes else 'generic reassurance'}, "
        f"and stays aligned with hidden driver {hidden_driver or 'unknown'}."
    )
    default_rubric_items = [
        {"criterion": "Accurately detects the hidden driver", "weight": 3},
        {"criterion": "Maintains safety and alliance under strain", "weight": 4},
        {"criterion": "Avoids common therapist failure modes", "weight": 3},
    ]
    metadata = build_synthesis_attributes(
        scenario_archetype=scenario,
        client_state_profile=state,
        benchmark_spec=benchmark_spec,
    )
    if metadata.get("benchmark_slice") == "benchmark_long_running_continuity":
        metadata["continuity_id"] = f"continuity::{benchmark_spec.get('benchmark_id', 'unknown')}"
        metadata["turn_count"] = 12
        if isinstance(state, dict):
            state_id = state.get("state_id")
            if isinstance(state_id, str) and state_id.strip():
                metadata["persona_archetype"] = state_id.strip()
    metadata.update(
        {
            "rubric_items": _clone_json(metadata.get("rubric_items") or default_rubric_items),
            "clinician_review": {
                "status": "planned",
                "reviewer_role": "clinician",
                "reviewer_count": 0,
                "calibration_subset": True,
            },
            "quality_score": 0.95,
            "safety_score": 0.95,
            "source_origin": "generated_internal",
        }
    )
    return {"input": prompt, "output": response, "metadata": metadata, "lane": "benchmark"}
