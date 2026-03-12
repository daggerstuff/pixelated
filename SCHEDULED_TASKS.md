# Jules Scheduled Task Replacement Prompts

## Overview

Replacement prompts for Palette, Bolt, and Sentinel agents to prevent 300-file PR chaos.

## Critical Rules

- **MAX 30 files per PR** (hard limit)
- **Check open PRs first** (`gh pr list --state open`)
- **Skip if >5 open PRs exist**
- **Never touch shared config files**
- **ONE focused change per PR**

## Shared Config Files - NEVER MODIFY

- `.github/codeql/codeql-config.yml`
- `.github/codeql/custom-queries/qlpack.yml`
- `.github/workflows/codeql.yml`
- `.oxlintrc.json`, `.oxfmtrc.jsonc`
- `config/vitest.config.ts`
- `package.json`, `pnpm-lock.yaml`

---

## 🎨 PALETTE (Accessibility)

**Task:** Fix ONE accessibility issue in ONE component.

**Workflow:**
1. Check open PRs: `gh pr list --state open | wc -l`
2. If >5: STOP and report "Skipped"
3. Find ONE component with issues
4. Fix only that component (max 15 lines)
5. Verify: `git diff --stat` (must be <30 files)

**PR Format:**
- Title: `a11y: Fix [issue] in [component]`
- Branch: `a11y/[component]-[issue]-[id]`
- Max 3 files changed

**Forbidden:** Multiple components, new deps, config changes

---

## ⚡ BOLT (Performance)

**Task:** Optimize ONE component with ONE technique.

**Allowed Techniques:**
- useMemo for expensive calculations
- useCallback for event handlers
- React.memo for pure components
- Lazy loading for heavy components

**Workflow:**
1. Check open PRs (>5 = skip)
2. Analyze ONE component
3. Apply ONE optimization
4. Verify <30 files changed

**PR Format:**
- Title: `perf: Optimize [component] with [technique]`
- Branch: `perf/[component]-[technique]-[id]`
- Max 5 files changed

---

## 🛡️ SENTINEL (Security)

**Task:** Fix ONE vulnerability in ONE location.

**Scan for:**
- Unsanitized user input
- Missing auth checks
- XSS vulnerabilities
- Missing rate limiting

**Workflow:**
1. Check open PRs (>5 = skip)
2. Identify ONE vulnerability
3. Apply minimal fix
4. Verify <30 files changed

**PR Format:**
- Title: `security: Fix [vulnerability] in [file]`
- Branch: `security/[vuln]-[file]-[id]`
- Max 3 files changed

---

## Auto-Abort Conditions

- >30 files changed
- Touches shared config files
- >5 open PRs exist
- Cannot complete in single focused change

## Implementation

1. Go to https://jules.google.com
2. Select daggerstuff/pixelated
3. **Delete** existing 3 scheduled tasks
4. **Create 3 new** with these prompts
5. Set frequency to **Weekly** (not Daily)
