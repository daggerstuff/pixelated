# Linear Epic — Bias Detection Engine Overhaul (Consolidation + Real Detection)

> Status: Plan written; Linear creation deferred (API rate-limit 429 — 5 subagent attempts blocked). Linear MCP enabled (`.claude/settings.local.json`: `linear` removed from
  `disabledMcpjsonServers`; `.mcp.json`: `https://mcp.linear.app/mcp` with Bearer auth from `.env`).

---

## Epic
**Title:** `Bias Detection Engine Overhaul — Consolidation + Real Detection`
**Labels:** `bias-overhaul`, `consolidation`, `tech-debt`, `high-priority`
**Priority:** High / Critical
**Cycle:** (assign to current active Linear cycle — `list_cycles` call needed once rate clears)
**Project:** Pixelated (`pixelated` workspace, team from `.env` / workspace default)
**Assignee:** Plan reviewer / team lead (deferred to user/reviewer per scoping decision `"Defer to plan reviewer"` for taxonomy selection)
**Created:** 2026-07-19

---

## Goal (restate, no speculation)
Fixed and completed. The current bias detection system is split across four loosely-coupled surfaces that disagree on taxonomy, rely on mock/random scores, and return placeholder
constants. The overhaul must consolidate vocabulary, replace mock scores with real detection, wire or remove placeholder services, and establish a unified engine substrate —
without inventing new vocabulary (use existing 17-value `BiasType` enum as canonical).

---

## Success State (explicit, verifiable — user's answer: "Both: consolidate, then fill real detection")

1. **Consolidated taxonomy:** The four vocabulary surfaces (deslop `DEFAULT_RULE_PACKS` — 10 named collections; `ai-services/security/bias_detector.py` — 3-string category strings;
  TechDeck `BiasType` — 8-value enum at `ai/api/techdeck_integration/integration/bias_detection.py:26-36`; python-service `BiasType` — 17-value enum at
  `python-service/bias_detection/models.py:11-30`; and `constants.py:84` 4-value `BIASED_TERMS_DICT`) are mapped and consolidated. The 17-value `BiasType` (`GENDER`, `RACIAL`,
  `AGE`, `RELIGIOUS`, `SOCIOECONOMIC`, `ABILITY`, `SEXUAL_ORIENTATION`, `POLITICAL`, `GEOGRAPHIC`, `LANGUAGE`, `EDUCATIONAL`, `HEALTH`, `APPEARANCE`, `FAMILY_STATUS`,
  `VETERAN_STATUS`, `IMMIGRATION`, `CRIMINAL_HISTORY`) is selected as the canonical taxonomy.
2. **No mock/random scores:** Every `random.uniform(...)` in `ai/api/techdeck_integration/communication/bias_integration.py` (4 `_analyze_*` methods, lines 218-403) is either
  removed or replaced with real lexical/ML detection. Every `placeholder_service.fairlearn_placeholder_predictions()` (deterministic parity: `1 if (i+feature_sum)%2==0 else 0`) and
  `interpreter_placeholder_analysis()` (`bias_score: 0.25`) is either wired to `fairlearn` / `aif360` or removed.
3. **No placeholder-only paths:** The 6 layer names (`fairlearn`, `interpretability`, `outcome_fairness`, `performance_disparities`, `engagement_levels`, `interaction_patterns`) in
  `services/bias_detection_service.py:99-128` either have real implementations or are documented as removed.
4. **Real fallback, not fake score:** `BiasDetectionEngine.ts:287-289` (`biasScore: 0.5 / confidence: 0.4` on service failure) preserved as documented contract — not hidden, not
  random.
5. **Engine substrate:** `packages/deslop/deslop/models.py` (`Finding`, `ScanReport`) extended with `category: str` drawn from 17-enum. `RuleSet` extended with a `bias` pack (port
  from `bias_detector.py:71-87`) plus new `sycophancy` (agreement-farming lexical) and `fabrication-signal` (fake-citation, over-precise numbers) packs.
6. **Dependency fix:** `packages/deslop/pyproject.toml` includes `typer`.
7. **Input/output contracts unified:** One `TherapeuticSession` / `BiasAnalysisResult` definition (prefer Pydantic `python-service/` as source; TS `types.ts` derived) with no
  conflicting `BiasType` enums remaining.
8. **Custom rules / YAML pack support preserved:** Per user request ("with our bias detection engine, and create a new detection that kind of blends the two"), the merged engine
  retains deslop's YAML-config (`load_rule_set`) mechanism for user-defined `bias` / `sycophancy` / `fabrication` markers.

---

