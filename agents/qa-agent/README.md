# qa-agent (PIX-3958)

Conversation Rehearsal **Clinical Session QA & Review** agent. Sub-agent of the
broader Eve workflow but a separable Node/TypeScript app under the Pixelated
Empathy monorepo.

## What's in this slice

| Slot                 | File                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| Runtime config       | `agent/agent.ts`                                                                      |
| Standing rules       | `agent/instructions.md`                                                               |
| Tool: scoring        | `agent/tools/score_session.ts`                                                        |
| Channel (Linear)     | `agent/channels/linear-chatops.ts`                                                    |
| Sub-agent            | `agent/subagents/report-writer/{agent.ts,instructions.md}`                            |
| Default eve channel  | `agent/channels/eve.ts` (auto-generated)                                              |

## Status

Vertical slice — enough to stand up the agent and verify the scaffolding pattern.

Tool returns structure-only payloads (no real Foresight or Mongo writes).

## Not yet wired (TODOs)

- `score_session` does not yet fetch the session record from Foresight.
- The report-writer sub-agent has no tool surface yet — it runs on the agent
  vertex only.
- Cohort aggregation (`tools/summarize_cohort.ts`) and gap-filing
  (`tools/flag_training_gap.ts`) are stubbed in the ticket but not authored
  here.

## How to develop

```sh
pnpm install --no-frozen-lockfile
pnpm dev     # eve dev server
pnpm typecheck
pnpm build
```

## Source of truth

Eve docs at `node_modules/eve/docs/` — read `agent-config.md`, `tools/overview.mdx`,
and `subagents.mdx` first if you touch this directory for the first time.
