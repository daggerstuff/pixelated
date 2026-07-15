# pipeline-agent (PIX-3959)

Training Pipeline **Orchestrator** agent — manages dataset curation through
production promotion of Pixelated Empathy models, with human approval gates at
every stage transition. Status: **Done** (PIX-3959).

## What's here (Eve filesystem-first layout)

| Slot            | Path                                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime config  | `agent/agent.ts` (`defineAgent` + Zod `outputSchema`)                                                                                                                                                |
| Standing rules  | `agent/instructions.md`, `agent/instructions/{state-machine.md,promotion-policy.md}`                                                                                                                 |
| Tools (7)       | `agent/tools/`: `check_pipeline_health`, `curate_dataset`, `promote_to_production`, `promote_to_staging`, `rollback_model`, `run_evaluation` (gated via `always()`), `run_training`                  |
| Channels (4)    | `agent/channels/eve.ts`, `agent/channels/slack.ts`, `agent/channels/slack-events.ts`, `agent/channels/linear.ts`                                                                                     |
| Connections (4) | `agent/connections/foresight.ts`, `agent/connections/k8s-mcp.ts`, `agent/connections/training-infra-mcp.ts`, `agent/connections/workers-ai-mcp.ts` — all `defineMcpClientConnection`, env-gated URLs |
| Sub-agents (1)  | `agent/subagents/evaluator/`                                                                                                                                                                         |
| Hooks (1)       | `agent/hooks/pipeline_audit.ts`                                                                                                                                                                      |
| Schedules (1)   | `agent/schedules/weekly-train.ts` — cron `0 9 * * 1` (Monday 09:00 UTC: infra health check + curation)                                                                                               |
| Lib             | `agent/lib/runtime-mode.ts`, `agent/lib/workers-ai.ts`, `agent/foresight-client.ts`                                                                                                                  |
| Evals           | `evals/evals.config.ts`, `evals/health-check.eval.ts`                                                                                                                                                |
| K8s             | `k8s/deployment.yaml`                                                                                                                                                                                |
| Tests           | `tests/` — **7 files / 13 tests** (unit per tool + `pipeline-lifecycle.integration.test.ts`) — added this cycle                                                                                      |

## Foresight wiring (live)

- `promote_to_staging.ts` derives a `model_card_hash` (sha256 of
  `model_uri:image_tag`), reads rehearsal + QA provenance via
  `searchMemories`, and writes a `training_provenance` record with
  `storeMemory` (category `training_provenance`, importance `0.9`). Returns
  `_provenance_stored`.
- `check_pipeline_health.ts` reads live system status via `getSystemStatus()`.

## How to develop

```sh
pnpm install --no-frozen-lockfile
pnpm dev        # eve dev server
pnpm typecheck  # tsgo
pnpm test       # vitest
pnpm build      # eve build
pnpm lint       # oxlint
```

## Source of truth

Eve docs at `node_modules/eve/docs/` — read `agents-approval.md`,
`schedules.mdx`, `tools/human-in-the-loop.md`, and `evals/overview.mdx` first.
