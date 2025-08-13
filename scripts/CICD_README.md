# CI/CD Pipeline Documentation

This directory contains the complete CI/CD pipeline infrastructure for Pixelated Empathy.

## Overview

The CI/CD pipeline provides automated building, testing, and deployment capabilities with the following stages:

1. **Code Quality** - Linting, formatting, and type checking
2. **Security Scanning** - Vulnerability detection and security audits
3. **Testing** - Unit, integration, and E2E tests
4. **Building** - Application build and Docker image creation
5. **Deployment** - Automated deployment to staging/production
6. **Monitoring** - Health checks and performance monitoring

## Quick Start

```bash
# Run full pipeline to staging
./scripts/pipeline full

# Run full pipeline to production
./scripts/pipeline full production

# Run individual stages
./scripts/pipeline test
./scripts/pipeline build
./scripts/pipeline deploy staging
```

## Scripts Overview

### Core Scripts

#### `build`
- **Purpose**: Build application with optimization and artifact generation
- **Usage**: `./scripts/build [--clean-deps] [--skip-tests] [--optimize] [--artifacts]`
- **Features**:
  - Dependency installation and validation
  - Code linting and type checking
  - Application building with optimization
  - Artifact generation and compression
  - Build caching and cleanup

#### `test`
- **Purpose**: Comprehensive test suite execution
- **Usage**: `./scripts/test [all|unit|integration|e2e|security|performance] [--coverage] [--report]`
- **Features**:
  - Multi-type test execution
  - Coverage reporting and thresholds
  - Test result aggregation
  - Performance and security testing

#### `pipeline`
- **Purpose**: CI/CD pipeline orchestration
- **Usage**: `./scripts/pipeline [full|quality|security|test|build|e2e|deploy] [staging|production]`
- **Features**:
  - Stage-by-stage execution
  - Environment-specific deployments
  - Pipeline reporting and cleanup
  - Error handling and rollback

### Configuration Files

#### `cicd.config.json`
Central CI/CD configuration including:
- Environment-specific settings
- Pipeline stage configurations
- Quality gates and thresholds
- Notification settings
- Artifact management

## GitHub Actions Integration

The pipeline integrates with GitHub Actions through `.github/workflows/ci-cd.yml`:

### Workflow Triggers
- **Push** to `main` or `develop` branches
- **Pull Requests** to `main` branch
- **Manual dispatch** for on-demand runs

### Workflow Jobs
1. **quality-checks** - Code quality and security scanning
2. **test** - Unit and integration tests (matrix strategy)
3. **e2e-tests** - End-to-end testing with Playwright
4. **build** - Application build and Docker image creation
5. **security-scan** - Container vulnerability scanning
6. **deploy-staging** - Automatic staging deployment
7. **deploy-production** - Production deployment with approval
8. **performance-test** - Performance testing and monitoring

## Environment Management

### Development Environment
- **Branch**: `develop`
- **Auto-deploy**: Yes
- **Target**: Staging environment
- **Tests**: All test suites
- **Performance**: Lighthouse CI

### Staging Environment
- **Branch**: `develop`
- **Auto-deploy**: Yes
- **Target**: Staging infrastructure
- **Tests**: Full test suite + performance
- **Security**: Vulnerability scanning

### Production Environment
- **Branch**: `main`
- **Auto-deploy**: No (manual approval required)
- **Target**: Production infrastructure
- **Tests**: Full test suite
- **Backup**: Automatic backup before deployment
- **Rollback**: Automatic rollback on failure

## Quality Gates

### Code Coverage
- **Minimum**: 80%
- **Target**: 90%
- **Action**: Warning (non-blocking)

### Security Vulnerabilities
- **Critical**: 0 allowed
- **High**: 2 allowed
- **Medium**: 10 allowed
- **Action**: Fail build on critical/high

### Performance
- **Lighthouse Score**: 85+
- **Load Time**: <3 seconds
- **Action**: Warning (non-blocking)

### Code Quality
- **ESLint Errors**: 0
- **TypeScript Errors**: 0
- **Action**: Warning (non-blocking)

## Deployment Strategies

### Rolling Deployment
- **Strategy**: Default for all environments
- **Max Unavailable**: 1 instance
- **Max Surge**: 1 instance
- **Health Check**: 300s timeout

### Blue-Green Deployment
- **Strategy**: Available for production
- **Switch**: Instant traffic switch
- **Rollback**: Instant rollback capability

