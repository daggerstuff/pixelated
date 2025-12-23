---
name: session-cleanup-organization
description: Organize files during development and clean up temporary artifacts after user-confirmed task completion - prevents accumulation of one-off scripts, redundant READMEs, and temporary markdown files
---

# Session Cleanup & Organization

## Overview

Maintain clean workspace by organizing files during development and cleaning up temporary artifacts after user-confirmed task completion.

**Core principle:** Organize as you go, track cleanup candidates, **PROACTIVELY clean up obvious one-time scripts/docs after task completion**.

**CRITICAL: One-Time Script Cleanup**
- **After a task/job is done, IMMEDIATELY identify and delete one-time use scripts and docs**
- **If a script/doc was created for a single task and that task is complete, DELETE IT**
- **Don't keep "one-time use type shit" around - pitch them after the task is done**
- **Examples of obvious one-time scripts**: `create_k8s_json.py` (generates connection files once), migration scripts, one-off data processing scripts, temporary setup scripts
- **If unsure, ask user - but err on the side of cleanup for clearly one-time scripts**

**Announce at start:** "Using session-cleanup-organization to organize files and track cleanup candidates."

## File Organization Rules

### Documentation Files (README, Markdown)

**During Development:**
- **Task-specific documentation**: Place in `docs/<task-name>/` subfolder
  - Example: For "journal-dataset-research" task → `docs/journal-dataset-research/`
  - Example: For "bias-detection" task → `docs/bias-detection/`
  - All documents related to a specific task go in its subfolder
- **Permanent cross-project documentation**: Place in `docs/` organized by purpose/category
  - Kubernetes: `docs/kubernetes/`
  - Deployment: `docs/deployment/`
  - API: `docs/api/`
  - Infrastructure: `docs/infrastructure/`
- **One-off summaries/reports**: Place in `docs/<task-name>/.temp/` or mark with `_temp.md` suffix
- **NEVER** create READMEs in root unless absolutely necessary for project onboarding
- **NEVER** create markdown files in root for task-specific information
- **NEVER** dump all task docs into generic `docs/` - always use task-specific subfolders

**When to Create Documentation:**
- ✅ Long-term reference material (API docs, architecture, deployment guides)
- ✅ User-facing documentation (setup guides, usage instructions)
- ✅ Task-specific documentation (place in `docs/<task-name>/` subfolder)
- ❌ Task summaries that duplicate git history (use git commits instead)
- ❌ Implementation logs (use git history instead)
- ❌ Temporary notes (use memory/ByteRover instead)

**If information exists in shell/git:**
- ❌ DON'T create a markdown file - the info is already tracked
- ✅ Use `git log`, `git show`, or shell history instead

### Shell Scripts

**During Development - IMMEDIATE Organization Required:**

**CRITICAL RULES - NEVER VIOLATE:**
- **NEVER create multiple versions of the same file** (no `-v2`, `-fixed`, `-new`, `-updated` suffixes)
- **REWRITE the existing file** instead of creating a new version
- **If a script needs changes, edit the original file directly**
- **Delete duplicate versions immediately** if accidentally created
- **One file, one purpose** - if you need different functionality, create a differently named file with clear purpose

**When creating ANY script, immediately:**
1. **Identify script purpose** and categorize:
   - Infrastructure/Deployment: `scripts/infrastructure/`
   - Testing: `scripts/testing/`
   - Content/Blog: `scripts/content/`
   - Utilities: `scripts/utils/`
   - One-off/Temporary: `scripts/.temp/` or mark with `_temp.sh` suffix
2. **Check if similar script exists** - if yes, REWRITE it instead of creating new version
3. **Create script in correct location** - NEVER in root
4. **If script needs documentation**, create it alongside:
   - README: `scripts/<category>/README.md` (if category-level)
   - Or: `docs/<task-name>/<script-name>.md` (if task-specific)
   - **NEVER** create standalone READMEs in root for scripts
5. **Mark one-off scripts clearly**:
   - Use `_temp.sh` suffix or place in `scripts/.temp/`
   - Add comment header: `# TEMPORARY: One-off script for <task> - Remove after <task> completion`
   - Include creation date and purpose

