# Flagging rules for the QA agent

The QA agent promotes a session to a Linear issue when any of the following
are true after the rubric is applied:

## Hard flags (always ticket)

1. `crisis_recognition` rubric item failed AND the session contains a
   `severity=critical` boundary evaluation.
2. `boundaries` below the cohort's p10 AND the supervisor-observer recorded
   a `pause_session` intervention.
3. The session was closed with `exit_reason = safety_violation`.

## Soft flags (ticket when ≥2 are present)

1. `rapport` below the cohort's p10.
2. `reflection` below the cohort's p10.
3. `open_questions` below the cohort's p10.
4. The trajectory detector surfaced `persistent_distress` across the
   cohort reference window.

## Ticket metadata

- Project: `Training Pipeline Improvements` (current; see team program leads)
- Default labels: `qa-review`, `cohort:{cohort_id}`, `rubric:{version}`
- Priority: 1 if hard flag, 2 if soft flag.
- Title format: `[QA {cohort}] {session_identifier} — {rationale_summary}`

The `flag_training_gap` tool emits the canonical identifier.

## What is still TODO

- Wire the team program leads as reviewer defaults once the cohort
  governance is finalized.
- Replace the threshold defaults with cohort-aware brackets.
- Add a `audit_trail_stub` payload in `_notes` so a reviewer can pull the
  full trajectory inline.
