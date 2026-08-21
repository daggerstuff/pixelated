# /// script
# dependencies = ["data-designer", "pydantic"]
# ///
"""Construct longitudinal therapy sessions with continuity and progression."""

from importlib import import_module

import data_designer.config as dd

_support = import_module(f"{__package__}._bootstrap" if __package__ else "_bootstrap")


def load_config_builder() -> dd.DataDesignerConfigBuilder:
    return _support.build_product_config(
        product_name="long_running_therapy",
        draft_model=_support.LongRunningTherapyDraft,
        axes={
            "arc_length": ["3 sessions", "5 sessions", "8 sessions"],
            "continuity_challenge": ["avoidance", "setback", "rupture and repair", "changing goals", "mixed progress"],
            "memory_focus": ["relationships", "coping practice", "values", "symptom pattern", "life transition"],
        },
        draft_prompt="""
Construct {{ arc_length }} of longitudinal therapy grounded in {{ source_analysis }}. Preserve continuity around
{{ memory_focus }} and include {{ continuity_challenge }}. Each session must carry forward only justified memories,
show realistic non-linear progression, and avoid invented diagnoses or guaranteed outcomes. Include rupture/repair
where appropriate and retain source-unit references.
""",
        transform_payload={
            "sessions": "{{ draft.sessions }}",
            "client_continuity_state": "{{ draft.client_continuity_state }}",
            "longitudinal_arc": "{{ draft.longitudinal_arc }}",
        },
    )