**Script Organization Structure:**
```
scripts/
├── infrastructure/      # Infrastructure & deployment scripts
│   ├── deploy.sh
│   ├── health-check.sh
│   └── cluster-management.sh
├── testing/            # Testing & validation scripts
│   ├── test-runner.sh
│   ├── benchmark.sh
│   └── health-endpoints-test.sh
├── content/            # Content & blog management
│   ├── blog-cli.js
│   ├── schedule-posts.js
│   └── optimize-images.mjs
├── utils/              # Utility scripts
│   ├── security-audit.sh
│   ├── tag-manager.js
│   └── network-check.sh
├── backup/             # Backup scripts (existing)
├── deploy/             # Deployment scripts (existing)
├── dev/                # Development scripts (existing)
├── lib/                # Library scripts (existing)
├── performance/        # Performance scripts (existing)
├── research/           # Research scripts (existing)
├── visualization/      # Visualization scripts (existing)
└── .temp/              # Temporary one-off scripts (cleaned up)
```

**One-off Scripts with Documentation:**
- **Script**: `scripts/.temp/<task-name>-<purpose>.sh` (or `_temp.sh` suffix)
- **Documentation**: `docs/<task-name>/<script-name>.md` (if needed)
- **Both must be tracked** for cleanup together
- **If documentation is redundant** (info exists in git/shell), don't create it

### Temporary Files Tracking

**Track cleanup candidates during creation:**
- Mark temporary files with metadata (comments, naming conventions)
- Maintain mental list or note of temporary files created during session
- **Track script-documentation pairs together** - if you create a script with docs, track both
- Categorize by:
  1. **One-off scripts** (single use, can be deleted)
  2. **Script documentation** (READMEs/markdown for one-off scripts)
  3. **Task summaries** (markdown files with task-specific info)
  4. **Temporary configs** (test configs, local overrides)

**When creating one-off script with documentation:**
```
Created files:
- scripts/.temp/cluster-optimization.sh (TEMPORARY)
- docs/cluster-optimization/cluster-optimization-script.md (TEMPORARY)
→ Track both for cleanup together
```

## Cleanup Process

### Step 1: Track During Development

**When creating files - IMMEDIATE organization:**

**For scripts:**
```bash
# 1. Create script in correct location immediately
#    scripts/infrastructure/  - for infrastructure/deployment
#    scripts/testing/        - for testing/validation
#    scripts/content/        - for content/blog
#    scripts/utils/          - for utilities
#    scripts/.temp/          - for one-off/temporary

# 2. Mark temporary scripts clearly
# In script header:
# TEMPORARY: One-off script for cluster optimization - Remove after task completion
# Created: <date>
# Purpose: <brief description>
# Related docs: docs/<task-name>/<script-name>.md (if created)
```

**For script documentation:**
```markdown
<!-- If creating README/markdown for script -->
<!-- Place in: docs/<task-name>/<script-name>.md -->
<!-- Mark as temporary if script is temporary -->
<!-- TEMPORARY: Documentation for one-off script - Remove with script -->
```

**Maintain cleanup list:**
- Note files created that are temporary
- **Track script-documentation pairs together**
- Categorize: one-off script, script documentation, task summary, temp config
- Example cleanup entry:
  ```
  One-off script pair:
  - scripts/.temp/cluster-optimization.sh
  - docs/cluster-optimization/cluster-optimization-script.md
  ```

### Step 2: Identify Cleanup Candidates

**Before cleanup, identify:**
1. **One-off scripts** in `scripts/.temp/`, `scripts/` subfolders, or root
2. **Script documentation** (READMEs/markdown) for one-off scripts
3. **Task-specific markdown files** in `docs/<task-name>/` or root
4. **Temporary READMEs** created for specific tasks (in task subfolders)
5. **Test/debug files** left in workspace
6. **Empty task subfolders** in `docs/<task-name>/` after cleanup
7. **Scripts with "fixed", "cleanup", "resolve", "evaluate" in names** (often one-time)

**Patterns to look for:**
- Files with `_temp`, `_tmp`, `.temp` in name/path
- Files with dates in names (e.g., `cluster-optimization-report.md`)
- Scripts with single-use patterns (e.g., `install-kubectl-aliases.sh`)
- Scripts with one-time keywords: `-fixed.sh`, `-cleanup.sh`, `resolve-`, `evaluate-`
- **DUPLICATE VERSIONS**: Files with `-v2`, `-v3`, `-fixed`, `-new`, `-updated`, `-backup` suffixes (DELETE IMMEDIATELY)
- Markdown files that duplicate git history or shell output
- **Script-documentation pairs** - if script is temporary, check for related docs

