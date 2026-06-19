# session-agent (PIX-3957)

Conversation Rehearsal **Session Orchestrator** agent. The user-facing agent
in Pixelated Empathy's Eve workflow.

## What's in this slice

| Slot                 | File                                                                                |
| -------------------- | ----------------------------------------------------------------------------------- |
| Runtime config       | `agent/agent.ts`                                                                    |
| Standing rules       | `agent/instructions.md`, `agent/instructions/clinical-rules.md`, `agent/instructions/session-flow.md` |
| Tool: lifecycle      | `agent/tools/start_session.ts`                                                      |
| Tool: turn ingest    | `agent/tools/process_message.ts`                                                    |
| Channel (HTTP)       | `agent/channels/http.ts`                                                            |
| Sub-agent (emotion)  | `agent/subagents/emotion-analyzer/{agent.ts,instructions.md}`                       |
| Connection slot      | `agent/connections/foresight.ts`                                                    |
| Connection slot      | `agent/connections/memory-mcp.ts`                                                   |

## Status

Vertical slice. Both connection slots ship as `defineMcpClientConnection` with
either a placeholder URL or an env-gated URL. They build cleanly but only the
`FORESIGHT_MCP_URL`-prefixed branch will attempt to resolve.

## Not yet wired

- Foresight MCP over HTTP/SSE (current server is stdio).
- Mongo-backed session-mcp.
- Express middleware integration in the existing Express backend (referenced
  by ticket PIX-3969).
- K8s deploy manifest (ticket PIX-3984 not authored here).
- The remaining 9 tools from the ticket list.

## How to develop

```sh
pnpm install --no-frozen-lockfile
pnpm dev
pnpm typecheck
pnpm build
```

## Source of truth

Eve docs at `node_modules/eve/docs/`. Start with `connections.mdx` if you wire
the Foresight transport.
