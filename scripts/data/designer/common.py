"""Common NVIDIA Data Designer configuration for source-grounded products."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import data_designer.config as dd
from pydantic import BaseModel

from scripts.data.designer.product_schemas import SourceReasoningAnalysis
from scripts.data.designer.validators import validate_generated_rows

REGISTRY_PATH = Path("ai/data/curated/construction/source_registry/representative_sources.jsonl")
CONSTRUCTION_SPEC_VERSION = "1.0.0"
PROMPT_VERSION = "2026-08-20.1"

JUDGE_OPTIONS = {
    1: "Unsafe, ungrounded, unusable, or reproduces restricted material",
    2: "Major clinical, grounding, or product-structure defects",
    3: "Usable only after substantial human revision",
    4: "Strong and safe with minor revision",
    5: "Excellent, source-grounded, clinically bounded, and product-faithful",
}

SOURCE_ANALYSIS_PROMPT = """
Analyze the approved source-analysis registry record below for construction use. The registry analysis is evidence,
not a claim of clinical truth. Select only information permitted by license_and_use_policy and contribution_mode.
Never reproduce evaluation prompts/answers, copyrighted passages, research-only text, hidden chain-of-thought, or
unapproved transcript language. Preserve source_unit_refs and state construction constraints explicitly.

Source: {{ source_id }} — {{ canonical_name }}
Policies: {{ license_and_use_policy }}
Direct-use approved: {{ direct_use_approved }}
Scope: {{ content_scope }}
Selected information: {{ selected_information }}
Inspection coverage: {{ inspection_coverage }}
Target product: PRODUCT_NAME
"""

SYSTEM_PROMPT = """
You construct synthetic clinical-training artifacts, not clinical care. Stay within the supplied source analysis,
preserve provenance references, avoid diagnosis overreach and unsafe advice, and use explicit escalation language
when risk warrants it. Do not copy protected or evaluation source text. Return only the requested structured output.
"""


def sampler(name: str, values: list[str]) -> dd.SamplerColumnConfig:
    return dd.SamplerColumnConfig(
        name=name,
        sampler_type=dd.SamplerType.CATEGORY,
        params=dd.CategorySamplerParams(values=values),
    )


def lineage_template(product_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Build a scalar release manifest; rich structured columns remain in the main dataset.

    Data Designer 0.9.1 materializes list-valued structured fields as NumPy arrays,
    which its schema-transform JSON finalizer cannot serialize. The manifest records
    the product schema and scalar review lineage; lossless release transforms live in
    ``schemas.py`` and operate on the retained main-dataset columns.
    """

    return {
        "product": product_name,
        "product_output_fields": list(payload),
        "source_id": "{{ source_id }}",
        "canonical_name": "{{ canonical_name }}",
        "source_analysis_ref": "{{ source_analysis.source_unit_refs | first }}",
        "construction_spec_version": CONSTRUCTION_SPEC_VERSION,
        "draft_model_alias": "nvidia-text",
        "analysis_model_alias": "nvidia-reasoning",
        "judge_model_alias": "nvidia-reasoning",
        "prompt_version": PROMPT_VERSION,
        "judge_scores": {
            "clinical_safety": "{{ quality.clinical_safety.score }}",
            "source_grounding": "{{ quality.source_grounding.score }}",
            "product_fidelity": "{{ quality.product_fidelity.score }}",
            "non_reproduction": "{{ quality.non_reproduction.score }}",
        },
        "judge_reasons": {
            "clinical_safety": "{{ quality.clinical_safety.reasoning }}",
            "source_grounding": "{{ quality.source_grounding.reasoning }}",
            "product_fidelity": "{{ quality.product_fidelity.reasoning }}",
            "non_reproduction": "{{ quality.non_reproduction.reasoning }}",
        },
        "human_review_status": "pending",
        "source_registry_version": "{{ registry_version }}",
    }


def build_product_config(
    *,
    product_name: str,
    draft_model: type[BaseModel],
    draft_prompt: str,
    axes: dict[str, list[str]],
    transform_payload: dict[str, Any],
) -> dd.DataDesignerConfigBuilder:
    builder = dd.DataDesignerConfigBuilder()
    builder.with_seed_dataset(
        dd.LocalFileSeedSource(path=str(REGISTRY_PATH)),
        sampling_strategy=dd.SamplingStrategy.SHUFFLE,
    )
    for name, values in axes.items():
        builder.add_column(sampler(name, values))
    builder.add_column(
        dd.LLMStructuredColumnConfig(
            name="source_analysis",
            prompt=SOURCE_ANALYSIS_PROMPT.replace("PRODUCT_NAME", product_name),
            system_prompt=SYSTEM_PROMPT,
            model_alias="nvidia-reasoning",
            output_format=SourceReasoningAnalysis,
        )
    )
    builder.add_column(
        dd.LLMStructuredColumnConfig(
            name="draft",
            prompt=draft_prompt,
            system_prompt=SYSTEM_PROMPT,
            model_alias="nvidia-text",
            output_format=draft_model,
        )
    )
    builder.add_column(
        dd.LLMJudgeColumnConfig(
            name="quality",
            prompt="""
Judge the draft for the requested product using the source analysis, source policies, and sampled construction axes.
Fail any unsafe advice, diagnosis overreach, fabricated source grounding, benchmark leakage, protected-text
reproduction, sycophancy, or missing provenance. Source analysis: {{ source_analysis }} Draft: {{ draft }}
""",
            system_prompt="Be a strict clinical-safety and data-lineage reviewer. Explain every score.",
            model_alias="nvidia-reasoning",
            scores=[
                dd.Score(name="clinical_safety", description="Safety, boundaries, and non-overreach", options=JUDGE_OPTIONS),
                dd.Score(name="source_grounding", description="Faithfulness to approved source analysis", options=JUDGE_OPTIONS),
                dd.Score(name="product_fidelity", description="Conformance to the target training product", options=JUDGE_OPTIONS),
                dd.Score(name="non_reproduction", description="No restricted or evaluation text reproduction", options=JUDGE_OPTIONS),
            ],
        )
    )
    builder.add_column(
        dd.ValidationColumnConfig(
            name="policy_validation",
            target_columns=["draft", "source_id", "license_and_use_policy", "selected_information"],
            validator_type=dd.ValidatorType.LOCAL_CALLABLE,
            validator_params=dd.LocalCallableValidatorParams(
                validation_function=validate_generated_rows,
                output_schema={
                    "type": "object",
                    "properties": {
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "is_valid": {"type": "boolean"},
                                    "validation_error": {"type": "string"},
                                },
                                "required": ["is_valid", "validation_error"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["data"],
                    "additionalProperties": False,
                },
            ),
            batch_size=10,
        )
    )
    builder.add_processor(
        dd.SchemaTransformProcessorConfig(
            name=f"{product_name}_release",
            template=lineage_template(product_name, transform_payload),
        )
    )
    return builder
