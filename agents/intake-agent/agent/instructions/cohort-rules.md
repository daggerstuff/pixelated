# Cohort Rules

## Cohort Model

Cohorts are defined by BOTH time windows AND skill levels:

- **Time-based**: Named by quarter (e.g. "2026-Q3") with start/end dates.
- **Skill-level**: One of BEGINNER, INTERMEDIATE, ADVANCED.
- A cohort is uniquely identified by `name:skill_level` (e.g.
  "2026-Q3:INTERMEDIATE").

## Cohort States

- `UPCOMING` — enrollment open, not yet started.
- `ACTIVE` — sessions in progress.
- `COMPLETED` — all curriculum content delivered.

## Assignment Rules

- A trainee may only be in one ACTIVE cohort at a time.
- A trainee may appear in multiple COMPLETED cohorts (longitudinal tracking).
- Reassigning a trainee: create a new assignment record. Never delete the old
  one.

## Curriculum

- Each cohort has a `curriculum_id` referencing a curriculum definition.
- Curriculum progress is tracked per-trainee, not per-cohort, so trainees in the
  same cohort may progress at different speeds.
