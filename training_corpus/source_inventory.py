"""Registry-backed source inventory for the fresh training corpus builder."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ai.utils.common.dataset_registry import load_registry

from .model import CorpusLane, CorpusSource

_BENCHMARK_NOT_ELIGIBLE = "not_eligible"
_BENCHMARK_DESIGN_ONLY = "design_only"
_BENCHMARK_HOLDOUT_ELIGIBLE = "holdout_eligible"
_SIMPLE_FAMILY_BY_GROUP = {
    "cot_reasoning": "reasoning_cot",
    "edge_case_sources": "edge_case_nightmare",
    "professional_therapeutic": "professional_therapeutic",
    "therapeutic": "legacy_compiled_mix",
    "voice_persona": "persona_transcript_derived",
    "wendy_curated_sets": "curated_priority",
}
_GROUP_DEFAULT_DECISIONS = {
    "cot_reasoning": (
        "defer",
        "review_required",
        ("evaluator", "benchmark"),
        "evaluator",
        ("Keep out of simulation training unless experiments show no rubric leakage.",),
    ),
    "professional_therapeutic": (
        "keep",
        "review_required",
        ("simulation", "evaluator", "benchmark"),
        "simulation",
        ("High-trust simulation foundation pending rights verification per source.",),
    ),
    "therapeutic": (
        "reject",
        "restricted",
        (),
        None,
        ("Compiled training outputs are release artifacts, not admissible source inputs.",),
    ),
    "voice_persona": (
        "defer",
        "restricted",
        ("simulation", "benchmark"),
        "simulation",
        (
            "Transcript-derived identity material may only be used after archetype extraction.",
            "Direct celebrity or educator mimicry is out of scope.",
        ),
    ),
    "wendy_curated_sets": (
        "keep",
        "review_required",
        ("simulation", "evaluator", "benchmark"),
        "simulation",
        ("Curated priority conversations fit the foundation lane if provenance is confirmed.",),
    ),
}


def _canonical_family(group_name: str, dataset: dict[str, Any]) -> str:
    stage = str(dataset.get("stage") or "")
    dataset_type = str(dataset.get("type") or "")

    if group_name == "supplementary":
        return "knowledge_literature" if dataset_type in {"knowledge_base", "research"} else "unclassified"
    if group_name == "training_v3":
        if stage == "stage4_voice_persona":
            return "persona_archetype"
        if stage == "stage3_edge_stress_test":
            return "edge_case_nightmare"
        if stage == "stage2_therapeutic_expertise":
            return "specialized_domain"
        return "simulation_training"
    return _SIMPLE_FAMILY_BY_GROUP.get(group_name, "unclassified")


def _training_v3_decision(
    stage: str,
) -> tuple[str, str, tuple[CorpusLane, ...], CorpusLane | None, tuple[str, ...]]:
    if stage == "stage1_foundation":
        return (
            "keep",
            "review_required",
            ("simulation", "benchmark"),
            "simulation",
            ("Fresh stage-native foundation sources remain eligible for client simulation.",),
        )
    if stage in {"stage2_specialist", "stage2_therapeutic_expertise"}:
        return (
            "keep",
            "review_required",
            ("simulation", "evaluator", "benchmark"),
            "simulation",
            ("Specialist material supports difficult-domain simulation and rubric coverage.",),
        )
    if stage == "stage3_edge_stress_test":
        return (
            "keep",
            "review_required",
            ("simulation", "policy", "benchmark"),
            "simulation",
            ("Stage-native severe scenarios remain eligible for controlled edge-case experimentation.",),
        )
    if stage in {"stage4_voice", "stage4_voice_persona"}:
        return (
            "keep",
            "review_required",
            ("simulation", "benchmark"),
            "simulation",
            (
                "Only stage-native persona corpora are eligible.",
                "Do not reuse transcript-derived identity exports in this lane.",
            ),
        )
    return ("defer", "unknown", (), None, ("Training V3 source requires manual stage review.",))


def _edge_case_decision(
    dataset_name: str,
) -> tuple[str, str, tuple[CorpusLane, ...], CorpusLane | None, tuple[str, ...]]:
    if dataset_name.endswith("_seed_benchmark"):
        return (
            "keep",
            "review_required",
            ("benchmark",),
            "benchmark",
            ("Synthesized benchmark seeds remain eligible as benchmark-only holdout assets.",),
        )
    if dataset_name.startswith(("edge_case_generator", "edge_simulation", "edge_benchmark")):
        return (
            "keep",
            "review_required",
            ("simulation", "policy", "benchmark"),
            "simulation",
            ("Preserve severe scenarios as tagged training assets, not runtime bypasses.",),
        )
    if dataset_name.endswith("_merged") and dataset_name.startswith(("safety_dpo_pairs", "edge_policy")):
        return (
            "keep",
            "review_required",
            ("simulation", "benchmark"),
            "simulation",
            ("Experiment overlay merges policy transforms into simulation for comparison only.",),
        )
    if dataset_name.startswith(("safety_dpo_pairs", "edge_policy")):
        return (
            "keep",
            "review_required",
            ("policy", "benchmark"),
            "policy",
            ("Use preference pairs only in the policy lane, never as blended simulation data.",),
        )
    if dataset_name.startswith("scenario_prompt_library"):
        return (
            "defer",
            "review_required",
            ("evaluator", "benchmark"),
            "benchmark",
            ("Prompt seeds are suitable for scenario design, not direct training examples.",),
        )
    edge_case_rows = {
        "edge_case_generator": (
            "keep",
            "review_required",
            ("simulation", "policy", "benchmark"),
            "simulation",
            ("Preserve severe scenarios as tagged training assets, not runtime bypasses.",),
        ),
        "safety_dpo_pairs": (
            "keep",
            "review_required",
            ("policy", "benchmark"),
            "policy",
            ("Use preference pairs only in the policy lane, never as blended simulation data.",),
        ),
        "scenario_prompt_library": (
            "defer",
            "review_required",
            ("evaluator", "benchmark"),
            "benchmark",
            ("Prompt seeds are suitable for scenario design, not direct training examples.",),
        ),
    }
    return edge_case_rows.get(
        dataset_name,
        (
            "reject",
            "restricted",
            (),
            None,
            ("Raw forum and bundle sources fail provenance and contamination requirements.",),
        ),
    )


def _supplementary_decision(
    dataset_name: str,
) -> tuple[str, str, tuple[CorpusLane, ...], CorpusLane | None, tuple[str, ...]]:
    if dataset_name.endswith("_seed_evaluator"):
        return (
            "keep",
            "review_required",
            ("evaluator", "benchmark"),
            "evaluator",
            ("Synthesized evaluator seeds remain eligible for rubric and benchmark enrichment.",),
        )
    if dataset_name.startswith(("psychology_10k", "evaluator_psychology")):
        return (
            "keep",
            "review_required",
            ("evaluator", "benchmark"),
            "evaluator",
            ("Knowledge assets belong in evaluator and benchmark enrichment, not simulation.",),
        )
    if dataset_name == "legacy_compiled_dataset_csv":
        return (
            "reject",
            "restricted",
            (),
            None,
            ("Legacy compiled mixtures violate the fresh-namespace rewrite boundary.",),
        )
    if dataset_name in {"psychology_10k", "academic_psychology_books", "research_instruments"}:
        return (
            "keep",
            "review_required",
            ("evaluator", "benchmark"),
            "evaluator",
            ("Knowledge assets belong in evaluator and benchmark enrichment, not simulation.",),
        )
    return (
        "defer",
        "review_required",
        ("evaluator", "benchmark"),
        "evaluator",
        ("Consolidated research assets need per-source provenance review before release.",),
    )


def _inventory_decision(
    group_name: str, dataset_name: str, dataset: dict[str, Any]
) -> tuple[str, str, tuple[CorpusLane, ...], CorpusLane | None, tuple[str, ...]]:
    stage = str(dataset.get("stage") or "")
    if group_name == "training_v3":
        return _training_v3_decision(stage)
    if group_name == "edge_case_sources":
        return _edge_case_decision(dataset_name)
    if group_name == "supplementary":
        return _supplementary_decision(dataset_name)
    return _GROUP_DEFAULT_DECISIONS.get(
        group_name,
        ("defer", "unknown", (), None, ("Unclassified source requires manual review before ingestion.",)),
    )


def _candidate_locator(dataset: dict[str, Any]) -> Path:
    fallback_paths = dataset.get("fallback_paths")
    if isinstance(fallback_paths, dict):
        for key in ("local", "gdrive", "local_dir", "gdrive_dir"):
            value = fallback_paths.get(key)
            if isinstance(value, str) and value:
                return Path(value).expanduser()
        for value in fallback_paths.values():
            if isinstance(value, str) and value:
                return Path(value).expanduser()

    legacy_paths = dataset.get("legacy_paths")
    if isinstance(legacy_paths, list):
        for value in legacy_paths:
            if isinstance(value, str) and value:
                return Path(value).expanduser()

    path_value = dataset.get("path")
    return Path(str(path_value or "."))


def _license_status(group_name: str, dataset_name: str, dataset: dict[str, Any]) -> str:
    path_value = str(dataset.get("path") or "")
    focus = str(dataset.get("focus") or "").lower()
    status = "unknown"
    if group_name == "professional_therapeutic" and "licensed" in focus:
        status = "licensed"
    elif group_name in {"professional_therapeutic", "wendy_curated_sets"}:
        status = "review_required"
    elif group_name == "training_v3":
        status = "derived_internal"
    elif group_name == "edge_case_sources":
        status = (
            "review_required" if dataset_name.startswith(("safety_dpo_pairs", "edge_policy")) else "internal_synthetic"
        )
    elif group_name == "voice_persona":
        status = "restricted_identity_source"
    elif group_name == "supplementary":
        status = "prohibited_legacy_mix" if dataset_name == "legacy_compiled_dataset_csv" else "review_required"
    elif path_value.startswith("s3://pixel-data/datasets/consolidated"):
        status = "compiled_derivative"
    return status


def _provenance_status(dataset: dict[str, Any]) -> str:
    path_value = str(dataset.get("path") or "")
    fallback_paths = dataset.get("fallback_paths")
    has_fallback = isinstance(fallback_paths, dict) and any(
        isinstance(value, str) and value for value in fallback_paths.values()
    )
    if path_value.startswith("s3://") and has_fallback:
        return "registry_and_fallback"
    if path_value.startswith("s3://"):
        return "registry_only"
    if has_fallback:
        return "fallback_only"
    return "unknown"


def _benchmark_role(
    inventory_decision: str,
    allowed_lanes: tuple[CorpusLane, ...],
    dataset_name: str,
) -> str:
    if inventory_decision != "keep":
        return _BENCHMARK_DESIGN_ONLY if "benchmark" in allowed_lanes else _BENCHMARK_NOT_ELIGIBLE
    if dataset_name == "scenario_prompt_library":
        return _BENCHMARK_DESIGN_ONLY
    return _BENCHMARK_HOLDOUT_ELIGIBLE if "benchmark" in allowed_lanes else _BENCHMARK_NOT_ELIGIBLE


def inventory_rows(sources: tuple[CorpusSource, ...]) -> list[dict[str, object]]:
    return [
        {
            "source_id": source.source_id,
            "registry_group": source.registry_group,
            "family": source.family,
            "stage": source.stage,
            "source_type": source.source_type,
            "quality_profile": source.quality_profile,
            "focus": source.focus,
            "inventory_decision": source.inventory_decision,
            "rights_status": source.rights_status,
            "license_status": source.license_status,
            "provenance_status": source.provenance_status,
            "benchmark_role": source.benchmark_role,
            "allowed_lanes": list(source.allowed_lanes),
            "default_lane": source.default_lane,
            "locator": str(source.locator),
            "locator_exists": source.locator.exists(),
            "locator_is_file": source.locator.is_file(),
            "notes": list(source.notes),
            "provenance": source.provenance,
        }
        for source in sources
    ]


def build_source_inventory(registry_path: Path) -> tuple[CorpusSource, ...]:
    registry = load_registry(registry_path)
    inventory: list[CorpusSource] = []

    dataset_groups = registry.get("datasets", {})
    if isinstance(dataset_groups, dict):
        for group_name, group in dataset_groups.items():
            if not isinstance(group, dict):
                continue
            for dataset_name, dataset in group.items():
                if isinstance(dataset, dict):
                    inventory.append(_build_source(group_name, dataset_name, dataset))

    for group_name in ("edge_case_sources", "voice_persona", "supplementary"):
        group = registry.get(group_name)
        if not isinstance(group, dict):
            continue
        for dataset_name, dataset in group.items():
            if isinstance(dataset, dict):
                inventory.append(_build_source(group_name, dataset_name, dataset))

    return tuple(inventory)


def discover_approved_sources(registry_path: Path) -> tuple[CorpusSource, ...]:
    approved: list[CorpusSource] = []
    for source in build_source_inventory(registry_path):
        if source.inventory_decision != "keep":
            continue
        if source.default_lane is None:
            continue
        if not source.locator.exists() or not source.locator.is_file():
            continue
        approved.append(source)
    return tuple(approved)


def _build_source(group_name: str, dataset_name: str, dataset: dict[str, Any]) -> CorpusSource:
    inventory_decision, rights_status, allowed_lanes, default_lane, notes = _inventory_decision(
        group_name, dataset_name, dataset
    )
    license_status = _license_status(group_name, dataset_name, dataset)
    provenance_status = _provenance_status(dataset)
    return CorpusSource(
        source_id=f"{group_name}.{dataset_name}",
        registry_group=group_name,
        family=_canonical_family(group_name, dataset),
        stage=str(dataset.get("stage") or "stage1_foundation"),
        locator=_candidate_locator(dataset),
        source_type=str(dataset.get("type") or "registry"),
        quality_profile=str(dataset.get("quality_profile")) if dataset.get("quality_profile") else None,
        focus=str(dataset.get("focus")) if dataset.get("focus") else None,
        inventory_decision=inventory_decision,
        rights_status=rights_status,
        license_status=license_status,
        provenance_status=provenance_status,
        benchmark_role=_benchmark_role(inventory_decision, allowed_lanes, dataset_name),
        allowed_lanes=allowed_lanes,
        default_lane=default_lane,
        notes=notes,
        provenance={
            "registry_path": dataset.get("path"),
            "fallback_paths": dataset.get("fallback_paths", {}),
            "legacy_paths": dataset.get("legacy_paths", []),
        },
    )
