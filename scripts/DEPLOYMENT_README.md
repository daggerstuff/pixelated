# Deployment Automation

This directory contains comprehensive deployment automation for Pixelated Empathy.

## Quick Start

```bash
# Deploy locally (development)
./scripts/deploy

# Deploy to production
./scripts/deploy production

# Build only
./scripts/deploy build

# Run tests only
./scripts/deploy test
```

## Scripts Overview

### Main Deployment Script (`deploy`)
- **Purpose**: Main deployment orchestration
- **Usage**: `./scripts/deploy [local|production|build|test|clean]`
- **Features**:
  - Environment validation
  - Docker image building
  - Test execution
  - Health checks
  - Cleanup

### Health Check Script (`deployment-health-check.sh`)
- **Purpose**: Verify deployment health
- **Usage**: `./scripts/deployment-health-check.sh [basic|detailed]`
- **Features**:
  - HTTP endpoint testing
  - Container status verification
  - Database connectivity checks

### Rollback Script (`deployment-rollback.sh`)
- **Purpose**: Rollback deployments when issues occur
- **Usage**: `./scripts/deployment-rollback.sh [backup|list|rollback|previous]`
- **Features**:
  - Automatic backup creation
  - Rollback to previous versions
  - Backup management

## Configuration Files

### `deploy.config.json`
Central deployment configuration including:
- Environment-specific settings
- Resource limits
- Health check parameters
- Deployment strategies

### Docker Compose Files
- `docker-compose.yml` - Base configuration
- `docker-compose.dev.yml` - Development overrides
- `docker-compose.prod.yml` - Production configuration

## Deployment Environments

### Development
- **Image**: `pixelated-empathy:dev`
- **Port**: 3000
- **Features**: Hot reload, debug ports, development database

### Staging
- **Image**: `pixelated-empathy:staging`
- **Replicas**: 2
- **Features**: Production-like environment for testing

### Production
- **Image**: `pixelated-empathy:prod`
- **Replicas**: 3
- **Features**: Load balancing, health checks, auto-restart

## Health Checks

The deployment includes comprehensive health monitoring:

- **HTTP Health Endpoint**: `/health`
- **Container Health**: Docker health checks
- **Database Connectivity**: PostgreSQL connection verification
- **Redis Connectivity**: Cache service verification

## Rollback Strategy

Automatic rollback capabilities:

1. **Backup Creation**: Before each deployment
2. **Health Monitoring**: Continuous health checks
3. **Auto Rollback**: On deployment failure
4. **Manual Rollback**: Via rollback script

## Security Considerations

- Environment variables are loaded from `.env` files
- Secrets are not stored in version control
- Container images are scanned for vulnerabilities
- Network policies restrict inter-service communication

## Monitoring Integration

The deployment automation integrates with:

- **Health Checks**: Built-in HTTP health endpoints
- **Logging**: Centralized log collection
- **Metrics**: Performance and resource monitoring
- **Alerting**: Failure notifications

## Troubleshooting

### Common Issues

1. **Docker Build Failures**
   ```bash
   # Check Docker daemon
   docker info
   
   # Clean build cache
   docker builder prune
   ```

2. **Health Check Failures**
   ```bash
   # Check container logs
   docker-compose logs app
   
   # Manual health check
   curl http://localhost:3000/health
   ```

3. **Database Connection Issues**
   ```bash
   # Check database container
   docker-compose logs db
   
   # Test database connection
   docker-compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
   ```

### Debug Mode

Enable debug mode by setting environment variables:

```bash
export DEBUG=true
export LOG_LEVEL=debug
./scripts/deploy
```

## Best Practices

1. **Always test locally** before production deployment
2. **Run health checks** after deployment
3. **Monitor logs** during deployment
4. **Keep backups** of working deployments
5. **Use staging environment** for testing changes

## Integration with CI/CD

The deployment scripts integrate with:

- **GitHub Actions**: `.github/workflows/`
- **GitLab CI**: `.gitlab-ci.yml`
- **Azure Pipelines**: `azure-pipelines.yml`

## Support

For deployment issues:

1. Check the logs: `docker-compose logs`
2. Run health checks: `./scripts/deployment-health-check.sh detailed`
3. Review configuration: `./scripts/deploy.config.json`
4. Rollback if needed: `./scripts/deployment-rollback.sh previous`
