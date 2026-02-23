# Azure Key Vault vs Variable Groups

## Decision Matrix

### ✅ Use Variable Groups (Current Setup) For:
- **Non-sensitive configuration**: Version numbers, resource names, URLs, namespaces
- **Build settings**: Node version, Python version, build pool
- **Deployment config**: Timeouts, resource groups, cluster names
- **Quick access**: Variables that don't require encryption at rest

### ✅ Use Azure Key Vault For:
- **Secrets**: API keys, passwords, tokens, certificates
- **Sensitive data**: Connection strings, credentials, SSH keys
- **Compliance requirements**: HIPAA, PCI-DSS, GDPR
- **Audit logging**: Track who accessed what secrets and when
- **Rotation policies**: Automatic secret rotation
- **Encryption at rest**: Hardware-backed encryption

## Current Variables Analysis

All current variables in `pixelated-pipeline-variables` are **non-sensitive configuration values**:
- ✅ `NODE_VERSION`: Version number (not a secret)
- ✅ `PNPM_VERSION`: Version number (not a secret)
- ✅ `AZURE_RESOURCE_GROUP`: Resource name (not a secret)
- ✅ `AKS_CLUSTER_NAME`: Cluster name (not a secret)
- ✅ `STAGING_URL`: Public URL (not a secret)

**Conclusion**: Variable Groups are appropriate for these.

## When to Use Key Vault

You should use Azure Key Vault if you have:

### Secrets for Application Deployment:
- `MONGODB_URI` - Database connection string with credentials
- `REDIS_PASSWORD` - Redis authentication password
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - API key (should be in Key Vault)
- `SENTRY_AUTH_TOKEN` - Sentry authentication token
- `AZURE_CLIENT_SECRET` - Azure service principal secret
- `BETTER_AUTH_SECRET` - Authentication secret
- `RESEND_API_KEY` - Email API key

### Secrets for Pipeline Operations:
- Service principal passwords
- Docker registry passwords
- Git credentials (if needed)
- SSH private keys
- TLS certificates

## Hybrid Approach (Recommended)

For production pipelines, use a **hybrid approach**:

1. **Variable Group** for non-sensitive config (current setup)
2. **Azure Key Vault Variable Group** linked to Key Vault for secrets

### Example Setup:

```yaml
variables:
  # Non-sensitive configuration
  - group: pixelated-pipeline-variables
  
  # Secrets from Azure Key Vault
  - group: pixelated-secrets-keyvault
```

## How to Link Key Vault to Variable Group

### Option 1: Link Variable Group to Key Vault (Recommended)

1. **Create Azure Key Vault**:
   ```bash
   az keyvault create \
     --name pixelated-secrets-kv \
     --resource-group pixelated-azure-resources \
     --location eastus
   ```

2. **Store secrets in Key Vault**:
   ```bash
   az keyvault secret set \
     --vault-name pixelated-secrets-kv \
     --name MongoDBUri \
     --value "mongodb://..."
   ```

3. **Create Variable Group linked to Key Vault**:
   - Go to **Pipelines** → **Library** → **+ Variable group**
   - Name: `pixelated-secrets-keyvault`
   - Check **Link secrets from an Azure key vault as variables**
   - Select Key Vault: `pixelated-secrets-kv`
   - Authorize the connection
   - Select which secrets to include as variables

4. **Reference in Pipeline**:
   ```yaml
   variables:
     - group: pixelated-pipeline-variables
     - group: pixelated-secrets-keyvault
   ```

### Option 2: Use Key Vault Task (Direct Access)

Access Key Vault secrets directly in pipeline:

```yaml
steps:
  - task: AzureKeyVault@2
    inputs:
      azureSubscription: '$(AZURE_SUBSCRIPTION)'
      KeyVaultName: 'pixelated-secrets-kv'
      SecretsFilter: '*'
```

## Security Best Practices

### ✅ Do:
- Store all secrets in Azure Key Vault
- Use Variable Groups only for non-sensitive config
- Enable audit logging on Key Vault
- Use managed identities where possible
- Rotate secrets regularly
- Limit access with RBAC

### ❌ Don't:
- Store secrets in Variable Groups (unless marked as secret and required for backward compatibility)
- Hardcode secrets in pipeline YAML
- Commit secrets to repositories
- Share secrets across environments without rotation

## Migration Path

If you need to add secrets later:

1. Create Azure Key Vault
2. Store secrets in Key Vault
3. Create Key Vault-linked Variable Group
4. Add variable group reference to pipeline
5. Keep existing Variable Group for non-sensitive config

## Current Status

✅ **Correctly configured**: Current variables are all non-sensitive and appropriately stored in Variable Groups.

🔒 **Future enhancement**: When adding secrets (API keys, passwords, etc.), create a Key Vault-linked Variable Group.

