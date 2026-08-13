# session-agent (PIX-3957)

Conversation Rehearsal **Session Orchestrator** agent — the user-facing durable
backend agent in Pixelated Empathy's Eve workflow. Status: **Done** (PIX-3957).

## What's here (Eve filesystem-first layout)

| Slot            | Path                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime config  | `agent/agent.ts` (`defineAgent` + Zod `outputSchema`: session states `NEW / RECOVERING / AWAITING_SUPERVISOR / CLOSING / CLOSED`, `emotion`, `clinical.boundary_passed`, `persistent_notes`)                                                      |
| Standing rules  | `agent/instructions.md`, `agent/instructions/clinical-rules.md`, `agent/instructions/session-flow.md`                                                                                                                                             |
| Tools (9)       | `agent/tools/`: `analyze_emotion`, `analyze_pace`, `check_clinical_boundary`, `conclude_session`, `hydrate_session`, `process_message`, `save_session`, `start_session`, `validate_response`                                                      |
| Channels (2)    | `agent/channels/eve.ts`, `agent/channels/http.ts` (`/eve/v1/health` + session middleware)                                                                                                                                                         |
| Connections (3) | `agent/connections/foresight.ts`, `agent/connections/memory-mcp.ts`, `agent/connections/workers-ai-mcp.ts` — all `defineMcpClientConnection` with env-gated URLs (`process.env.FORESIGHT_URL ?? 'http://127.0.0.1:8764/mcp'`)                     |
| Sub-agents (2)  | `agent/subagents/emotion-analyzer/`, `agent/subagents/supervisor-observer/`                                                                                                                                                                       |
| Hooks (1)       | `agent/hooks/pii_scrubber.ts` (logs-only scrubber on `message.completed`)                                                                                                                                                                         |
| Lib             | `agent/lib/process-shutdown.ts`, `agent/lib/workers-ai.ts`, `agent/foresight-client.ts` (SSEClientTransport → `/sse`)                                                                                                                             |
| Evals           | `evals/evals.config.ts`, `evals/smoke.eval.ts`, `evals/boundary_flag.eval.ts`                                                                                                                                                                     |
| K8s             | `k8s/deployment.yaml` (`session-agent` + `session-agent-mc`; startupProbe/readiness/liveness at `/eve/v1/health`; secret `cloudflare-workers-ai`; env `FORESIGHT_URL=http://foresight:8765`, `PIXELATED_SESSION_MCP_URL=http://session-mcp:8766`) |
| Tests           | `tests/` — 10 files (9 unit + 1 `session-lifecycle.integration.test.ts`)                                                                                                                                                                          |

## Foresight transport

Foresight MCP is wired over **HTTP/SSE** via `agent/foresight-client.ts`
(`SSEClientTransport` to `${FORESIGHT_URL ?? 'http://127.0.0.1:8764/mcp'}`). It
exposes `storeMemory` / `searchMemories` and is used for session hydration and
persistent notes. Connection config lives in `agent/connections/foresight.ts`.

## Handoff protocol

- **→ qa-agent:** `conclude_session.ts` writes session end event to Foresight
  with tag `handoff:qa`. qa-agent's daily schedule picks up sessions requiring
  review.

## Notes / non-gaps

- **No schedule is defined for this agent** — the parent ticket (PIX-3957) does
  not require one (unlike qa-agent's daily review and pipeline-agent's weekly
  train). This is intentional, not a gap.
- `pii_scrubber` hook is a logs-only stub by design (no mutation of the event
  payload) — see `agent/hooks/pii_scrubber.ts`.

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
