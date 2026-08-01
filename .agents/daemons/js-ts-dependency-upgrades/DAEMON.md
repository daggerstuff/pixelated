---
id: js-ts-dependency-upgrades
purpose: Keep JavaScript and TypeScript dependencies current with low-noise grouped upgrade pull requests.
routines:
  - Scan the configured manifests and lockfile for available JavaScript and TypeScript dependency updates.
  - Identify safe patch and minor dependency upgrades, grouped by runtime and development dependency type.
  - Create or update focused dependency upgrade pull requests with verification evidence and clear rollback notes.
deny:
  - Do not auto-merge dependency pull requests.
  - Do not perform major-version upgrades.
  - Do not use --latest or update dependencies beyond their existing manifest range and patch/minor boundary.
  - Do not change dependency range style, package manager, registry configuration, or workspace layout.
  - Do not change pnpm-workspace.yaml, overrides, or the minimum-release-age policy.
  - Do not make broad refactors or unrelated code changes while fixing upgrade fallout.
  - Do not run package-manager commands outside the configured outdated scan, update, install, and verification commands.
schedule: '0 8 * * 1'
---

# JavaScript/TypeScript Dependency Update Maintainer

## Configuration

Use these repository-specific values:

- Package manager: `pnpm@11.18.0`
- Dependency manifests:
  - `package.json`
  - `business-strategy-cms/package.json`
  - `packages/*/package.json`
  - `tests/integration/package.json`
- Lockfile: `pnpm-lock.yaml`
- Outdated scan: `pnpm outdated --recursive`
- Runtime dependency update: `pnpm update --recursive --prod <selected-package-names>`
- Development dependency update: `pnpm update --recursive --dev <selected-package-names>`
- Install or lockfile refresh: `PNPM_CONFIG_TRUST_LOCKFILE=true pnpm install --no-frozen-lockfile`
- Verification:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test:unit`
- Target branch: `staging`
- Runtime dependency branch: `chore/deps-runtime-minor-patch`
- Development dependency branch: `chore/deps-dev-minor-patch`
- Runtime dependency title: `chore(deps): update production patch/minor dependencies`
- Development dependency title: `chore(deps-dev): update development patch/minor dependencies`
- Pull request labels: `dependencies`, `pnpm`

## Update policy

Default scope:

- patch and minor updates only
- runtime dependencies and development dependencies in separate pull requests
- retain existing manifest ranges; do not use `--latest`
- no package manager migration
- no registry or workspace layout changes
- preserve `pnpm-workspace.yaml`, overrides, and the minimum-release-age policy

Major upgrades are out of scope.

Run the configured outdated scan before choosing updates. Select no more than 20 packages for a dependency bucket before invoking its update command.

Replace `<selected-package-names>` only with that reviewed package list; it is a command argument description, not repository setup configuration.

## PR policy

Create or update at most two pull requests per run:

1. runtime dependency patch/minor updates
2. development dependency patch/minor updates

Use the configured branch and title for each dependency bucket.

Before opening or updating a pull request, search all open pull requests for the same dependency bucket regardless of whether the author is a human, Dependabot, or Charlie.

Reuse or no-op for overlapping work instead of creating a duplicate.

Target `staging` and apply the `dependencies` and `pnpm` labels.

Each PR body must include:

- configured package manager
- packages updated
- dependency type bucket
- install command run
- verification commands run
- failures, skipped packages, and follow-ups

## Verification and freshness

Before modifying files, re-read `staging` and search existing branches and all open pull requests to avoid duplicate work.

After applying updates:

1. run the configured install or lockfile refresh command
2. run the configured verification commands
3. inspect the diff to confirm it only contains dependency update changes and minimal lockfile changes

If verification fails and the fix is not a small dependency-related adjustment, leave the pull request as draft or stop with a concise handoff note.

Do not broaden into feature or refactor work.

## Limits

- Max open pull requests created or updated per run: 2
- Max packages selected before each update command and per grouped pull request: 20
- No changes outside dependency manifests, lockfiles, and minimal generated dependency metadata unless the pull request is explicitly marked draft with rationale

## No-op when

- no patch or minor upgrades are available
- verification cannot be run safely
- an existing pull request by any author already covers the same dependency bucket and does not need an update
