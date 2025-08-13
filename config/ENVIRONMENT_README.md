# Environment Management

This directory contains comprehensive environment management for Pixelated Empathy across different deployment environments.

## Overview

The environment management system provides:

- **Environment-specific configurations** for development, staging, and production
- **Centralized configuration management** with JSON-based config files
- **Environment switching capabilities** with automated .env generation
- **Configuration validation** and comparison tools
- **Template-based environment creation** for new environments

## Directory Structure

```
config/
├── environments/
│   ├── development.json    # Development environment configuration
│   ├── staging.json        # Staging environment configuration
│   └── production.json     # Production environment configuration
└── ENVIRONMENT_README.md   # This documentation
```

## Quick Start

### Switch to Development Environment
```bash
./scripts/env-manager switch development
```

### List Available Environments
```bash
./scripts/env-manager list
```

### Generate .env File for Staging
```bash
./scripts/env-manager generate staging .env.staging
```

### Compare Environments
```bash
./scripts/env-manager compare development production
```

## Environment Configurations

### Development Environment
- **Purpose**: Local development and testing
- **Database**: Local PostgreSQL with relaxed security
- **Debug**: Enabled with detailed logging
- **Features**: All features enabled for testing
- **Security**: Relaxed for development convenience
- **Monitoring**: Basic health checks and metrics

### Staging Environment
- **Purpose**: Pre-production testing and validation
- **Database**: Managed PostgreSQL with SSL
- **Debug**: Disabled with structured logging
- **Features**: Production-like feature set
- **Security**: Production-level security measures
- **Monitoring**: Full monitoring with Sentry and Datadog

### Production Environment
- **Purpose**: Live production deployment
- **Database**: High-availability PostgreSQL with backups
- **Debug**: Disabled with minimal logging
- **Features**: Carefully controlled feature flags
- **Security**: Maximum security with WAF and encryption
- **Monitoring**: Comprehensive monitoring and alerting

## Configuration Sections

### Database Configuration
```json
{
  "database": {
    "type": "postgresql",
    "host": "${DB_HOST}",
    "port": 5432,
    "name": "pixelated_production",
    "username": "${DB_USERNAME}",
    "password": "${DB_PASSWORD}",
    "ssl": true,
    "pool": {
      "min": 10,
      "max": 50,
      "idle_timeout": 30000
    }
  }
}
```

### Redis Configuration
```json
{
  "redis": {
    "host": "${REDIS_HOST}",
    "port": 6379,
    "password": "${REDIS_PASSWORD}",
    "database": 0,
    "key_prefix": "pixelated:prod:",
    "ttl": 3600,
    "cluster": true
  }
}
```

### API Configuration
```json
{
  "api": {
    "host": "0.0.0.0",
    "port": 3000,
    "cors": {
      "enabled": true,
      "origins": ["https://pixelated-empathy.com"],
      "credentials": true
    },
    "rate_limiting": {
      "enabled": true,
      "requests_per_minute": 60
    }
  }
}
```

### Authentication Configuration
```json
{
  "auth": {
    "jwt": {
      "secret": "${JWT_SECRET}",
      "expires_in": "15m",
      "refresh_expires_in": "7d"
    },
    "session": {
      "secret": "${SESSION_SECRET}",
      "max_age": 1800000,
      "secure": true
    }
  }
}
```

### AI Services Configuration
```json
{
  "ai": {
    "openai": {
      "api_key": "${OPENAI_API_KEY}",
      "model": "gpt-4",
      "max_tokens": 2000,
      "temperature": 0.7
    },
    "anthropic": {
      "api_key": "${ANTHROPIC_API_KEY}",
      "model": "claude-3-sonnet-20240229",
      "max_tokens": 2000
    }
  }
}
```

### Monitoring Configuration
```json
{
  "monitoring": {
    "enabled": true,
    "sentry": {
      "enabled": true,
      "dsn": "${SENTRY_DSN}",
      "environment": "production"
    },
    "datadog": {
      "enabled": true,
      "api_key": "${DATADOG_API_KEY}",
      "service": "pixelated-empathy-production"
    }
  }
}
```

### Feature Flags
```json
{
  "features": {
    "user_registration": true,
    "email_verification": true,
    "password_reset": true,
    "social_login": true,
    "ai_chat": true,
    "file_upload": true,
    "analytics": true,
    "maintenance_mode": false
  }
}
```

### Security Configuration
```json
{
  "security": {
    "encryption": {
      "algorithm": "aes-256-gcm",
      "key": "${ENCRYPTION_KEY}"
    },
    "csrf": {
      "enabled": true,
      "secret": "${CSRF_SECRET}"
    },
    "helmet": {
      "enabled": true,
      "content_security_policy": true,
      "hsts": true
    }
  }
}
```

