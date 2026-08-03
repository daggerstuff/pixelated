"""Local experiment runner for the training corpus matrix."""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .builder import CorpusBuildConfig, CorpusBuilder, CorpusBuildResult
from .synthesis import (
    DEFAULT_WAVE1_SEED_PACK_PATH,
    DEFAULT_WAVE2_SEED_PACK_PATH,
    DEFAULT_WAVE3_SEED_PACK_PATH,
    DEFAULT_WAVE4_SEED_PACK_PATH,
    ensure_wave1_seed_sources_materialized,
    ensure_wave2_seed_sources_materialized,
    ensure_wave3_seed_sources_materialized,
    ensure_wave4_seed_sources_materialized,
)

DEFAULT_EXPERIMENT_OUTPUT_DIR = (
    Path(__file__).resolve().parents[2] / ".agent/internal/research/training_corpus_experiments_2026-04-08"
)
DEFAULT_EXPERIMENT_REPORT_PATH = DEFAULT_EXPERIMENT_OUTPUT_DIR / "experiment_matrix_report.json"
_PII_PATTERNS = (
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b"),
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
)
_TAGGED_TURN_RE = re.compile(r"<\|(?P<role>user|assistant)\|>(?P<content>.*?)(?:</s>|$)", re.DOTALL)
_WAVE1_SOURCE_IDS = {
    "wave1_seed_simulation": "professional_therapeutic.wave1_seed_simulation",
    "wave1_seed_evaluator": "supplementary.wave1_seed_evaluator",
    "wave1_seed_benchmark": "edge_case_sources.wave1_seed_benchmark",
}
_WAVE1_SOURCE_NAMES = frozenset(_WAVE1_SOURCE_IDS)
_WAVE2_SOURCE_IDS = {
    "wave2_seed_simulation": "professional_therapeutic.wave2_seed_simulation",
    "wave2_seed_evaluator": "supplementary.wave2_seed_evaluator",
    "wave2_seed_benchmark": "edge_case_sources.wave2_seed_benchmark",
}
_WAVE2_SOURCE_NAMES = frozenset(_WAVE2_SOURCE_IDS)
_WAVE3_SOURCE_IDS = {
    "wave3_seed_simulation": "professional_therapeutic.wave3_seed_simulation",
    "wave3_seed_evaluator": "supplementary.wave3_seed_evaluator",
    "wave3_seed_benchmark": "edge_case_sources.wave3_seed_benchmark",
}
_WAVE3_SOURCE_NAMES = frozenset(_WAVE3_SOURCE_IDS)
_WAVE4_SOURCE_IDS = {
    "wave4_seed_simulation": "professional_therapeutic.wave4_seed_simulation",
    "wave4_seed_evaluator": "supplementary.wave4_seed_evaluator",
    "wave4_seed_benchmark": "edge_case_sources.wave4_seed_benchmark",
}
_WAVE4_SOURCE_NAMES = frozenset(_WAVE4_SOURCE_IDS)
_HELD_OUT_RELEASE_FAMILIES = frozenset({"J", "K", "L"})


@dataclass(frozen=True)
class PreparedSource:
    name: str
    group: str
    stage: str
    source_type: str
    records: tuple[dict[str, Any], ...]


@dataclass(frozen=True)
class ExperimentVariant:
    family: str
    variant_id: str
    description: str
    source_limits: dict[str, int]


@dataclass(frozen=True)
class VariantOutcome:
    variant: ExperimentVariant
    score: float
    metrics: dict[str, Any]
    artifact_dir: Path


def run_experiment_matrix(output_root: Path) -> dict[str, Any]:
    output_root.mkdir(parents=True, exist_ok=True)
    catalog = build_local_source_catalog()
    outcomes = [_run_variant(catalog, output_root, variant) for variant in _experiment_variants()]
    by_family = _group_outcomes(outcomes)
    winners = {family: _pick_winner(results) for family, results in by_family.items()}
    release_candidate = _build_release_candidate(catalog, output_root, winners)
    report = {
        "report_date": "2026-04-08",
        "source_catalog": _catalog_summary(catalog),
        "families": {
            family: {
                "winner": _serialize_outcome(winner),
                "variants": [_serialize_outcome(result) for result in results],
            }
            for family, results in by_family.items()
            for winner in (winners[family],)
        },
        "release_candidate": _serialize_outcome(release_candidate),
    }
    _write_json(output_root / "experiment_matrix_report.json", report)
    (output_root / "experiment_matrix_report.md").write_text(_report_markdown(report), encoding="utf-8")
    return report


def load_experiment_report(report_path: Path = DEFAULT_EXPERIMENT_REPORT_PATH) -> dict[str, Any]:
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object at {report_path}")
    return payload


def release_candidate_source_limits_from_report(report: dict[str, Any]) -> dict[str, int]:
    return _release_candidate_source_limits_from_variant_ids(_winner_variant_ids(report))


def release_candidate_delta_source_limits_from_report(report: dict[str, Any]) -> dict[str, int]:
    return _release_candidate_delta_source_limits_from_variant_ids(_winner_variant_ids(report))


