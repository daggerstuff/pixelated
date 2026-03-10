# Playwright Docker Setup

This setup uses Playwright's official Docker image which comes with all necessary browsers pre-installed, eliminating the need for sudo access during browser installation.

## Usage

### Run all E2E tests
```bash
pnpm test:e2e:docker
```

### Run tests with UI mode
```bash
pnpm test:e2e:docker:ui
```

### Run specific test suites
```bash
# Run smoke tests
docker-compose -f docker/docker-compose.playwright.yml run --rm playwright pnpm test:smoke

# Run browser compatibility tests
docker-compose -f docker/docker-compose.playwright.yml run --rm playwright pnpm test:e2e:browser-compat
```

## Benefits

1. **No sudo required**: Browsers are pre-installed in the Docker image
2. **Consistent environment**: Same environment across all machines and CI
3. **All browsers included**: Chromium, Firefox, and WebKit are pre-installed
4. **No OS compatibility issues**: Uses Ubuntu 20.04 (jammy) which is well-supported

## Troubleshooting

If you encounter permission issues, make sure the docker-compose file has the correct volume mappings and the Playwright user has proper permissions.