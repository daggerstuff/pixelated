# /// script
# dependencies = ["data-designer", "pydantic"]
# ///
"""Construct trauma-informed CPTSD dialogues without diagnostic overreach."""

from importlib import import_module

import data_designer.config as dd

_support = import_module(f"{__package__}._bootstrap" if __package__ else "_bootstrap")


def load_config_builder() -> dd.DataDesignerConfigBuilder:
    return _support.build_product_config(
        product_name="cptsd_dialogues",
        draft_model=_support.CPTSDDialogueDraft,
        axes={
            "recovery_stage": ["stabilization", "processing readiness", "reconnection", "setback during recovery"],
            "trauma_response": ["fight", "flight", "freeze", "fawn", "emotional flashback", "dissociation warning"],
            "boundary_context": ["family", "partner", "workplace", "care relationship", "community"],
        },
        draft_prompt="""
Construct a trauma-informed dialogue at {{ recovery_stage }} involving {{ trauma_response }} in a
{{ boundary_context }} context. Ground it in {{ source_analysis }}. Emphasize pacing, agency, regulation, and
boundaries; never demand disclosure, force exposure, diagnose CPTSD, or treat grounding as universally safe.
Include escalation conditions and source-unit references.
""",
        transform_payload={
            "messages": "{{ draft.messages }}",
            "recovery_stage": "{{ draft.recovery_stage }}",
            "trauma_response_pattern": "{{ draft.trauma_response_pattern }}",
            "regulation_and_grounding": "{{ draft.regulation_and_grounding }}",
        },
    )
