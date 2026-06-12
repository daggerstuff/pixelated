# pnpm-install-with-fallback.sh

A robust utility script for installing dependencies with smart fallback strategies to handle lockfile issues in CI/CD environments.

## Features

- **Retry Logic**: Implements exponential backoff with jitter to handle transient network issues
- **Multiple Strategies**: Tries different pnpm install approaches in order of preference
- **Configurable**: Adjustable retry attempts, delay timing, and install arguments
- **Environment Aware**: Works differently in CI/CD vs local development environments

## Usage

```bash
# Basic usage
chmod +x scripts/devops/pnpm-install-with-fallback.sh
scripts/devops/pnpm-install-with-fallback.sh

# With custom arguments
PNPM_INSTALL_ARGS="--prod --ignore-scripts" scripts/devops/pnpm-install-with-fallback.sh

# Force no-frozen-lockfile strategy
PNPM_INSTALL_FORCE_NO_FROZEN_LOCKFILE=1 scripts/devops/pnpm-install-with-fallback.sh

# Prefer frozen-lockfile but fallback to no-frozen-lockfile (default behavior)
scripts/devops/pnpm-install-with-fallback.sh

# Try offline first, then frozen-lockfile, then no-frozen-lockfile
PNPM_INSTALL_TRY_OFFLINE_FIRST=1 scripts/devops/pnpm-install-with-fallback.sh
```

## Configuration

The script can be configured using environment variables:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PNPM_INSTALL_MAX_ATTEMPTS` | 3 | Maximum retry attempts per strategy |
| `PNPM_INSTALL_RETRY_DELAY_SECONDS` | 2 | Base delay between retries (exponential backoff) |
| `PNPM_INSTALL_ARGS` | "" | Additional arguments to pass to pnpm install |
| `PNPM_INSTALL_FORCE_NO_FROZEN_LOCKFILE` | 0 | Force using --no-frozen-lockfile strategy only |
| `PNPM_INSTALL_PREFER_FROZEN_LOCKFILE` | 0 | Prefer frozen-lockfile but fallback to no-frozen-lockfile |
| `PNPM_INSTALL_TRY_OFFLINE_FIRST` | 0 | Try --offline first before other strategies |

## Strategies

The script tries different strategies in this order:

1. **Offline** (if `PNPM_INSTALL_TRY_OFFLINE_FIRST=1`): `pnpm install --offline`
2. **Frozen Lockfile** (default): `pnpm install --frozen-lockfile`
3. **No Frozen Lockfile** (fallback): `pnpm install --no-frozen-lockfile`

## Exit Codes

- `0`: Success - Dependencies installed successfully
- `1`: Failure - Unable to install dependencies with any strategy

## Integration Examples

### Dockerfile
```dockerfile
COPY scripts/devops/pnpm-install-with-fallback.sh /tmp/pnpm-install-with-fallback.sh
RUN chmod +x /tmp/pnpm-install-with-fallback.sh && \
    PNPM_INSTALL_ARGS="--prod --ignore-scripts" /tmp/pnpm-install-with-fallback.sh && \
    rm /tmp/pnpm-install-with-fallback.sh
```

### CI/CD Pipeline
```yaml
script:
  - chmod +x scripts/devops/pnpm-install-with-fallback.sh
  - PNPM_INSTALL_ARGS="" scripts/devops/pnpm-install-with-fallback.sh
```

### Shell Script
```bash
chmod +x scripts/devops/pnpm-install-with-fallback.sh
scripts/devops/pnpm-install-with-fallback.sh
```
