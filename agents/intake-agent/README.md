# intake-agent

**Intake & Cohort Manager** agent for Pixelated Empathy. Onboards new clinical
trainees, manages cohort assignments, tracks curriculum progress, and surfaces
trainee status to other agents and supervisors. Status: **Phase 1 - Done**.

## What's here (Eve filesystem-first layout)

| Slot            | Path                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime config  | `agent/agent.ts` (`defineAgent` + Zod `outputSchema`: `trainee_id`, `cohort_id`, enrollment data)                                          |
| Standing rules  | `agent/instructions.md`, `agent/instructions/enrollment-flow.md`, `agent/instructions/cohort-rules.md`                                     |
| Tools (6)       | `agent/tools/`: `register_trainee`, `assign_cohort`, `list_cohorts`, `get_trainee_status`, `get_cohort_progress`, `record_curriculum_step` |
| Channels (2)    | `agent/channels/eve.ts`, `agent/channels/linear.ts`                                                                                        |
| Connections (1) | `agent/connections/foresight.ts` — `defineMcpClientConnection`, env-gated URL (`process.env.FORESIGHT_URL ?? 'http://127.0.0.1:8764/mcp'`) |
| Lib             | `agent/lib/workers-ai.ts`, `agent/foresight-client.ts` (SSEClientTransport → `/sse`)                                                       |
| Evals           | `evals/evals.config.ts`, `evals/smoke.eval.ts`                                                                                             |
| Tests           | `tests/` — 6 unit tests (one per tool)                                                                                                     |

## Tools

- **`register_trainee`** — registers a new trainee with name, email, clinical
  role, experience level, and credentials. Creates a Foresight memory record and
  returns `{ trainee_id, enrolled_at, status, enrollment_url? }`.
- **`assign_cohort`** — assigns a trainee to an existing or new cohort
  (time-based or skill-level: BEGINNER/INTERMEDIATE/ADVANCED). Creates cohort if
  `cohort_id` omitted.
- **`list_cohorts`** — queries Foresight for cohorts filtered by status
  (ACTIVE/COMPLETED/UPCOMING). Returns cohort list with size, date range,
  status.
- **`get_trainee_status`** — queries Foresight for all trainee records:
  enrollment, cohort, curriculum progress, session count, and latest scores.
- **`get_cohort_progress`** — aggregates qa-agent score records from Foresight
  across all trainees in a cohort. Returns averages by rubric dimension and
  completion rate.
- **`record_curriculum_step`** — tracks curriculum progress per trainee with
  status (COMPLETED/IN_PROGRESS/SKIPPED) and optional notes.

## Foresight wiring (live)

- All tools use `storeMemory` and `searchMemories` for CRUD on trainee profiles,
  cohort membership, and curriculum records.
- Memory tag conventions:

| Category     | Tags                                  | Example                              |
| ------------ | ------------------------------------- | ------------------------------------ |
| `trainee`    | `trainee:<id>, intake`                | `trainee:a1b2c3, intake`             |
| `cohort`     | `cohort:<id>, enrollment`             | `cohort:cohort-2026-q3, enrollment`  |
| `curriculum` | `trainee:<id>, curriculum, step:<id>` | `trainee:a1b2c3, curriculum, step:1` |
| `enrollment` | `trainee:<id>, cohort:<id>`           | `trainee:a1b2c3, cohort:cohort-2026` |

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
