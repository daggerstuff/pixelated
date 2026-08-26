# px CLI and Eve Agents

`px` is the CLI tool (`cli/px/`) used to invoke **Eve agents** — specialized AI
agents for the Pixelated Empathy therapeutic training platform.

## What px does

- Invokes Eve agents running as remote services (e.g.
  `eve-agent.pixelated.svc.cluster.local:2000`)
- Provides commands to call specific agent tools (e.g.
  `px invoke eve evaluate_corpus_gate`)
- Formats agent responses with smart formatting (scores, findings, health
  checks, async tasks)
- Manages agent configuration from `agents/px.config.json`

## Eve agent (from px config)

Agent: `eve`

- Endpoint: `http://eve-agent.pixelated.svc.cluster.local:2000`
- Tools: `clean_corpus`, `replace_slop`, `regenerate_record`,
  `evaluate_corpus_gate`
- Async: false, Timeout: 30000ms

## Why agents use px

px CLI is the standardized way to:

- Invoke any Eve agent (advisor, content, qa, pipeline, intake, session, eve)
- Route requests to the correct agent endpoint
- Get formatted, readable output
- Integrate with git hooks (pre-commit, pre-push, post-merge, pr-open, pr-merge)

The px config at `agents/px.config.json` defines 7 agents with their endpoints
and available tools, enabling the team to invoke specialized AI functionality
from the terminal.

## Related issues

- #5446: Remove hardcoded pnpm version and fix px-cli filter
- #5447: Fix CI pnpm setup and px-cli build filter
