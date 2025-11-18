---
title: 'CI/CD Pipeline'
description: 'CI/CD Pipeline documentation'
pubDate: 2024-01-15
author: 'Pixelated Team'
tags: ['documentation']
draft: false
toc: true
---

# CI/CD Pipeline

This document outlines our Continuous Integration and Continuous Deployment (CI/CD) pipeline, implemented using GitHub Actions.

## Overview

Our CI/CD pipeline automates the building, testing, deployment, and verification of our application. It is configured to deploy to different environments depending on the trigger:

- **Push to `main` branch**: Automatic deployment to staging
- **Workflow dispatch with environment selection**: Manual deployment to staging or production

## Pipeline Configuration

The pipeline is defined in `.github/workflows/deploy.yml` and consists of the following jobs:

1. **Build**: Compiles and packages the application
2. **Deploy**: Pushes the application to the target environment
3. **Rollback**: Automatically recovers from failed deployments

### Build Job

The build job performs the following tasks:

1. Checks out the code repository
2. Sets up pnpm and Node.js
3. Installs dependencies
4. Builds the application
5. Uploads build artifacts for use in subsequent jobs

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
      with:
        version: 10
    - uses: actions/setup-node@v6
      with:
        node-version: 22
        cache: pnpm
    - name: Install dependencies
      run: pnpm install --no-frozen-lockfile
    - name: Build application
      run: pnpm build
    - name: Upload build artifact
      uses: actions/upload-artifact@v4
      with:
        name: build-files
        path: dist/
```

### Deploy Job

The deploy job performs the following tasks:

1. Checks out the code repository
2. Sets up pnpm and Node.js
3. Installs dependencies
4. Downloads build artifacts from the build job
5. Records a deployment ID
6. Deploys the application to the target environment
7. Records the deployment in the database
8. Verifies the deployment
9. Notifies the team of successful deployment

```yaml
deploy:
  needs: build
  runs-on: ubuntu-latest
  environment:
    name: ${{ github.event.inputs.environment || 'staging' }}
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
      with:
        version: 10
    - uses: actions/setup-node@v6
      with:
        node-version: 22
        cache: pnpm
    - name: Install dependencies
      run: pnpm install --no-frozen-lockfile
    - name: Download build artifact
      uses: actions/download-artifact@v4
      with:
        name: build-files
        path: dist/
    - name: Record deployment ID
      id: deployment
      run: |
        echo "id=$(date +%Y%m%d%H%M%S)-${GITHUB_SHA::8}" >> $GITHUB_OUTPUT
    - name: Deploy to ${{ github.event.inputs.environment || 'staging' }}
      id: deploy
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        DEPLOYMENT_ID: ${{ steps.deployment.outputs.id }}
      run: |
        echo "Deploying with ID: $DEPLOYMENT_ID"
        pnpm deploy:${{ github.event.inputs.environment || 'staging' }}
    - name: Record deployment in database
      if: success()
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        DEPLOYMENT_ID: ${{ steps.deployment.outputs.id }}
      run: |
        echo "Recording successful deployment with ID: $DEPLOYMENT_ID"
        pnpm tsx src/scripts/record-deployment.ts --id=$DEPLOYMENT_ID --status=success
    - name: Verify deployment
      id: verify
      if: success()
      env:
        DEPLOYMENT_URL: ${{ steps.deploy.outputs.url }}
      run: |
        echo "Verifying deployment at $DEPLOYMENT_URL"
        pnpm verify-deployment
    - name: Notify team of successful deployment
      if: success()
      env:
        SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        DEPLOYMENT_ID: ${{ steps.deployment.outputs.id }}
        ENVIRONMENT: ${{ github.event.inputs.environment || 'staging' }}
      run: |
        curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"✅ Successfully deployed to $ENVIRONMENT with ID $DEPLOYMENT_ID\"}" $SLACK_WEBHOOK
```

### Rollback Job

The rollback job is triggered automatically if the deploy job fails. It performs the following tasks:

1. Checks out the code repository
2. Sets up pnpm and Node.js
3. Installs dependencies
4. Executes the rollback script
5. Verifies the rollback was successful
6. Notifies the team of the rollback status

```yaml
rollback:
  needs: deploy
  if: failure()
  runs-on: ubuntu-latest
  environment:
    name: ${{ github.event.inputs.environment || 'staging' }}
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
      with:
        version: 10
    - uses: actions/setup-node@v6
      with:
        node-version: 22
        cache: pnpm
    - name: Install dependencies
      run: pnpm install --no-frozen-lockfile
    - name: Execute rollback
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        ENVIRONMENT: ${{ github.event.inputs.environment || 'staging' }}
      run: |
        echo "Initiating automatic rollback due to deployment failure"
        pnpm tsx src/scripts/rollback.ts --notify=true --environment=$ENVIRONMENT
    - name: Verify rollback
      if: success()
      env:
        ENVIRONMENT: ${{ github.event.inputs.environment || 'staging' }}
      run: |
        echo "Verifying rollback success"
        pnpm verify-deployment
    - name: Notify team of rollback
      if: always()
      env:
        SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        ENVIRONMENT: ${{ github.event.inputs.environment || 'staging' }}
        ROLLBACK_STATUS: ${{ job.status }}
      run: |
        if [[ "$ROLLBACK_STATUS" == "success" ]]; then
          curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"⚠️ Deployment to $ENVIRONMENT failed, but rollback was successful.\"}" $SLACK_WEBHOOK
        else
          curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"🚨 URGENT: Deployment to $ENVIRONMENT failed and automatic rollback also failed! Manual intervention required.\"}" $SLACK_WEBHOOK
        fi
```

## Manual Deployments

To manually trigger a deployment to a specific environment, use the GitHub Actions workflow dispatch:

1. Go to the GitHub repository
2. Click on the "Actions" tab
3. Select the "Deploy" workflow
4. Click "Run workflow"
5. Select the target environment (staging or production)
6. Click "Run workflow"

## Environment Secrets

The CI/CD pipeline requires the following secrets to be configured in the GitHub repository:

- `SUPABASE_URL`: The URL of the Supabase project
- `SUPABASE_ANON_KEY`: The anonymous key for the Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`: The service role key for the Supabase project
- `SLACK_WEBHOOK`: The webhook URL for Slack notifications

These secrets should be configured for each environment (staging and production) to ensure proper isolation.

## Deployment Scripts

The CI/CD pipeline uses several scripts to manage the deployment process:

- `deploy:staging`: Deploys the application to the staging environment
- `deploy:production`: Deploys the application to the production environment
- `verify-deployment`: Verifies the deployment was successful
- `record-deployment.ts`: Records the deployment in the database
- `rollback.ts`: Rolls back to a previous successful deployment

These scripts are located in the `src/scripts` directory.

## Notifications

The CI/CD pipeline sends notifications to Slack for important events:

- Successful deployments
- Failed deployments
- Successful rollbacks
- Failed rollbacks

These notifications help the team stay informed about the status of the deployment process.

## Future Improvements

We plan to make the following improvements to our CI/CD pipeline:

1. Add more comprehensive testing stages (unit tests, integration tests, end-to-end tests)
2. Implement blue-green deployments for zero-downtime updates
3. Add canary releases for gradual rollouts
4. Implement feature flags for controlled feature releases
5. Add performance testing and benchmarking
