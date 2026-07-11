# pipeline-agent (PIX-3959)

Training Pipeline **Orchestrator** agent. Manages dataset curation through
production promotion of Pixelated Empathy models, with human gates at every
stage transition.

## What's in this slice

| Slot             | File                                                   |
| ---------------- | ------------------------------------------------------ |
| Runtime config   | `agent/agent.ts`                                       |
| Standing rules   | `agent/instructions.md`                                |
| Tool: evaluation | `agent/tools/run_evaluation.ts` (gated via `always()`) |
| Channel (Slack)  | `agent/channels/slack-events.ts`                       |
| Sub-agent        | `agent/subagents/evaluator/{agent.ts,instructions.md}` |

## Status

Vertical slice. The orchestrator is parked at gate boundaries; only the
`run_evaluation` tool is wired, and only to return a structured stub.

## Not yet wired (TODOs)

- The remaining pipeline tools (curate*dataset, run_training, promote_to*\*,
  rollback_model, check_pipeline_health).
- Schedule (weekly cron) — root-only, not yet authored.
- K8s MCP connection for promotion.
- Slack approval buttons -> input response wiring.
- Linear channel for blocker tickets (separate from QA agent's chatops channel).

## How to develop

```sh
pnpm install --no-frozen-lockfile
pnpm dev
pnpm typecheck
pnpm build
```

## Source of truth

Eve docs at `node_modules/eve/docs/`. Start with `agents-approval.md`,
`schedules.mdx`, and `tools/human-in-the-loop.md`.
