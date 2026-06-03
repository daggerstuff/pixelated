---
name: git-push
description: >
  Intelligently groups, stages, commits, and pushes all 4 repos in the
  Pixelated workspace (ai, docs, foresight-mcp submodules first, then main).
  Semantic grouping auto-generates commit messages by file type/area. Use when
  you want to commit and push all pending changes across the monorepo.
  Trigger: /git:push or "commit and push everything" or "sync all repos".
allowed-tools: Bash,Read
---

# Git Push — Smart Multi-Repo Commit & Push

## Purpose

Commits and pushes all 4 Pixelated repos with intelligent semantic grouping:
1. Processes **submodules first** (`ai`, `docs`, `foresight-mcp`)
2. Updates submodule pointers in the **main repo** (`pixelated`)
3. Pushes **each repo to all of its configured remotes**

## When to Activate

This skill is triggered when the user says any of:
- `/git:push`
- "commit and push everything"
- "sync all repos"
- "push all changes"
- "smart commit"
- "commit everything across all repos"

## Arguments (optional)

The user may optionally provide:
- `--dry-run` — show what would be committed without making any changes
- `--message "..."` or `-m "..."` — override auto-generated commit message for all repos

## Execution Protocol

### Step 1 — Confirm Intent

Before running, briefly confirm with the user what you are about to do:
- How many files have changed (per repo)
- Which remotes will be pushed to

Avoid asking for permission if the intent is clear from the user's message.

### Step 2 — Run the Script

Execute the smart commit and push script:

```bash
bash /home/vivi/pixelated/scripts/git/smart-commit-push.sh [ARGS]
```

Pass any user-provided flags directly (e.g., `--dry-run`, `--message "..."`).

### Step 3 — Report Outcome

After the script completes:
- List each repo and the commit message used
- List which remotes were pushed to (and flag any that failed)
- If any push failed, explain the likely cause and suggest remediation

### Step 4 — Handle Errors

If any step fails:
- Report the specific error to the user
- Do NOT silently suppress or retry with `--force` without asking
- For push failures, suggest: `git pull --rebase <remote> <branch>` first

## Important Rules

- **Never** add `@ts-ignore`, `# noqa`, or other suppression comments
- **Never** modify lockfiles or CI configs as part of this workflow
- **Always** respect the submodule commit order: subs before main
- **Do not** commit `scratch/`, `aws/`, or `tests/results/` directories
