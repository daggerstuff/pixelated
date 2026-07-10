# demo-qa-agent (Hackathon Demo Corpus QA)

**Demo Corpus QA & Curation** agent for the Pixelated Empathy hackathon investor
demo (Richard's pitch). A vertical-slice Eve agent that hardens the synthetic
email/chat corpus **before** it is rehearsed and injected into a real Gmail /
Google Chat workspace.

This agent is purpose-built for the hackathon task in `../hackathon/`. It is NOT
a clinical agent — no patient data, no HIPAA surface. It mirrors the `qa-agent`
(PIX-3958) scaffolding and borrows `pipeline-agent`'s human-in- the-loop
`always()` gate for the one destructive action: live injection.

## What's in this slice

| Slot              | File                                                       |
| ----------------- | ---------------------------------------------------------- |
| Runtime config    | `agent/agent.ts`                                           |
| Standing rules    | `agent/instructions.md`                                    |
| Tool: audit       | `agent/tools/audit_corpus.ts`                              |
| Tool: scoring     | `agent/tools/score_thread.ts`                              |
| Tool: curation    | `agent/tools/curate_showcase.ts`                           |
| Tool: safety gate | `agent/tools/gate_injection.ts` (gated via `always()`)     |
| Sub-agent         | `agent/subagents/report-writer/{agent.ts,instructions.md}` |
| Foresight client  | `agent/foresight-client.ts`                                |

## The four tools

- **`audit_corpus`** — runs the fragility audit over the corpus JSON and returns
  structured findings. Checks the five demo-breaking classes: duplicate
  subjects, LLM slop, forbidden emoji in persona voices (Chad, Marcus, Dr.
  Elias, Julian), near-duplicate "echo" replies (30–50% overlap), and threaded
  referential integrity.
- **`score_thread`** — scores one thread's demo-readiness (Workers AI when
  credentials are present; stub fallback otherwise).
- **`curate_showcase`** — picks the N demo-ready threads (default 15) per the
  battle plan, avoiding duplicate subjects and spanning distinct personas.
- **`gate_injection`** — the safety controller. Blocks `push_to_gmail.py` /
  `push_to_chat.py` unless the last audit passed with zero blocking findings
  **and** a human approves the gate. It never executes the push scripts itself.

## Status

Vertical slice. Tools return structured payloads (no live injection, no real
Foresight writes in the default path). The destructive push scripts live in
`../hackathon/` and are only ever invoked through the human-gated
`gate_injection` verdict — never directly by this agent.

## WARNING

Never run `push_to_gmail.py` or `push_to_chat.py` during a demo. Those scripts
write ~830 messages into a real workspace. The gate exists precisely to keep
that blast radius behind an explicit approval.

## How to develop

```sh
pnpm install --no-frozen-lockfile
pnpm dev      # eve dev server
pnpm typecheck
pnpm build
```

## Source of truth

Eve docs at `node_modules/eve/docs/` — read `agent-config.md`,
`tools/overview.mdx`, `tools/human-in-the-loop.md`, and `subagents.mdx` first if
you touch this directory for the first time.
