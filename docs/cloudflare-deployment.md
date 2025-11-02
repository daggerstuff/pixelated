# Cloudflare Deployment Guide

This guide covers deploying Pixelated Empathy to Cloudflare Workers/Pages.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Already included in dependencies
3. **pnpm**: Package manager (already configured)

## Initial Setup

### 1. Authenticate with Cloudflare

```bash
pnpm wrangler login
```

Or set environment variables:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

### 2. Create Required Resources

Run the setup script to create KV namespaces and R2 buckets:

```bash
pnpm cf:setup
```

This creates:
- **KV Namespaces**: `CACHE`, `SESSIONS` (with preview versions)
- **R2 Buckets**: `pixelated-assets`, `pixelated-uploads` (with preview versions)

### 3. Update wrangler.toml

After running setup, update `wrangler.toml` with the IDs from the output:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-id-here"
preview_id = "your-preview-kv-id-here"
```

### 4. Configure Secrets

Set up environment secrets:

```bash
# For production
pnpm cf:secrets production

# For staging
pnpm cf:secrets staging
```

Or manually set individual secrets:

```bash
echo "your-secret-value" | pnpm wrangler secret put SECRET_NAME --env production
```

### 5. Local Development Variables

Copy the example file and fill in your values:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your local development credentials.

## Deployment

### Deploy to Production

```bash
pnpm cf:deploy
```

### Deploy to Staging

```bash
pnpm cf:deploy:staging
```

### Deploy to Development

```bash
pnpm cf:deploy:dev
```

## Available Commands

### Deployment Scripts

```bash
# Deploy to environments
pnpm cf:deploy              # Production
pnpm cf:deploy:staging      # Staging
pnpm cf:deploy:dev          # Development

# Setup and configuration
pnpm cf:setup               # Create KV/R2 resources
pnpm cf:secrets             # Configure secrets

# Monitoring and debugging
pnpm cf:logs                # Tail production logs
pnpm cf:rollback            # Rollback production deployment

# Direct wrangler access
pnpm wrangler [command]     # Run any wrangler command
```

### Wrangler Commands

```bash
# Development
pnpm wrangler dev                    # Local development server
pnpm wrangler dev --remote           # Remote development

# Deployment
pnpm wrangler deploy                 # Deploy to production
pnpm wrangler deploy --env staging   # Deploy to staging

# KV Operations
pnpm wrangler kv:namespace list
pnpm wrangler kv:key list --binding CACHE
pnpm wrangler kv:key get "key-name" --binding CACHE
pnpm wrangler kv:key put "key-name" "value" --binding CACHE

# R2 Operations
pnpm wrangler r2 bucket list
pnpm wrangler r2 object list pixelated-assets
pnpm wrangler r2 object get pixelated-assets/file.txt

# Secrets Management
pnpm wrangler secret list
pnpm wrangler secret put SECRET_NAME
pnpm wrangler secret delete SECRET_NAME

# Logs and Monitoring
pnpm wrangler tail                   # Tail logs
pnpm wrangler tail --format pretty   # Pretty formatted logs

# Rollback
pnpm wrangler rollback               # Rollback to previous version
pnpm wrangler deployments list       # List deployments
```

## Configuration

### Environment Variables

Set in `wrangler.toml` under `[vars]` or `[env.production.vars]`:

```toml
[vars]
NODE_ENV = "production"
PUBLIC_SITE_URL = "https://pixelatedempathy.com"
```

### Secrets

Sensitive values should be set as secrets (not in wrangler.toml):

```bash
echo "secret-value" | pnpm wrangler secret put SECRET_NAME
```

### Bindings

Configure in `wrangler.toml`:

- **KV Namespaces**: Key-value storage
- **R2 Buckets**: Object storage
- **D1 Databases**: SQL databases
- **Durable Objects**: Stateful objects
- **Workers AI**: AI model inference
- **Vectorize**: Vector embeddings

## Architecture

### Workers vs Pages

**Workers** (Current Setup):
- Full Node.js compatibility
- Server-side rendering
- API routes
- Background jobs

**Pages** (Alternative):
- Static site hosting
- Edge functions
- Git integration
- Automatic deployments

### Resource Limits

- **CPU Time**: 50,000ms per request (configured)
- **Memory**: 128MB default
- **Request Size**: 100MB
- **Response Size**: Unlimited

### Pricing Tiers

- **Free**: 100,000 requests/day
- **Paid**: $5/month for 10M requests
- **Enterprise**: Custom pricing

## Monitoring

### View Logs

```bash
# Real-time logs
pnpm cf:logs

# Filtered logs
pnpm wrangler tail --format pretty --status error
```

### Analytics

Access analytics in Cloudflare Dashboard:
- Request volume
- Error rates
- CPU usage
- Bandwidth

### Observability

Configured in `wrangler.toml`:

```toml
[observability]
enabled = true
head_sampling_rate = 1.0
```

## Troubleshooting

### Build Errors

```bash
# Clean build
rm -rf dist node_modules/.vite
pnpm install
pnpm build
```

### Authentication Issues

```bash
# Re-authenticate
pnpm wrangler logout
pnpm wrangler login
```

### Deployment Failures

```bash
# Check deployment status
pnpm wrangler deployments list

# View specific deployment
pnpm wrangler deployment view [deployment-id]

# Rollback if needed
pnpm cf:rollback
```

### Local Development Issues

```bash
# Use remote development mode
pnpm wrangler dev --remote

# Clear local cache
rm -rf .wrangler
```

## Custom Domains

### Add Domain

1. Add domain to Cloudflare
2. Update `wrangler.toml`:

```toml
[[routes]]
pattern = "pixelatedempathy.com/*"
custom_domain = true
```

3. Deploy:

```bash
pnpm cf:deploy
```

### SSL/TLS

Cloudflare automatically provisions SSL certificates for custom domains.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm build
      
      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production
```

## Best Practices

1. **Use Environments**: Separate dev/staging/production
2. **Secrets Management**: Never commit secrets to git
3. **Resource Naming**: Use consistent naming conventions
4. **Monitoring**: Set up alerts for errors
5. **Testing**: Test locally with `wrangler dev` first
6. **Rollback Plan**: Always have a rollback strategy
7. **Documentation**: Keep deployment docs updated

## Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
- [R2 Storage](https://developers.cloudflare.com/r2/)

## Support

For issues or questions:
- Cloudflare Community: [community.cloudflare.com](https://community.cloudflare.com)
- Discord: [Cloudflare Developers](https://discord.gg/cloudflaredev)
- Documentation: [developers.cloudflare.com](https://developers.cloudflare.com)
