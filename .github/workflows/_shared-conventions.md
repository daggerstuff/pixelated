# Shared GH Actions Workflow Conventions

This file documents cross-cutting patterns used in multiple workflows
under `.github/workflows/`. Reference it from comments in the workflows
so the rationale lives in one place.

## GH_TOKEN \u2014 variable name mismatch

`gh` CLI checks **`$GH_TOKEN`** (NOT `$GITHUB_TOKEN`) for auth. Without
`GH_TOKEN` set, `gh release view / download`, `gh api`, etc. exit with:

> gh: To use GitHub CLI in a GitHub Actions workflow, set the
>     GH_TOKEN environment variable.

GitHub Actions DOES auto-inject `$GITHUB_TOKEN` into every step, but
`gh` does not consume it. So when calling `gh` (or `curl -H
"Authorization: Bearer $GH_TOKEN"` to api.github.com), declare
`GH_TOKEN` explicitly.

When using `curl -H "Authorization: Bearer ${VAR}" ...`:

- If the bash script references `$GH_TOKEN`, declare `GH_TOKEN:` in the
  step's (or job's) `env:` block. Map it to `${{ secrets.GITHUB_TOKEN }}`.
- Same for `$GITHUB_TOKEN` if that's the literal name in bash.

## GH_TOKEN at job level \u2014 single source of truth

Set `GH_TOKEN` at the **job-level `env:` block**, NOT per-step.

Why:

- Job-level `env:` propagates to every step in the job automatically.
- Adding a new step that uses `gh release` / `gh api` later inherits
  the token without remembering the per-step pattern.
- Future maintainers reading the file don't have to grep for which
  step needs the env block.

Anti-pattern: per-step `env: GH_TOKEN: ...` blocks. The deploy-civo
cleanup commit `c9f8e15e7` removed exactly this duplication.

## Cross-references

| Workflow | Where the convention applies |
|---|---|
| `deploy-civo.yml` | `deploy-civo` job \u2014 env block above the steps |
| `update-civo-cli-pin.yml` | `check-and-update` job \u2014 env block above the steps |

Both files comment on the env block with a one-line pointer to this
document. Future workflows that need GitHub API auth should follow the
same pattern: job-level `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
