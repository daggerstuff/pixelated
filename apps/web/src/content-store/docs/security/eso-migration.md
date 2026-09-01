---
title: External Secrets Operator Migration
description:
  Migrating file-based secrets to External Secrets Operator (ESO) backed by
  Vault
pubDate: 2026-07-23
author: Platform Team
tags: ['security', 'infrastructure', 'kubernetes', 'secrets']
draft: false
toc: true
---

## Overview

This document describes the migration from file-based secrets
(`config/secrets/`) to External Secrets Operator (ESO) backed by a secret
manager (Vault, AWS Secrets Manager, or Doppler).

## Why Migrate?

**Before:**

- Secrets stored as plain files in `config/secrets/`
- No rotation, no audit trail, no central management
- K8s `secrets.yaml` used placeholder templates
- Docker Compose used file-based secrets

**After:**

- Secrets managed centrally in Vault/AWS Secrets Manager/Doppler
- ESO syncs secrets into K8s automatically
- Automatic rotation supported by backend
- Full audit trail of secret access
- No secrets committed to git

## Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Vault / AWS SM /   │────▶│  ESO Controller  │────▶│  K8s Secret       │
│  Doppler            │     │  (watches CRDs)    │     │  pixelated-       │
│  (secret store)     │     │                   │     │  empathy-secrets  │
└─────────────────────┘     └──────────────────┘     └───────────────────┘
       ▲                           ▲                          │
       │                           │                          │
  Manual/secrets       ExternalSecret CRD            envFrom secretRef
  manager CLI          (k8s/base/external-secrets)   (deployment.yaml)
```

## Files

| File                               | Purpose                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `k8s/base/secret-store.yaml`       | ClusterSecretStore CRDs for Vault, AWS, Doppler         |
| `k8s/base/external-secrets.yaml`   | ExternalSecret CRDs — maps remote secrets to K8s Secret |
| `k8s/base/eso-install.yaml`        | Helm values for ESO installation                        |
| `k8s/base/secrets.yaml`            | DEPRECATED — static template, kept for CI fallback      |
| `scripts/devops/migrate-to-eso.sh` | Migration automation script                             |
| `config/secrets/`                  | Dev-only secret files (untracked, not committed)        |

## Backend Configuration

### HashiCorp Vault (Primary)

Secrets are stored in Vault KV v2 at `kv/pixelated-empathy/`:

```bash
# Set up Vault paths
vault secrets enable -path=kv kv-v2

vault kv put kv/pixelated-empathy/database \
  user="pixelated" password="REDACTED" host="db.internal" name="pixelated"

vault kv put kv/pixelated-empathy/redis \
  password="REDACTED"

vault kv put kv/pixelated-empathy/auth \
  jwt-secret="REDACTED" api-key="REDACTED"

vault kv put kv/pixelated-empathy/auth0 \
  domain="REDACTED" client-id="REDACTED" client-secret="REDACTED" \
  management-client-id="REDACTED" management-client-secret="REDACTED"

vault kv put kv/pixelated-empathy/security \
  encryption-key="REDACTED"

# K8s auth for ESO
vault auth enable kubernetes
vault write auth/kubernetes/config kubernetes_host="https://kubernetes.default.svc"
vault write auth/kubernetes/role/external-secrets \
  bound_service_account_names="external-secrets" \
  bound_service_account_namespaces="external-secrets" \
  policies="eso-policy" ttl="1h"

vault policy write eso-policy - <<EOF
path "kv/data/pixelated-empathy/*" { capabilities = ["read"] }
EOF
```

### AWS Secrets Manager (Alternative)

```bash
aws secretsmanager create-secret --name pixelated-empathy/database \
  --secret-string '{"user":"pixelated","password":"REDACTED","host":"db.internal","name":"pixelated"}'
```

### Doppler (Dev/Staging)

```bash
doppler secrets set db-password=REDACTED redis-password=REDACTED \
  jwt-secret=REDACTED encryption-key=REDACTED
```

## Installation

### 1. Install ESO

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm upgrade --install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace \
  -f k8s/base/eso-install.yaml
```

### 2. Apply SecretStore

```bash
kubectl apply -f k8s/base/secret-store.yaml
```

### 3. Apply ExternalSecrets

```bash
kubectl apply -f k8s/base/external-secrets.yaml
```

### 4. Verify

```bash
kubectl -n pixelated-empathy get externalsecret
kubectl -n pixelated-empathy get secret pixelated-empathy-secrets
```

### 5. Verify No Secrets in Git

```bash
./scripts/devops/migrate-to-eso.sh --verify
```

## Dev Workflow

Local development still uses `config/secrets/` files:

```bash
cd config/secrets
for f in *.example; do cp "$f" "${f%.example}"; done
# Edit files with your local values
```

Docker Compose continues to use file-based secrets for local dev.

## Secret Rotation

With ESO, rotation is handled by the backend:

- **Vault**: Use `vault kv put` to update the secret value. ESO syncs within
  `refreshInterval` (1h by default).
- **AWS Secrets Manager**: Use rotation Lambda functions.
- **Doppler**: Update in Doppler dashboard; ESO syncs automatically.

To force immediate refresh:

```bash
kubectl -n pixelated-empathy annotate externalsecret/pixelated-empathy-secrets \
  force-sync=$(date +%s) --overwrite
```

## Audit Trail

ESO logs all secret access. To view audit logs:

```bash
kubectl -n external-secrets logs -l app.kubernetes.io/name=external-secrets | grep pixelated-empathy
```

Vault audit:

```bash
vault audit enable file file_path=/var/log/vault/audit.log
vault audit list
```

## Backward Compatibility

The deprecated `k8s/base/secrets.yaml` is retained for CI/testing fallback. The
`k8s/base/kustomization.yaml` now includes `secret-store.yaml` and
`external-secrets.yaml` instead of `secrets.yaml`.

To use the static template for CI:

```bash
scripts/render-k8s-secrets.sh > k8s/base/secrets.generated.yaml
# Apply secrets.generated.yaml instead of external-secrets.yaml
```