### Canary Deployment
- **Strategy**: Available for production
- **Traffic Split**: 10% -> 50% -> 100%
- **Monitoring**: Automatic rollback on metrics

## Monitoring and Alerting

### Build Metrics
- Build duration and success rate
- Test execution time and results
- Deployment frequency and lead time
- Failure rate and recovery time

### Notification Channels
- **Slack**: Real-time notifications
- **Email**: Detailed reports and alerts
- **Dashboard**: Grafana monitoring dashboard

### Alert Conditions
- Build failures
- Test failures
- Security vulnerabilities
- Deployment failures
- Performance degradation

## Artifact Management

### Build Artifacts
- **Location**: `artifacts/` directory
- **Retention**: 30 days
- **Compression**: Automatic gzip compression
- **Checksums**: SHA256 verification

### Docker Images
- **Registry**: GitHub Container Registry (ghcr.io)
- **Tagging**: Branch-based and SHA-based tags
- **Cleanup**: Automatic cleanup of old images
- **Security**: Vulnerability scanning with Trivy

## Security Considerations

### Secrets Management
- GitHub Secrets for sensitive data
- Environment-specific secret injection
- No secrets in code or logs
- Automatic secret rotation

### Access Control
- Branch protection rules
- Required status checks
- Manual approval for production
- Audit logging for all actions

### Vulnerability Management
- Dependency scanning with npm audit
- Container scanning with Trivy
- SAST scanning with CodeQL
- Regular security updates

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   ./scripts/build --help
   
   # Clean build
   ./scripts/build --clean-deps
   ```

2. **Test Failures**
   ```bash
   # Run specific test type
   ./scripts/test unit --coverage
   
   # Check test results
   cat test-results/test-report.json
   ```

3. **Deployment Failures**
   ```bash
   # Check deployment health
   ./scripts/deployment-health-check.sh detailed
   
   # Rollback if needed
   ./scripts/deployment-rollback.sh previous
   ```

4. **Pipeline Failures**
   ```bash
   # Check pipeline logs
   cat logs/pipeline/pipeline_*.log
   
   # Run individual stages
   ./scripts/pipeline test
   ./scripts/pipeline build
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
export DEBUG=true
export LOG_LEVEL=debug
./scripts/pipeline full
```

### Manual Intervention

For manual pipeline control:

```bash
# Skip specific stages
export SKIP_TESTS=true
export SKIP_SECURITY=true
./scripts/pipeline full

# Force deployment
export FORCE_DEPLOY=true
./scripts/pipeline deploy production
```

## Best Practices

### Development Workflow
1. Create feature branch from `develop`
2. Make changes and commit with conventional commits
3. Push branch and create pull request
4. Pipeline runs automatically on PR
5. Merge to `develop` triggers staging deployment
6. Merge to `main` triggers production deployment

### Testing Strategy
1. Write tests before implementation (TDD)
2. Maintain high test coverage (>80%)
3. Use appropriate test types for different scenarios
4. Run tests locally before pushing
5. Monitor test performance and flakiness

### Deployment Strategy
1. Always deploy to staging first
2. Run smoke tests after deployment
3. Monitor metrics and logs
4. Use feature flags for risky changes
5. Have rollback plan ready

### Security Practices
1. Regular dependency updates
2. Security scanning in pipeline
3. Secrets management best practices
4. Access control and audit logging
5. Incident response procedures

## Integration Examples

### Slack Notifications
```bash
# Set webhook URL
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."

# Notifications will be sent automatically
./scripts/pipeline full production
```

### Custom Quality Gates
```json
{
  "quality_gates": {
    "custom_metric": {
      "threshold": 95,
      "command": "npm run custom-check",
      "fail_build": true
    }
  }
}
```

### External Tool Integration
```bash
# SonarQube integration
export SONAR_TOKEN="your-token"
./scripts/pipeline quality

# Datadog metrics
export DATADOG_API_KEY="your-key"
./scripts/pipeline full
```

## Support and Maintenance

### Regular Maintenance
- Update dependencies monthly
- Review and update quality gates quarterly
- Performance optimization reviews
- Security audit and updates

### Support Contacts
- **DevOps Team**: devops@pixelated-empathy.com
- **Security Team**: security@pixelated-empathy.com
- **Development Team**: dev@pixelated-empathy.com

### Documentation Updates
- Keep this README updated with changes
- Document new integrations and tools
- Update troubleshooting guides
- Maintain runbook procedures
