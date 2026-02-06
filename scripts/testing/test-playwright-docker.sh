#!/bin/bash

# Script to test Playwright Docker setup
echo "Testing Playwright Docker setup..."

# Build the Playwright Docker image
echo "Building Playwright Docker image..."
docker-compose -f docker/docker-compose.playwright.yml build

# Run a simple test to verify the setup
echo "Running Playwright test verification..."
docker-compose -f docker/docker-compose.playwright.yml run --rm playwright pnpm list @playwright/test

echo "Playwright Docker setup test completed!"
echo "You can now run your tests with: pnpm test:e2e:docker"