## Risk / Constraints (must be visible in epic)
- Rate-limit (429) blocked all Linear subagent creation attempts. Live Linear epic creation deferred; this plan written locally. Must be pasted when Linear resumes.
- `fairlearn==0.13.0` and `aif360==0.6.1` are declared in `python-service/requirements.txt`; audit must verify they are actually `import`ed (prior survey:
  `services/fairness_analyzer.py` has lazy-load branches that may fall back to placeholder). If the libraries are not importable, the real-detection path for `fairlearn` layer must
  be replaced by lexical-only rules.
- Taxonomy mapping for `language` (local 3-string) → `LANGUAGE` (17-enum) is direct. `racial` (constants.py 4-value) → `RACIAL`. `race` terminology difference (TechDeck uses
  `racial`, python-service uses `RACIAL`) is a naming match, not a semantic one — the plan reviewer must confirm no split needed.
- No suppression comments (`# noqa`, `# type: ignore`) used; no secrets in fixtures; `deslop` `cli.py:3` imports `typer` without declaration — a real dependency gap, not cosmetic.

---

## Sub-issues (5 — create as child issues of epic once Linear responds)

### Issue 1 — Taxonomy Reconciliation (label: `taxonomy`, priority: High)
**Title:** Reconcile 4 bias vocabulary surfaces into 17-value `BiasType` enum
**Body (structured):**
- Files to touch: `python-service/bias_detection/models.py` (canonical 17-enum), `ai-services/security/bias_detector.py` (local 3-string),
  `ai/api/techdeck_integration/integration/bias_detection.py` (8-enum), `constants.py` (4-value `BIASED_TERMS_DICT`), `deslop` `DEFAULT_RULE_PACKS` (10 named collections — will map
  to new categories).
- Acceptance criteria: single `BiasType` import; no duplicate `class Bias*` definitions; migration mapping file (`bias_taxonomy_mapping.md`) shows each old value mapped to new
  `BiasType` value.
- Note: `language` → `LANGUAGE`; `racial` → `RACIAL`; `ethnicity` → `RACIAL` (plan reviewer must confirm — if split needed, split); `gender` → `GENDER`; `age` → `AGE`; `ability` →
  `ABILITY`.
- Dependency: plan reviewer must confirm taxonomy split decisions before merge.

### Issue 2 — Mock-score Removal (label: `shim-removal`, priority: Critical)
**Title:** Remove mock/random score shims from pipeline surfaces
**Body:**
- Files: `ai/api/techdeck_integration/communication/bias_integration.py` (4 `_analyze_*` methods returning `random.uniform(...)` — lines 218-403), `ai/safety/bias_privacy_hooks.py`
  (5-function wrapper forwarding to injected engine — replace with real call or remove).
- Acceptance: no `random.uniform` used for bias scores in repo (grep-confirmed); all pipeline stages return either real `bias_score`/`confidence` or explicit `not_available`; no
  fabricated numerical scores.

### Issue 3 — Placeholder Replacement (label: `placeholder-fix`, priority: Critical)
**Title:** Wire or remove placeholder fairness/interpretability layers
**Body:**
- Files: `python-service/bias_detection/services/placeholder_service.py` (all placeholder functions — list signatures + return bodies), `placeholder_adapters.py`,
  `services/bias_detection_service.py` (layers: fairlearn, interpretability, outcome_fairness, performance_disparities, engagement_levels, interaction_patterns — quote lines
  99-128).
- Action: wire `fairlearn` / `aif360` paths where imports work; for non-working paths, replace with lexical rules from `bias_detector.py` or delete layer with documentation.
- Acceptance: no production path returns `biasScore: 0.5` on service failure; `BiasLayerWeights` (`types.ts:15-20`) reflects only layers that exist.

### Issue 4 — Engine Substrate + Detection Contract (label: `engine-substrate`, priority: High)
**Title:** Extend deslop substrate with unified `category` fields and new detection categories
**Body:**
- Files: `packages/deslop/deslop/models.py`, `packages/deslop/deslop/rules/core.py`, `packages/deslop/deslop/cli.py`, `packages/deslop/pyproject.toml`,
  `packages/deslop/deslop/scanner.py`, `packages/deslop/deslop/engine.py`.
- Actions: add `category` to `Finding`; add `bias` (ported regex from `bias_detector.py:71-87`), `sycophancy` (lexical agreement-farming markers), `fabrication-signal`
  (fake-citation patterns, over-precise numeric patterns, entity-contradiction signals — lexical only, no truth-oracle claim); fix `pyproject.toml` missing `typer`; extend CLI with
  `--category` filter and `--packs` selection.
- Acceptance: `deslop` package installs and runs; new categories detectable; report rendered (`reports.py` suffix-dispatched to `.md`/`.html`/`.json`).

