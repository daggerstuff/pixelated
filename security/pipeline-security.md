# GitLab Pipeline Security Configuration Guide

## Critical Security Variables to Configure

### Required GitLab CI/CD Variables (Masked & Protected)

1. **SSH_PRIVATE_KEY** (Type: Variable, Masked: Yes, Protected: Yes)
   - Your SSH private key for VPS deployment
   - Format: Single line with `\n` for line breaks
   - Scope: All environments

2. **VPS_HOST** (Type: Variable, Masked: No, Protected: Yes)
   - Your VPS hostname or IP address
   - Example: `your-server.com` or `192.168.1.100`

3. **VPS_USER** (Type: Variable, Masked: No, Protected: Yes)
   - SSH username for VPS access
   - Example: `deploy` or `ubuntu`

4. **VPS_DOMAIN** (Type: Variable, Masked: No, Protected: No)
   - Your production domain for health checks
   - Example: `https://pixelatedempathy.com`

5. **SENTRY_AUTH_TOKEN** (Type: Variable, Masked: Yes, Protected: Yes)
   - Sentry authentication token for release management
   - Get from: Sentry → Settings → Auth Tokens

6. **SENTRY_DSN** (Type: Variable, Masked: Yes, Protected: Yes)
   - Sentry Data Source Name for error tracking
   - Get from: Sentry → Project Settings → Client Keys

7. **PUBLIC_SENTRY_DSN** (Type: Variable, Masked: No, Protected: Yes)
   - Public Sentry DSN for client-side error tracking

8. **BETTER_AUTH_SECRET** (Type: Variable, Masked: Yes, Protected: Yes)
   - Secret key for Better Auth authentication
   - Generate: `openssl rand -base64 32`

## Security Best Practices Implemented

### Container Security
- ✅ Non-root user (UID 1001)
- ✅ Read-only filesystem
- ✅ Dropped all capabilities except essential ones
- ✅ No new privileges
- ✅ Resource limits (CPU: 2 cores, Memory: 2GB)
- ✅ Temporary filesystems for /tmp and /var/tmp
- ✅ Security options enabled

### Build Security
- ✅ Multi-stage builds to minimize attack surface
- ✅ Security updates in base images
- ✅ Dependency vulnerability scanning
- ✅ Static Application Security Testing (SAST)
- ✅ Container image scanning
- ✅ Secret detection

### Deployment Security
- ✅ Blue-green deployment strategy
- ✅ Health checks before marking deployment successful
- ✅ Automatic rollback capability
- ✅ Secure SSH key handling
- ✅ Registry authentication
- ✅ Network security (proper port exposure)

### Pipeline Security
- ✅ Secrets stored in GitLab CI/CD variables (masked & protected)
- ✅ No hardcoded credentials in code
- ✅ Proper error handling without exposing sensitive data
- ✅ Resource limits to prevent resource exhaustion
- ✅ Timeout controls to prevent hanging jobs

## How to Configure Variables in GitLab

1. Go to your GitLab project
2. Navigate to Settings → CI/CD
3. Expand "Variables" section
4. Add each variable with these settings:
   - **Type**: Variable
   - **Environment scope**: All (unless specified)
   - **Protect variable**: Yes (for sensitive data)
   - **Mask variable**: Yes (for secrets)

## SSH Key Setup

1. Generate SSH key pair:
   ```bash
   ssh-keygen -t ed25519 -C "gitlab-ci@pixelated" -f ~/.ssh/gitlab_ci_key
   ```

2. Add public key to your VPS:
   ```bash
   ssh-copy-id -i ~/.ssh/gitlab_ci_key.pub user@your-vps
   ```

3. Convert private key to single line for GitLab:
   ```bash
   awk '{printf "%s\\n", $0}' ~/.ssh/gitlab_ci_key
   ```

4. Copy the output and paste into GitLab CI/CD variable `SSH_PRIVATE_KEY`

## Monitoring and Alerting

The pipeline includes comprehensive monitoring:

- **Health Checks**: Multiple endpoint validation
- **Container Health**: Docker health checks with proper timeouts
- **Resource Monitoring**: Memory and CPU usage tracking
- **Security Scanning**: Automated vulnerability detection
- **Deployment Verification**: Post-deployment validation

## Troubleshooting Common Issues

### Build Failures
- Check resource limits if builds fail with OOM errors
- Verify all required secrets are configured
- Check Docker registry connectivity

### Deployment Failures
- Verify SSH connectivity to VPS
- Check VPS Docker installation
- Validate health check endpoints

### Security Scan Failures
- Review vulnerability reports in GitLab Security Dashboard
- Update dependencies to fix known vulnerabilities
- Consider accepting risk for false positives

## Emergency Procedures

### Rollback Deployment
1. Go to GitLab → CI/CD → Pipelines
2. Find the last successful deployment
3. Click "Rollback" button
4. Monitor health checks

### Security Incident Response
1. Immediately revoke compromised credentials
2. Rotate all secrets in GitLab CI/CD variables
3. Review security scan results
4. Update container images with security patches

## Compliance and Auditing

The pipeline generates comprehensive audit trails:
- Build logs with timestamps
- Security scan reports
- Deployment history
- Health check results
- Resource usage metrics

All artifacts are retained according to GitLab's retention policies and can be used for compliance reporting.