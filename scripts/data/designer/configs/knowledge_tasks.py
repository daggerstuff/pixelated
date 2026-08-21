# /// script
# dependencies = ["data-designer", "pydantic"]
# ///
"""Construct citation-bearing knowledge and retrieval tasks."""

from importlib import import_module

import data_designer.config as dd

_support = import_module(f"{__package__}._bootstrap" if __package__ else "_bootstrap")


def load_config_builder() -> dd.DataDesignerConfigBuilder:
    return _support.build_product_config(
        product_name="knowledge_tasks",
        draft_model=_support.KnowledgeTaskDraft,
        axes={
            "task_type": ["concept explanation", "compare approaches", "case-grounded retrieval", "contraindication lookup"],
            "answer_scope": ["brief", "structured", "multi-source synthesis"],
            "citation_density": ["one claim per citation", "paragraph-level citations", "contrastive citations"],
        },
        draft_prompt="""
Construct a {{ answer_scope }} {{ task_type }} task with {{ citation_density }}, grounded only in
{{ source_analysis }}. Every substantive claim needs a source_unit_ref. For copyrighted or restricted sources,
require retrieval at use time and synthesize without reproducing protected passages. Distinguish source-supported
claims from uncertainty and never fabricate citations.
""",
        transform_payload={
            "query": "{{ draft.query }}",
            "answer": "{{ draft.answer }}",
            "citations": "{{ draft.citations }}",
            "retrieval_requirements": "{{ draft.retrieval_requirements }}",
        },
    )
