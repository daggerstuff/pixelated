"""Stage 1 semantic segmentation of routing descriptions into clauses."""

from __future__ import annotations

import re

from skillreducer.llm.client import LLMClient
from skillreducer.llm import prompts


def segment_description(description: str, llm: LLMClient | None) -> list[str]:
    """Split description d into semantic routing clauses U = {u1, ..., un}.

    Stage 1 Phase 1: each clause captures one coherent routing concept
    (finer than sentences, coarser than words). Used as DDMIN input units.
    """
    if llm and llm.enabled:
        result = llm.complete_json(prompts.SEGMENT_DESCRIPTION.format(description=description))
        if isinstance(result, dict):
            clauses = result.get("clauses", [])
            parsed = [str(c).strip() for c in clauses if str(c).strip()]
            if parsed:
                return parsed
    return _heuristic_segment(description)


def _heuristic_segment(description: str) -> list[str]:
    """Offline clause segmentation when no LLM is configured."""
    parts = re.split(r"(?<=[.!?])\s+|;\s+|,\s+(?=Use when|Tools:|Triggers:)", description)
    clauses = [p.strip() for p in parts if p.strip()]
    return clauses or [description.strip()]
