# /// script
# dependencies = ["data-designer", "pydantic"]
# ///
"""Construct source-grounded therapeutic SFT conversations."""

from importlib import import_module

import data_designer.config as dd

_support = import_module(f"{__package__}._bootstrap" if __package__ else "_bootstrap")


def load_config_builder() -> dd.DataDesignerConfigBuilder:
    return _support.build_product_config(
        product_name="therapeutic_sft",
        draft_model=_support.TherapeuticSFTDraft,
        axes={
            "conversation_length": ["single-turn", "short multi-turn", "extended multi-turn"],
            "therapeutic_stance": ["reflective", "collaborative", "psychoeducational", "skills-oriented"],
            "cultural_context": ["explicitly represented", "identity-salient", "not specified"],
        },
        draft_prompt="""
Construct a therapeutic training conversation from {{ source_analysis }}. Use {{ conversation_length }}, a
{{ therapeutic_stance }} stance, and {{ cultural_context }} cultural context. The response must validate without
sycophancy, avoid diagnosis and prescriptive treatment, and retain selected source-unit references. Policies:
{{ license_and_use_policy }}. Return a structured SFT draft, not commentary.
""",
        transform_payload={"messages": "{{ draft.messages }}", "scenario_summary": "{{ draft.scenario_summary }}"},
    )
