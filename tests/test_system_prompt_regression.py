"""Deterministic routing & golden set evaluation.

Evaluates local intent-router behavior against a static query-to-skill
matrix to catch intent drift. The router is a deterministic keyword scorer
over the trigger phrases declared in each ``skills/*/SKILL.md`` — no LLM in
the loop, so the golden set must pass identically on every run.

``REGRESSION_DATASET`` rows are ``(query, expected_skill, should_match)``.
Rows with ``should_match=True`` assert the router resolves to the expected
skill; negative baselines (``False``) assert it resolves *somewhere else*.

Run with: ``pytest tests/test_system_prompt_regression.py -v``
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from tests.test_skill_routing import parse_skill_metadata

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"
FALLBACK_SKILL = "general-qa"
# Trigger words shorter than this carry no routing signal ("for", "the", ...).
MIN_TRIGGER_WORD_LEN = 4
# Common English words that carry no intent signal; excluded from trigger
# keywords so e.g. "test" in a trigger phrase never routes arbitrary
# "regression test framework" queries to a code skill.
STOPWORDS = frozenset(
    {
        "about",
        "after",
        "again",
        "all",
        "also",
        "and",
        "any",
        "are",
        "because",
        "been",
        "before",
        "being",
        "between",
        "both",
        "but",
        "can",
        "could",
        "each",
        "from",
        "further",
        "general",
        "get",
        "has",
        "have",
        "how",
        "into",
        "just",
        "make",
        "many",
        "more",
        "most",
        "must",
        "need",
        "new",
        "not",
        "only",
        "other",
        "out",
        "over",
        "please",
        "quick",
        "review",
        "said",
        "same",
        "she",
        "should",
        "some",
        "such",
        "than",
        "that",
        "the",
        "them",
        "then",
        "there",
        "these",
        "they",
        "this",
        "those",
        "three",
        "through",
        "unit",
        "use",
        "used",
        "using",
        "very",
        "was",
        "were",
        "what",
        "when",
        "where",
        "which",
        "while",
        "who",
        "whom",
        "will",
        "with",
        "write",
    }
)

# Regression test matrix: (Input Query, Expected Target Skill, Should Match)
REGRESSION_DATASET: list[tuple[str, str, bool]] = [
    ("Write unit tests for the worker endpoints", "code-generator", True),
    ("Review this git commit diff", "code-review", True),
    ("What is the capital of Vermont?", "general-qa", True),
    ("Draft the regression test framework", "general-qa", False),  # Negative baseline
]

_WORD_RE = re.compile(r"[a-z0-9']+")


def _load_skill_triggers() -> dict[str, list[str]]:
    """Map skill name -> trigger phrases declared in skills/*/SKILL.md."""
    triggers: dict[str, list[str]] = {}
    for skill_file in sorted(SKILLS_DIR.glob("**/SKILL.md")):
        meta = parse_skill_metadata(skill_file)
        name = meta.get("name", skill_file.parent.name)
        triggers[name] = [line.strip().strip("\"'-") for line in meta.get("triggers", "").splitlines() if line.strip()]
    return triggers


def _trigger_keywords(triggers: list[str]) -> set[str]:
    keywords: set[str] = set()
    for phrase in triggers:
        for word in _WORD_RE.findall(phrase.lower()):
            if len(word) >= MIN_TRIGGER_WORD_LEN and word not in STOPWORDS:
                keywords.add(word)
    return keywords


def route_intent(query: str) -> str:
    """Deterministic local intent router (stand-in for the production handler).

    Scores each skill by how many of its trigger keywords appear as whole
    words in the query. Highest score wins; ties break lexicographically by
    skill name; when no skill scores above zero, the query falls back to
    ``FALLBACK_SKILL``. Same input always yields the same output.
    """
    skills = _load_skill_triggers()
    query_words = set(_WORD_RE.findall(query.lower()))
    best_skill: str | None = None
    best_score = 0
    for name in sorted(skills):
        score = len(query_words & _trigger_keywords(skills[name]))
        if score > best_score:
            best_score = score
            best_skill = name
    return best_skill if best_skill is not None else FALLBACK_SKILL


def test_skill_targets_in_regression_dataset_exist() -> None:
    """Guard against a typo'd skill name silently vacating the matrix."""
    available = {
        meta.get("name", path.parent.name)
        for path in SKILLS_DIR.glob("**/SKILL.md")
        for meta in [parse_skill_metadata(path)]
    }
    for _, expected_skill, should_match in REGRESSION_DATASET:
        if should_match:
            assert expected_skill in available, f"Expected skill {expected_skill!r} has no SKILL.md under {SKILLS_DIR}"


@pytest.mark.parametrize(
    ("query", "expected_skill", "should_match"),
    REGRESSION_DATASET,
    ids=[query for query, _, _ in REGRESSION_DATASET],
)
def test_intent_routing_regression(query: str, expected_skill: str, should_match: bool) -> None:
    resolved_first = route_intent(query)
    resolved_second = route_intent(query)
    assert resolved_first == resolved_second, (
        f"Router is non-deterministic for {query!r}: {resolved_first!r} != {resolved_second!r}"
    )
    resolved = resolved_first
    if should_match:
        assert resolved == expected_skill, f"Query '{query}' resolved to {resolved}, expected {expected_skill}"
    else:
        assert resolved != expected_skill, f"Query '{query}' unexpectedly resolved to {expected_skill}"


def test_router_fallback_is_general_qa_for_noise() -> None:
    """Queries with no trigger signal must land on the fallback skill."""
    assert route_intent("zzz qqq xxx vvv www") == FALLBACK_SKILL