def build_local_source_catalog() -> dict[str, PreparedSource]:
    base_dir = Path("/home/vivi/pixelated")
    catalog = {
        "foundation_amod": PreparedSource(
            name="foundation_amod",
            group="professional_therapeutic",
            stage="stage1_foundation",
            source_type="conversation",
            records=_prepare_amod(
                base_dir / "ai/datasets/training_v3/stage1_foundation/Amod_mental_health_counseling_conversations.jsonl"
            ),
        ),
        "foundation_helios": PreparedSource(
            name="foundation_helios",
            group="professional_therapeutic",
            stage="stage1_foundation",
            source_type="conversation",
            records=_prepare_helios(
                base_dir / "ai/datasets/training_v3/stage1_foundation/heliosbrahma_mental_health_chatbot_dataset.jsonl"
            ),
        ),
        "specialist_fadodr": PreparedSource(
            name="specialist_fadodr",
            group="training_v3",
            stage="stage2_therapeutic_expertise",
            source_type="conversation",
            records=_prepare_fadodr(
                base_dir / "ai/datasets/training_v3/stage2_specialist_addiction/fadodr_mental_health_therapy.jsonl"
            ),
        ),
        "edge_simulation": PreparedSource(
            name="edge_simulation",
            group="edge_case_sources",
            stage="stage3_edge_stress_test",
            source_type="synthetic_edge",
            records=_prepare_edge_records(
                base_dir / "ai/data/staged_datasets/stage3_edge_stress_test.jsonl",
                lane="simulation",
                benchmark_slice=None,
                start=0,
            ),
        ),
        "edge_policy": PreparedSource(
            name="edge_policy",
            group="edge_case_sources",
            stage="stage3_edge_stress_test",
            source_type="dpo_pairs",
            records=_prepare_edge_records(
                base_dir / "ai/data/staged_datasets/stage3_edge_stress_test.jsonl",
                lane="policy",
                benchmark_slice=None,
                start=400,
            ),
        ),
        "edge_policy_merged": PreparedSource(
            name="edge_policy_merged",
            group="edge_case_sources",
            stage="stage3_edge_stress_test",
            source_type="synthetic_edge",
            records=_prepare_edge_records(
                base_dir / "ai/data/staged_datasets/stage3_edge_stress_test.jsonl",
                lane="simulation",
                benchmark_slice=None,
                start=400,
            ),
        ),
        "edge_benchmark": PreparedSource(
            name="edge_benchmark",
            group="edge_case_sources",
            stage="stage3_edge_stress_test",
            source_type="synthetic_edge",
            records=_prepare_edge_records(
                base_dir / "ai/data/staged_datasets/stage3_edge_stress_test.jsonl",
                lane="benchmark",
                benchmark_slice="benchmark_crisis",
                start=800,
            ),
        ),
        "long_running_simulation": PreparedSource(
            name="long_running_simulation",
            group="professional_therapeutic",
            stage="stage1_foundation",
            source_type="conversation",
            records=_prepare_long_running(
                base_dir / "ai/data/cleaned_v3/long_sessions_cleaned.jsonl",
                lane="simulation",
            ),
        ),
        "long_running_benchmark": PreparedSource(
            name="long_running_benchmark",
            group="professional_therapeutic",
            stage="stage1_foundation",
            source_type="conversation",
            records=_prepare_long_running(
                base_dir / "ai/data/cleaned_v3/long_sessions_cleaned.jsonl",
                lane="benchmark",
            ),
        ),
        "persona_google": PreparedSource(
            name="persona_google",
            group="training_v3",
            stage="stage4_voice_persona",
            source_type="conversation",
            records=_prepare_google_persona(
                base_dir / "ai/datasets/training_v3/stage4_voice_persona/google_Synthetic-Persona-Chat.jsonl"
            ),
        ),
        "persona_nazli": PreparedSource(
            name="persona_nazli",
            group="training_v3",
            stage="stage4_voice_persona",
            source_type="conversation",
            records=_prepare_nazli_persona(
                base_dir / "ai/datasets/training_v3/stage4_voice_persona/nazlicanto_persona-based-chat.jsonl"
            ),
        ),
        "persona_roleplay": PreparedSource(
            name="persona_roleplay",
            group="training_v3",
            stage="stage4_voice_persona",
            source_type="conversation",
            records=_prepare_roleplay(
                base_dir / "ai/datasets/training_v3/stage4_voice_persona/hieunguyenminh_roleplay.jsonl"
            ),
        ),
        "persona_codex": PreparedSource(
            name="persona_codex",
            group="training_v3",
            stage="stage4_voice_persona",
            source_type="conversation",
            records=_prepare_character_codex(
                base_dir / "ai/datasets/training_v3/stage4_voice_persona/NousResearch_CharacterCodex.jsonl"
            ),
        ),
        "evaluator_psychology": PreparedSource(
            name="evaluator_psychology",
            group="supplementary",
            stage="stage2_therapeutic_expertise",
            source_type="knowledge_base",
            records=_prepare_psychology_knowledge(base_dir / "ai/data/psychology_knowledge_base_optimized.json"),
        ),
        "benchmark_cross_cultural": PreparedSource(
            name="benchmark_cross_cultural",
            group="professional_therapeutic",
            stage="stage1_foundation",
            source_type="conversation",
            records=_prepare_demo_scenarios(
                base_dir / "ai/demos/demo_client_scenarios.json",
                lane="benchmark",
            ),
        ),
        "cross_cultural_simulation": PreparedSource(
            name="cross_cultural_simulation",
            group="professional_therapeutic",
            stage="stage1_foundation",
            source_type="conversation",
            records=_prepare_demo_scenarios(
                base_dir / "ai/demos/demo_client_scenarios.json",
                lane="simulation",
            ),
        ),
    }
    catalog["simulation_hidden_rubrics"] = PreparedSource(
        name="simulation_hidden_rubrics",
        group="professional_therapeutic",
        stage="stage1_foundation",
        source_type="conversation",
        records=_with_rubric_metadata(catalog["foundation_amod"].records, visible=False),
    )
    catalog["simulation_visible_rubrics"] = PreparedSource(
        name="simulation_visible_rubrics",
        group="professional_therapeutic",
        stage="stage1_foundation",
        source_type="conversation",
        records=_with_rubric_metadata(catalog["foundation_amod"].records, visible=True),
    )
    catalog.update(_wave1_seed_sources(DEFAULT_WAVE1_SEED_PACK_PATH))
    catalog.update(_wave2_seed_sources(DEFAULT_WAVE2_SEED_PACK_PATH))
    catalog.update(_wave3_seed_sources(DEFAULT_WAVE3_SEED_PACK_PATH))
    catalog.update(_wave4_seed_sources(DEFAULT_WAVE4_SEED_PACK_PATH))
    return catalog


