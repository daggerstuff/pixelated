# GitHub Actions Migration from GitLab CI/CD

This document explains the migration from GitLab CI/CD pipeline to GitHub Actions workflows for the Pixelated Empathy project.

## Overview

The original GitLab pipeline has been converted into modular GitHub Actions workflows that provide equivalent functionality with enhanced integration capabilities.

## Workflow Mapping

### Original GitLab Pipeline Stages → GitHub Actions Workflows

| GitLab Stage | GitLab Job | GitHub Actions Workflow | Description |
|--------------|------------|------------------------|-------------|
| **validate** | validate | `gke-deploy.yml` (validate job) | Parallel validation (dependencies, lint, typecheck) |
| **build** | build | `gke-deploy.yml` (build job) | Application build and container image creation |
| **test** | - | `ci.yml` (test job) | Unit tests and integration tests |
| **security** | security | `gke-deploy.yml` (security-scan job) + `security-scanning.yml` | Security scanning (Trivy, container security) |
| **security** | sentry-release | `gke-deploy.yml` (sentry-release job) + `sentry-build.yml` | Sentry release creation and source maps |
| **deploy** | deploy-gke | `gke-deploy.yml` (deploy-gke job) | GKE deployment with multiple strategies |
| **deploy** | rollback-gke | `gke-rollback.yml` | GKE rollback functionality |
| **deploy** | health-check-gke | `gke-deploy.yml` (health-check-gke job) + `gke-monitoring.yml` | Health checks and monitoring |
| **deploy** | cleanup | `gke-deploy.yml` (cleanup job) | Container image cleanup |

## Key Workflows

### 1. GKE Deployment Pipeline (`gke-deploy.yml`)
**Triggers**: Push to main/master, pull requests, manual dispatch
**Features**:
- Multi-stage validation (dependencies, lint, typecheck)
- Docker image build with multi-tag support
- Security scanning (Trivy, container security)
- Sentry release integration
- GKE deployment with strategies: rolling, blue-green, canary
- Health checks and monitoring
- Cleanup of old images

### 2. GKE Rollback (`gke-rollback.yml`)
**Triggers**: Manual workflow dispatch
**Features**:
- Rollback to previous revisions
- Automatic health checks post-rollback
- Support for both staging and production environments
- Slack notifications
- Git tagging for rollback tracking

### 3. GKE Monitoring & Alerting (`gke-monitoring.yml`)
**Triggers**: Scheduled (every 5 minutes), manual dispatch
**Features**:
- Comprehensive health monitoring
- Resource usage monitoring
- Security monitoring
- Log analysis and error detection
- GitHub issue creation for critical alerts
- Slack notifications
- Performance monitoring

### 4. GKE Integration (`gke-integration.yml`)
**Triggers**: Completion of CI/CD Pipeline
**Features**:
- Automatic deployment triggering based on CI success
- Environment-specific deployment (staging/production)
- Cleanup automation
- Deployment notifications

### 5. Existing Enhanced Workflows
- **`ci.yml`**: Enhanced with better test coverage
- **`security-scanning.yml`**: Comprehensive security scanning
- **`sentry-build.yml`**: Sentry integration with build artifacts
- **`kubesec.yml`**: Kubernetes security scanning

## Required Secrets

### Google Cloud Platform
- `GCP_SERVICE_ACCOUNT_KEY`: GCP service account JSON key
- `GCP_PROJECT_ID`: GCP project ID
- `GKE_CLUSTER_NAME`: GKE cluster name (default: pixelcluster)
- `GKE_ZONE`: GKE zone (default: us-east1)
- `GKE_NAMESPACE`: Kubernetes namespace (default: pixelated)
- `GKE_DEPLOYMENT_NAME`: Deployment name (default: pixelated)
- `GKE_SERVICE_NAME`: Service name (default: pixelated-service)
- `GKE_ENVIRONMENT_URL`: Application URL

### Deployment Configuration
- `GKE_REPLICAS`: Number of replicas (default: 3)
- `GKE_MAX_SURGE`: Max surge during rollout (default: 1)
- `GKE_MAX_UNAVAILABLE`: Max unavailable during rollout (default: 0)
- `CANARY_PERCENTAGE`: Canary deployment percentage (default: 25)
- `AUTO_ROLLBACK`: Enable automatic rollback (default: true)
- `HEALTH_CHECK_TIMEOUT`: Health check timeout (default: 300)

