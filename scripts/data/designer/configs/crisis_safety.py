# /// script
# dependencies = ["data-designer", "pydantic"]
# ///
"""Construct crisis-safe response and escalation examples."""

from importlib import import_module

import data_designer.config as dd

_support = import_module(f"{__package__}._bootstrap" if __package__ else "_bootstrap")


def load_config_builder() -> dd.DataDesignerConfigBuilder:
    return _support.build_product_config(
        product_name="crisis_safety",
        draft_model=_support.CrisisSafetyDraft,
        axes={
            "risk_level": ["unclear", "elevated", "imminent"],
            "signal_channel": ["direct statement", "indirect language", "behavioral clues", "third-party concern"],
            "support_context": ["alone", "trusted person available", "professional support available", "location unknown"],
        },
        draft_prompt="""
Construct a {{ risk_level }} crisis-safety exchange using {{ signal_channel }} with support context
{{ support_context }}, grounded in {{ source_analysis }}. Prioritize direct compassionate assessment, immediate
safety, local emergency/crisis resources without assuming geography, and practical connection to human support.
Never promise confidentiality, minimize risk, provide harmful details, or substitute for emergency care.
""",
        transform_payload={
            "messages": "{{ draft.messages }}",
            "risk_level": "{{ draft.risk_level }}",
            "warning_signals": "{{ draft.warning_signals }}",
            "escalation_path": "{{ draft.escalation_path }}",
        },
    )
