# Azure Pipeline Updates for Docker-based Playwright

## Summary of Changes

This update modifies the Azure DevOps pipeline to use Docker-based Playwright testing instead of the traditional approach that requires sudo access for browser installation. This resolves the "sudo authentication failed" issue that was occurring in the CI environment.

## Key Changes Made

### 1. Updated PerformanceTest Stage
- Replaced traditional Playwright installation with Docker-based approach
- Added Docker image build step using `docker/Dockerfile.playwright`
- Runs performance tests inside Docker container with pre-installed browsers
- Maintains all existing connectivity checks and error handling

### 2. Updated E2ETest Stage
- Replaced traditional Playwright installation with Docker-based approach
- Added Docker image build step using `docker/Dockerfile.playwright`
- Runs E2E smoke tests inside Docker container with pre-installed browsers
- Maintains all existing connectivity checks and result publishing

### 3. Added New PlaywrightDockerTest Stage
- New comprehensive testing stage that runs full Playwright test suite
- Uses Docker-based approach with Playwright's official image
- Publishes both test results and HTML reports
- Can be used for more extensive testing scenarios

## Benefits

1. **Eliminates sudo requirement**: Browsers are pre-installed in Docker image
2. **Consistent environment**: Same environment across all machines and CI
3. **Faster builds**: No need to install browsers during each build
4. **Better reliability**: Pre-tested Docker image with all dependencies
5. **OS compatibility**: Uses Ubuntu 20.04 which is well-supported

## Files Created

1. `docker/Dockerfile.playwright` - Playwright Docker image definition
2. `docker/docker-compose.playwright.yml` - Docker Compose configuration
3. `docker/README.playwright.md` - Documentation for Playwright Docker setup
4. `scripts/test-playwright-docker.sh` - Test script for Playwright Docker setup
5. Updated npm scripts in `package.json`:
   - `test:e2e:docker` - Run all E2E tests in Docker
   - `test:e2e:docker:ui` - Run tests with Playwright UI mode in Docker
   - `test:e2e:docker:setup` - Test the Playwright Docker setup

## Azure Pipeline Changes

The updated pipeline file (`azure-pipelines-updated-final.yml`) includes:
- Modified PerformanceTest stage using Docker approach
- Modified E2ETest stage using Docker approach
- New PlaywrightDockerTest stage for comprehensive testing

## Usage

To use the updated pipeline:
1. Replace the existing `azure-pipelines.yml` with the updated version
2. Ensure Docker is available on the build agents
3. The pipeline will automatically build and use the Playwright Docker image

This solution resolves the sudo authentication failures while providing a more reliable and consistent testing environment.