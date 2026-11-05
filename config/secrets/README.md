# Local Development Secrets

This directory holds secret **files** for local Docker Compose and developer
workflows. Production traffic is served from Cloudflare Workers; runtime secrets
there are configured via repository `CF_WORKER_*` GitHub Actions secrets and
synced during deploy (see `AGENTS.md` and `.github/workflows/deploy-cloudflare.yml`).

## Setup

Copy the example files and fill in your local values:

```bash
for f in *.example; do cp "$f" "${f%.example}"; done
```

Or create them manually:

```bash
echo "dummy-db-password" > db-password
echo "dummy-redis-password" > redis-password
echo "dummy-jwt-secret" > jwt-secret
echo "dummy-encryption-key" > encryption-key
echo "your-auth0-domain" > auth0-domain
echo "your-auth0-client-id" > auth0-client-id
echo "your-auth0-client-secret" > auth0-client-secret
echo "your-auth0-mgmt-client-id" > auth0-management-client-id
echo "your-auth0-mgmt-client-secret" > auth0-management-client-secret
```

## Files

| File                             | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `db-password`                    | PostgreSQL password                |
| `redis-password`                 | Redis password                     |
| `jwt-secret`                     | JWT signing secret                 |
| `encryption-key`                 | FHE encryption key                 |
| `auth0-domain`                   | Auth0 tenant domain                |
| `auth0-client-id`                | Auth0 client ID                    |
| `auth0-client-secret`            | Auth0 client secret                |
| `auth0-management-client-id`     | Auth0 management API client ID     |
| `auth0-management-client-secret` | Auth0 management API client secret |

## Production vs local

- **Local / Compose**: stacks under `infra/docker/` mount these paths as Docker
  secrets (for example `docker-compose.prod.yml` and environment-specific
  compose files). Do not commit real values; keep only `*.example` templates in
  git.
- **Production (Workers)**: do not copy this directory to Cloudflare. Use the
  Worker secret workflow documented in `AGENTS.md`; Vercel standby uses its own
  project environment variables when deployed.
