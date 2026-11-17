# AI PR Reviewers — Pixelated Empathy

Three AI reviewers are configured for `daggerstuff/pixelated` (base branch: `staging`).
All three review PRs through their GitHub Apps — there is no GitHub Actions workflow for any of them.
Keep their instructions aligned: HIPAA/PHI, anti-suppression, tenant isolation/RLS, async error handling, no style/formatting nitpicks, never suggest `tsc`/`astro check` (OOM; type-aware `oxlint` instead).

| Reviewer | Repo config | Local CLI | GitHub trigger |
| --- | --- | --- | --- |
| Greptile | [.greptile/config.json](../.greptile/config.json), [rules.md](../.greptile/rules.md), [files.json](../.greptile/files.json) | `greptile review` | Auto on open/push; `@greptile` comment |
| CodeRabbit | [.coderabbit.yaml](../.coderabbit.yaml) | `coderabbit review` / `cr review` | Auto on open/push; `@coderabbitai review` comment |
| Cubic | [cubic.yaml](../cubic.yaml) (read only from `staging`) | `cubic review` | Auto on open/push; `@cubic-dev-ai review this PR` comment |

## CLIs (installed on this machine)

```bash
# CodeRabbit 0.9.5 -> ~/.local/bin/coderabbit (alias: cr)
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
coderabbit --version && coderabbit doctor
coderabbit auth login            # browser OAuth, interactive
coderabbit auth status
coderabbit review                # tracked local changes
coderabbit review --agent        # structured findings for coding agents

# Cubic 1.14.2 -> ~/.cubic/bin/cubic (installer added it to ~/.zshrc; open a new shell)
curl -fsSL https://cubic.dev/install | bash
cubic --version
cubic auth login                 # browser OAuth, interactive (or: cubic, then sign in)
cubic auth list
cubic review                     # uncommitted changes
cubic review -b                  # branch vs its base; --base staging to be explicit

# Greptile 3.8.0 (previous setup)
greptile login && greptile init --json && greptile review
```

CI/headless: use each vendor's API-key env var instead of browser login; never commit keys.

## GitHub PR integration (one-time, browser — cannot be done from CLI/gh)

Current `gh` auth (`repo`, `read:org`) cannot install GitHub Apps, and all three CLIs are signed out on this machine. A repo admin must do each of these once:

1. **CodeRabbit:** install the CodeRabbit GitHub App on `daggerstuff/pixelated` from [app.coderabbit.ai](https://app.coderabbit.ai) (sign in with GitHub, grant this repo only), then run `coderabbit auth login` locally.
2. **Cubic:** sign up at [cubic.dev/sign-up](https://cubic.dev/sign-up) with GitHub and install the cubic GitHub App on `daggerstuff/pixelated`, then run `cubic auth login` locally. Note: `cubic.yaml` is only read from the default branch, so merge config changes to `staging` before expecting them to apply.
3. **Greptile:** see [.greptile/README.md](../.greptile/README.md).

Verify each after install (expect the bot in the list):

```bash
gh api repos/daggerstuff/pixelated/pulls/<PR>/reviews --jq '.[].user.login'
# coderabbitai[bot] / cubic-dev-ai[bot] / greptile[bot]
coderabbit auth status; cubic auth list; greptile whoami
```

Config changes only affect new reviews. Submodules (`ai/`, `foresight/`, `docs/`) are separate repos — install/configure each app there separately if wanted.
