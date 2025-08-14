# Environment Variables Setup

This document explains how to set up environment variables for the Pixelated Empathy application in your Forgejo CI/CD pipeline.

## Overview

The application uses environment variables for configuration, and these need to be securely stored in Forgejo secrets rather than being committed to the repository.

## Quick Setup

1. **Run the setup script:**
   ```bash
   ./scripts/setup-forgejo-secrets.sh
   ```

2. **Install forgejo-cli (if not already installed):**
   ```bash
   cargo install forgejo-cli
   ```

3. **Set your secrets:**
   ```bash
   # Example: Set database URL
   fj secret set DATABASE_URL "postgresql://user:pass@host:5432/db"
   
   # Example: Set API key
   echo "sk-your-api-key" | fj secret set OPENAI_API_KEY
   ```

## Required Environment Variables

### Core Application
- `NODE_ENV` - Environment (production/staging/development)
- `PORT` - Application port (default: 4321)
- `LOG_LEVEL` - Logging level (info/debug/error)

### Database
- `DATABASE_URL` - Full database connection string
- `DATABASE_HOST` - Database host
- `DATABASE_PORT` - Database port
- `DATABASE_NAME` - Database name
- `DATABASE_USER` - Database username
- `DATABASE_PASSWORD` - Database password

### Authentication
- `JWT_SECRET` - Secret for JWT token signing
- `SESSION_SECRET` - Secret for session management

### AI Services
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

### External Services
- `REDIS_URL` - Redis connection URL
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASSWORD` - SMTP password

### Monitoring
- `SENTRY_DSN` - Sentry error tracking DSN
- `LOGTAIL_TOKEN` - Logtail logging token

### Feature Flags
- `ENABLE_AI_FEATURES` - Enable AI features (true/false)
- `ENABLE_ANALYTICS` - Enable analytics (true/false)

## Security Features
- `ENABLE_RATE_LIMITING` - Enable rate limiting
- `RATE_LIMIT_WINDOW` - Rate limit window in seconds
- `RATE_LIMIT_MAX_REQUESTS` - Maximum requests per window
- `ENABLE_HIPAA_COMPLIANCE` - Enable HIPAA compliance features
- `ENABLE_AUDIT_LOGGING` - Enable audit logging
- `ENABLE_DATA_MASKING` - Enable data masking

## How It Works

1. **Local Development:** Use a `.env` file (not committed to git)
2. **CI/CD Pipeline:** Environment variables are created from Forgejo secrets
3. **Production:** Environment variables are securely deployed to your VPS

## Workflow Process

1. The `prepare-env` job creates environment content from secrets
2. The content is base64 encoded and passed between jobs
3. The `deploy` job decodes the content and creates a `.env` file on the VPS
4. The Docker container uses the environment variables

## Troubleshooting

### "No .env file found" Error
This is expected! The workflow doesn't need a local `.env` file. It creates the environment from secrets.

### Missing Secrets
If you get errors about missing secrets, add them using:
```bash
forgejo-cli secret set SECRET_NAME "value"
```

### Secret Not Working
Check that:
1. The secret name matches exactly (case-sensitive)
2. The secret value is correct
3. You're in the right repository context

## Best Practices

1. **Never commit `.env` files** to the repository
2. **Use strong, unique secrets** for JWT_SECRET and SESSION_SECRET
3. **Rotate secrets regularly** for security
4. **Use different secrets** for different environments
5. **Monitor secret usage** in Forgejo logs

## Example Commands

```bash
# List all secrets
fj secret list

# Set a secret
fj secret set DATABASE_URL "postgresql://user:pass@host:5432/db"

# Set a secret from file
cat .env.local | fj secret set ENV_CONTENT

# Delete a secret
fj secret delete SECRET_NAME
```

## Local Development

For local development, create a `.env` file based on `env.example`:

```bash
cp env.example .env
# Edit .env with your local values
```

The `.env` file is already in `.gitignore` and won't be committed.
