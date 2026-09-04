"""Stage 1 description compression via DDMIN and simulated routing oracle."""

from __future__ import annotations

import re

from skillreducer.llm.client import LLMClient
from skillreducer.llm import prompts
from skillreducer.models import Skill
from skillreducer.stage1.ddmin import ddmin
from skillreducer.stage1.oracle import (
    Stage1Oracle,
    build_stage1_oracle,
    simulated_oracle,
)
from skillreducer.stage1.prompts import POLISH_DESCRIPTION_PROMPT
from skillreducer.stage1.segment import segment_description


def compress_description(
    description: str,
    llm: LLMClient | None,
    *,
    skill: Skill | None = None,
    oracle_ctx: Stage1Oracle | None = None,
    skill_library: list[Skill] | None = None,
    max_restore_steps: int = 3,
    config=None,
) -> tuple[str, list[str]]:
    """Compress a verbose routing description using Stage 1 Phase 1 + Phase 2.

    Phase 1 (paper): segment into semantic clauses U, run DDMIN with O(d,Q,C),
    paraphrase retained clauses (oracle-gated), then polish.

    Phase 2 (paper): validate on Q_val; selective restore (max_restore_steps);
    fallback to original if validation still fails.
    """
    from skillreducer.config import Config

    notes: list[str] = []
    original = description.strip()
    if not original:
        return original, notes

    cfg = config or Config.load()
    ctx = oracle_ctx
    if ctx is None and skill is not None:
        ctx = build_stage1_oracle(skill, llm, cfg, skill_library)

    clauses = segment_description(original, llm)
    if len(clauses) <= 1:
        compressed = polish_description(_join_clauses(clauses), llm)
        if ctx and not _passes_oracle(compressed, ctx, llm, phase2=True):
            notes.append("Stage 1 Phase 2: single-clause validation failed; keeping original")
            return original, notes
        return compressed, notes

    def oracle(candidate: list[str]) -> bool:
        candidate_desc = _join_clauses(candidate)
        if ctx is None:
            return _heuristic_oracle_pass(candidate_desc, original)
        if len(ctx.candidate_pool(candidate_desc)) < 2:
            return _heuristic_oracle_pass(candidate_desc, original)
        return simulated_oracle(candidate_desc, ctx, llm)

    minimal = ddmin(clauses, oracle)
    deleted = [c for c in clauses if c not in minimal]

    rewritten = paraphrase_clauses_gated(minimal, ctx, llm, original)
    compressed = polish_description(_join_clauses(rewritten), llm)

    if ctx is not None:
        if not _passes_oracle(compressed, ctx, llm, phase2=True):
            compressed, restore_notes = selective_restore(
                minimal,
                deleted,
                ctx,
                llm,
                max_restore_steps=max_restore_steps,
            )
            notes.extend(restore_notes)
            if not _passes_oracle(compressed, ctx, llm, phase2=True):
                compressed = original
                notes.append("Stage 1 Phase 2: fallback to original description")
    elif not _heuristic_oracle_pass(compressed, original):
        compressed = original
        notes.append("Stage 1: heuristic oracle failed; fallback to original")

    if compressed != original:
        notes.append(f"Stage 1: compressed description ({len(clauses)} -> {len(minimal)} clauses)")
    return compressed, notes


def paraphrase_clauses_gated(
    clauses: list[str],
    oracle_ctx: Stage1Oracle | None,
    llm: LLMClient | None,
    original_description: str,
) -> list[str]:
    """Paraphrase each retained clause shorter; accept only if O(d,Q,C) still passes.

    Stage 1 Phase 1: per-unit paraphrase gated by simulated routing oracle.
    """
    result = list(clauses)
    for index, clause in enumerate(clauses):
        shorter = _paraphrase_clause(clause, llm)
        if shorter == clause:
            continue
        trial = list(result)
        trial[index] = shorter
        trial_desc = _join_clauses(trial)
        if oracle_ctx is None:
            if _heuristic_oracle_pass(trial_desc, original_description):
                result[index] = shorter
        elif simulated_oracle(trial_desc, oracle_ctx, llm):
            result[index] = shorter
    return result


def polish_description(description: str, llm: LLMClient | None) -> str:
    """Polish joined description text for grammatical coherence.

    Stage 1 Phase 1: final polish step after paraphrase.
    """
    text = _join_clauses([description]) if "\n" not in description else description.strip()
    if llm and llm.enabled:
        polished = llm.complete(POLISH_DESCRIPTION_PROMPT.format(description=text)).strip()
        if polished:
            return polished
    return _join_clauses([text])


def selective_restore(
    minimal: list[str],
    deleted: list[str],
    oracle_ctx: Stage1Oracle,
    llm: LLMClient | None,
    *,
    max_restore_steps: int = 3,
) -> tuple[str, list[str]]:
    """Greedily re-add deleted clauses when Phase 2 validation fails.

    Stage 1 Phase 2: selective recovery (max_restore_steps), per Algorithm 1.
    """
    notes: list[str] = []
    restored = list(minimal)
    pool = list(deleted)
    compressed = polish_description(_join_clauses(restored), llm)

    for _ in range(max_restore_steps):
        if not pool:
            break
        best = max(pool, key=lambda c: _overlap_score(c, oracle_ctx.original_description))
        pool.remove(best)
        restored.append(best)
        trial = polish_description(_join_clauses(restored), llm)
        if _passes_oracle(trial, oracle_ctx, llm, phase2=True):
            compressed = trial
            notes.append("Stage 1 Phase 2: selective restore applied")
            break
    return compressed, notes


def _passes_oracle(
    description: str,
    oracle_ctx: Stage1Oracle,
    llm: LLMClient | None,
    *,
    phase2: bool = False,
) -> bool:
    """Run simulated oracle; Phase 2 uses Q_val baseline queries."""
    queries = oracle_ctx.q_val if phase2 and oracle_ctx.q_val else None
    return simulated_oracle(description, oracle_ctx, llm, queries=queries)


def _paraphrase_clause(clause: str, llm: LLMClient | None) -> str:
    """Rewrite one routing clause to a shorter form (Stage 1 Phase 1)."""
    if llm and llm.enabled:
        return llm.complete(prompts.PARAPHRASE_CLAUSE.format(clause=clause)).strip() or clause
    return re.sub(r"\b(use when the user mentions|use when)\b", "Use when", clause, flags=re.I)


def _join_clauses(clauses: list[str]) -> str:
    """Join semantic clauses into a single description string."""
    text = ". ".join(c.strip().rstrip(".") for c in clauses if c.strip())
    text = re.sub(r"\s+", " ", text).strip()
    if text and not text.endswith("."):
        text += "."
    return text


def _heuristic_oracle_pass(candidate: str, original: str) -> bool:
    """Offline oracle fallback when no skill context or LLM is available."""
    cand_tokens = set(re.findall(r"[a-z0-9][a-z0-9_-]{2,}", candidate.lower()))
    orig_tokens = set(re.findall(r"[a-z0-9][a-z0-9_-]{2,}", original.lower()))
    if not cand_tokens:
        return False
    overlap = len(cand_tokens & orig_tokens) / max(len(orig_tokens), 1)
    return overlap >= 0.45 and len(candidate) <= len(original)


def _overlap_score(clause: str, original: str) -> int:
    """Score a deleted clause for greedy selective restore ranking."""
    return len(set(clause.lower().split()) & set(original.lower().split()))
