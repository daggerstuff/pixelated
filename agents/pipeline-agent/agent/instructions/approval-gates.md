# Approval gates

## Gate 1 — Post Dataset Curation

Default approver: the data governance lead (placeholder: `data-lead`). Slack
channel: `training-pipeline`. Linear: no ticket required; the gate is
Slack-only.

## Gate 2 — Post Training

Default approver: any of the program's training reviewers (placed in priority
order). Slack channel: `training-pipeline`. Linear: the orchestrator creates a
ticket in `Training Pipeline Improvements` for human ratification on the
comparative loss curves.

## Gate 3 — Post Evaluation

Default approver: any of the program's evaluation reviewers. The evaluator
sub-agent must finish before the gate opens.

## Gate 4 — Pre Production Deploy

Default approver: any of the program's release managers. Both Slack and Linear
are wired; the Linear reaction on the release ticket counts as approval if the
operator has not yet pressed the Slack button.

## Common rules

- Approvals are bound to the agent session id; replaying a session reopens gates
  if any remain unresolved.
- Gates time out after 24 hours and auto-decline with a notification, the
  operator can extend up to 7 days once per gate.
- All gate resolutions log a Linear-compatible `pipeline_event` with the gate id
  and reviewer id.
