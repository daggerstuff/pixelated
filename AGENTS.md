# AGENTS.md

## Project: Pixelated Empathy

## ⚠️ CRITICAL: PR Creation Rules for Jules

### RULE 1: MAXIMUM 30 FILES PER PR
- **Hard limit: 30 files maximum**
- **Ideal size: 5-15 files**
- If your change touches more than 30 files, SPLIT IT into multiple focused PRs
- **Why**: We had 60 PRs all blocked because they touched the same files

### RULE 2: DO NOT TOUCH SHARED CONFIG FILES
**NEVER modify these unless the PR is SPECIFICALLY about configuring them:**
- `.github/codeql/codeql-config.yml`
- `.github/codeql/custom-queries/qlpack.yml`
- `.github/workflows/codeql.yml`
- `.oxlintrc.json`
- `.oxfmtrc.jsonc`
- `config/vitest.config.ts`
- `package.json`
- `pnpm-lock.yaml`

**Why**: Every PR touching these files conflicts with every other PR. This created 60 blocked PRs.

### RULE 3: ONE FEATURE = ONE PR
- Each PR should implement ONE specific feature or fix
- Good examples:
  - "Optimize ChatMessage component rendering"
  - "Fix NotificationCenter keyboard accessibility"
  - "Add unit tests for bias detection"
- Bad examples (DO NOT DO):
  - "Fix everything" (300 files across 10 features)
  - "Update configs and fix UI and add tests" (mixed concerns)

### RULE 4: CHECK BEFORE CREATING
Before creating ANY PR:
1. Run: `gh pr list --repo daggerstuff/pixelated --state open`
2. If there are >5 open PRs, WAIT before creating more
3. Check if your files overlap with existing open PRs
4. If overlap exists, WAIT for those PRs to merge first

### RULE 5: DESCRIPTIVE BRANCH NAMES
Use clear branch names:
- ✅ `feature/notification-center-accessibility`
- ✅ `fix/chat-message-memoization`
- ✅ `perf/performance-optimizer-lru`
- ❌ `fix/things`
- ❌ `update/stuff`
- ❌ `chore/random`

## CONSEQUENCES

If you ignore these rules:
- **Merge conflicts**: Your PR will conflict with everything
- **Blocked PRs**: 60 PRs were created that all blocked each other
- **Lost work**: We had to abandon 59 PRs completely
- **Wasted time**: Review comments were fixed but PRs couldn't merge

## VERIFICATION CHECKLIST

Before submitting a PR, verify:
- [ ] PR touches ≤30 files
- [ ] PR does NOT modify shared config files (unless that's the feature)
- [ ] PR focuses on ONE feature/fix
- [ ] No overlapping files with existing open PRs
- [ ] Branch name is descriptive

## PROJECT CONTEXT

**Base Branch**: `staging` (NOT main)
**Tech Stack**: TypeScript, Astro, React, Node.js
**PR Target**: All PRs must target `staging` branch

## WHEN IN DOUBT

**Make the PR smaller.**

Split large changes into multiple sequential PRs:
1. First: Config/setup changes (if needed)
2. Second: Core logic changes
3. Third: Tests and documentation

Never combine unrelated changes into one PR.
