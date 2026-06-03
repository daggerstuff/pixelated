# Rules Directory — Canonical Policy

This directory contains the **canonical rule set** for agent behavior in this repository.

The goal is to keep rule usage:
- **consistent**
- **low-noise**
- **token-efficient**

---

## Purpose

Rules define *how* work is executed (quality gates, risk handling, verification), while skills define *what* to do in a domain.

This README establishes:
1. The canonical rules baseline
2. A lazy-loading policy for selecting rules per task
3. Duplication handling and maintenance conventions

---

## Canonical Rule Set

Use this folder’s curated rule files as the source of truth for rule-level behavior.  
Current canonical categories include:

- architecture / planning
- migration / refactoring
- code review / verification
- debugging / performance
- security
- devops / CI/CD
- language-specific quality (Python / TypeScript)
- testing discipline

If a rule is not in the curated set, treat it as non-canonical unless explicitly promoted.

---

## Lazy-Loading Policy (Rules)

Do **not** load all rules at startup.

### Startup (default)
Load only:
1. Repository governance (`AGENTS.md`, repo instructions)
2. This file (`.agent/rules/README.md`)
3. Curated rule manifest (if present): `.agent/rules-curation-kept.txt`

### On-demand rule loading
Load a full rule file only when:
- Task risk requires it (security/compliance/data integrity)
- Task scope implies it (migration/refactor/performance tuning)
- Verification depth requires it (testing/review/release gate)

### Rule loading limits
- Initial: **1 primary rule**
- Optional: **+1 secondary rule**
- Exceptional cases: **max 3 active rules** at once

If you need more, unload irrelevant rules first.

---

## Rule Selection Heuristics

Use this quick mapping:

- **Bug fixing / regressions** → debugging + test-writing
- **Large code movement** → code-migration or refactoring
- **Security-sensitive changes** → security-audit (+ verification gate)
- **Infra/deploy/CI changes** → devops-cicd (+ cloud if relevant)
- **Architecture decisions** → strong-reasoner-planner / llm-architect
- **Language-heavy edits** → python-pro or typescript-pro

Pick the most general canonical rule first, then specialize only if needed.

---

## Duplication and Conflict Policy

When rules overlap:

1. Prefer canonical curated rule files.
2. Prefer higher-signal general rules over narrow variants.
3. Avoid stacking multiple rules that restate the same constraints.
4. If two rules conflict:
   - Follow repo governance first (`AGENTS.md`, repo instructions)
   - Then follow canonical rule intent with least-risk interpretation
   - Document the choice in task notes/PR description

---

## Token Efficiency Guidelines

- Keep active rules minimal for the current task.
- Avoid loading long examples/templates until needed.
- Summarize rule intent into a short local checklist before execution.
- Re-load only when task scope changes materially.

Target: high-signal, low-context overhead.

---

## Suggested Operational Flow

1. Bootstrap minimal governance context.
2. Classify task type and risk.
3. Load one best-fit canonical rule.
4. Execute work.
5. If blocked or risk increases, load one additional rule.
6. Verify and finalize.
7. Drop unused rule context before moving to a new task type.

---

## Curation Artifacts

When available, these files define rule curation state:

- `.agent/rules-curation-kept.txt`
- `.agent/rules-curation-removed.txt`
- `.agent/rules-curation-report.json`

Use these to understand what is canonical vs deprecated.

---

## Maintenance

When rules are added/removed/consolidated:

1. Update curation artifacts
2. Ensure this README remains aligned with selection policy
3. Keep naming and scope clear (one rule, one core responsibility)
4. Remove obsolete duplicates instead of accumulating aliases

---

## Summary

**Default behavior:** load minimal governance + this README.  
**Then:** lazy-load only the most relevant canonical rule(s).  
**Result:** lower token usage, cleaner decisions, and more consistent execution quality.