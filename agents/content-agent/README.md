# content-agent

**Clinical Content Curation** agent for the Pixelated Empathy platform. Audits,
scores, and curates generated clinical training scenarios before they enter the
scenario library.

## What's in this slice

| Slot              | File                                                       |
| ----------------- | ---------------------------------------------------------- |
| Runtime config    | `agent/agent.ts`                                           |
| Standing rules    | `agent/instructions.md`                                    |
| Tool: audit       | `agent/tools/audit_corpus.ts`                              |
| Tool: clin audit  | `agent/tools/audit_clinical_corpus.ts`                     |
| Tool: scoring     | `agent/tools/score_thread.ts`                              |
| Tool: curation    | `agent/tools/curate_showcase.ts`                           |
| Tool: safety gate | `agent/tools/gate_injection.ts` (gated via `always()`)     |
| Sub-agent         | `agent/subagents/report-writer/{agent.ts,instructions.md}` |
| Foresight client  | `agent/foresight-client.ts`                                |

## The five tools

- **`audit_corpus`** — runs the quality audit over scenario JSON. Checks for
  clinical quality dimensions: therapeutic validity, persona consistency,
  boundary safety, PII leakage, and LLM slop.
- **`audit_clinical_corpus`** — focused audit on clinical QA datasets (JSONL)
  for therapy-specific slop and response repetition.
- **`score_thread`** — scores one scenario's quality across clinical dimensions
  (Workers AI when credentials are present; stub fallback otherwise).
- **`curate_showcase`** — picks the top N scenarios for the library, avoiding
  duplicate patterns and spanning diverse clinical presentations.
- **`gate_injection`** — the safety controller. Blocks publishing to the
  scenario library unless the last audit passed with zero blocking findings
  **and** a human approves the gate.

## Status

Generalized from the demo-qa-agent hackathon slice. Tools return structured
payloads. The gate prevents unauthorized publishing to the scenario library.

## How to develop

```sh
pnpm install --no-frozen-lockfile
pnpm dev      # eve dev server
pnpm typecheck
pnpm build
```

## Source of truth

Eve docs at `node_modules/eve/docs/` — read `agent-config.md`,
`tools/overview.mdx`, `tools/human-in-the-loop.md`, and `subagents.mdx` first.
