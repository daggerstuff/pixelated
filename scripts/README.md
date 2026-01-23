# Dependabot Alerts Script

This script queries the GitHub Dependabot alerts API for the current repository and outputs the list of alerts to `alerts.json`.

## Usage

```bash
pnpm ts-node scripts/list-dependabot-alerts.ts
```

Or if ts-node is globally available:

```bash
./scripts/list-dependabot-alerts.ts
```

## Requirements

- GitHub CLI (`gh`) installed and authenticated
- Repository with Dependabot alerts
- `ts-node` (available as dev dependency in this project)

## Output

The script will create or overwrite `alerts.json` in the repository root with the Dependabot alerts data.