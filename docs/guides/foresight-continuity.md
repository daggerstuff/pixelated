---
name: foresight-omc-central-directive
description: Foresight is the continuity backbone for OMC/Claude operations — always inject context blocks before edits, link setup-state to memory, and complete cohesive sequences
ignoring plugin noise.
metadata:
  type: project
---

Always run Foresight continuity before OMC/Claude actions:
`manage_context_blocks` (list/get), `search_memories` (continuity check),
`manage_memories` (store/update). Link `.omc-config.json` / setup-state to
memory IDs (e.g., ccb75939, ba1459bb). Complete cohesive blocks; ignore
plugin/hook noise — hooks (`Stop`/`PostToolUse`/`SubagentStop`) stay intact,
workflow adapts.

**Why:** Setup interrupted repeatedly by `workflow-drift-guard.mjs`,
`post-tool-verifier.mjs`, `subagent-tracker.mjs`, agent failures (a7915a1 /
a836bbed — 500/degraded). Without foresight backbone, state fragments across
turns.

**How to apply:** Before any edit/action: (1) `manage_context_blocks` list/get,
(2) `search_memories` keyword, (3) perform work in one cohesive block, (4)
confirm/save state, (5) ignore plugin/agent notifications — never split a
sequence. Keep hook policy unchanged (per CLAUDE.md); adapt workflow instead.
