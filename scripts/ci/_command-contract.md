# CI Command Contract

**Version:** 1.0  
**Date:** 2026-07-30  
**Scope:** All executable scripts in `scripts/ci/`, `scripts/devops/`  
**Governance:** Runbook — add exceptions via ADR

---

## 1. Purpose

Standardize the interface contract for every CI/DX script so they behave predictably
regardless of language (shell, Node, Python) or CI provider (GitHub Actions, Bitbucket Pipelines).
A developer or pipeline runner should be able to call any contract-compliant script without reading
its internals.

---

## 2. Shebang Convention

| Language | Shebang |
|---|---|
| Bash | `#!/usr/bin/env bash` — NOT `#!/bin/bash` (portability) |
| Node.js | `#!/usr/bin/env node` |
| Python | `#!/usr/bin/env python3` |

All scripts MUST be directly executable (`chmod +x`).  
Scripts imported as modules only (not run directly) MAY omit the shebang.

---

## 3. Exit Codes

| Code | Meaning | When |
|---|---|---|
| `0` | Success | All checks passed, all work completed |
| `1` | Failure | One or more checks failed, or operation errored |
| `2` | Internal error | Script misconfiguration, missing dependency, invalid args |

Scripts MUST exit explicitly with the appropriate code.  
Default exit code `0` is acceptable only for scripts that cannot fail (e.g., info reporters).

---

## 4. CLI Interface

### 4.1 Flag conventions (shell scripts)

Use `getopts` for simple flag parsing. Long flags require manual parsing.

```
script.sh [--flag value] [positional ...]
```

Reserved flags:

| Flag | Meaning |
|---|---|
| `--json` | Emit structured JSON output to stdout instead of human-readable |
| `--quiet` | Suppress all non-error output |
| `--help` | Print usage and exit 0 |

All flags MUST precede positional arguments.

### 4.2 Flag conventions (Node.js)

Prefer a lightweight parser (minimist, or a 10-line inline parser).  
Reserved flags same as shell. Stderr for diagnostics, stdout for data.

### 4.3 Flag conventions (Python)

Prefer `argparse`. Reserved flags same as shell.

### 4.4 Output

| Stream | Content |
|---|---|
| stdout | Primary output — the data the caller needs (JSON, file list, summary) |
| stderr | Diagnostics, progress, warnings, errors |

Never write primary output to stderr.

### 4.5 `--json` output schema

When `--json` is passed, stdout MUST be a single valid JSON object:

```json
{
  "status": "pass" | "fail" | "error",
  "summary": "Human-readable one-liner",
  "data": { ... },
  "errors": [ ... ]
}
```

`status: "pass"` → exit 0, `"fail"` → exit 1, `"error"` → exit 2.

---

## 5. Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `CI` | Any | Set to `true` when running in any CI environment |
| `GITHUB_ACTIONS` | GH-specific | Auto-set by GitHub Actions runner |
| `BITBUCKET_PIPELINES` | BB-specific | Auto-set by Bitbucket Pipelines runner |

Scripts MUST NOT require unset environment variables unless documented.  
Use `"${VAR:-default}"` patterns for optional variables with safe defaults.

---

## 6. Logging Convention

### Shell

```
echo "→ action description"    # progress
echo "✅ Success message"       # success
echo "⚠️  Warning message"      # warning
echo "❌ Error message" >&2     # fatal error
```

Prefix human-readable lines with a single emoji + space.  
Use `>&2` for error lines unconditionally.

### Node.js

```
console.log("→ action description")      // progress
console.log("✅ Success message")         // success
console.error("❌ Error message")         // fatal error
```

### Python

```
logger.info("action description")
logger.warning("warning message")
logger.error("error message")
```

---

## 7. Error Handling

| Language | Required |
|---|---|
| Bash | `set -euo pipefail` at top of every shell script |
| Node.js | Handle promise rejections; use `process.exit(1)` on failure |
| Python | Handle exceptions; avoid bare `except:` |

Every script MUST handle the case where a dependency (binary, file, network target) is missing and print a helpful error message.

---

## 8. Project Root Resolution

All scripts MUST resolve the project root consistently.  
Do not assume `cwd` is the project root — it may be a subdirectory.

### Shell

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"   # from scripts/ci/
```

Adjust the relative path based on script depth.  
Store in a variable named `PROJECT_ROOT` (uppercase).

### Node.js

```js
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')     // from scripts/ci/
```

### Python

```python
from pathlib import Path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent              # from scripts/ci/
```

---

## 9. Header Comment

Every script MUST have a header comment (first non-shebang lines):

```bash
# scripts/ci/script-name.sh
#
# One-line purpose.
# Detailed description if needed.
#
# Usage: script-name.sh [--flag value] [positional...]
# Exit codes:
#   0 — success
#   1 — failure condition X
```

Node/Python scripts use their language's comment style but the same structure.

---

## 10. Compliance

| Check | How |
|---|---|
| Shebang | `head -1 <script>` matches §2 |
| Exit codes | `eval <script>; echo $?` matches §3 |
| `set -euo pipefail` | Present in all shell scripts |
| Header | First lines match §9 |
| `--help` | Emits usage and exits 0 |
| `--json` (if applicable) | Emits valid JSON matching §4.5 |
| Project root | Uses `PROJECT_ROOT` resolution from §8 |

---

## 11. Exceptions

Scripts exempt from this contract (grandfathered or inherently one-off):

- `ci-ops-dashboard.py` — interactive TUI, not a pipeline step
- `docker-entrypoint.js` — Docker ENTRYPOINT, different interface contract
- `strict-mode-progress.json` — data file, not a script

New scripts MUST comply with this contract. Exemptions require an ADR.
