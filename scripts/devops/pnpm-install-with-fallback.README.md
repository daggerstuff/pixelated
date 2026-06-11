# pnpm-install-with-fallback.sh

Enhanced pnpm install script with smart fallback strategies for resilient dependency installation in CI/CD environments.

## Features

- **Exponential backoff with jitter** for network resilience
- **Multiple installation strategies**:
  - Frozen lockfile (default for reproducible builds)
  - No frozen lockfile (for resolving lockfile conflicts)
  - Offline first (for air-gapped environments)
  - Supply-chain policy bypass (for handling minimum release age violations)
- **Supply-chain policy bypass** capability for handling ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION
- **Comprehensive error handling and logging**
- **Works in both CI/CD and local development environments**

## Usage

```bash
scripts/devops/pnpm-install-with-fallback.sh [options]
```

### Options

- `--no-frozen-lockfile` - Install without frozen lockfile
- `--frozen-lockfile` - Install with frozen lockfile (default)
- `--offline` - Try offline installation first

### Environment Variables

- `PNPM_INSTALL_MAX_ATTEMPTS` - Maximum number of retries (default: 3)
- `PNPM_INSTALL_RETRY_DELAY_SECONDS` - Base delay for exponential backoff in seconds (default: 2)
- `PNPM_INSTALL_ARGS` - Additional arguments to pass to pnpm install
- `PNPM_INSTALL_FORCE_NO_FROZEN_LOCKFILE` - Force no frozen lockfile strategy
- `PNPM_INSTALL_PREFER_FROZEN_LOCKFILE` - Prefer frozen lockfile strategy
- `PNPM_INSTALL_TRY_OFFLINE_FIRST` - Try offline installation first
- `PNPM_INSTALL_BYPASS_SUPPLY_CHAIN` - Bypass supply-chain policies (sets --trust-lockfile flag and NODE_OPTIONS="--no-deprecation")

## Strategies

The script tries different strategies in order based on configuration:

1. **Offline** (if PNPM_INSTALL_TRY_OFFLINE_FIRST=1)
2. **No supply-chain** (if PNPM_INSTALL_BYPASS_SUPPLY_CHAIN=1)
3. **Frozen lockfile** (default)
4. **No frozen lockfile** (fallback)

## Supply-Chain Policy Bypass

When encountering ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION errors, you can bypass supply-chain policies by:

1. Setting `PNPM_INSTALL_BYPASS_SUPPLY_CHAIN=1` environment variable
2. Using the script will automatically add `--trust-lockfile` flag and `NODE_OPTIONS="--no-deprecation"`

This is particularly useful in CI/CD environments where you want to ensure builds succeed even when packages haven't met the minimum release age requirement.

## Examples

```bash
# Basic usage (tries frozen lockfile first, then no frozen lockfile)
scripts/devops/pnpm-install-with-fallback.sh

# Force no frozen lockfile strategy
PNPM_INSTALL_FORCE_NO_FROZEN_LOCKFILE=1 scripts/devops/pnpm-install-with-fallback.sh

# Bypass supply-chain policies
PNPM_INSTALL_BYPASS_SUPPLY_CHAIN=1 scripts/devops/pnpm-install-with-fallback.sh

# Try offline first, then other strategies
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
| `PNPM_INSTALL_BYPASS_SUPPLY_CHAIN` | 0 | Bypass supply-chain policy checks with --trust-lockfile flag |

## Strategy Order

The script tries different strategies in this order:

1. **Supply Chain Bypass** (if `PNPM_INSTALL_BYPASS_SUPPLY_CHAIN=1`): `pnpm install --no-frozen-lockfile --trust-lockfile` with `NODE_OPTIONS="--no-deprecation"`
2. **Offline** (if `PNPM_INSTALL_TRY_OFFLINE_FIRST=1`): `pnpm install --offline`
3. **Frozen Lockfile** (default): `pnpm install --frozen-lockfile`
4. **No Frozen Lockfile** (fallback): `pnpm install --no-frozen-lockfile`

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
