# qa-agent (PIX-3958)

Conversation Rehearsal **Clinical Session QA & Review** agent — scores rehearsal
sessions against the clinical rubric, surfaces training gaps, and posts review
digests. Sub-agent of the broader Eve workflow. Status: **Done** (PIX-3958).

## What's here (Eve filesystem-first layout)

| Slot            | Path                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime config  | `agent/agent.ts` (`defineAgent` + Zod `outputSchema`)                                                                                      |
| Standing rules  | `agent/instructions.md`, `agent/instructions/{flagging-rules.md,report-format.md,scoring-criteria.md}`                                     |
| Tools (6)       | `agent/tools/`: `detect_emotional_patterns`, `fetch_sessions`, `flag_training_gap`, `generate_report`, `score_session`, `summarize_cohort` |
| Channels (3)    | `agent/channels/eve.ts`, `agent/channels/linear-chatops.ts`, `agent/channels/slack-supervisor-digest.ts`                                   |
| Connections (2) | `agent/connections/foresight.ts`, `agent/connections/workers-ai-mcp.ts` — `defineMcpClientConnection`, env-gated URLs                      |
| Sub-agents (2)  | `agent/subagents/report-writer/`, `agent/subagents/scoring-engine/`                                                                        |
| Hooks (1)       | `agent/hooks/qa_audit.ts`                                                                                                                  |
| Schedules (1)   | `agent/schedules/daily-review.ts` — cron `30 23 * * *` (daily QA review digest)                                                            |
| Lib             | `agent/lib/runtime-mode.ts`, `agent/lib/workers-ai.ts`, `agent/foresight-client.ts`                                                        |
| Evals           | `evals/evals.config.ts`, `evals/no-sessions.eval.ts`                                                                                       |
| K8s             | `k8s/deployment.yaml`                                                                                                                      |
| Tests           | `tests/` — 7 files (6 unit + 1 `qa-review-lifecycle.integration.test.ts`)                                                                  |

## Handoff protocol

- **→ pipeline-agent:** `flag_training_gap.ts` writes a `training_gap` memory
  with tag `handoff:pipeline`. pipeline-agent reads flagged gaps in its weekly
  schedule.

## Foresight wiring (live)

- `score_session.ts` calls
  `searchMemories({ query: 'session_id:<uuid>', limit, tag_filter: ['session_id:<uuid>'] })`,
  concatenates `memories[].content` into the scored `transcript`, and passes it
  to the Workers AI (`llama-3.2-3b-instruct`) scoring prompt. Returns
  `transcript_fetched: boolean`.
- `summarize_cohort.ts` queries a cohort `tag_filter`, parses per-session JSON
  memory content, aggregates the 5 rubric dimensions (mean / p10 / p90), and
  surfaces the top-5 gap trainees.
- `fetch_sessions.ts` reads session records from Foresight.

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

Eve docs at `node_modules/eve/docs/` — read `agent-config.md`,
`tools/overview.mdx`, `subagents.mdx`, and `schedules.mdx` first.
