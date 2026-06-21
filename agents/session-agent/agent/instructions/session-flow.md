# Session flow

State machine for a rehearsal session. The agent's turns must always be in one of these
states. Transitions are decided by the model, executed by tools.

```
[NEW]
  -- start_session --> [ACTIVE]
  -- start_session (resume=true, session_id=...) --> [RECOVERING]

[RECOVERING]
  -- hydrate_transcript complete --> [ACTIVE]
  -- hydrate_transcript partial --> [ACTIVE] (with degraded context warning)

[ACTIVE]
  -- process_message (user turn) --> [ACTIVE]
  -- check_clinical_boundary (severity=critical) --> [AWAITING_SUPERVISOR]
  -- check_clinical_boundary (severity=warning) --> [ACTIVE]
  -- conclude_session (manual) --> [CLOSING]
  -- conclude_session (auto after N turns) --> [CLOSING]

[AWAITING_SUPERVISOR]
  -- supervisor response received --> [ACTIVE]
  -- trainee acknowledges hazard removed --> [ACTIVE]
  -- supervisor marks session unsafe --> [CLOSED]

[CLOSING]
  -- finalize persistence --> [CLOSED]

[CLOSED]
  (terminal — no further transitions)
```

## Allowed tool calls per state

| State                 | Allowed tools                                             |
| --------------------- | --------------------------------------------------------- |
| NEW                   | start_session                                             |
| RECOVERING            | (internal: hydrate_transcript)                            |
| ACTIVE                | process_message, analyze_emotion, check_clinical_boundary |
| AWAITING_SUPERVISOR   | check_clinical_boundary (resolve only)                    |
| CLOSING               | conclude_session                                          |
| CLOSED                | none                                                      |

## Compaction

The agent compacts framing (state transitions, tool summaries) but never dialogue
content. Default compaction threshold: 0.75 of the configured context window, set in
`agent.ts`. Transcript turns are stored in Foresight and replayed into the emerging
session on recovery.

## Recovery

When `start_session` is called with `resume=true` and an existing `session_id`:

1. Look up the session in the durable store (stubbed via Foresight search in this slice).
2. Replay the most recent N transcript turns before the first new turn.
3. Continue with state whatever the last persisted state said.

This slice does not implement the replay loop. `start_session` returns a stub recovery
record so the surrounding infra can verify the connection is wired correctly.

## Still TODO

- Final cause-of-state machine implementation in `state-machine.ts` (not authored here).
- Compaction summarizer prompt (separate file when authored).
- Supervisor escalation webhook (channel implementation pending).