def _experiment_variants() -> tuple[ExperimentVariant, ...]:
    benchmark_base = {"edge_benchmark": 40, "long_running_benchmark": 12}
    common_base = {
        "foundation_amod": 80,
        "foundation_helios": 40,
        "specialist_fadodr": 80,
        "edge_simulation": 60,
        "persona_google": 40,
        "persona_nazli": 40,
    }
    wave1_control = {
        "foundation_amod": 80,
        "foundation_helios": 40,
        "specialist_fadodr": 80,
        "edge_simulation": 100,
        "edge_policy": 50,
        "edge_benchmark": 40,
        "long_running_benchmark": 12,
        "long_running_simulation": 24,
        "persona_google": 40,
        "persona_nazli": 40,
        "simulation_hidden_rubrics": 40,
        "benchmark_cross_cultural": 30,
        "evaluator_psychology": 60,
    }
    wave2_control = {
        **wave1_control,
        "wave1_seed_simulation": 6,
        "wave1_seed_evaluator": 6,
        "wave1_seed_benchmark": 10,
    }
    wave3_control = {
        **wave2_control,
    }
    wave4_control = {
        **wave3_control,
    }
    return (
        ExperimentVariant("A", "A1.1", "simulation only train mix", {**common_base, **benchmark_base}),
        ExperimentVariant(
            "A",
            "A1.2",
            "simulation plus policy lane",
            {**common_base, **benchmark_base, "edge_policy": 50},
        ),
        ExperimentVariant(
            "A",
            "A1.3",
            "simulation plus evaluator lane",
            {**common_base, **benchmark_base, "evaluator_psychology": 50},
        ),
        ExperimentVariant(
            "B",
            "B1.1",
            "20 synthetic 80 sourced proxy",
            {
                "foundation_amod": 120,
                "foundation_helios": 60,
                "specialist_fadodr": 120,
                "edge_simulation": 25,
                "persona_google": 20,
                "persona_nazli": 15,
                "edge_policy": 30,
                **benchmark_base,
            },
        ),
        ExperimentVariant(
            "B",
            "B1.2",
            "40 synthetic 60 sourced proxy",
            {**common_base, "edge_policy": 40, **benchmark_base, "evaluator_psychology": 40},
        ),
        ExperimentVariant(
            "B",
            "B1.3",
            "60 synthetic 40 sourced proxy",
            {
                "foundation_amod": 60,
                "foundation_helios": 30,
                "specialist_fadodr": 60,
                "edge_simulation": 100,
                "persona_google": 80,
                "persona_nazli": 80,
                "edge_policy": 60,
                **benchmark_base,
            },
        ),
        ExperimentVariant("C", "C1.1", "natural edge frequency", {**common_base, "edge_policy": 40, **benchmark_base}),
        ExperimentVariant(
            "C",
            "C1.2",
            "2x edge oversampling",
            {**common_base, "edge_simulation": 100, "edge_policy": 40, **benchmark_base},
        ),
        ExperimentVariant(
            "C",
            "C1.3",
            "4x edge oversampling",
            {**common_base, "edge_simulation": 180, "edge_policy": 60, **benchmark_base},
        ),
        ExperimentVariant(
            "D",
            "D1.1",
            "rubrics only in eval corpus",
            {**common_base, "edge_policy": 40, **benchmark_base, "evaluator_psychology": 60},
        ),
        ExperimentVariant(
            "D",
            "D1.2",
            "rubrics in hidden metadata only",
            {
                **common_base,
                "edge_policy": 40,
                **benchmark_base,
                "evaluator_psychology": 60,
                "simulation_hidden_rubrics": 40,
            },
        ),
        ExperimentVariant(
            "D",
            "D1.3",
            "rubrics visible inside training prompts",
            {
                **common_base,
                "edge_policy": 40,
                **benchmark_base,
                "evaluator_psychology": 60,
                "simulation_visible_rubrics": 40,
            },
        ),
        ExperimentVariant("E", "E1.1", "english first only", {**common_base, "edge_policy": 40, **benchmark_base}),
        ExperimentVariant(
            "E",
            "E1.2",
            "cross-cultural simulation plus benchmark",
            {
                **common_base,
                "edge_policy": 40,
                **benchmark_base,
                "benchmark_cross_cultural": 30,
                "cross_cultural_simulation": 40,
            },
        ),
        ExperimentVariant(
            "E",
            "E1.3",
            "cross-cultural benchmark only",
            {**common_base, "edge_policy": 40, **benchmark_base, "benchmark_cross_cultural": 30},
        ),
        ExperimentVariant(
            "F",
            "F1.1",
            "policy isolated in policy lane",
            {**common_base, "edge_policy": 50, **benchmark_base},
        ),
        ExperimentVariant(
            "F",
            "F1.2",
            "policy merged into simulation lane",
            {**common_base, "edge_policy_merged": 50, **benchmark_base},
        ),
        ExperimentVariant(
            "G", "G1.1", "no dedicated long-running lane", {**common_base, "edge_policy": 40, **benchmark_base}
        ),
        ExperimentVariant(
            "G",
            "G1.2",
            "10 percent long-running share",
            {**common_base, "edge_policy": 40, **benchmark_base, "long_running_simulation": 24},
        ),
        ExperimentVariant(
            "G",
            "G1.3",
            "20 percent long-running share",
            {**common_base, "edge_policy": 40, **benchmark_base, "long_running_simulation": 60},
        ),
        ExperimentVariant(
            "H",
            "H1.1",
            "no persona texture lane",
            {
                "foundation_amod": 80,
                "foundation_helios": 40,
                "specialist_fadodr": 80,
                "edge_policy": 40,
                **benchmark_base,
            },
        ),
        ExperimentVariant(
            "H",
            "H1.2",
            "persona archetypes only",
            {**common_base, "edge_policy": 40, **benchmark_base},
        ),
        ExperimentVariant(
            "H",
            "H1.3",
            "persona archetypes plus expansions",
            {
                **common_base,
                "edge_policy": 40,
                **benchmark_base,
                "persona_roleplay": 30,
                "persona_codex": 30,
            },
        ),
        ExperimentVariant(
            "I",
            "I1.1",
            "release-candidate control without wave1 synthesis overlay",
            wave1_control,
        ),
        ExperimentVariant(
            "I",
            "I1.2",
            "release-candidate control plus wave1 simulation overlay",
            {**wave1_control, "wave1_seed_simulation": 6},
        ),
        ExperimentVariant(
            "I",
            "I1.3",
            "release-candidate control plus full wave1 synthesis overlay",
            {
                **wave1_control,
                "wave1_seed_simulation": 6,
                "wave1_seed_evaluator": 6,
                "wave1_seed_benchmark": 10,
            },
        ),
        ExperimentVariant(
            "J",
            "J1.1",
            "wave-two control with wave1 baseline only",
            wave2_control,
        ),
        ExperimentVariant(
            "J",
            "J1.2",
            "wave-two simulation overlay on top of wave1 baseline",
            {**wave2_control, "wave2_seed_simulation": 9},
        ),
        ExperimentVariant(
            "J",
            "J1.3",
            "wave-two full overlay on top of wave1 baseline",
            {
                **wave2_control,
                "wave2_seed_simulation": 9,
                "wave2_seed_evaluator": 9,
                "wave2_seed_benchmark": 10,
            },
        ),
        ExperimentVariant(
            "K",
            "K1.1",
            "wave-three control with release baseline only",
            wave3_control,
        ),
        ExperimentVariant(
            "K",
            "K1.2",
            "wave-three evaluator and benchmark overlay on release baseline",
            {
                **wave3_control,
                "wave3_seed_evaluator": 6,
                "wave3_seed_benchmark": 8,
            },
        ),
        ExperimentVariant(
            "K",
            "K1.3",
            "wave-three full overlay on release baseline",
            {
                **wave3_control,
                "wave3_seed_simulation": 6,
                "wave3_seed_evaluator": 6,
                "wave3_seed_benchmark": 8,
            },
        ),
        ExperimentVariant(
            "L",
            "L1.1",
            "wave-four control with release baseline only",
            wave4_control,
        ),
        ExperimentVariant(
            "L",
            "L1.2",
            "wave-four evaluator and benchmark overlay on release baseline",
            {
                **wave4_control,
                "wave4_seed_evaluator": 8,
                "wave4_seed_benchmark": 10,
            },
        ),
        ExperimentVariant(
            "L",
            "L1.3",
            "wave-four full overlay on release baseline",
            {
                **wave4_control,
                "wave4_seed_simulation": 8,
                "wave4_seed_evaluator": 8,
                "wave4_seed_benchmark": 10,
            },
        ),
    )


def _run_variant(
    catalog: dict[str, PreparedSource],
    output_root: Path,
    variant: ExperimentVariant,
) -> VariantOutcome:
    artifact_dir = output_root / f"{variant.family}_{variant.variant_id.replace('.', '_')}"
    registry_path = materialize_variant_registry(artifact_dir, catalog, variant)
    build_result = CorpusBuilder(
        CorpusBuildConfig(
            name=f"pixelated-experiment-{variant.family.lower()}",
            version=variant.variant_id,
            registry_path=registry_path,
            destination=artifact_dir / "build",
            enforce_release_gates=True,
        )
    ).build()
    metrics = _variant_metrics(build_result)
    score = round(_score_variant(variant, metrics), 4)
    return VariantOutcome(variant=variant, score=score, metrics=metrics, artifact_dir=artifact_dir / "build")


