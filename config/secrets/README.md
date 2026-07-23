# Local Development Secrets

This directory contains secret files for local development. In production,
secrets are managed by External Secrets Operator (ESO) backed by Vault or
AWS Secrets Manager — see `k8s/base/external-secrets.yaml`.

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

| File | Purpose |
|------|---------|
| `db-password` | PostgreSQL password |
| `redis-password` | Redis password |
| `jwt-secret` | JWT signing secret |
| `encryption-key` | FHE encryption key |
| `auth0-domain` | Auth0 tenant domain |
| `auth0-client-id` | Auth0 client ID |
| `auth0-client-secret` | Auth0 client secret |
| `auth0-management-client-id` | Auth0 management API client ID |
| `auth0-management-client-secret` | Auth0 management API client secret |

## Production

In production, these files are NOT used. Secrets are synced from the
external secret store (Vault/AWS Secrets Manager/Doppler) by ESO into
Kubernetes Secret resources. See `k8s/base/external-secrets.yaml`.

Docker Compose production (`docker/docker-compose.production.yml`) uses
these files as Docker secrets. For production deployments, mount secrets
from the secret store instead.
