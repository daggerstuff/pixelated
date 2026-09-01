# Shared GH Actions Workflow Conventions

This file documents cross-cutting patterns used in multiple workflows under
`.github/workflows/`. Reference it from comments in the workflows so the
rationale lives in one place.

## GH_TOKEN variable name mismatch

`gh` CLI checks **`$GH_TOKEN`** (NOT `$GITHUB_TOKEN`) for auth. Without
`GH_TOKEN` set, `gh release view / download`, `gh api`, etc. exit with:

> gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN
> environment variable.

GitHub Actions DOES auto-inject `$GITHUB_TOKEN` into every step, but `gh` does
not consume it. So when calling `gh` (or
`curl -H "Authorization: Bearer $GH_TOKEN"` to api.github.com), declare
`GH_TOKEN` explicitly.

When using `curl -H "Authorization: Bearer ${VAR}" ...`:

- If the bash script references `$GH_TOKEN`, declare `GH_TOKEN:` in the step's
  (or job's) `env:` block. Map it to `${{ secrets.GITHUB_TOKEN }}`.
- Same for `$GITHUB_TOKEN` if that's the literal name in bash.

## GH_TOKEN at job level, single source of truth

Set `GH_TOKEN` at the **job-level `env:` block**, NOT per-step.

Why:

- Job-level `env:` propagates to every step in the job automatically.
- Adding a new step that uses `gh release` / `gh api` later inherits the token
  without remembering the per-step pattern.
- Future maintainers reading the file don't have to grep for which step needs
  the env block.

Anti-pattern: per-step `env: GH_TOKEN: ...` blocks (each step duplicating the
same env declaration). Search git history for the original removal commit if you
want the diff that introduced the job-level pattern.

## WORKFLOW_PAT secret for editing workflow files

GitHub's default `GITHUB_TOKEN` cannot authorize pushes that modify files under
`.github/workflows/`. Such pushes fail with:

> refusing to allow a GitHub App to create or update workflow `.yml` without
> workflows permission

To create PRs that edit workflow files (e.g., `update-kubectl-pin.yml`
auto-bumping a kubectl pin, or `update-civo-cli-pin.yml` auto-bumping a Civo CLI
pin), the workflow's `peter-evans/create-pull-request` step must authenticate
with a Personal Access Token (PAT) that has the **`workflow`** scope.

The convention name: `WORKFLOW_PAT` (uppercase, snake_case) -- registered as a
repo secret in Settings -> Secrets and variables -> Actions.

Setup (one-time, by a repo admin):

1. github.com -> Settings -> Developer settings -> Personal access tokens ->
   Tokens (classic) -> Generate new token -> scope: `workflow`. Recommended:
   fine-grained PAT scoped to _this single repo_ with an expiry, OR a GitHub App
   with Workflows: Read & Write -- both are safer than a classic PAT scoped to
   the whole account.
2. Repo -> Settings -> Secrets and variables -> Actions -> New repository secret
   -> name: `WORKFLOW_PAT`, value: <paste token>.

The pre-flight check validates the token in two stages:

1. **Presence**: `[[ -z "$WORKFLOW_PAT" ]]` -- aborts early if the secret is
   unset. Uses `env:` mapping (not `${{ }}` template expansion) to avoid
   leaking the token into logs.
2. **Validity**: `curl -sf -o /dev/null -w '%{http_code}' -H "Authorization:
   token $WORKFLOW_PAT" https://api.github.com/user` -- confirms the token is
   not expired or revoked. A non-200 response sets `has_pat=false` and emits a
   warning, so the job exits cleanly instead of falling through to
   `peter-evans/create-pull-request` where the bad token causes a cryptic
   `fatal: could not read Username for 'https://github.com'` (ENXIO on the
   interactive git prompt in a TTY-less CI runner).

Until `WORKFLOW_PAT` is configured and valid, the Create Pull Request step is
skipped with a pre-flight warning pointing at the `permissions:` block of the
caller workflow. The workflow registers as success so CI dashboards don't show
a red run for an unconfigured-repo or expired-token state.

## Cross-references

| Workflow                  | Convention   | Where the convention applies                        |
| ------------------------- | ------------ | --------------------------------------------------- |
| `deploy-civo.yml`         | GH_TOKEN     | `deploy-civo` job -- env block above the steps      |
| `update-civo-cli-pin.yml` | GH_TOKEN     | `check-and-update` job -- env block above the steps |
| `update-civo-cli-pin.yml` | WORKFLOW_PAT | `permissions:` block at the top of the file         |
| `update-kubectl-pin.yml`  | WORKFLOW_PAT | `permissions:` block at the top of the file         |

Workflows following the GH_TOKEN convention comment the env block with a
one-line pointer to this document's GH_TOKEN section. Workflows following the
WORKFLOW_PAT convention comment the permissions block with a one-line pointer to
this document's WORKFLOW_PAT section. New workflows that need GitHub API auth,
OR that open PRs editing other workflow files, should follow the same pattern.

## Naming conventions

All workflow-level convention names in this repository use **uppercase,
snake_case**: `GH_TOKEN`, `WORKFLOW_PAT`. This is a convention, not a YAML or
GitHub requirement. Follow it when adding a new cross-workflow secret or env var
so the cross-references table remains internally consistent. Specifically:

- The constant name is **all-caps** (matching shell/secret convention).
- Words are separated by underscores (`_`), not hyphens (`-`).
- The secret name registered in Settings > Secrets and variables > Actions is
  the **same value**. The YAML key in `permissions:` or `env:` blocks, the
  inline comment pointing to this document, and the heading used in
  `_shared-conventions.md` all mirror that value exactly.

If a future workflow needs a different secret for a different GitHub-scope
reason, keep the pattern: pick a new all-caps name, register the repo secret
under it, and add a `## <NAME>` section in this document with the rationale.

## Trigger and path filter convention

Every workflow's `on:` triggers should follow a consistent taxonomy:

### Branch targeting

| Target    | Convention           | Use case                                  |
| --------- | -------------------- | ----------------------------------------- |
| `staging` | push + pull_request  | Development branch — most CI runs here    |
| `main`    | push only            | Production branch — deploy workflows only |
| `master`  | Avoid (legacy alias) | Migrate to `main` or `staging`            |

### Trigger types

| Trigger             | Convention                                         | When to use                  |
| ------------------- | -------------------------------------------------- | ---------------------------- |
| `push`              | Always pair with `branches: [staging]` (or higher) | Run on commits to the branch |
| `pull_request`      | Pair with `branches: [staging]`                    | Validate PRs before merge    |
| `workflow_dispatch` | Include on all workflows                           | Enable manual re-runs        |
| `schedule`          | Cron string only                                   | Periodic maintenance tasks   |

### Path filter rules

1. **Expensive workflows MUST have `paths:`** — any workflow running 15+ minutes
   (Docker builds, Playwright, browser tests, security scans that build the app)
   should restrict to source paths that actually trigger it.
2. **Include the workflow's own YAML** — always add the workflow file itself
   (`.github/workflows/<name>.yml`) so edits to the trigger config re-trigger.
3. **Include dependency files** — add `package.json` and `pnpm-lock.yaml` when
   the workflow runs install or build steps.
4. **Security scans are exempt** — `security.yml` intentionally has no path
   filters to catch supply-chain attacks regardless of what changed.
5. **Bitbucket path conditions** — use Bitbucket-native
   `changesets.includePaths` on per-step conditions (already applied to AI
   validation steps).

### Example

```yaml
on:
  push:
    branches: [staging]
    paths:
      - 'src/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
      - '.github/workflows/my-workflow.yml'
  pull_request:
    branches: [staging]
    paths:
      - 'src/**'
      - '.github/workflows/my-workflow.yml'
  workflow_dispatch:
```
