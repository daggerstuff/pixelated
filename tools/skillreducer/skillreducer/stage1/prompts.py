"""Stage 1 Agno routing agent — description generation and compression."""

from __future__ import annotations

STAGE1_DESCRIPTION = (
    "Stage 1 routing agent (SkillReducer, Gao et al. 2026). "
    "Optimizes YAML description fields so agents route to the correct skill with minimal tokens."
)

STAGE1_INSTRUCTIONS = [
    "You optimize the routing layer (description field) of agent skills.",
    "A description must be third person and include: WHAT the skill does, WHEN to trigger it, and unique identifiers (APIs, file types, library names).",
    "Remove redundant trigger-phrase lists if capability keywords already imply them.",
    "Keep only routing-essential clauses; drop feature laundry lists and usage examples from descriptions.",
    "If description is missing or too short, generate one from the skill body (capability + trigger + identifiers).",
    "Compressed descriptions must still distinguish this skill from similar skills in the same domain.",
    "Never use first or second person in descriptions.",
]

ROUTING_ORACLE_PROMPT = """\
You are a routing oracle. Given a skill description and test queries, decide if the description
would cause an agent runtime to select the TARGET skill (not a distractor) for every query.

Target skill name: {skill_name}
Candidate description:
{candidate_description}

Test queries:
{queries}

Reply with JSON only: {{"passes": true}} or {{"passes": false, "reason": "..."}}
A pass means the description preserves enough routing signal for ALL queries.
"""

GENERATE_FROM_BODY_PROMPT = """\
Generate a routing description for this agent skill body.

Skill name: {skill_name}

Body:
{body}

Return JSON:
{{
  "capability": "20-40 tokens, what the skill does",
  "trigger": "20-40 tokens, when to use it",
  "identifiers": "library names, APIs, file types",
  "description": "single combined third-person description string"
}}
"""

BUILD_TEST_QUERIES_PROMPT = """\
Generate {num_queries} diverse user queries that should trigger this agent skill.

Skill name: {skill_name}
Description: {description}

Body excerpt:
{body}

Return JSON: {{"queries": ["...", "..."]}}
Each query should be a realistic user request that routes to this skill only.
"""

ADVERSARIAL_SKILL_PROMPT = """\
Generate a plausible adversarial "shadow" skill in the SAME domain as the target
but with a DIFFERENT purpose — designed to be confusable when the target description is vague.

Target skill: {target_name}
Target description: {target_description}

Example: target "JWT authentication" -> adversarial "OAuth 2.0 token refresh".

Reply with ONLY a single JSON object, no markdown fences, no explanation:
{{"name": "kebab-case-skill-name", "description": "third-person routing description for the shadow skill"}}
"""

ROUTING_SELECT_PROMPT = """\
You are a skill routing model. Select exactly ONE skill for the user query.
Reply with JSON only: {{"selected": "<skill_name>"}}

Query: {query}

Candidates:
{candidates}
"""

POLISH_DESCRIPTION_PROMPT = """\
Polish this skill routing description for grammatical coherence.
Preserve all routing meaning. Third person only. Return only the polished text.

Description:
{description}
"""
