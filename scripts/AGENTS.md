# AGENTS.md: scripts/

## PURPOSE

Automation scripts: build, deploy, CI/CD, data ETL, DevOps. Not application code.

## KEY DIRECTORIES

- `ci/` - CI pipeline steps (build, lint, security-scan)
- `deploy/` - Staging/production deployments (`staging.sh`, `production.sh`, `rollback.sh`)
- `devops/` - Dev environment setup (`setup-dev.sh`, `setup-db.sh`)
- `data/` - Data processing (export, import, transform)
- `testing/` - Test automation (`e2e.sh`, `performance.sh`, `security-tests.sh`)
- `backup/` - Backup/restore (`backup.sh`, `restore.sh`)
- `migration/` - Database migrations
- `training/` - AI training pipelines
- `utils/` - Shared utilities

## CONVENTIONS

- Bash: `#!/usr/bin/env bash`; `set -euo pipefail`; `chmod +x`
- Python: `#!/usr/bin/env python3`; use `uv run`
- Arguments: Document in header; support `--dry-run`, `--verbose`
- Secrets: Read from env vars or `.env` (gitignored); never hard-code
- Logging: `echo "[$(date)] [LEVEL] message"` to stderr
- Exit codes: `0` success, non-zero error; document non-standard

### Safe Script Pattern

```bash
#!/usr/bin/env bash
set -euo pipefail
source .env 2>/dev/null || true

if [[ "${1:-}" != "--force" ]]; then
  read -p "Destructive action. Continue? (yes/no): " c
  [[ "$c" == "yes" ]] || exit 1
fi

# Script logic
./scripts/backup/backup.sh
```

## EXECUTION

```bash
bash scripts/deploy/staging.sh
uv run python scripts/data/export.py --output data.json
```

## SECURITY

- Never commit secrets; use env vars
- Validate inputs before use
- Require confirmation/`--force` for destructive operations
- Audit log production changes

## ANTI-PATTERNS

❌ Hard-coded passwords/keys
❌ Silent failures
❌ Mixing production/test data
❌ Destructive ops without backup or confirmation
❌ Long-running scripts without progress output

---

_Generated: 2025-03-15 | Domain: Build & DevOps_