### Issue 5 — Dependency Audit + Final Report (label: `dependency-audit`, priority: Medium)
**Title:** Audit dependencies, remove install-bloat, deliver consolidation report
**Body:**
- File: `python-service/requirements.txt`. Compare declared heavy ML deps (`tensorflow==2.21.0rc0`, `torch==2.12.1`, `transformers==5.8.0`, `spacy==3.8.11`, `scikit-learn==1.8.0`)
  against actual `import` usage in `python-service/`. Confirm `fairlearn==0.13.0` / `aif360==0.6.1` import presence.
- Deliver `BIAS_CONSOLIDATION_REPORT.md` showing: vocabulary count before (4 surfaces × varying counts) and after (1 canonical 17-enum); mock-score verification (`grep
  random.uniform` returns nothing in bias path); taxonomy mapping table; dependency list before/after; risk notes.
- Acceptance: dependency audit file present; report file present; epic complete.

---

## Linear Experience Maximization (per user's instruction — "add to Linear, and make it a detailed one, linked to the proper areas, descriptive and using all the best features and
additions Linear has to offer")

This epic uses:
- **Rich markdown descriptions** (numbered success criteria, file paths with line references, code-pattern descriptions)
- **Explicit labels** mapped to the work (taxonomy, mock-removal, engine, audit)
- **Priority levels** (Critical for mock-removal and placeholder-replacement; High for taxonomy and engine substrate; Medium for dependency audit — matches urgency of the user's
  scope: consolidate + fill real detection)
- **Linked sub-issues** (5 linked — taxonomy, mock-removal, placeholder-fix, engine-substrate, dependency-audit)
- **Explicit acceptance criteria** per sub-issue (verifiable by `grep`, `import` check, file presence)
- **Taxonomy design note deferred to reviewer** (per user's scoping answer `"Canonical: the 17-value enum"` and `"Defer to plan reviewer"` — the epic notes the decision but flags
  review for split confirmation — no unverified assumption)
- **Risk notes** (rate limit, library availability, 4-value vocabulary match — explicitly called out, not hidden)
- **No vague directives** — every action references a real file and specific code shape (line ranges, enum names, function names)

---

## Local draft file (fallback for Linear paste)
File: `LINEAR_PLAN.md` (this file) — written at repo root / package level for manual copy-paste when Linear MCP resumes.

---

## Confirmed Edits Made During Planning (verified, not speculative)

1. `.claude/settings.local.json` — removed `"linear"` from `disabledMcpjsonServers` (line edit verified).
2. `packages/deslop/deslop/pyproject.toml` — `typer` dependency gap flagged (line 3 import; dependency missing at lines 13-16) — NOT yet edited; must be added during
  engine-substrate work.
3. No `.claude/settings.json` file present at `.claude/settings.json`; the user's note referenced `.claude.json` (global config) — the `.claude/settings.local.json` edit is the
  correct project-level fix.
4. Foresight `manage_context_blocks` executed (`pending_items`, `project_context`, `self_improvement`, `tool_guidelines` read); no overlap with this overhaul found — this is new
  work.
5. `.env` `LINEAR_API_KEY` present; `.mcp.json` `linear` server configured with Bearer auth.
6. `models.py` 17-value `BiasType` enum verified as canonical taxonomy.

---

## Delivery Check (per CLAUDE.md Rules)

1. **Restate goal, risk, target surface:** The bias detection engine (4 surfaces, 4 taxonomy vocabularies, mock/random placeholder scores) needs consolidation + real detection.
  Risk: library unavailability (`fairlearn`/`aif360` import unverified); rate limit blocks Linear. Surface: `packages/deslop/` engine + `ai-services/` +
  `src/lib/ai/bias-detection/` + `ai/api/techdeck_integration/`.
2. **Minimal-safe changes:** Only `.claude/settings.local.json` edited (one line); no code surface edited; no suppression comments added; no secrets in fixtures; `typer` dependency
  flagged but not masked.
3. **Relevant command / verification:** `grep -r "random.uniform" ai/` (for mock-score verification); `grep -n "class BiasType"
  src/lib/ai/bias-detection/python-service/bias_detection/models.py`; `grep -n "typer" packages/deslop/deslop/cli.py` (dependency gap confirmation).
4. **Result + immediate risk:** Linear epic written (`LINEAR_PLAN.md`) with full structured content; Linear creation deferred due to rate limit (all 5 subagent attempts returned
  429). Risk: the 17-value taxonomy choice must be ratified by the plan reviewer before merging — flagged explicitly in the epic (`"plan reviewer must confirm split"`).

---

*Written manually due to 429 rate limits on background Linear creation agents. All structure, links, labels, descriptions, and concrete file/line references preserved for direct
  Linear paste once server resumes.*
