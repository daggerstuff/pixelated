from __future__ import annotations

GENERATE_DESCRIPTION = """\
Extract an agent skill routing description from the body below.
Return JSON with keys: capability, trigger, identifiers.
Each value should be 20-40 tokens worth of concise third-person text.
Combine into one description string in field "description".
Rules:
- Third person only
- Include WHAT the skill does and WHEN to use it
- Include concrete trigger terms (file types, APIs, tools)
- No first/second person

Body:
{body}
"""

SEGMENT_DESCRIPTION = """\
Split this skill description into independent semantic routing clauses.
Return JSON: {{"clauses": ["...", "..."]}}
Each clause should capture one routing-relevant concept.

Description:
{description}
"""

PARAPHRASE_CLAUSE = """\
Rewrite this routing clause shorter while preserving routing meaning.
Return only the rewritten clause text.

Clause:
{clause}
"""

CLASSIFY_PARAGRAPHS = """\
Classify each paragraph into exactly one type:
- core_rule: actionable instructions the agent must follow
- background: explanations and rationale
- example: illustrative code snippets or I/O pairs
- template: boilerplate for copy-paste
- redundant: repeated or unnecessary content

Return JSON:
{{"items": [{{"index": 0, "type": "core_rule"}}]}}

Paragraphs:
{paragraphs}
"""

SUMMARIZE_BACKGROUND = """\
Summarize the following background content into one concise paragraph.
Preserve all unique factual claims: numbers, thresholds, API endpoints.

Content:
{content}
"""

GEN_REFERENCE_META = """\
Given reference content, return JSON:
{{"when": "short trigger clause for when to load this file", "topics": ["k1", "k2", "k3"]}}

Content:
{content}
"""

REVIEW_SCRIPT_EXTRACTION = """\
Review each Python or Linux shell code block in the markdown file below and decide
whether it should be extracted into a standalone script file under scripts/.

Return JSON with one item per block:
{{"items": [
  {{"index": 0, "extract": true, "reason": "...", "script_name": "foo.py", "replacement": "Run: `python scripts/foo.py`"}},
  {{"index": 1, "extract": true, "reason": "...", "script_name": "deploy.sh", "replacement": "Run: `bash scripts/deploy.sh`"}}
]}}

Rules:
- Python blocks -> .py files; run with python scripts/<name>.py
- Bash/sh/shell/zsh blocks -> .sh files; run with bash scripts/<name>.sh
- NOT every block should be extracted — default to extract: false when uncertain
- extract: true only for complete, runnable, multi-line scripts worth a separate file
- extract: false for one-liners, syntax illustrations, partial snippets, or code
  tightly coupled to surrounding prose
- replacement is required only when extract is true (max ~30 tokens)
- include reason for every block

File: {filename}

Blocks:
{blocks}
"""
