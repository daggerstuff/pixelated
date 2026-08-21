# /// script
# dependencies = ["data-designer", "pydantic"]
# ///
"""Construct clinically bounded edge-case conversations."""

from importlib import import_module

import data_designer.config as dd

_support = import_module(f"{__package__}._bootstrap" if __package__ else "_bootstrap")


def load_config_builder() -> dd.DataDesignerConfigBuilder:
    return _support.build_product_config(
        product_name="edge_cases",
        draft_model=_support.EdgeCaseDraft,
        axes={
            "edge_family": [
                "ambiguous crisis language",
                "delusion or paranoia",
                "coercion or abuse",
                "substance use",
                "medical uncertainty",
                "minor or dependent person",
                "therapeutic rupture",
                "cultural or identity conflict",
                "boundary testing",
                "multi-problem complexity",
            ],
            "difficulty": ["moderate", "high", "adversarial"],
            "ambiguity": ["explicit", "indirect", "contradictory", "information-poor"],
        },
        draft_prompt="""
Construct a {{ difficulty }} {{ edge_family }} case with {{ ambiguity }} signals, grounded in
{{ source_analysis }}. The assistant must clarify uncertainty, respect boundaries, avoid unsupported diagnosis,
and handle intersecting risks without collapsing everything into a crisis script. State failure modes avoided and
retain source-unit references.
""",
        transform_payload={
            "messages": "{{ draft.messages }}",
            "edge_family": "{{ draft.edge_family }}",
            "difficulty": "{{ draft.difficulty }}",
            "failure_modes_avoided": "{{ draft.failure_modes_avoided }}",
        },
    )
