# CodeQL configuration

Static analysis for JavaScript/TypeScript and Python lives under this directory.
The workflow that runs it is **`.github/workflows/security-deep.yml`** (`codeql-analysis`
job). Treat that workflow as the source of truth for triggers, matrix languages, build
steps, and SARIF upload.

## Files here

| Path | Role |
| ---- | ---- |
| `codeql-config.yml` | Query filters, included/excluded paths, custom query packs |
| `custom-queries/` | Healthcare- and FHIR-focused CodeQL queries |

## Local / manual runs

Use the same config file path as CI:

```bash
# After installing the CodeQL CLI — see GitHub docs for setup.
codeql database create codeql-db --language=javascript-typescript \
  --source-root="$PWD" --command="pnpm build"
codeql database analyze codeql-db .github/codeql/codeql-config.yml \
  --format=sarif-latest --output=codeql-results.sarif
```

For suppressions and accepted-risk tracking, see `.github/security/vulnerability-suppression.md`.
