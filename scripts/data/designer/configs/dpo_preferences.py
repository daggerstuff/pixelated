# /// script
# dependencies = ["data-designer", "pydantic"]
# ///
"""Construct chosen/rejected therapeutic preference pairs."""

from importlib import import_module

import data_designer.config as dd

_support = import_module(f"{__package__}._bootstrap" if __package__ else "_bootstrap")


def load_config_builder() -> dd.DataDesignerConfigBuilder:
    return _support.build_product_config(
        product_name="dpo_preferences",
        draft_model=_support.DPOPreferenceDraft,
        axes={
            "preference_dimension": [
                "clinical safety",
                "empathic accuracy",
                "non-sycophancy",
                "boundary quality",
                "source grounding",
                "cultural humility",
            ],
            "negative_error": ["unsafe advice", "diagnosis overreach", "premature reassurance", "moralizing", "fabrication"],
            "contrast_strength": ["subtle", "clear", "safety-critical"],
        },
        draft_prompt="""
Construct a {{ contrast_strength }} chosen/rejected pair emphasizing {{ preference_dimension }}. The rejected
response should demonstrate {{ negative_error }} without containing actionable harmful detail. Ground both in
{{ source_analysis }} so the quality difference is attributable and independently reviewable. Provide explicit
reason codes, safety differences, and source-unit references.
""",
        transform_payload={
            "prompt": "{{ draft.prompt }}",
            "chosen": "{{ draft.chosen }}",
            "rejected": "{{ draft.rejected }}",
            "reason_codes": "{{ draft.reason_codes }}",
            "quality_dimensions": "{{ draft.quality_dimensions }}",
        },
    )
