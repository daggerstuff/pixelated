# supervisor-agent

**Clinical Supervisor Oversight** agent for Pixelated Empathy. Answers ad-hoc
queries across session and QA data, compares cohorts and trainees, adjusts
thresholds, flags sessions, and posts findings to Slack and Linear. Status:
**Phase 1 - Done**.

## What's here (Eve filesystem-first layout)

| Slot            | Path                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime config  | `agent/agent.ts` (`defineAgent` + Zod `outputSchema`)                                                                                                                                                   |
| Standing rules  | `agent/instructions.md`                                                                                                                                                                                 |
| Tools (8)       | `agent/tools/`: `query_cohort_trends`, `compare_trainees`, `list_flagged_sessions`, `generate_supervisor_report`, `query_trainee_timeline`, `adjust_threshold`, `adjust_trainee_status`, `notify_slack` |
| Channels (3)    | `agent/channels/eve.ts`, `agent/channels/slack.ts`, `agent/channels/linear.ts`                                                                                                                          |
| Connections (1) | `agent/connections/foresight.ts` — `defineMcpClientConnection`, env-gated URL (`process.env.FORESIGHT_URL ?? 'http://127.0.0.1:8764/sse'`)                                                              |
| Lib             | `agent/lib/workers-ai.ts`, `agent/foresight-client.ts` (SSEClientTransport → `/sse`)                                                                                                                    |
| Evals           | `evals/evals.config.ts`, `evals/smoke.eval.ts`                                                                                                                                                          |
| Tests           | `tests/` — 8 unit tests (one per tool)                                                                                                                                                                  |

## Tools

- **`query_cohort_trends`** — aggregates qa-agent score records from Foresight
  over a time range to surface trend direction per rubric dimension.
- **`compare_trainees`** — side-by-side comparison of trainees across rubric
  dimensions. Returns scores, ranking, and session counts.
- **`list_flagged_sessions`** — queries Foresight for sessions with boundary
  flags or escalations, filterable by severity (warning/critical) and status
  (OPEN/RESOLVED).
- **`generate_supervisor_report`** — composes a supervisor-facing report with
  cohort or time-range scope. Sections include aggregated scores, trends,
  flagged sessions, and gap trainees.
- **`query_trainee_timeline`** — builds a chronological timeline of a single
  trainee's journey: sessions, scores, flags, and curriculum steps.
- **`adjust_threshold`** — adjusts clinical scoring thresholds (boundary
  sensitivity, emotional intensity) within supervisor authority.
- **`adjust_trainee_status`** — pauses, resumes, or modifies a trainee's status
  (e.g., flag for review, graduation hold).
- **`notify_slack`** — posts supervisor findings, reports, or alerts to a Slack
  channel.

## Scope boundaries

The supervisor-agent reads across data produced by other agents:

- Does **not** conduct rehearsal sessions — that belongs to session-agent.
- Does **not** score individual sessions — that belongs to qa-agent.
- Does **not** manage the training pipeline — that belongs to pipeline-agent.
- Does **not** handle enrollment or cohort assignment — that belongs to intake-agent.
- **Can** adjust thresholds, pause/resume trainees, and update cohort assignments.

## Foresight wiring (live)

- Query tools read session scores, flags, and trainee records from Foresight
  using `searchMemories` with `tag_filter` and `time_range` parameters.
- `adjust_threshold` and `adjust_trainee_status` write supervisor actions to
  Foresight for audit trail.

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
`tools/overview.mdx`, `connections.mdx`, and `evals/overview.mdx` first.
