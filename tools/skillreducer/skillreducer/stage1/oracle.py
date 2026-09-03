"""Stage 1 simulated routing oracle O(d, Q, C) per Gao et al. 2026, Section IV-A."""

from __future__ import annotations

import math
import random
import re
from collections import Counter
from dataclasses import dataclass, field

from skillreducer.config import Config
from skillreducer.llm.client import LLMClient
from skillreducer.models import Skill
from skillreducer.parser import find_skill_paths, parse_skill_md
from skillreducer.stage1.prompts import (
    ADVERSARIAL_SKILL_PROMPT,
    BUILD_TEST_QUERIES_PROMPT,
    ROUTING_SELECT_PROMPT,
)

_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9_-]{2,}")


@dataclass
class CandidateSkill:
    """One skill entry in the routing candidate pool C."""

    name: str
    description: str
    is_target: bool = False
    is_adversarial: bool = False


@dataclass
class Stage1Oracle:
    """Context for Stage 1 simulated routing oracle O(d, Q, C).

    Holds the target skill identity, test queries Q, distractor skills,
    and optional adversarial shadow skill s_adv used during DDMIN.
    """

    target_name: str
    queries: list[str]
    distractors: list[CandidateSkill] = field(default_factory=list)
    adversarial: CandidateSkill | None = None
    q_val: list[str] = field(default_factory=list)
    original_description: str = ""

    def candidate_pool(self, target_description: str) -> list[CandidateSkill]:
        """Build candidate pool C: target + distractors + adversarial s_adv."""
        pool: list[CandidateSkill] = [
            CandidateSkill(
                name=self.target_name,
                description=target_description,
                is_target=True,
            ),
            *self.distractors,
        ]
        if self.adversarial is not None:
            pool.append(self.adversarial)
        return pool


def _tokenize(text: str) -> list[str]:
    """Tokenize name + description text for TF-IDF similarity."""
    return _TOKEN_RE.findall(text.lower())


def _tfidf_vectors(documents: list[list[str]]) -> list[Counter[str]]:
    """Compute TF vectors scaled by IDF across a document corpus."""
    doc_count = len(documents)
    df: Counter[str] = Counter()
    for doc in documents:
        df.update(set(doc))

    vectors: list[Counter[str]] = []
    for doc in documents:
        tf = Counter(doc)
        total = sum(tf.values()) or 1
        vec: Counter[str] = Counter()
        for term, count in tf.items():
            idf = math.log((1 + doc_count) / (1 + df[term])) + 1.0
            vec[term] = (count / total) * idf
        vectors.append(vec)
    return vectors


def _cosine_similarity(a: Counter[str], b: Counter[str]) -> float:
    """Cosine similarity between two sparse TF-IDF vectors."""
    if not a or not b:
        return 0.0
    dot = sum(a[t] * b[t] for t in a if t in b)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def select_tfidf_distractors(
    target: Skill,
    skill_library: list[Skill],
    k: int = 4,
) -> list[CandidateSkill]:
    """Select k distractor skills by TF-IDF cosine similarity (name + description).

    Stage 1 Phase 1: semantically close skills are most likely to confuse the router.
    """
    others = [s for s in skill_library if s.name != target.name and s.description.strip()]
    if not others:
        return []

    target_text = f"{target.name} {target.description}"
    target_tokens = _tokenize(target_text)
    corpus = [target_tokens] + [_tokenize(f"{s.name} {s.description}") for s in others]
    vectors = _tfidf_vectors(corpus)
    target_vec = vectors[0]

    scored: list[tuple[float, Skill]] = []
    for skill, vec in zip(others, vectors[1:], strict=False):
        scored.append((_cosine_similarity(target_vec, vec), skill))
    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        CandidateSkill(name=s.name, description=s.description)
        for _, s in scored[:k]
    ]


def generate_adversarial_skill(
    target_name: str,
    target_description: str,
    llm: LLMClient | None,
) -> CandidateSkill | None:
    """Generate adversarial shadow skill s_adv via LLM (same domain, different purpose).

    Stage 1 Phase 1: stress-tests vague descriptions that could match a confusable peer.
    """
    if not llm or not llm.enabled:
        return None
    result = llm.complete_json(
        ADVERSARIAL_SKILL_PROMPT.format(
            target_name=target_name,
            target_description=target_description,
        )
    )
    if not isinstance(result, dict):
        return None
    name = str(result.get("name", "")).strip()
    description = str(result.get("description", "")).strip()
    if not name or not description:
        return None
    return CandidateSkill(name=name, description=description, is_adversarial=True)


