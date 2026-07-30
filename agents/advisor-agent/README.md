# advisor-agent

**Code Review & Engineering Advisor** agent. A critique-only senior engineering
reviewer that inspects another agent's question, source files, and working diff,
then returns scored, actionable advice without modifying files.

## What's in this slice

| Slot              | File                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Runtime config    | `agent/agent.ts`                                                                                                             |
| Standing rules    | `agent/instructions.md`                                                                                                      |
| Model             | `agent/lib/workers-ai.ts`                                                                                                    |
| Tools             | `agent/tools/get_worktree.ts`, `agent/tools/read_file.ts`                                                                    |
| Channels          | `agent/channels/eve.ts`, `agent/channels/slack.ts`, `agent/channels/slack-events.ts`, `agent/channels/linear.ts`             |
| Connections       | `agent/connections/foresight.ts`, `agent/connections/linear.ts`, `agent/connections/notion.ts` (eager)                       |
| Sub-agent         | `agent/subagents/evaluator/{agent.ts,instructions.md}`                                                                       |
| Pipeline guidance | `agent/instructions/approval-gates.md`, `agent/instructions/pipeline-states.md`, `agent/instructions/recovery-procedures.md` |
| Schedule          | `agent/schedules/weekly-train.ts`                                                                                            |
| Hook              | `agent/hooks/pipeline_audit.ts`                                                                                              |

## Status

The advisor reviews worktree state and files on demand and returns structured
critique. Now wired into pipeline-agent's promotion gates via
`evaluate_pipeline_review` — receives structured `context` payloads specifying
what's being reviewed and returns scored, actionable advice.

## Notes

- Foresight MCP is wired over HTTP/SSE via `agent/connections/foresight.ts` for
  memory-backed context.
- The agent never writes files; it only produces advice with confidence scores.
