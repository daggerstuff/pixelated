# Greptile — Pixelated Empathy

AI PR reviews via the Greptile GitHub App, configured by this folder.
`.greptile/` takes precedence over a root `greptile.json` and over dashboard defaults.

## Files

| File | Purpose |
| --- | --- |
| [config.json](config.json) | Strictness 2, `logic`+`syntax` only (no style nitpicks), auto-review on open+push, no drafts, `staging` base, skips `dependencies`/`automated` PRs and `dependabot[bot]`, structured rules with severity |
| [rules.md](rules.md) | Prose rules: HIPAA/PHI, anti-suppression, tenant isolation/RLS, async/error handling, secrets |
| [files.json](files.json) | Context files the reviewer reads (`AGENTS.md`, `SECURITY.md`, `THREAT_MODEL.md`, `.coderabbit.yaml`) |

Aligned with the sibling reviewers already in this repo: [.coderabbit.yaml](../.coderabbit.yaml), [cubic.yaml](../cubic.yaml), [.pr_agent.toml](../.pr_agent.toml).

## CLI (installed)

```bash
curl -fsSL https://greptile.com/cli/install | bash   # installed v3.8.0 via Homebrew (greptileai/tap)
greptile --version
greptile login          # OAuth, interactive — required once per device
greptile whoami
greptile init --json    # check/enable this repo in your Greptile org (admin, OAuth only)
greptile config         # resolved config for this repo (needs login)
greptile review         # local review of current branch vs staging, before pushing
greptile review --branch staging --json
```

CI/headless alternative: `export GREPTILE_API_KEY=...` then `greptile review`. Never commit the key.

## GitHub PR integration (one-time, browser — cannot be done from CLI/gh)

Greptile reviews PRs through its GitHub App, not a GitHub Actions workflow. No workflow YAML is needed or added.

1. Go to [app.greptile.com](https://app.greptile.com) and sign in with GitHub.
2. Install/connect the Greptile GitHub App for `daggerstuff/pixelated` (repo admin required; grant this repo only).
3. Enable `daggerstuff/pixelated` in Greptile and confirm the base branch is `staging`.
4. Open a test PR to `staging`: Greptile should auto-review on open and on push, post a summary + confidence score, and add a status check.
5. Manual triggers on any PR: comment `@greptile` (optionally with instructions, e.g. `@greptile focus on HIPAA`), or re-request review.

Verify after install:

```bash
gh api repos/daggerstuff/pixelated/pulls/<PR>/reviews --jq '.[].user.login'   # expect greptile[bot]
greptile init --json                                                          # expect enabled/connected
```

## Notes

- Config changes only affect new reviews; existing PR reviews are not re-run automatically.
- `ai/`, `foresight/`, `docs/` are submodules (separate repos) — ignored here; configure Greptile in those repos separately if wanted.
