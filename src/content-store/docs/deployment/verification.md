---
title: 'Deployment Verification'
description: 'Deployment Verification documentation'
pubDate: 2024-01-15
author: 'Pixelated Team'
tags: ['documentation']
draft: false
toc: true
---

# Deployment Verification

This document outlines the verification process for deployments to ensure all components are functioning correctly after a deployment or rollback.

## Verification Process

After each deployment or rollback, a verification process runs to check critical system components and functionality. This process is automated but can also be run manually if needed.

### Automated Verification

Automated verification is triggered by the CI/CD pipeline after each deployment and rollback. The verification script performs checks on various system components and reports success or failure.

The script is located at `src/scripts/verify-deployment.ts` and can be run with the following command:

```bash
pnpm verify-deployment
```

### Manual Verification

To run the verification process manually, use the following command:

```bash
pnpm verify-deployment --environment=staging --verbose
```

Available options:

- `--environment`: The environment to verify (default: "staging")
- `--base-url`: Override the base URL for the environment
- `--verbose`: Enable detailed logging
- `--fail-fast`: Stop at the first failure
- `--timeout`: Maximum time to wait for checks (in milliseconds)

## Verification Checks

The verification process includes the following checks:

### 1. Basic Connectivity

Verifies that the site is accessible by making a request to the root URL.

### 2. Health Endpoint

Checks the `/api/health` endpoint to ensure the application is healthy.

### 3. API Endpoints

Verifies critical API endpoints are functioning correctly:

- `/api/ai/usage`: Checks AI usage statistics
- Additional endpoints as configured

### 4. Authentication

Verifies that authentication is working correctly by making a request to the Supabase auth API.

### 5. Static Assets

Checks that important static assets are accessible:

- Favicon
- CSS files
- Other configured assets

### 6. Database Connectivity

Verifies that the application can connect to the database and execute queries.

### 7. Browser Tests

In CI environments, runs browser tests using Playwright to verify key user flows.

## Verification Results

The verification process produces results in the following formats:

### Console Output

The verification results are displayed in the console with color-coded status messages:

- ✅ PASSED: Checks that succeeded
- ❌ FAILED: Checks that failed
- ⏭️ SKIPPED: Checks that were skipped

### CI Results

In CI environments, the verification results are saved to a JSON file (`verification-results.json`) for further processing and reporting.

## Interpreting Results

A successful verification will show all checks as PASSED or SKIPPED. If any check fails, the verification is considered failed and will trigger an automatic rollback in CI environments.

## Troubleshooting Failed Verifications

If a verification check fails, refer to the following guidelines:

### Site Connectivity Issues

- Check DNS configuration
- Verify load balancer status
- Check for networking issues

### API Endpoint Failures

- Check the API server logs
- Verify API service is running
- Check for dependent service failures

### Authentication Issues

- Verify Supabase configuration
- Check authentication service status
- Review recent changes to authentication code

### Database Connectivity Issues

- Check database connection string
- Verify database service status
- Check for database migrations that may have failed

### Static Asset Issues

- Verify asset bundling process
- Check CDN configuration
- Review recent changes to asset handling

## Running Manual Verification

For in-depth troubleshooting, you can run verification with additional options:

```bash
# Run with verbose logging
pnpm tsx src/scripts/verify-deployment.ts --verbose

# Verify a specific environment with a custom timeout
pnpm tsx src/scripts/verify-deployment.ts --environment=production --timeout=60000

# Verify against a local deployment
pnpm tsx src/scripts/verify-deployment.ts --base-url=http://localhost:3000
```

## Custom Verification Checks

To add custom verification checks, modify the `src/scripts/verify-deployment.ts` file and add new check functions. Each check should return an object with `passed` and optional `message` properties.