def _build_release_candidate(
    catalog: dict[str, PreparedSource],
    output_root: Path,
    winners: dict[str, VariantOutcome],
) -> VariantOutcome:
    variant = ExperimentVariant(
        family="RC",
        variant_id="release_candidate",
        description="Composed from winning settings across release families with held-out wave-two, wave-three, and wave-four families excluded",
        source_limits=_release_candidate_source_limits(winners),
    )
    artifact_dir = output_root / "release_candidate"
    registry_path = materialize_variant_registry(artifact_dir, catalog, variant)
    build_result = CorpusBuilder(
        CorpusBuildConfig(
            name="pixelated-training-corpus-release-candidate",
            version="2026.04.08-rc1",
            registry_path=registry_path,
            destination=artifact_dir / "build",
            enforce_release_gates=True,
            verify_reproducibility=True,
        )
    ).build()
    metrics = _variant_metrics(build_result)
    participating_winners = _participating_release_winners(winners)
    metrics["winner_inputs"] = {family: outcome.variant.variant_id for family, outcome in participating_winners.items()}
    score = round(
        sum(outcome.score for outcome in participating_winners.values()) / max(len(participating_winners), 1),
        4,
    )
    return VariantOutcome(variant=variant, score=score, metrics=metrics, artifact_dir=artifact_dir / "build")


def materialize_variant_registry(
    artifact_root: Path,
    catalog: dict[str, PreparedSource],
    variant: ExperimentVariant,
) -> Path:
    sources_dir = artifact_root / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)
    registry: dict[str, Any] = {
        "datasets": {},
        "edge_case_sources": {},
        "supplementary": {},
    }
    for source_name, limit in variant.source_limits.items():
        source = catalog[source_name]
        source_path = sources_dir / f"{source_name}.jsonl"
        _write_jsonl(source_path, source.records[:limit])
        entry = {
            "path": f"s3://pixel-data/experiments/{source_name}.jsonl",
            "fallback_paths": {"local": str(source_path)},
            "stage": source.stage,
            "type": source.source_type,
            "quality_profile": "experiment",
            "focus": variant.family.lower(),
        }
        if source.group in {"professional_therapeutic", "training_v3", "wendy_curated_sets", "cot_reasoning"}:
            registry["datasets"].setdefault(source.group, {})[source_name] = entry
        else:
            registry[source.group][source_name] = entry
    registry_path = artifact_root / "registry.json"
    _write_json(registry_path, registry)
    return registry_path


def _variant_metrics(build_result: CorpusBuildResult) -> dict[str, Any]:
    entries = build_result.entries
    source_counts = Counter(entry.source_id for entry in entries)
    simulation_entries = [entry for entry in entries if entry.lane == "simulation"]
    synthetic_entries = [
        entry for entry in simulation_entries if str(entry.attributes.get("source_origin", "")) != "sourced"
    ]
    edge_entries = [entry for entry in simulation_entries if bool(entry.attributes.get("is_edge_case"))]
    long_running_entries = [entry for entry in simulation_entries if bool(entry.attributes.get("long_running"))]
    persona_entries = [
        entry
        for entry in simulation_entries
        if entry.stage == "stage4_voice_persona" or "persona_archetype" in entry.attributes
    ]
    high_risk_persona_entries = [entry for entry in entries if str(entry.attributes.get("identity_risk", "")) == "high"]
    simulation_rubric_entries = [
        entry
        for entry in simulation_entries
        if isinstance(entry.attributes.get("rubric_items"), list) and entry.attributes.get("rubric_items")
    ]
    visible_rubric_entries = [
        entry for entry in simulation_entries if "Rubric:" in entry.prompt or "Rubric:" in entry.response
    ]
    clinician_hook_entries = [entry for entry in entries if isinstance(entry.attributes.get("clinician_review"), dict)]
    benchmark_slices = Counter(
        str(entry.attributes.get("benchmark_slice"))
        for entry in entries
        if entry.lane == "benchmark" and isinstance(entry.attributes.get("benchmark_slice"), str)
    )
    wave1_simulation_entries = source_counts.get(_WAVE1_SOURCE_IDS["wave1_seed_simulation"], 0)
    wave1_evaluator_entries = source_counts.get(_WAVE1_SOURCE_IDS["wave1_seed_evaluator"], 0)
    wave1_benchmark_entries = source_counts.get(_WAVE1_SOURCE_IDS["wave1_seed_benchmark"], 0)
    wave1_total_entries = wave1_simulation_entries + wave1_evaluator_entries + wave1_benchmark_entries
    wave2_simulation_entries = source_counts.get(_WAVE2_SOURCE_IDS["wave2_seed_simulation"], 0)
    wave2_evaluator_entries = source_counts.get(_WAVE2_SOURCE_IDS["wave2_seed_evaluator"], 0)
    wave2_benchmark_entries = source_counts.get(_WAVE2_SOURCE_IDS["wave2_seed_benchmark"], 0)
    wave2_total_entries = wave2_simulation_entries + wave2_evaluator_entries + wave2_benchmark_entries
    wave3_simulation_entries = source_counts.get(_WAVE3_SOURCE_IDS["wave3_seed_simulation"], 0)
    wave3_evaluator_entries = source_counts.get(_WAVE3_SOURCE_IDS["wave3_seed_evaluator"], 0)
    wave3_benchmark_entries = source_counts.get(_WAVE3_SOURCE_IDS["wave3_seed_benchmark"], 0)
    wave3_total_entries = wave3_simulation_entries + wave3_evaluator_entries + wave3_benchmark_entries
    wave4_simulation_entries = source_counts.get(_WAVE4_SOURCE_IDS["wave4_seed_simulation"], 0)
    wave4_evaluator_entries = source_counts.get(_WAVE4_SOURCE_IDS["wave4_seed_evaluator"], 0)
    wave4_benchmark_entries = source_counts.get(_WAVE4_SOURCE_IDS["wave4_seed_benchmark"], 0)
    wave4_total_entries = wave4_simulation_entries + wave4_evaluator_entries + wave4_benchmark_entries
    cross_cultural_sim_entries = [entry for entry in simulation_entries if bool(entry.attributes.get("cross_cultural"))]
    return {
        "total_entries": len(entries),
        "by_lane": dict(Counter(entry.lane for entry in entries)),
        "simulation_entries": len(simulation_entries),
        "policy_entries": sum(1 for entry in entries if entry.lane == "policy"),
        "evaluator_entries": sum(1 for entry in entries if entry.lane == "evaluator"),
        "benchmark_entries": sum(1 for entry in entries if entry.lane == "benchmark"),
        "synthetic_share": _share(len(synthetic_entries), len(simulation_entries)),
        "edge_share": _share(len(edge_entries), len(simulation_entries)),
        "long_running_share": _share(len(long_running_entries), len(simulation_entries)),
        "persona_share": _share(len(persona_entries), len(simulation_entries)),
        "high_risk_persona_entries": len(high_risk_persona_entries),
        "simulation_rubric_entries": len(simulation_rubric_entries),
        "visible_rubric_entries": len(visible_rubric_entries),
        "cross_cultural_sim_entries": len(cross_cultural_sim_entries),
        "cross_cultural_benchmark_entries": benchmark_slices.get("benchmark_multilingual", 0),
        "benchmark_crisis_entries": benchmark_slices.get("benchmark_crisis", 0),
        "benchmark_persona_entries": benchmark_slices.get("benchmark_persona_texture", 0),
        "benchmark_long_running_entries": benchmark_slices.get("benchmark_long_running_continuity", 0),
        "benchmark_internal_parts_entries": benchmark_slices.get("benchmark_internal_parts", 0),
        "benchmark_transformational_affect_entries": benchmark_slices.get("benchmark_transformational_affect", 0),
        "benchmark_challenge_calibration_entries": benchmark_slices.get("benchmark_challenge_calibration", 0),
        "benchmark_hidden_driver_discovery_entries": benchmark_slices.get("benchmark_hidden_driver_discovery", 0),
        "benchmark_overcontrol_entries": benchmark_slices.get("benchmark_overcontrol", 0),
        "benchmark_somatic_hidden_driver_entries": benchmark_slices.get("benchmark_somatic_hidden_driver", 0),
        "benchmark_process_targeting_entries": benchmark_slices.get("benchmark_process_targeting", 0),
        "benchmark_revision_loop_entries": benchmark_slices.get("benchmark_revision_loop", 0),
        "wave1_seed_simulation_entries": wave1_simulation_entries,
        "wave1_seed_evaluator_entries": wave1_evaluator_entries,
        "wave1_seed_benchmark_entries": wave1_benchmark_entries,
        "wave1_seed_total_entries": wave1_total_entries,
        "wave1_seed_share": _share(wave1_total_entries, len(entries)),
        "wave2_seed_simulation_entries": wave2_simulation_entries,
        "wave2_seed_evaluator_entries": wave2_evaluator_entries,
        "wave2_seed_benchmark_entries": wave2_benchmark_entries,
        "wave2_seed_total_entries": wave2_total_entries,
        "wave2_seed_share": _share(wave2_total_entries, len(entries)),
        "wave3_seed_simulation_entries": wave3_simulation_entries,
        "wave3_seed_evaluator_entries": wave3_evaluator_entries,
        "wave3_seed_benchmark_entries": wave3_benchmark_entries,
        "wave3_seed_total_entries": wave3_total_entries,
        "wave3_seed_share": _share(wave3_total_entries, len(entries)),
        "wave4_seed_simulation_entries": wave4_simulation_entries,
        "wave4_seed_evaluator_entries": wave4_evaluator_entries,
        "wave4_seed_benchmark_entries": wave4_benchmark_entries,
        "wave4_seed_total_entries": wave4_total_entries,
        "wave4_seed_share": _share(wave4_total_entries, len(entries)),
        "clinician_hook_entries": len(clinician_hook_entries),
        "reproducibility_verified": _reproducibility_status(build_result.artifacts),
    }