## Environment Manager Commands

### List Environments
```bash
./scripts/env-manager list
```
Shows all available environment configurations.

### Validate Environment
```bash
./scripts/env-manager validate production
```
Validates the JSON syntax and required fields for an environment.

### Switch Environment
```bash
./scripts/env-manager switch staging
```
Switches to the specified environment by generating a new .env file.

### Show Current Environment
```bash
./scripts/env-manager current
```
Displays information about the currently active environment.

### Generate .env File
```bash
./scripts/env-manager generate production .env.prod
```
Generates an .env file for the specified environment.

### Compare Environments
```bash
./scripts/env-manager compare development production
```
Shows configuration differences between two environments.

### Create New Environment
```bash
./scripts/env-manager create testing
```
Creates a new environment template that can be customized.

## Environment Variables

### Required Variables
These variables must be set in your actual environment:

#### Database
- `DB_HOST` - Database server hostname
- `DB_USERNAME` - Database username
- `DB_PASSWORD` - Database password

#### Redis
- `REDIS_HOST` - Redis server hostname
- `REDIS_PASSWORD` - Redis password

#### Authentication
- `JWT_SECRET` - JWT signing secret (minimum 32 characters)
- `SESSION_SECRET` - Session signing secret (minimum 32 characters)
- `CSRF_SECRET` - CSRF protection secret (minimum 32 characters)

#### AI Services
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

#### Monitoring
- `SENTRY_DSN` - Sentry error tracking DSN
- `DATADOG_API_KEY` - Datadog monitoring API key

#### Security
- `ENCRYPTION_KEY` - Data encryption key (32 characters)

### Optional Variables
These variables have defaults but can be customized:

#### AWS (for S3 storage)
- `AWS_REGION` - AWS region
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `S3_BUCKET` - S3 bucket name

#### OAuth
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

#### CDN
- `CLOUDFLARE_ZONE_ID` - Cloudflare zone ID
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token

## Best Practices

### Security
1. **Never commit .env files** to version control
2. **Use strong secrets** (minimum 32 characters for keys)
3. **Rotate secrets regularly** in production
4. **Use environment-specific secrets** (don't reuse across environments)
5. **Enable SSL/TLS** in staging and production

### Configuration Management
1. **Validate configurations** before deployment
2. **Use feature flags** to control functionality
3. **Document configuration changes** in commit messages
4. **Test configuration changes** in staging first
5. **Keep environment parity** as close as possible

### Monitoring
1. **Enable monitoring** in all non-development environments
2. **Set up alerts** for critical metrics
3. **Monitor configuration drift** between environments
4. **Log configuration changes** for audit trails
5. **Use health checks** to verify configuration

## Troubleshooting

### Common Issues

1. **Invalid JSON Configuration**
   ```bash
   # Validate configuration
   ./scripts/env-manager validate production
   
   # Check JSON syntax
   jq . config/environments/production.json
   ```

2. **Missing Environment Variables**
   ```bash
   # Check current environment
   ./scripts/env-manager current
   
   # Regenerate .env file
   ./scripts/env-manager switch production
   ```

3. **Configuration Differences**
   ```bash
   # Compare environments
   ./scripts/env-manager compare staging production
   
   # Check specific sections
   jq '.database' config/environments/staging.json
   ```

4. **Environment Switch Issues**
   ```bash
   # Check prerequisites
   which jq
   
   # Manual .env generation
   ./scripts/env-manager generate development .env.manual
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
export DEBUG=true
./scripts/env-manager switch production
```

### Manual Configuration

If the environment manager fails, you can manually configure:

1. Copy `.env.example` to `.env`
2. Edit `.env` with your specific values
3. Validate with your application's startup

## Integration with Deployment

The environment management system integrates with:

### CI/CD Pipeline
```bash
# In CI/CD scripts
./scripts/env-manager switch $ENVIRONMENT
./scripts/deploy $ENVIRONMENT
```

### Docker Compose
```yaml
# docker-compose.yml
services:
  app:
    env_file:
      - .env
```

### Application Code
```javascript
// Load configuration
const config = require('./config/environments/' + process.env.ENVIRONMENT + '.json');
```

## Support

For environment management issues:

1. Check this documentation
2. Validate your configuration files
3. Compare with working environments
4. Contact the DevOps team

## Contributing

When adding new configuration options:

1. Add to all environment files
2. Update this documentation
3. Add validation if needed
4. Test in development first
5. Update .env.example template