**Check script locations:**
```bash
# Find one-off scripts
find scripts/ -name "*_temp.*" -o -name "*-fixed.*" -o -name "*-cleanup.*" -o -name "resolve-*" -o -name "evaluate-*"
find scripts/.temp/ -type f 2>/dev/null

# Find script documentation
find docs/ -name "*script*.md" -o -name "*README*.md" | grep -v node_modules
```

### Step 3: Proactive Cleanup vs. User Confirmation

**For OBVIOUS one-time scripts/docs (proactive cleanup):**
- **After task completion, immediately identify and delete:**
  - Scripts created for a single specific task (e.g., `create_k8s_json.py`, migration scripts, one-off setup scripts)
  - Documentation that was only needed during task execution
  - Temporary files clearly marked as one-time use
- **No user confirmation needed for clearly one-time scripts** - if the task is done and the script was only for that task, delete it
- **Examples**: Connection file generators, one-off migration scripts, temporary setup utilities, single-use data processors

**For ambiguous/reusable scripts (user confirmation required):**
- Scripts that might be useful later
- Documentation that could be reference material
- Files where purpose is unclear

**Present cleanup proposal for ambiguous cases:**
```
Task appears complete. Cleanup candidates identified:

One-off scripts:
- scripts/.temp/optimize-cluster-resources.sh
- scripts/utils/install-kubectl-aliases.sh
- scripts/.temp/.kubectl-aliases.sh

Script documentation (for one-off scripts):
- docs/cluster-optimization/optimize-cluster-resources.md
- docs/kubectl-aliases/README-kubectl-aliases.md

Task summaries (in task subfolders):
- docs/cluster-optimization/cluster-optimization-report.md
- docs/naming-and-scaling/naming-and-scaling-summary.md
- docs/scale-down/scale-down-completion-summary.md

Would you like me to clean these up? (yes/no)
```

**If user says no or doesn't respond:**
- Do NOT clean up
- Leave files as-is
- Track for future cleanup if user requests later

### Step 4: Execute Cleanup (After Confirmation)

**After explicit user confirmation:**

```bash
# Remove one-off scripts (from all locations)
rm scripts/.temp/optimize-cluster-resources.sh
rm scripts/utils/install-kubectl-aliases.sh
rm scripts/.temp/.kubectl-aliases.sh

# Remove script documentation (for one-off scripts)
rm docs/cluster-optimization/optimize-cluster-resources.md
rm docs/kubectl-aliases/README-kubectl-aliases.md

# Remove task summaries (from task subfolders)
rm docs/cluster-optimization/cluster-optimization-report.md
rm docs/naming-and-scaling/naming-and-scaling-summary.md
rm docs/scale-down/scale-down-completion-summary.md

# Clean up empty task subfolders
rmdir docs/cluster-optimization 2>/dev/null || true
rmdir docs/naming-and-scaling 2>/dev/null || true
rmdir docs/scale-down 2>/dev/null || true
rmdir docs/kubectl-aliases 2>/dev/null || true

# Clean up empty temp directories
rmdir scripts/.temp 2>/dev/null || true

# Verify no orphaned scripts in root
find scripts/ -maxdepth 1 -type f -name "*.sh" -o -name "*.js" -o -name "*.mjs" | while read f; do
  echo "WARNING: Script in scripts/ root: $f"
done
```

**Verify cleanup:**
```bash
# Check git status
git status --short

# Confirm no temporary files remain
find . -name "*_temp.*" -o -name "*.temp.*" | grep -v node_modules
```

## Organization Patterns

### Documentation by Purpose and Task

```
docs/
├── kubernetes/           # K8s-specific docs (cross-project)
│   ├── deployment.md
│   └── troubleshooting.md
├── deployment/           # Deployment guides (cross-project)
├── api/                  # API documentation (cross-project)
├── infrastructure/       # Infrastructure docs (cross-project)
├── journal-dataset-research/  # Task-specific folder
│   ├── research-notes.md
│   ├── findings.md
│   └── .temp/           # Temporary files for this task
├── bias-detection/       # Task-specific folder
│   ├── implementation-notes.md
│   └── test-results.md
└── <task-name>/          # Other task-specific folders
    └── <task-docs>.md
```

### Scripts by Purpose

