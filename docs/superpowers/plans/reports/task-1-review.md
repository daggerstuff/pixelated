# Task 1 Review — Experiment Runner Scaffold

Status: BLOCKED (1 CRITICAL, 1 MEDIUM) Plan:
docs/superpowers/plans/2026-08-09-serverless-a-b-plan.md (Task 1) Spec:
docs/superpowers/specs/2026-08-09-serverless-a-b-spec.md Commit reviewed:
9463b80ce2

## Verdict: BLOCKED until `tags` fixed

### Critical

- `TrainableModel.tags` missing (Pydantic strict). Fix: pass
  `config={'tags': ['A', f'group:{exp_id}']}` to constructor.

### Medium

- Report claims deferral to Tasks 2-6; those tasks don't include label-tracking.
  Fix tracking now (Task 1).

### Positive

- No placeholders, no secrets, file structure exact, backend signature verified.

### Fix instruction (from reviewer)

Replace `tags = ...` lines with constructor-level `config=`; re-run
`pytest ... -v -k test_ab_tags_set`; confirm PASS; update report status.
