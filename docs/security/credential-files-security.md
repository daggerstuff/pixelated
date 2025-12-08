# Credential Files Security

## Overview

This document describes the security measures for handling Azure and Kubernetes credential files in this repository.

## Security Issues Fixed

### Issue 1: Azure Service Principal Credentials
**Status**: ✅ Fixed

Files containing Azure service principal credentials (tenantId, servicePrincipalId, servicePrincipalKey) were found in the repository. These have been removed.

**Action Required**:
- If these were real credentials, they MUST be rotated immediately in Azure Portal
- Use Azure Key Vault or environment variables for credential storage
- Never commit credential files to version control

### Issue 2: Kubernetes Cluster Credentials
**Status**: ✅ Fixed

Files containing Kubernetes kubeconfig with authentication tokens and certificates were found. These have been removed.

**Action Required**:
- If these were real credentials, rotate the cluster credentials:
  ```bash
  az aks rotate-certs --resource-group <resource-group> --name <cluster-name>
  ```
- Regenerate kubeconfig if needed
- Never commit kubeconfig files to version control

### Issue 3: Script Security Controls
**Status**: ✅ Fixed

The `create_k8s_json.py` script has been enhanced with:
- Security warnings and documentation
- File permission controls (0600 - owner read/write only)
- Input validation
- Error handling
- Command-line arguments for flexibility
- Timeout protection

## Template Files

Template files are provided for reference:
- `azure-connection.template.json` - Template for Azure service connection
- `k8s-connection.template.json` - Template for Kubernetes connection

**These templates are safe to commit** - they contain placeholder values only.

## Usage

### Generating Kubernetes Connection JSON

Use the secure script to generate connection files:

```bash
python create_k8s_json.py \
  --resource-group pixelated-azure-resources \
  --name pixelated-aks-cluster \
  --output k8s-connection.json
```

The script will:
1. Validate Azure CLI is installed
2. Fetch kubeconfig securely
3. Create output file with restrictive permissions (0600)
4. Display security warnings

### Azure Connection Files

For Azure service connections, manually create files from the template:

1. Copy `azure-connection.template.json` to your desired filename
2. Fill in the placeholder values
3. **Never commit the filled file to git**

## Git Ignore Rules

The following patterns are ignored by git:
- `*azure-connection*.json` (except templates)
- `*k8s-connection*.json` (except templates)
- `filled-*.json`
- `*service-connection*.json`

## Best Practices

1. **Never commit credential files** - Use `.gitignore` patterns
2. **Use environment variables** - For CI/CD pipelines
3. **Use Azure Key Vault** - For production secrets
4. **Rotate credentials regularly** - Especially after exposure
5. **Set file permissions** - Use 0600 for credential files
6. **Use templates** - Reference templates, never real credentials

## Credential Rotation

If credentials were exposed:

### Azure Service Principal
1. Go to Azure Portal → Azure Active Directory → App registrations
2. Find the service principal
3. Go to "Certificates & secrets"
4. Delete the exposed secret
5. Create a new secret
6. Update all systems using the old secret

### Kubernetes Cluster
1. Rotate cluster certificates:
   ```bash
   az aks rotate-certs --resource-group <rg> --name <cluster>
   ```
2. Regenerate kubeconfig:
   ```bash
   az aks get-credentials --resource-group <rg> --name <cluster>
   ```
3. Update all systems using the old kubeconfig

## Related Documentation

- [Azure Key Vault vs Variable Groups](../azure-devops/key-vault-vs-variable-groups.md)
- [Security Best Practices](../security/credential-management.md)
- [Pipeline Security](../security/pipeline-security.md)

