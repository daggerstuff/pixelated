"""Tests for Stage 1 simulated routing oracle."""

from __future__ import annotations

from pathlib import Path

from skillreducer.models import Skill
from skillreducer.stage1.ddmin import ddmin
from skillreducer.stage1.oracle import (
    CandidateSkill,
    Stage1Oracle,
    _cosine_similarity,
    _tokenize,
    build_test_queries,
    route_query,
    select_tfidf_distractors,
    simulated_oracle,
)


def _skill(name: str, description: str) -> Skill:
    return Skill(
        path=Path(f"/tmp/{name}/SKILL.md"),
        name=name,
        description=description,
        body=f"# {name}\n\nBody text.",
        frontmatter={"name": name, "description": description},
    )


def test_tfidf_selects_similar_skill() -> None:
    target = _skill("jwt-auth", "Handles JWT authentication and token validation for APIs.")
    other_close = _skill("oauth-refresh", "Refreshes OAuth 2.0 tokens and manages client credentials.")
    other_far = _skill("pdf-merge", "Merges PDF files and splits pages for document workflows.")

    distractors = select_tfidf_distractors(target, [other_close, other_far], k=2)
    assert len(distractors) == 2
    names = {d.name for d in distractors}
    assert "oauth-refresh" in names
    assert "pdf-merge" not in names or len(names) == 2


def test_simulated_oracle_requires_target_selection() -> None:
    ctx = Stage1Oracle(
        target_name="jwt-auth",
        queries=["Set up JWT authentication for my API"],
        distractors=[
            CandidateSkill(
                name="api-security",
                description=(
                    "Handles API authentication and security tokens for web applications "
                    "and bearer credentials."
                ),
            )
        ],
    )
    good = (
        "Validates JWT tokens and configures API authentication. "
        "Use when implementing JWT auth or bearer token security."
    )
    vague = "Handles authentication and security tokens for web applications."

    assert simulated_oracle(good, ctx, llm=None)
    assert not simulated_oracle(vague, ctx, llm=None)


def test_route_query_heuristic_prefers_overlap() -> None:
    candidates = [
        CandidateSkill(name="target", description="JWT authentication API security", is_target=True),
        CandidateSkill(name="other", description="PDF merging and page splitting"),
    ]
    selected = route_query("help with JWT API authentication", candidates, llm=None)
    assert selected == "target"


def test_build_test_queries_heuristic() -> None:
    skill = _skill("api-testing", "Runs API integration tests.")
    queries = build_test_queries(skill, llm=None, num_queries=4)
    assert len(queries) >= 2
    assert any("api-testing" in q or "api testing" in q for q in queries)


def test_ddmin_with_oracle_style_predicate() -> None:
    units = ["JWT authentication", "OAuth support", "PDF export"]

    def oracle(candidate: list[str]) -> bool:
        joined = " ".join(candidate)
        return "JWT" in joined

    result = ddmin(units, oracle)
    assert "JWT authentication" in result
    assert "OAuth support" not in result
