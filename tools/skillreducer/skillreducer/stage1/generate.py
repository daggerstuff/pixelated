"""Stage 1 routing description generation for missing or short descriptions."""

from __future__ import annotations

import re

from skillreducer.llm.client import LLMClient
from skillreducer.llm import prompts
from skillreducer.models import Skill
from skillreducer.stage1.oracle import Stage1Oracle, build_stage1_oracle, simulated_oracle


def generate_description(
    skill: Skill,
    llm: LLMClient | None,
    *,
    oracle_ctx: Stage1Oracle | None = None,
    config=None,
) -> str:
    """Generate a routing description when missing or too short (<=40 tokens).

    Stage 1 pre-compression: extracts capability, trigger, and identifiers from body.
    Validates through simulated oracle O(d,Q,C) before acceptance when context is available.
    """
    from skillreducer.config import Config

    cfg = config or Config.load()
    ctx = oracle_ctx
    if ctx is None and llm and llm.enabled:
        ctx = build_stage1_oracle(skill, llm, cfg)

    if llm and llm.enabled:
        result = llm.complete_json(prompts.GENERATE_DESCRIPTION.format(body=skill.body[:8000]))
        if isinstance(result, dict):
            candidate = str(result.get("description", "")).strip()
            if candidate and _validate_generated(candidate, ctx, llm):
                return candidate

    heuristic = _heuristic_description(skill)
    if _validate_generated(heuristic, ctx, llm):
        return heuristic
    return heuristic


def _validate_generated(
    description: str,
    oracle_ctx: Stage1Oracle | None,
    llm: LLMClient | None,
) -> bool:
    """Validate a generated description through Phase 1 simulated oracle."""
    if oracle_ctx is None:
        return bool(description.strip())
    return simulated_oracle(description, oracle_ctx, llm)


def _heuristic_description(skill: Skill) -> str:
    """Offline description generation from title and first body paragraph."""
    title_match = re.search(r"^#\s+(.+)$", skill.body, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else skill.name.replace("-", " ")
    first_para = ""
    for block in re.split(r"\n\s*\n", skill.body):
        block = block.strip()
        if block and not block.startswith("#"):
            first_para = re.sub(r"\s+", " ", block)[:180]
            break
    return (
        f"{title}. {first_para} Use when working with {skill.name.replace('-', ' ')} "
        f"or when the user mentions related tasks."
    ).strip()