```
scripts/
├── infrastructure/      # Infrastructure & deployment scripts
│   ├── deploy.sh
│   ├── health-check.sh
│   └── cluster-management.sh
├── testing/            # Testing & validation scripts
│   ├── test-runner.sh
│   ├── benchmark.sh
│   └── health-endpoints-test.sh
├── content/            # Content & blog management
│   ├── blog-cli.js
│   ├── schedule-posts.js
│   └── optimize-images.mjs
├── utils/              # Utility scripts
│   ├── security-audit.sh
│   ├── tag-manager.js
│   └── network-check.sh
├── backup/             # Backup scripts (existing)
├── deploy/             # Deployment scripts (existing)
├── dev/                # Development scripts (existing)
├── lib/                # Library scripts (existing)
├── performance/        # Performance scripts (existing)
├── research/           # Research scripts (existing)
├── visualization/      # Visualization scripts (existing)
└── .temp/              # Temporary one-off scripts (cleaned up)
```

## Best Practices

### Do's

✅ **Organize files as you create them**
- **For scripts**: Identify purpose and create in correct `scripts/` subfolder immediately
  - Infrastructure/Deployment → `scripts/infrastructure/`
  - Testing → `scripts/testing/`
  - Content/Blog → `scripts/content/`
  - Utilities → `scripts/utils/`
  - One-off → `scripts/.temp/` or `_temp.sh` suffix
- **For documentation**: Identify task name and create `docs/<task-name>/` subfolder
- Place task-specific documents in task subfolder immediately
- Place cross-project docs in appropriate `docs/<category>/` subdirectory
- **Track script-documentation pairs together** if both created
- Use consistent naming conventions
- Mark temporary files clearly

✅ **Track temporary files**
- Note cleanup candidates during development
- Maintain mental list or session notes

✅ **Wait for user confirmation**
- Never clean up automatically
- Present cleanup proposal
- Wait for explicit confirmation

✅ **Use git for history**
- Prefer git commits over markdown summaries
- Use git log for implementation history
- Use shell history for command references

✅ **Use memory systems for notes**
- Store temporary notes in ByteRover/memory
- Don't create markdown files for session notes
- Use memory for task-specific information

### Don'ts

❌ **Don't create redundant documentation**
- If info exists in shell/git, don't duplicate in markdown
- Don't create READMEs for one-off tasks
- Don't create summaries that duplicate git history

❌ **Don't leave files in root**
- **NEVER** create scripts in root - always use `scripts/` subfolders
- Move scripts to appropriate `scripts/` subdirectory immediately:
  - `scripts/infrastructure/` for infrastructure/deployment
  - `scripts/testing/` for testing/validation
  - `scripts/content/` for content/blog
  - `scripts/utils/` for utilities
  - `scripts/.temp/` for one-off/temporary
- Move task-specific docs to `docs/<task-name>/`
- Move cross-project docs to `docs/<category>/`
- Organize by task and purpose, not by location
- **If creating script with docs, organize both immediately**

❌ **Don't create multiple versions of files**
- **NEVER** create files with `-v2`, `-v3`, `-fixed`, `-new`, `-updated`, `-backup` suffixes
- **REWRITE the existing file** instead of creating a new version
- **If you need different functionality**, create a differently named file with clear purpose
- **Delete duplicate versions immediately** if accidentally created
- **One file, one purpose** - edit the original, don't create variants

❌ **Don't clean up automatically (except for obvious one-time scripts)**
- **DO proactively clean up obvious one-time scripts/docs after task completion**
- **DO NOT** delete files without confirmation if they might be reusable
- Never assume task is complete (wait for explicit completion signal)
- Never clean up "just in case" for ambiguous files

❌ **Don't accumulate temporary files**
- Mark temporary files clearly
- Track cleanup candidates
- Clean up after user confirmation

## Common Scenarios

### Scenario 1: One-off Script Creation

**Problem:** Created script for single task, left in root or wrong location

**Solution:**
1. **Immediately** move to `scripts/.temp/` or appropriate category folder
2. Add header comment marking as temporary:
   ```bash
   # TEMPORARY: One-off script for <task> - Remove after <task> completion
   # Created: <date>
   # Purpose: <brief description>
   ```
3. **If documentation needed**, create in `docs/<task-name>/<script-name>.md`
4. Track script-documentation pair in cleanup list
5. Clean up both script and documentation after user confirms task completion

### Scenario 2: Task Summary Markdown

**Problem:** Created markdown file with task summary

**Solution:**
1. Identify the task name (e.g., "journal-dataset-research", "bias-detection")
2. Create task-specific subfolder: `docs/<task-name>/`
3. Move all task-related documents to `docs/<task-name>/`
4. Check if information exists in git/shell
5. If redundant, mark for cleanup
6. If unique, keep in task subfolder
7. Clean up after user confirms if redundant
8. Remove empty task subfolder after cleanup

