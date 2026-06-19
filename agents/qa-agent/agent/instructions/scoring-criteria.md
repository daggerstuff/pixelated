# Scoring criteria for the QA agent

The QA agent scores each completed rehearsal session on the rubric below.
Each dimension is a 0.0-1.0 score. Per-dimension pass thresholds are
written by the program leads and pinned at deploy time.

## Current rubric dimensions (placeholder)

| Dimension        | What it measures                                           |
| ---------------- | ---------------------------------------------------------- |
| rapport          | Warmth, eye-contact-equivalent acknowledgements            |
| open_questions   | Did the trainee ask open vs. closed questions              |
| reflection       | Mirrored the participant's content accurately              |
| boundaries       | Stayed inside the scenario role                            |
| crisis_recognition | Crisis prompt appears when severity==critical             |

The scoring-engine sub-agent (`agent/subagents/scoring-engine/agent.ts`)
emits one row per dimension in its structured output, with a short
evidence span. It never sees PII.

## What is still TODO

- Lock the rubric to a published version. Today's placeholder will be
  promoted to `rubric_version = "2026.Q3.Starter"`.
- Add cohort-aware normative brackets (pass threshold = mean - 1 SD).
- Replace the heuristic placeholder detectors with calls into the
  programmatic scorers in `ai/training/evals/`.