def build_test_queries(
    skill: Skill,
    llm: LLMClient | None,
    num_queries: int = 8,
) -> list[str]:
    """Build test queries Q = {q1, ..., qk} that should trigger the target skill.

    Stage 1 Phase 1: used by simulated oracle O(d, Q, C) during DDMIN.
    """
    if llm and llm.enabled:
        result = llm.complete_json(
            BUILD_TEST_QUERIES_PROMPT.format(
                skill_name=skill.name,
                description=skill.description or skill.name,
                body=skill.body[:4000],
                num_queries=num_queries,
            )
        )
        if isinstance(result, dict):
            raw = result.get("queries", [])
            queries = [str(q).strip() for q in raw if str(q).strip()]
            if queries:
                return queries[:num_queries]

    return _heuristic_test_queries(skill, num_queries)


def _heuristic_test_queries(skill: Skill, num_queries: int) -> list[str]:
    """Offline fallback for Q when no LLM is configured."""
    queries = [
        f"Help me with {skill.name.replace('-', ' ')}",
        f"I need to use the {skill.name} skill",
    ]
    for line in skill.body.splitlines():
        if line.startswith("# ") and len(queries) < num_queries:
            queries.append(f"User asks about: {line.lstrip('# ').strip()}")
    return queries[:num_queries]


def establish_q_val(
    original_description: str,
    oracle_ctx: Stage1Oracle,
    llm: LLMClient | None,
) -> list[str]:
    """Establish Q_val: queries that trigger the target with the original description.

    Stage 1 Phase 2: baseline validation set before accepting compression.
    """
    passing = [
        q
        for q in oracle_ctx.queries
        if simulated_oracle(original_description, oracle_ctx, llm, queries=[q])
    ]
    return passing or list(oracle_ctx.queries)


def route_query(
    query: str,
    candidates: list[CandidateSkill],
    llm: LLMClient | None,
) -> str:
    """Route one query against candidate pool C; return selected skill name.

    Stage 1 Phase 1: candidate order in C should be randomized per query by caller.
    """
    if llm and llm.enabled:
        block = "\n".join(
            f"- {c.name}: {c.description}" for c in candidates
        )
        result = llm.complete_json(
            ROUTING_SELECT_PROMPT.format(query=query, candidates=block),
            model=None,
        )
        if isinstance(result, dict):
            selected = str(result.get("selected", "")).strip()
            if selected:
                return selected

    return _heuristic_route_query(query, candidates)


def _heuristic_route_query(query: str, candidates: list[CandidateSkill]) -> str:
    """Score candidates by token overlap with query + description (no-LLM fallback)."""
    query_tokens = set(_tokenize(query))
    best_name = candidates[0].name
    best_score = -1.0
    for candidate in candidates:
        desc_tokens = set(_tokenize(f"{candidate.name} {candidate.description}"))
        overlap = len(query_tokens & desc_tokens)
        if overlap > best_score or (overlap == best_score and candidate.is_target):
            best_score = overlap
            best_name = candidate.name
    return best_name


def simulated_oracle(
    description: str,
    oracle_ctx: Stage1Oracle,
    llm: LLMClient | None,
    *,
    queries: list[str] | None = None,
) -> bool:
    """Simulated routing oracle O(d, Q, C) -> {0, 1}.

    Stage 1 Phase 1: returns 1 iff the routing model selects the target skill
    for every query in Q. Candidate order in C is randomized per query.
    """
    test_queries = queries if queries is not None else oracle_ctx.queries
    if not test_queries or not description.strip():
        return False

    pool = oracle_ctx.candidate_pool(description.strip())
    if len(pool) < 2:
        return bool(description.strip())

    for query in test_queries:
        shuffled = list(pool)
        random.shuffle(shuffled)
        selected = route_query(query, shuffled, llm)
        if selected != oracle_ctx.target_name:
            return False
    return True


def load_skill_library(skill: Skill, recursive: bool = False) -> list[Skill]:
    """Load sibling skills from the parent directory for TF-IDF distractor selection."""
    parent = skill.skill_dir.parent
    library: list[Skill] = []
    for skill_path in find_skill_paths(parent, recursive=recursive):
        try:
            loaded = parse_skill_md(skill_path)
            if loaded.name != skill.name:
                library.append(loaded)
        except (OSError, FileNotFoundError, ValueError):
            continue
    return library


def build_stage1_oracle(
    skill: Skill,
    llm: LLMClient | None,
    config: Config,
    skill_library: list[Skill] | None = None,
) -> Stage1Oracle:
    """Assemble full Stage 1 oracle context (Q, distractors, s_adv) for one skill."""
    library = skill_library if skill_library is not None else load_skill_library(skill)
    queries = build_test_queries(skill, llm, config.num_test_queries)
    distractors = select_tfidf_distractors(skill, library, k=config.num_distractors)
    adversarial = (
        generate_adversarial_skill(skill.name, skill.description, llm)
        if config.include_adversarial
        else None
    )
    original = skill.description.strip()
    ctx = Stage1Oracle(
        target_name=skill.name,
        queries=queries,
        distractors=distractors,
        adversarial=adversarial,
        original_description=original,
    )
    ctx.q_val = establish_q_val(original or skill.name, ctx, llm) if original else queries
    return ctx
