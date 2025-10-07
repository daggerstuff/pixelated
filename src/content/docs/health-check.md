---
title: "Website Health Check Documentation"
description: "Website Health Check Documentation documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Website Health Check Documentation

This document explains the automated health check system that monitors the Pixelated Empathy application.

## Overview

The health check system regularly checks the main website and API endpoints to ensure they are functioning correctly. If any issues are detected, the system will create a GitHub issue to alert the team.

## How It Works

1. A GitHub Actions workflow runs every 15 minutes (configurable in `.github/workflows/health-check.yml`)
2. The workflow executes the `health-check.sh` script
3. The script checks:
   - The main website endpoint (`https://app.pixelatedempathy.com`)
   - The API health endpoint (`https://app.pixelatedempathy.com/api/health`)
4. If either check fails, a GitHub issue is created and assigned to the repository owner

## Troubleshooting Common Issues

### Exit Code 6: Could not resolve host

This error indicates a DNS resolution problem. Possible causes:

- The domain name is incorrect
- DNS servers are unavailable
- Network connectivity issues

**Solutions:**

- Verify the domain name is correct in the health check configuration
- Check if the domain resolves using `dig` or `nslookup`
- Check network connectivity to DNS servers

### Exit Code 7: Failed to connect

This error indicates that the host was found but a connection could not be established. Possible causes:

- The server is down
- A firewall is blocking the connection
- Network connectivity issues

**Solutions:**

- Check if the server is running
- Verify firewall settings
- Test connectivity from another network

### Exit Code 28: Operation timeout

This error indicates that the request timed out. Possible causes:

- Server is overloaded
- Network latency issues
- Service is partially down

**Solutions:**

- Check server load and performance metrics
- Increase the timeout value in the script if needed
- Check if the service is experiencing slowdowns

### HTTP Status Errors

- **404 Not Found**: The endpoint URL is incorrect or the resource doesn't exist
- **500 Internal Server Error**: The server encountered an error processing the request
- **502/503/504**: Issues with the server or gateway

## Customizing the Health Check

### Changing Endpoints

Edit the following environment variables in `.github/workflows/health-check.yml`:

```yaml
env:
  APP_URL: https://app.pixelatedempathy.com
  API_PATH: /api/health
```

### Changing Check Frequency

Edit the cron schedule in `.github/workflows/health-check.yml`:

```yaml
on:
  schedule:
    - cron: '*/15 * * * *'  # Current: Every 15 minutes
```

Common cron schedules:

- Every hour: `0 * * * *`
- Every 30 minutes: `*/30 * * * *`
- Daily at midnight: `0 0 * * *`

### Adding New Checks

To add a new endpoint to check, modify the `health-check.sh` script to include additional calls to the `check_endpoint` function.

## Notification Settings

Currently, the health check creates a GitHub issue when a failure is detected. To add additional notification methods:

1. Edit `.github/workflows/health-check.yml`
2. Add steps for additional notifications under the "Notify on failure" step
3. Common notification options:
   - Slack/Discord webhooks
   - Email notifications
   - SMS alerts
   - PagerDuty integration

## Monitoring Dashboard

Consider setting up a monitoring dashboard that visualizes health check results over time, using tools like:

- Grafana
- Datadog
- New Relic
- Prometheus

This can help identify patterns and potential issues before they become critical.
