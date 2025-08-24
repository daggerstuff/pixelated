# Azure Deployment Fixes

## Issues Fixed

### 1. Container Registry Access Issues

**Problem**: ACR had `adminUserEnabled: false` and `publicNetworkAccess: 'Disabled'`, but the template was trying to use
`listCredentials()`.

**Fix**:

- Enabled admin user for ACR
- Enabled public network access for GitHub Actions
- Added managed identity authentication for App Service and Container Apps
- Added proper RBAC role assignments for ACR pull access

### 2. Port Configuration Mismatch

**Problem**: Infrastructure was configured for port 4321 but should use 3000 for consistency.

**Fix**:

- Updated Bicep template to use port 3000
- Updated Dockerfile.azure to expose port 3000
- Updated health check endpoints

### 3. Deployment Slots Issues

**Problem**: Workflow was trying to deploy to non-existent staging slots.

**Fix**:

- Removed slot-name parameter from deployment
- Simplified App Service URL generation
- Removed slot-specific configuration

### 4. Network Access Restrictions

**Problem**: Key Vault and ACR had restrictive network policies preventing GitHub Actions access.

**Fix**:

- Enabled public network access for Key Vault
- Relaxed network ACL policies
- Disabled purge protection for development

## Key Changes Made

### infra/main.bicep

- ✅ Enabled ACR admin user and public access
- ✅ Added managed identity for App Service and Container Apps
- ✅ Added RBAC role assignments for ACR access
- ✅ Updated port configuration to 3000
- ✅ Relaxed Key Vault network policies
- ✅ Fixed zone redundancy settings

### .github/workflows/azure-deployment.yml

- ✅ Removed deployment slot configuration
- ✅ Simplified App Service URL generation
- ✅ Updated port references to 3000

### Dockerfile.azure

- ✅ Updated port configuration to 3000
- ✅ Updated health check endpoint

## Testing

Run the validation script to test the Bicep template:

```bash
./scripts/validate-bicep.sh
```

## Next Steps

1. Commit these changes
2. Push to trigger the deployment pipeline
3. Monitor the deployment logs for any remaining issues
4. Test the deployed application endpoints

## Security Notes

For production deployments, consider:

- Re-enabling network restrictions after initial setup
- Using private endpoints for ACR and Key Vault
- Implementing proper RBAC instead of admin user for ACR
- Adding application insights for monitoring