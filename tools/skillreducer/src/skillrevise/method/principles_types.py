from __future__ import annotations

from dataclasses import dataclass

from skillrevise.core.models import RepairPrinciple


class PrincipleRetrievalCandidate:
    principle: RepairPrinciple
    score: float
    rank: int
    matched_signals: list[str]


@dataclass(frozen=True)
class PrincipleRetrievalConfig:
    method: str = "hybrid-rrf"
    embedding_model: str = "qwen/qwen3-embedding-4b"
    embedding_url: str | None = None
    embedding_api_key: str | None = None
    embedding_cache: str | None = None
    keyword_weight: float = 0.5
    semantic_weight: float = 0.5
    rrf_k: int = 60
    dense_content_weight: float = 0.05


@dataclass(frozen=True)
class AbsorbedPrincipleAbstraction:
    title: str
    trigger: str
    action_template: str
    verification_template: str
    trigger_keywords: list[str]
    retrieval_tags: list[str]