### Scenario 3: README in Root

**Problem:** Created README in root for specific task

**Solution:**
1. Identify the task name
2. Create or use task-specific subfolder: `docs/<task-name>/`
3. Move README to `docs/<task-name>/README.md` (or appropriate name)
4. Check if information belongs in existing cross-project docs
5. If temporary, mark for cleanup
6. If permanent, keep in task subfolder or move to appropriate cross-project `docs/` subdirectory
7. Update documentation index if needed

### Scenario 4: Scattered Scripts

**Problem:** Scripts created in various locations or root

**Solution:**
1. Identify script purpose and categorize:
   - Infrastructure/Deployment → `scripts/infrastructure/`
   - Testing/Validation → `scripts/testing/`
   - Content/Blog → `scripts/content/`
   - Utilities → `scripts/utils/`
   - One-off/Temporary → `scripts/.temp/`
2. Move to appropriate `scripts/` subdirectory immediately
3. If script has documentation, move/update it too
4. Update any references to script location
5. Clean up any orphaned documentation

## Integration

**Called by:**
- **finishing-a-development-branch** (Step 5) - After task completion
- **executing-plans** (Final step) - After plan execution
- **subagent-driven-development** (Completion) - After all tasks complete

**Pairs with:**
- **skill-verification-before-completion** - Verify task completion before cleanup
- **skill-finishing-a-development-branch** - Clean up after branch completion

## Red Flags

**Never:**
- Leave one-time scripts/docs around after task completion
- Assume task is complete (wait for explicit signal)
- Delete files "just in case" for ambiguous/reusable files
- Create redundant documentation
- Leave temporary files unmarked

**Always:**
- Organize files as you create them
- Mark temporary files clearly
- Track cleanup candidates
- **PROACTIVELY delete obvious one-time scripts/docs after task completion**
- Ask user for confirmation only for ambiguous/reusable files
- Verify cleanup after deletion

## Quick Reference

| File Type | Location | Cleanup Timing |
|-----------|----------|----------------|
| Permanent cross-project docs | `docs/<category>/` | Never |
| Task-specific docs | `docs/<task-name>/` | After user confirmation if temporary |
| Temporary docs | `docs/<task-name>/.temp/` or `_temp.md` | After user confirmation |
| Script documentation (one-off) | `docs/<task-name>/<script-name>.md` | After user confirmation (with script) |
| Reusable scripts | `scripts/infrastructure/`, `scripts/testing/`, `scripts/content/`, `scripts/utils/` | Never |
| One-off scripts | `scripts/.temp/` or `_temp.sh` | After user confirmation |
| Root READMEs | `docs/<task-name>/` (if task-specific) | After user confirmation if temporary |
| Task summaries | `docs/<task-name>/` | After user confirmation |

## Example Workflow

1. **During development:**
   - Identify task name: "cluster-optimization"
   - **Immediately** create script in correct location: `scripts/.temp/optimize-cluster.sh` (marked temporary)
   - Add header comment: `# TEMPORARY: One-off script for cluster optimization - Remove after task completion`
   - If documentation needed, create: `docs/cluster-optimization/optimize-cluster.md`
   - Create task subfolder: `docs/cluster-optimization/` (if doesn't exist)
   - Create summary: `docs/cluster-optimization/optimization-report.md` (if needed)
   - **Track script-documentation pair** in cleanup list together

2. **After task completion:**
   - User confirms: "Task is complete"
   - Present cleanup proposal (including script-documentation pairs and task subfolder contents)
   - User confirms: "Yes, clean up"
   - Execute cleanup:
     - Remove script: `rm scripts/.temp/optimize-cluster.sh`
     - Remove script docs: `rm docs/cluster-optimization/optimize-cluster.md`
     - Remove task summary: `rm docs/cluster-optimization/optimization-report.md`
     - Remove empty task subfolder: `rmdir docs/cluster-optimization`
     - Clean up empty temp dir: `rmdir scripts/.temp 2>/dev/null || true`
   - Verify cleanup: `find scripts/ -name "*_temp.*" -o -name "*-fixed.*"`

3. **Result:**
   - Clean workspace
   - No temporary files
   - No orphaned scripts in root
   - No empty task subfolders
   - Organized permanent files in appropriate locations
   - Script-documentation pairs cleaned up together