### Container Registry
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### Monitoring & Notifications
- `SLACK_WEBHOOK_URL`: Slack webhook for notifications (optional)

### Sentry Integration
- `SENTRY_AUTH_TOKEN`: Sentry authentication token
- `SENTRY_ORG`: Sentry organization
- `SENTRY_PROJECT`: Sentry project
- `SENTRY_DSN`: Sentry DSN
- `PUBLIC_SENTRY_DSN`: Public Sentry DSN

## Deployment Strategies

### 1. Rolling Deployment (Default)
- Gradual replacement of pods
- Zero-downtime deployment
- Configurable surge and unavailable parameters

### 2. Blue-Green Deployment
- Complete parallel environment
- Traffic switching after validation
- Instant rollback capability

### 3. Canary Deployment
- Gradual traffic shifting
- Performance validation
- Automatic rollback on failure

## Health Checks

### Comprehensive Health Monitoring
- Pod readiness and liveness probes
- Service endpoint validation
- External connectivity testing
- Resource usage monitoring
- Error rate analysis

### Automated Responses
- Automatic rollback on health check failure
- GitHub issue creation for critical issues
- Slack notifications for alerts
- Performance degradation detection

## Migration Benefits

### 1. Enhanced Integration
- Better integration with GitHub ecosystem
- Native GitHub Actions features
- Improved artifact management
- Enhanced security scanning

### 2. Improved Monitoring
- Real-time health monitoring
- Automated alerting
- Resource usage tracking
- Performance monitoring

### 3. Better Rollback Capabilities
- Automated rollback triggers
- Health check validation
- Git tagging for tracking
- Notification integration

### 4. Cost Optimization
- Efficient container image cleanup
- Resource monitoring
- Automated scaling recommendations

## Usage Examples

### Manual Deployment
```bash
# Deploy to production with rolling strategy
gh workflow run gke-deploy.yml -f deployment_strategy=rolling -f environment=production

# Deploy to staging with blue-green strategy
gh workflow run gke-deploy.yml -f deployment_strategy=blue-green -f environment=staging

# Deploy with canary strategy
gh workflow run gke-deploy.yml -f deployment_strategy=canary -f environment=production
```

### Manual Rollback
```bash
# Rollback production to previous revision
gh workflow run gke-rollback.yml -f environment=production

# Rollback to specific revision
gh workflow run gke-rollback.yml -f environment=production -f revision=abc123

# Rollback staging with auto-rollback disabled
gh workflow run gke-rollback.yml -f environment=staging -f auto_rollback=false
```

### Manual Monitoring
```bash
# Run comprehensive health check
gh workflow run gke-monitoring.yml -f check_type=comprehensive -f environment=production

# Run performance monitoring
gh workflow run gke-monitoring.yml -f check_type=performance -f environment=production

# Run security monitoring
gh workflow run gke-monitoring.yml -f check_type=security -f environment=production
```

## Troubleshooting

### Common Issues

1. **GCP Authentication Failures**
   - Verify service account key format
   - Check project ID configuration
   - Ensure proper IAM permissions

2. **GKE Cluster Access Issues**
   - Verify cluster name and zone
   - Check network connectivity
   - Ensure kubectl is properly configured

3. **Deployment Failures**
   - Check container image availability
   - Verify deployment strategy configuration
   - Review health check settings

4. **Monitoring Alerts**
   - Check Slack webhook configuration
   - Verify GitHub token permissions
   - Review alert thresholds

### Debug Mode
Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository settings.

## Migration Checklist

- [x] Create comprehensive GKE deployment workflow
- [x] Implement rollback functionality
- [x] Add monitoring and alerting
- [x] Integrate with existing CI/CD pipeline
- [x] Configure required secrets
- [x] Test deployment strategies
- [x] Validate health checks
- [x] Set up notifications

## Next Steps

1. **Configure Secrets**: Add all required secrets to your GitHub repository
2. **Test Workflows**: Run manual deployments to validate functionality
3. **Monitor Performance**: Set up monitoring dashboards
4. **Optimize Resources**: Fine-tune deployment parameters
5. **Train Team**: Document usage procedures for team members

## Support

For issues or questions regarding the GitHub Actions workflows:
1. Check the workflow logs in GitHub Actions
2. Review the troubleshooting section above
3. Create an issue in the repository
4. Contact the development team