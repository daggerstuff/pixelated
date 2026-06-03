# START_HERE — Lean Context Bootstrap

This file defines the **default startup policy** for agent context loading in this repository.

## Goal

Keep startup context small and relevant while preserving quality.

- **Default behavior:** load only compact indexes and core governance.
- **On demand:** lazy-load full skill/rule content only when needed.
- **Avoid:** eager-loading all `.agents/skills/**/SKILL.md` or all `.agent/rules/*.md`.

---

## 1) Minimal Startup Context (always)

Load only these at startup:

1. `AGENTS.md` (repo root)
2. `.github/copilot-instructions.md`
3. `.agent/core/personality.md`
4. `.agents/skills/README.md`
5. `.agents/skills-index-compressed.json`
6. `.agent/rules-curation-kept.txt` (if present)
7. `.agents/skills-curation-kept.txt` (if present)

### Why

This gives enough policy + discovery metadata to route work without flooding context.

---

## 2) Lazy-Load Policy (skills + rules)

## Skills (lazy by task)

Use `skills-index-compressed.json` metadata first.  
Load a skill’s `SKILL.md` **only if** one of these is true:

- The task explicitly maps to that skill domain.
- The task needs concrete steps/checklists from that skill.
- The agent cannot proceed confidently with current context.

### Skill loading cap

- Initial pass: load **max 1–3** skills.
- If still ambiguous, load **1 additional** skill at a time.
- Prefer canonical/kept skills over overlapping variants.

## Rules (lazy by risk/scope)

Start with the curated canonical rule set only.  
Load additional rule files **only** when:

- Task involves security/compliance risk.
- Task involves migrations/refactors touching many files.
- Task explicitly requests deep quality checks.

### Rule loading cap

- Initial pass: load **1 primary rule** for the task.
- Optional add-on: **1–2 secondary rules** if needed.

---

## 3) Canonical Priority Order

When duplicates or overlaps exist, prefer this order:

1. **Curated canonical files** (`*-curation-kept.txt` lists)
2. Generalist high-signal guides (architecture/testing/security)
3. Narrow specialist docs only if the task clearly requires them

If two sources conflict:
- Follow `AGENTS.md` and `.github/copilot-instructions.md` first.
- Then follow curated canonical rule/skill guidance.

---

## 4) Token Budget Guardrails

- Target startup context: **< 20k tokens**
- Keep non-essential narrative/history out of startup payload
- Defer examples, long templates, and exhaustive checklists until requested

If token pressure rises:
1. Drop non-critical references first
2. Keep only active task skill/rule + core governance
3. Continue with incremental lazy loading

---

## 5) Practical Workflow

1. Bootstrap minimal startup context (Section 1).
2. Classify task domain (frontend/backend/ai/security/testing/devops/etc.).
3. Select **one** best-fit skill from `skills-index-compressed.json`.
4. Load only that skill’s `SKILL.md` via `.agent/scripts/skill_lazy_loader.py`.
5. Select **one** best-fit rule (if needed) from curated rules.
6. Execute task.
7. If blocked/uncertain, load one additional skill or rule.
8. Before final output, run concise verification against loaded guidance.

---

## 6) What Not To Do

- Do **not** load all skills at startup.
- Do **not** load all rules “just in case.”
- Do **not** keep stale loaded docs in active context when task scope changes.
- Do **not** prioritize niche overlap docs over canonical curated sources.

---

## 7) Fast Mapping Hints

Use these coarse mappings before loading docs:

- `ui/react/next/accessibility` → frontend + testing (+ wcag if needed)
- `api/backend/db/auth` → backend + database + security
- `infra/cicd/deploy/observability` → devops + performance
- `ml/agent/rag/prompt` → ai + memory/orchestration
- `bug/failure/regression` → debugging + testing + verification

Then lazy-load only the minimum needed files.

---

## 8) Maintenance Notes

When curation changes:
- Regenerate:
  - `.agents/skills-index-compressed.json`
  - `.agents/skills-index.md`
  - curation manifests (`skills-curation-*`, `rules-curation-*`)
- Keep this file aligned with current curated policy.

---

## Summary

**Load small, route fast, fetch deep only when necessary.**  
This is the default context strategy for token-efficient, high-signal execution.
