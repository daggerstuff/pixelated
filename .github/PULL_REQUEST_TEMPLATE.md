<!-- PR checklist for Pixelated Empathy. Delete sections that do not apply. -->

## Summary

<!-- What changed and why. One or two sentences. -->

## Clinical / privacy impact

<!-- This is a mental-health platform: state explicitly if the change touches
     PHI, therapeutic gating, consent, crisis flows, or data retention.
     "None" is an acceptable answer. -->

- [ ] No PHI or sensitive data introduced in code, tests, fixtures, or logs.

## Validation

<!-- What real checks did you run? Commands + result. Do not claim checks you
     did not run. -->

- [ ] `pnpm lint` (oxlint type-aware)
- [ ] Relevant tests executed (list the suite and result)

## Type-safety and suppression policy

- [ ] No `@ts-ignore`, `@ts-nocheck`, `# noqa`, `# type: ignore`, or eslint
      disables added anywhere.

## Quality baselines

<!-- If this PR intentionally grows a pinned baseline (complexity, duplication,
     file size, tech-debt, version drift), say which and why, and that it was
     re-pinned via the sanctioned `-- --update` path. -->

- [ ] No pinned baseline regresses (CI Quality workflow reports this).
