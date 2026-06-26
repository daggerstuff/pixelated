# Pipeline state machine

```
[Dataset Curation] -> [Gate 1] -> [Training Launch] -> [Training Monitor]
    -> [Gate 2] -> [Evaluation] -> [Evaluator Review] -> [Gate 3]
    -> [Staging Deploy] -> [Smoke Test] -> [Gate 4]
    -> [Production Deploy] -> [Monitor] -> [Closed]
```

## Transitions

| From                | To               | Trigger                                |
| ------------------- | ---------------- | -------------------------------------- |
| (any)               | `HOLD`           | `hold`                                 |
| `HOLD`              | (previous state) | `resume`                               |
| (any)               | `FAILED`         | tool error after retries exhausted     |
| `FAILED`            | (previous state) | `fail` — only on operator confirmation |
| (any post-_Gate N_) | (one step prior) | `rollback` from any post-gate state    |
| Production Deploy   | `[Closed]`       | monitoring window expires              |

## State machine invariants

- A state transition emits exactly one Linear-compatible event with the
  `pipeline_event` shape defined in agent/connections/**, regardless of tool
  success.
- Approval gates (`Gate 1` ... `Gate 4`) only resolve via the linked Slack
  button, Linked Linear reaction, or scheduler-timeout auto-decline. The
  pipeline never auto-approves.
- A `rollback` from a state that has not yet crossed a gate is invalid — the
  orchestrator replies asking the operator to use `hold` instead.

## Sub-state: `Training Monitor`

Monitors an in-flight training job by polling the training-infra MCP. Emits a
`training_progress` event every 5 minutes. If the job falls behind its expected
loss curve for more than 30 minutes, escalates to the operator via Slack and
pauses until acknowledged.

## Sub-state: `Smoke Test`

Runs the canonical smoke model against the staging deployment. Records the
latency, error rate, and a behavioral sanity-check on a fixed prompt bank. A
failure escalates and rolls back to the staging previous-good state.

## Sub-state: `Monitor` (post-production)

Runs for the configurable monitoring window (default 4 hours). Records the same
smoke battery on the production deployment. Auto-transitions to `[Closed]` on
window expiry with a "monitoring_ok" event.

## Still TODO

- Replace placeholder gate reviewers with the actual cohort leads when
  governance is finalized.
- Replace placeholder smoke-test prompts with the program's golden set.