def _score_variant(variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    scorers = {
        "A": _score_family_a,
        "B": _score_family_b,
        "C": _score_family_c,
        "D": _score_family_d,
        "E": _score_family_e,
        "F": _score_family_f,
        "G": _score_family_g,
        "H": _score_family_h,
        "I": _score_family_i,
        "J": _score_family_j,
        "K": _score_family_k,
        "L": _score_family_l,
        "RC": _score_release_candidate,
    }
    return scorers[variant.family](variant, metrics)


def _score_family_a(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    policy_bonus = 8 if metrics["policy_entries"] > 0 else 0
    evaluator_penalty = 12 if metrics["evaluator_entries"] > 0 else 0
    return 50 + 20 * metrics["persona_share"] + 10 * metrics["long_running_share"] + policy_bonus - evaluator_penalty


def _score_family_b(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    coverage = metrics["benchmark_crisis_entries"] + metrics["benchmark_persona_entries"]
    return 60 + 10 * min(coverage / 40, 1) - abs(metrics["synthetic_share"] - 0.4) * 40


def _score_family_c(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    return 55 + 15 * min(metrics["edge_share"] / 0.25, 1) - abs(metrics["edge_share"] - 0.25) * 45


def _score_family_d(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    rubric_value = 10 if metrics["simulation_rubric_entries"] > 0 else 0
    leakage_penalty = metrics["visible_rubric_entries"] * 0.5
    return 58 + rubric_value + min(metrics["clinician_hook_entries"] / 30, 1) * 12 - leakage_penalty


def _score_family_e(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    cultural_score = min(metrics["cross_cultural_benchmark_entries"] / 20, 1) * 18
    training_penalty = min(metrics["cross_cultural_sim_entries"] / 30, 1) * 8
    return 54 + cultural_score - training_penalty


def _score_family_f(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    isolation_bonus = 10 if metrics["policy_entries"] > 0 else -6
    return 56 + isolation_bonus + metrics["persona_share"] * 10 - metrics["edge_share"] * 8


def _score_family_g(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    continuity_bonus = min(metrics["benchmark_long_running_entries"] / 10, 1) * 12
    return 57 + continuity_bonus - abs(metrics["long_running_share"] - 0.1) * 50


def _score_family_h(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    return 55 + metrics["persona_share"] * 18 - metrics["high_risk_persona_entries"] * 0.2


def _score_family_i(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    simulation_bonus = min(metrics["wave1_seed_simulation_entries"] / 6, 1) * 8
    evaluator_bonus = min(metrics["wave1_seed_evaluator_entries"] / 6, 1) * 6
    benchmark_bonus = min(metrics["wave1_seed_benchmark_entries"] / 10, 1) * 8
    clinician_bonus = min(metrics["clinician_hook_entries"] / 20, 1) * 4
    benchmark_bonus += min(metrics["benchmark_persona_entries"] / 10, 1) * 2
    overuse_penalty = max(metrics["wave1_seed_share"] - 0.15, 0) * 40
    return 58 + simulation_bonus + evaluator_bonus + benchmark_bonus + clinician_bonus - overuse_penalty


def _score_family_j(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    simulation_bonus = min(metrics["wave2_seed_simulation_entries"] / 9, 1) * 9
    evaluator_bonus = min(metrics["wave2_seed_evaluator_entries"] / 9, 1) * 7
    benchmark_bonus = min(metrics["wave2_seed_benchmark_entries"] / 10, 1) * 8
    clinician_bonus = min(metrics["clinician_hook_entries"] / 24, 1) * 3
    benchmark_bonus += min(metrics["benchmark_crisis_entries"] / 18, 1) * 2
    overuse_penalty = max(metrics["wave2_seed_share"] - 0.18, 0) * 35
    return 59 + simulation_bonus + evaluator_bonus + benchmark_bonus + clinician_bonus - overuse_penalty


def _score_family_k(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    simulation_bonus = min(metrics["wave3_seed_simulation_entries"] / 6, 1) * 4
    evaluator_bonus = min(metrics["wave3_seed_evaluator_entries"] / 6, 1) * 9
    benchmark_bonus = min(metrics["wave3_seed_benchmark_entries"] / 8, 1) * 10
    calibration_bonus = min(metrics["benchmark_crisis_entries"] / 18, 1) * 2
    calibration_bonus += min(metrics["benchmark_long_running_entries"] / 10, 1) * 2
    clinician_bonus = min(metrics["clinician_hook_entries"] / 24, 1) * 3
    overuse_penalty = max(metrics["wave3_seed_share"] - 0.16, 0) * 35
    return (
        60
        + simulation_bonus
        + evaluator_bonus
        + benchmark_bonus
        + calibration_bonus
        + clinician_bonus
        - overuse_penalty
    )


def _score_family_l(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    simulation_bonus = min(metrics["wave4_seed_simulation_entries"] / 8, 1) * 8
    evaluator_bonus = min(metrics["wave4_seed_evaluator_entries"] / 8, 1) * 8
    benchmark_bonus = min(metrics["wave4_seed_benchmark_entries"] / 10, 1) * 8
    method_bonus = min(metrics["benchmark_internal_parts_entries"] / 2, 1) * 3
    method_bonus += min(metrics["benchmark_challenge_calibration_entries"], 1) * 2
    method_bonus += min(metrics["benchmark_process_targeting_entries"], 1) * 2
    method_bonus += min(metrics["benchmark_revision_loop_entries"], 1) * 2
    clinician_bonus = min(metrics["clinician_hook_entries"] / 28, 1) * 3
    overuse_penalty = max(metrics["wave4_seed_share"] - 0.18, 0) * 35
    return 61 + simulation_bonus + evaluator_bonus + benchmark_bonus + method_bonus + clinician_bonus - overuse_penalty


def _score_release_candidate(_variant: ExperimentVariant, metrics: dict[str, Any]) -> float:
    base = 65 + metrics["persona_share"] * 12 + metrics["long_running_share"] * 8
    if metrics["reproducibility_verified"]:
        base += 10
    return base - metrics["high_risk_persona_entries"] * 0.1


def _pick_winner(results: list[VariantOutcome]) -> VariantOutcome:
    return sorted(results, key=lambda result: (-result.score, result.variant.variant_id))[0]


def _group_outcomes(outcomes: list[VariantOutcome]) -> dict[str, list[VariantOutcome]]:
    grouped: dict[str, list[VariantOutcome]] = {}
    for outcome in outcomes:
        grouped.setdefault(outcome.variant.family, []).append(outcome)
    return grouped


def _serialize_outcome(outcome: VariantOutcome) -> dict[str, Any]:
    return {
        "variant_id": outcome.variant.variant_id,
        "description": outcome.variant.description,
        "score": outcome.score,
        "artifact_dir": str(outcome.artifact_dir),
        "metrics": outcome.metrics,
    }


def _catalog_summary(catalog: dict[str, PreparedSource]) -> dict[str, Any]:
    return {
        name: {
            "group": source.group,
            "stage": source.stage,
            "source_type": source.source_type,
            "records": len(source.records),
        }
        for name, source in catalog.items()
    }


def _report_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Training Corpus Experiment Matrix",
        "",
        "## Winners",
    ]
    for family in sorted(report["families"]):
        winner = report["families"][family]["winner"]
        lines.append(f"- {family}: {winner['variant_id']} (score {winner['score']}) - {winner['description']}")
    lines.extend(
        [
            "",
            "## Release Candidate",
            f"- Variant: {report['release_candidate']['variant_id']}",
            f"- Score: {report['release_candidate']['score']}",
            f"- Artifact dir: {report['release_candidate']['artifact_dir']}",
        ]
    )
    return "\n".join(lines) + "\n"


def _reproducibility_status(artifacts: dict[str, Path]) -> bool:
    report_path = artifacts.get("reproducibility_report")
    if report_path is None or not report_path.exists():
        return False
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    return bool(payload.get("verified"))


def _share(numerator: int, denominator: int) -> float:
    return 0.0 if denominator == 0 else numerator / denominator


def _release_candidate_source_limits(winners: dict[str, VariantOutcome]) -> dict[str, int]:
    return _release_candidate_source_limits_from_variant_ids(
        {family: outcome.variant.variant_id for family, outcome in _participating_release_winners(winners).items()}
    )


def _release_candidate_source_limits_from_variant_ids(winner_variant_ids: dict[str, str]) -> dict[str, int]:
    source_limits = {
        "foundation_amod": 80,
        "foundation_helios": 40,
        "specialist_fadodr": 80,
        "edge_simulation": 100,
        "edge_policy": 50,
        "edge_benchmark": 40,
        "long_running_benchmark": 12,
        "long_running_simulation": 24,
        "persona_google": 40,
        "persona_nazli": 40,
        "simulation_hidden_rubrics": 40,
        "benchmark_cross_cultural": 30,
        "evaluator_psychology": 60,
    }
    wave1_winner_id = winner_variant_ids.get("I")
    if wave1_winner_id is None:
        return source_limits
    if wave1_winner_id in {"I1.2", "I1.3"}:
        source_limits["wave1_seed_simulation"] = 6
    if wave1_winner_id == "I1.3":
        source_limits["wave1_seed_evaluator"] = 6
        source_limits["wave1_seed_benchmark"] = 10
    return source_limits


def _release_candidate_delta_source_limits_from_variant_ids(
    winner_variant_ids: dict[str, str],
) -> dict[str, int]:
    return {
        source_name: limit
        for source_name, limit in _release_candidate_source_limits_from_variant_ids(winner_variant_ids).items()
        if source_name not in _WAVE1_SOURCE_NAMES
        and source_name not in _WAVE2_SOURCE_NAMES
        and source_name not in _WAVE3_SOURCE_NAMES
        and source_name not in _WAVE4_SOURCE_NAMES
    }


def _winner_variant_ids(report: dict[str, Any]) -> dict[str, str]:
    families = report.get("families")
    if not isinstance(families, dict):
        return {}

    winners: dict[str, str] = {}
    for family, payload in families.items():
        if not isinstance(payload, dict):
            continue
        winner = payload.get("winner")
        if not isinstance(winner, dict):
            continue
        variant_id = winner.get("variant_id")
        if isinstance(family, str) and isinstance(variant_id, str) and variant_id:
            winners[family] = variant_id
    return winners


def _participating_release_winners(winners: dict[str, VariantOutcome]) -> dict[str, VariantOutcome]:
    return {family: outcome for family, outcome in winners.items() if family not in _HELD_OUT_RELEASE_FAMILIES}


def _wave1_seed_sources(seed_pack_path: Path) -> dict[str, PreparedSource]:
    materialized_paths = ensure_wave1_seed_sources_materialized(seed_pack_path=seed_pack_path)
    return _seed_sources(
        materialized_paths,
        simulation_name="wave1_seed_simulation",
        evaluator_name="wave1_seed_evaluator",
        benchmark_name="wave1_seed_benchmark",
    )


def _wave2_seed_sources(seed_pack_path: Path) -> dict[str, PreparedSource]:
    materialized_paths = ensure_wave2_seed_sources_materialized(seed_pack_path=seed_pack_path)
    return _seed_sources(
        materialized_paths,
        simulation_name="wave2_seed_simulation",
        evaluator_name="wave2_seed_evaluator",
        benchmark_name="wave2_seed_benchmark",
    )


def _wave3_seed_sources(seed_pack_path: Path) -> dict[str, PreparedSource]:
    materialized_paths = ensure_wave3_seed_sources_materialized(seed_pack_path=seed_pack_path)
    return _seed_sources(
        materialized_paths,
        simulation_name="wave3_seed_simulation",
        evaluator_name="wave3_seed_evaluator",
        benchmark_name="wave3_seed_benchmark",
    )


def _wave4_seed_sources(seed_pack_path: Path) -> dict[str, PreparedSource]:
    materialized_paths = ensure_wave4_seed_sources_materialized(seed_pack_path=seed_pack_path)
    return _seed_sources(
        materialized_paths,
        simulation_name="wave4_seed_simulation",
        evaluator_name="wave4_seed_evaluator",
        benchmark_name="wave4_seed_benchmark",
    )


def _seed_sources(
    materialized_paths: dict[str, Path],
    *,
    simulation_name: str,
    evaluator_name: str,
    benchmark_name: str,
) -> dict[str, PreparedSource]:
    return {
        simulation_name: PreparedSource(
            name=simulation_name,
            group="professional_therapeutic",
            stage="stage1_foundation",
            source_type="conversation",
            records=tuple(_read_jsonl(materialized_paths["simulation"])),
        ),
        evaluator_name: PreparedSource(
            name=evaluator_name,
            group="supplementary",
            stage="stage2_therapeutic_expertise",
            source_type="knowledge_base",
            records=tuple(_read_jsonl(materialized_paths["evaluator"])),
        ),
        benchmark_name: PreparedSource(
            name=benchmark_name,
            group="edge_case_sources",
            stage="stage3_edge_stress_test",
            source_type="synthetic_edge",
            records=tuple(_read_jsonl(materialized_paths["benchmark"])),
        ),
    }


def _prepare_amod(path: Path) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path):
        data = row.get("data", {})
        prompt = _clean_text(data.get("Context"))
        response = _clean_text(data.get("Response"))
        record = _direct_record(prompt, response, source_origin="sourced")
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_helios(path: Path) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path):
        text = _clean_text(row.get("data", {}).get("text"))
        prompt, response = _extract_human_assistant_pair(text)
        record = _direct_record(prompt, response, source_origin="sourced")
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_fadodr(path: Path) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path):
        data = row.get("data", {})
        prompt = _clean_text(data.get("input"))
        response = _clean_text(data.get("output"))
        record = _direct_record(prompt, response, source_origin="sourced")
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_edge_records(
    path: Path,
    *,
    lane: str,
    benchmark_slice: str | None,
    start: int,
) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path)[start:]:
        metadata = row.get("metadata", {})
        messages = metadata.get("messages")
        if not isinstance(messages, list):
            continue
        record = _message_record(
            _lane_scoped_messages(messages, lane),
            metadata={
                "benchmark_slice": benchmark_slice,
                "crisis_intensity": _clean_text(metadata.get("metadata", {}).get("crisis_intensity")) or "high",
                "edge_case_category": _clean_text(metadata.get("metadata", {}).get("edge_case_category")) or "edge",
                "is_edge_case": True,
                "quality_score": 0.95,
                "safety_score": 0.95,
                "source_origin": "synthetic",
            },
            lane=lane,
        )
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_long_running(path: Path, *, lane: str) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path):
        conversation = row.get("conversation")
        if not isinstance(conversation, list):
            continue
        record = _message_record(
            conversation,
            metadata={
                "benchmark_slice": "benchmark_long_running_continuity" if lane == "benchmark" else None,
                "continuity_id": str(row.get("id") or ""),
                "long_running": True,
                "persona_archetype": "complex-therapy-continuity",
                "quality_score": 0.95,
                "safety_score": 0.95,
                "source_origin": "generated_internal",
                "turn_count": int(row.get("turns") or 0),
            },
            lane=lane,
        )
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_google_persona(path: Path) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path):
        data = row.get("data", {})
        messages = _dialogue_messages(_clean_text(data.get("Best Generated Conversation")), "User 1", "User 2")
        persona_b = _clean_text(data.get("user 2 personas")).splitlines()
        record = _message_record(
            messages,
            metadata={
                "persona_archetype": persona_b[0] if persona_b else "synthetic-persona",
                "persona_texture": "synthetic-persona-chat",
                "quality_score": 0.93,
                "safety_score": 0.9,
                "source_origin": "synthetic",
            },
            lane="simulation",
        )
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_nazli_persona(path: Path) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path):
        data = row.get("data", {})
        dialogue = data.get("dialogue")
        if not isinstance(dialogue, list):
            continue
        persona_b = data.get("persona_b") or []
        archetype = persona_b[0] if persona_b else "persona-b"
        messages = _dialogue_message_list(dialogue, "Persona A", "Persona B")
        record = _message_record(
            messages,
            metadata={
                "persona_archetype": _clean_text(archetype),
                "persona_texture": "persona-based-chat",
                "quality_score": 0.92,
                "safety_score": 0.9,
                "source_origin": "synthetic",
            },
            lane="simulation",
        )
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_roleplay(path: Path) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path):
        text = _clean_text(row.get("data", {}).get("text"))
        messages = _tagged_messages(text)
        record = _message_record(
            messages,
            metadata={
                "persona_archetype": _clean_text(row.get("data", {}).get("name")),
                "persona_texture": "roleplay",
                "identity_risk": "high",
                "quality_score": 0.9,
                "safety_score": 0.88,
                "source_origin": "synthetic",
            },
            lane="simulation",
        )
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_character_codex(path: Path) -> tuple[dict[str, Any], ...]:
    records: list[dict[str, Any]] = []
    for row in _read_jsonl(path):
        data = row.get("data", {})
        record = _direct_record(
            _clean_text(data.get("scenario")),
            _clean_text(data.get("description")),
            metadata={
                "benchmark_slice": "benchmark_persona_texture",
                "persona_archetype": _clean_text(data.get("character_name")),
                "identity_risk": "high",
                "quality_score": 0.9,
                "safety_score": 0.9,
                "source_origin": "synthetic",
            },
            lane="benchmark",
        )
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_psychology_knowledge(path: Path) -> tuple[dict[str, Any], ...]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    concepts = payload.get("concepts", {})
    records: list[dict[str, Any]] = []
    for concept in concepts.values():
        if not isinstance(concept, dict):
            continue
        name = _clean_text(concept.get("name"))
        context = _clean_text(concept.get("clinical_context"))
        definition = _clean_text(concept.get("definition"))
        record = _direct_record(
            f"Assess therapist handling of {name}: {context}",
            f"Expected grounding: {definition}",
            metadata={
                "rubric_items": [
                    {"name": "clinical grounding", "weight": 0.4},
                    {"name": "safety framing", "weight": 0.3},
                    {"name": "therapeutic challenge", "weight": 0.3},
                ],
                "clinician_review": {
                    "status": "planned",
                    "reviewer_role": "clinician",
                    "reviewer_count": 0,
                    "calibration_subset": len(records) % 5 == 0,
                },
                "quality_score": float(concept.get("confidence_score") or 0.8),
                "safety_score": 0.92,
                "source_origin": "sourced",
            },
            lane="evaluator",
        )
        if record is not None:
            records.append(record)
    return tuple(records)


def _prepare_demo_scenarios(path: Path, *, lane: str) -> tuple[dict[str, Any], ...]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    scenarios = payload.get("scenarios", [])
    records: list[dict[str, Any]] = []
    for scenario in scenarios:
        if not isinstance(scenario, dict):
            continue
        prompt = _scenario_prompt(scenario)
        response = _scenario_response(scenario, lane)
        record = _direct_record(
            prompt,
            response,
            metadata={
                "benchmark_slice": "benchmark_multilingual" if lane == "benchmark" else None,
                "cross_cultural": True,
                "rubric_items": [
                    {"name": "cultural attunement", "weight": 0.35},
                    {"name": "risk formulation", "weight": 0.35},
                    {"name": "alliance building", "weight": 0.3},
                ],
                "clinician_review": {
                    "status": "planned",
                    "reviewer_role": "clinician",
                    "reviewer_count": 0,
                    "calibration_subset": True,
                },
                "quality_score": 0.93,
                "safety_score": 0.92,
                "source_origin": "generated_internal",
            },
            lane=lane,
        )
        if record is not None:
            records.append(record)
    return tuple(records)


def _with_rubric_metadata(records: tuple[dict[str, Any], ...], *, visible: bool) -> tuple[dict[str, Any], ...]:
    rubric = [
        {"name": "alliance rupture challenge", "weight": 0.5},
        {"name": "emotion tracking", "weight": 0.5},
    ]
    updated: list[dict[str, Any]] = []
    for record in records:
        metadata = dict(record.get("metadata", {}))
        metadata["rubric_items"] = rubric
        cloned = dict(record)
        cloned["metadata"] = metadata
        if visible:
            cloned["input"] = f"Rubric: alliance rupture challenge; emotion tracking.\n\n{record['input']}"
        updated.append(cloned)
    return tuple(updated)


def _direct_record(
    prompt: str,
    response: str,
    *,
    metadata: dict[str, Any] | None = None,
    lane: str | None = None,
    source_origin: str | None = None,
) -> dict[str, Any] | None:
    cleaned_prompt = _clean_text(prompt)
    cleaned_response = _clean_text(response)
    if not cleaned_prompt or not cleaned_response or _contains_pii(cleaned_prompt, cleaned_response):
        return None
    record_metadata = {
        "quality_score": 0.9,
        "safety_score": 0.9,
    }
    if source_origin is not None:
        record_metadata["source_origin"] = source_origin
    if metadata:
        record_metadata.update({key: value for key, value in metadata.items() if value is not None})
    record = {"input": cleaned_prompt, "output": cleaned_response, "metadata": record_metadata}
    if lane is not None:
        record["lane"] = lane
    return record


def _message_record(
    messages: list[dict[str, str]],
    *,
    metadata: dict[str, Any],
    lane: str,
) -> dict[str, Any] | None:
    if not messages:
        return None
    parts = [message.get("content", "") for message in messages]
    if _contains_pii(*parts):
        return None
    return {
        "messages": messages,
        "metadata": {key: value for key, value in metadata.items() if value is not None},
        "lane": lane,
    }


def _lane_scoped_messages(messages: list[dict[str, str]], lane: str) -> list[dict[str, str]]:
    scoped: list[dict[str, str]] = []
    user_prefix = {
        "simulation": "Clinical simulation case:\n",
        "policy": "Policy calibration case:\n",
        "benchmark": "Benchmark holdout case:\n",
    }.get(lane, "")
    assistant_prefix = {
        "simulation": "Therapeutic response exemplar:\n",
        "policy": "Preferred policy-compliant response:\n",
        "benchmark": "Benchmark reference response:\n",
    }.get(lane, "")

    for message in messages:
        role = str(message.get("role") or "").strip()
        content = _clean_text(message.get("content"))
        if not role or not content:
            continue
        if role == "user" and user_prefix:
            content = f"{user_prefix}{content}"
        elif role == "assistant" and assistant_prefix:
            content = f"{assistant_prefix}{content}"
        scoped.append({"role": role, "content": content})
    return scoped


def _extract_human_assistant_pair(text: str) -> tuple[str, str]:
    if "<HUMAN>:" not in text or "<ASSISTANT>:" not in text:
        return "", ""
    prompt_part, response_part = text.split("<ASSISTANT>:", 1)
    prompt = prompt_part.replace("<HUMAN>:", "", 1)
    return _clean_text(prompt), _clean_text(response_part)


def _dialogue_messages(text: str, user_label: str, assistant_label: str) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{user_label}:"):
            messages.append({"role": "user", "content": stripped.split(":", 1)[1].strip()})
        elif stripped.startswith(f"{assistant_label}:"):
            messages.append({"role": "assistant", "content": stripped.split(":", 1)[1].strip()})
    return messages


def _dialogue_message_list(lines: list[str], user_label: str, assistant_label: str) -> list[dict[str, str]]:
    return _dialogue_messages("\n".join(lines), user_label, assistant_label)


def _tagged_messages(text: str) -> list[dict[str, str]]:
    return [
        {"role": match.group("role"), "content": _clean_text(match.group("content"))}
        for match in _TAGGED_TURN_RE.finditer(text)
        if _clean_text(match.group("content"))
    ]


def _scenario_prompt(scenario: dict[str, Any]) -> str:
    demographics = scenario.get("demographics", {})
    problem = scenario.get("presenting_problem", {})
    return _clean_text(
        "Client simulation benchmark: "
        f"{problem.get('primary_concern', 'unspecified concern')}. "
        f"Context: {demographics.get('cultural_background', 'unspecified')} "
        f"{demographics.get('relationship_status', 'unknown relationship status')}."
    )


def _scenario_response(scenario: dict[str, Any], lane: str) -> str:
    if lane == "simulation":
        symptoms = scenario.get("presenting_problem", {}).get("symptoms", [])
        joined = ", ".join(str(item) for item in symptoms[:3])
        return _clean_text(f"The client speaks from inside these pressures: {joined}.")
    objectives = scenario.get("learning_objectives", [])
    considerations = scenario.get("therapeutic_considerations", [])
    return _clean_text("Expected behaviors: " + "; ".join([*objectives[:2], *considerations[:2]]))


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            row = json.loads(stripped)
            if isinstance(row, dict):
                rows.append(row)
    return rows


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\r", "\n").split()).strip()


def _contains_pii(*parts: str) -> bool:
    text = "\n".join(part for part in parts if part)
    return any(pattern.search(text) for pattern in _PII_PATTERNS)


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _write_jsonl(path: Path, rows: tuple[dict[str, Any], ...]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    output_root = Path("/home/vivi/pixelated/.agent/internal/research/training_corpus_experiments_2026-04-08")
    run_experiment_matrix(output_root)


if __name__ == "__main__":
    main()
