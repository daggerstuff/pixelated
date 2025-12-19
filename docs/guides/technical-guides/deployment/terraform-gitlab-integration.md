# Terraform GitLab-managed State Integration Guide

This guide walks you through setting up GitLab-managed Terraform state for your Azure infrastructure with Azure DevOps pipeline integration.

## Step 1: Set up GitLab Project for State Management

1. **Create a GitLab Project**:
   - Go to gitlab.com or your GitLab instance
   - Create a new project: `pixelated-infrastructure`
   - Make it private (recommended for state storage)

2. **Get Your Project ID**:
   - Go to your project settings
   - Find the project ID in the General settings
   - Example: Project ID is `12345678`

3. **Create a GitLab Access Token**:
   - Go to **User Settings → Access Tokens**
   - Create token with `api` scope
   - Copy the token (format: `glpat-xxxxxxxxxxxxxxxxxxxx`)

## Step 2: Configure Terraform Backend

1. **Update the backend configuration**:
   ```bash
   cd terraform
   cp backend.config.example backend.config
   ```

   Edit `backend.config` with your GitLab values:
   ```hcl
   address = "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure"
   lock_address = "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock"
   unlock_address = "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock"
   username = "gitlab-ci-token"
   
   # HTTP methods for lock/unlock operations (required)
   lock_method = "POST"
   unlock_method = "DELETE"
   ```

   **Note**: 
   - The state name `pixelated-azure-infrastructure` will create a remote state file in GitLab that tracks all your Azure infrastructure.
   - The GitLab token should be set via environment variable `TF_HTTP_PASSWORD` (not in the config file)
   - `lock_method` and `unlock_method` are required for proper state locking
   - Never commit `backend.config` with actual tokens

2. **Set the GitLab token as an environment variable**:
   ```bash
   export TF_HTTP_PASSWORD="glpat-xxxxxxxxx"
   ```
   
   Or in Azure DevOps, store `TF_HTTP_PASSWORD` as an encrypted variable

## Step 3: Set up Azure DevOps Variables

Add these to your Azure DevOps pipeline variable groups:

1. **In Azure DevOps → Pipelines → Library → Variable Groups**:

   **Create "pixelated-terraform-variables"**:

   | Variable Name | Value | Secret? | Description |
   |-------------|--------|---------|-------------|
   | `TERRAFORM_VERSION` | `1.9.0` | ❌ | Terraform version to use (project requires >= 1.0) |
   | `TERRAFORM_STATE_ADDRESS` | `https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure` | ❌ | GitLab state API endpoint |
   | `TERRAFORM_LOCK_ADDRESS` | `https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock` | ❌ | Lock state endpoint |
   | `TERRAFORM_UNLOCK_ADDRESS` | `https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock` | ❌ | Unlock state endpoint |
   | `GITLAB_PROJECT_ID` | `77130665` | ❌ | Your GitLab project ID |
   | `TF_HTTP_PASSWORD` | `glpat-xxxxxxxxx` | ✅ | GitLab API token for backend authentication (use your actual token) |

   **Important**: Use `TF_HTTP_PASSWORD` (not `GITLAB_TOKEN`) as this is the environment variable Terraform's HTTP backend expects.

2. **Update your existing variable group**:
   Add to "pixelated-pipeline-variables":
   - `AZURE_SUBSCRIPTION_ID` = `b125799a-7bf1-475d-adce-fff747834f73` (if not already present)
   - `AZURE_TENANT_ID` = `15760c36-862d-4476-9c87-baeb9fb6e1cd` (if not already present)
   - `TF_HTTP_PASSWORD` = `glpat-xxxxxxxxx` (✅ Secret) - Same as above, for pipeline use

## Step 4: Azure Service Principal Setup

If not using managed identity, create a Service Principal:

```bash
# Create service principal
az ad sp create-for-rbac --name "pixelated-terraform-sp" \
  --role "Contributor" \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID

# Output will have:
# appId (client_id), password (client_secret), and tenant
```

Store these in Azure DevOps as encrypted variables:
- `AZURE_CLIENT_ID` (the appId)
- `AZURE_CLIENT_SECRET` (the password)
- `AZURE_TENANT_ID` (the tenant)

## Step 5: Test Terraform Locally

Before pushing to pipeline, test locally:

```bash
cd terraform

# Initialize with GitLab backend
export TF_HTTP_PASSWORD="glpat-xxxxxxxxx"  # Your GitLab token
terraform init -backend-config=backend.config

# If you get "Backend configuration changed" error:
# - Use -reconfigure to update backend config without migrating state
# - Use -migrate-state if you need to migrate state from another backend
terraform init -backend-config=backend.config -reconfigure

# If this is the first time (state doesn't exist yet), you may need to:
# 1. Create the state file first without locking:
terraform plan -var-file=environments/staging.tfvars -lock=false

# 2. After the state file is created, subsequent operations can use locking:
terraform plan -var-file=environments/staging.tfvars

# Review the plan output
terraform show
```

**Note**: 
- If you get a `405 Method Not Allowed` error on the first run, it means the state file doesn't exist in GitLab yet. Run the first `terraform plan` or `terraform apply` with `-lock=false` to create the initial state file.
- If you get "Backend configuration changed" error, use `-reconfigure` flag to update the backend configuration without losing state.

## Step 6: Run Azure DevOps Terraform Pipeline

1. **Create a new pipeline** in Azure DevOps:
   ```yaml
   # Example azure-pipelines-terraform.yml
   trigger:
     branches:
       include:
         - main
         - develop
   
   variables:
     - group: pixelated-terraform-variables
     - group: pixelated-pipeline-variables
   
   stages:
   - stage: TerraformPlan
     displayName: 'Terraform Plan'
     jobs:
     - job: Plan
       displayName: 'Plan Infrastructure'
       pool:
         vmImage: 'ubuntu-latest'
       steps:
       - task: TerraformInstaller@0
         displayName: 'Install Terraform'
         inputs:
           terraformVersion: $(TERRAFORM_VERSION)
       
       - task: TerraformTaskV4@4
         displayName: 'Terraform Init & Plan'
         inputs:
           provider: 'azurerm'
           command: 'init'
           backendServiceArm: 'your-azure-service-connection'
           backendAzureRmResourceGroupName: 'your-resource-group'
           backendAzureRmStorageAccountName: 'your-storage-account'
           backendAzureRmContainerName: 'tfstate'
           backendAzureRmKey: 'terraform.tfstate'
           workingDirectory: '$(System.DefaultWorkingDirectory)/terraform'
           environmentServiceNameAzureRM: 'your-azure-service-connection'
       
       - task: TerraformTaskV4@4
         displayName: 'Terraform Plan'
         inputs:
           provider: 'azurerm'
           command: 'plan'
           workingDirectory: '$(System.DefaultWorkingDirectory)/terraform'
           environmentServiceNameAzureRM: 'your-azure-service-connection'
           commandOptions: '-var-file=environments/staging.tfvars'
   ```

2. **Configure pipeline variables**:
   - Reference the variable groups created in Step 3
   - Ensure `TF_HTTP_PASSWORD` is available to the pipeline
   - Set up Azure service connection for authentication

3. **Manually trigger the pipeline**:
   - Go to **Pipelines** in Azure DevOps
   - Create new pipeline → Existing Azure Pipelines YAML
   - Select `azure-pipelines-terraform.yml`
   - Trigger with parameters:
     - terraformAction: `plan`
     - environment: `staging`

4. **Monitor pipeline execution**:
   - Check the logs for any errors
   - View Terraform plan details in artifacts
   - Verify GitLab state was created successfully
   - Check GitLab project → Infrastructure → Terraform States to see state history

## Step 7: Review Infrastructure Changes

After each run, review:
1. **Terraform Plan**: Check what changed
2. **Pipeline logs**: Check for warnings
3. **GitLab state history**: View all infrastructure changes
4. **Azure resources**: Verify resources were created/updated

## Step 8: Production Deployment

When ready for production:

1. **Plan production changes**: Same process but use `environments/production.tfvars`
2. **Manual approval**: The pipeline requires manual approval in Azure DevOps
3. **Production verification**: Check all resources after apply
4. **Rollback if needed**: GitLab keeps history - you can rollback to any previous version

## GitLab State Management Features

### Benefits You Get:
- ✅ **State locking** prevents concurrent modifications
- ✅ **State encryption** at rest in GitLab
- ✅ **Version history** shows all infrastructure changes
- ✅ **Access control** via project permissions
- ✅ **Web UI** for viewing state snapshots
- ✅ **API access** for automation

### Common Operations:

**View current state:**
```bash
curl "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure" \
  -H "PRIVATE-TOKEN: glpat-xxxxxx"
```

**View specific state version:**
```bash
curl "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/versions/<serial>" \
  -H "PRIVATE-TOKEN: glpat-xxxxxx"
```

**List all state versions:**
```bash
curl "https://gitlab.com/api/v4/projects/77130665/terraform/states" \
  -H "PRIVATE-TOKEN: glpat-xxxxxx"
```

**Lock state (manual):**
```bash
curl -X POST "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock" \
  -H "PRIVATE-TOKEN: glpat-xxxxxx"
```

**Unlock state (manual):**
```bash
curl -X DELETE "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock" \
  -H "PRIVATE-TOKEN: glpat-xxxxxx"
```

**Compare versions visually using GitLab UI:**
- Navigate to your GitLab project → Infrastructure → Terraform States
- Select your state name to view version history

## Troubleshooting

### Issue: "403 Forbidden" on GitLab API
**Solution**: 
- Verify your GitLab token has `api` scope
- Ensure the token has at least **Maintainer** role on the project (required for locking/unlocking)
- Check project permissions in GitLab project settings

### Issue: "Backend configuration changed"
**Solution**: 
- This occurs when the backend configuration in `backend.config` has changed
- Use `-reconfigure` to update the backend configuration:
  ```bash
  terraform init -backend-config=backend.config -reconfigure
  ```
- This updates the backend config without migrating state
- Use `-migrate-state` if you're migrating from a different backend type

### Issue: "405 Method Not Allowed" on first run
**Solution**: 
- This occurs when the state file doesn't exist yet in GitLab
- Run the first operation with `-lock=false` to create the initial state:
  ```bash
  terraform plan -var-file=environments/staging.tfvars -lock=false
  ```
- Subsequent operations will work normally with locking enabled

### Issue: "State lock held"
**Solution**: 
- Wait for the other pipeline/operation to complete
- If stuck, manually unlock via GitLab API:
  ```bash
  curl -X DELETE "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock" \
    -H "PRIVATE-TOKEN: glpat-xxxxxx"
  ```
- Or use `terraform force-unlock <LOCK_ID>` if you have the lock ID

### Issue: "Provider authentication failed"
**Solution**: 
- Check Azure DevOps service connection permissions
- Verify subscription ID and tenant ID are correct
- Ensure service principal has Contributor role on the subscription
- For managed identity, verify the identity has proper permissions

### Issue: Plan shows unexpected changes
**Solution**: 
- Check for manual resource changes in Azure portal
- Import unknown resources to state:
  ```bash
  terraform import azurerm_resource_group.main /subscriptions/SUB_ID/resourceGroups/RESOURCE_NAME
  ```
- Review Terraform state for drift: `terraform state list`

### Issue: "Unsupported argument" errors in backend.config
**Solution**: 
- Ensure parameter names are lowercase (e.g., `address`, not `ADDRESS`)
- Verify `lock_method = "POST"` and `unlock_method = "DELETE"` are set
- Check Terraform version compatibility (requires >= 1.0)

## Azure DevOps Variable Groups Best Practices

### Creating Variable Groups via Terraform (Optional)

You can manage Azure DevOps variable groups as code using the `azuredevops` provider:

```hcl
terraform {
  required_providers {
    azuredevops = {
      source  = "microsoft/azuredevops"
      version = ">=0.1.0"
    }
  }
}

provider "azuredevops" {
  org_service_url = var.azure_devops_org_url
  personal_access_token = var.azure_devops_pat
}

resource "azuredevops_variable_group" "terraform_vars" {
  project_id   = var.azure_devops_project_id
  name         = "pixelated-terraform-variables"
  description  = "Terraform variables for GitLab state backend"
  allow_access = true

  variable {
    name  = "TERRAFORM_VERSION"
    value = "1.9.0"
  }

  variable {
    name  = "TERRAFORM_STATE_ADDRESS"
    value = "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure"
  }

  variable {
    name         = "TF_HTTP_PASSWORD"
    secret_value = var.gitlab_token
    is_secret    = true
  }
}
```

### Linking Variable Groups to Key Vault

For enhanced security, link variable groups to Azure Key Vault:

```hcl
resource "azuredevops_serviceendpoint_azurerm" "example" {
  project_id            = var.azure_devops_project_id
  service_endpoint_name = "AzureRM-ServiceConnection"
  credentials {
    serviceprincipalid  = var.service_principal_id
    serviceprincipalkey = var.service_principal_key
  }
  azurerm_spn_tenantid      = var.azure_tenant_id
  azurerm_subscription_id   = var.azure_subscription_id
  azurerm_subscription_name = "Your Subscription"
}

resource "azuredevops_variable_group" "terraform_vars" {
  project_id   = var.azure_devops_project_id
  name         = "pixelated-terraform-variables"
  allow_access = true

  key_vault {
    name                = "your-key-vault-name"
    service_endpoint_id = azuredevops_serviceendpoint_azurerm.example.id
  }

  variable {
    name = "TF_HTTP_PASSWORD"  # References Key Vault secret
  }
}
```

## Security Best Practices

1. **Never commit tokens** - Always use variable groups or Key Vault
2. **Use managed identity** - Prefer over service principal secrets when possible
3. **Encrypt variables** - Mark all sensitive data as secret in Azure DevOps
4. **Link to Key Vault** - For production, use Azure Key Vault integration
5. **Audit state access** - Check who has access to infrastructure repo
6. **Backup state** - GitLab versions automatically, keep local backups too
7. **Monitor costs** - Set up alerts for unexpected resource usage
8. **Rotate tokens regularly** - Update GitLab tokens and service principal secrets periodically
9. **Use branch protection** - Protect variable groups with branch control policies
10. **Limit permissions** - Grant only necessary permissions to service principals and tokens

## Next Steps

Now you have fully managed infrastructure as code with GitLab-backed state. Consider:

1. **Automated cost alerts** with Azure Cost Management
2. **Drift detection** in nightly pipelines
3. **Security scanning** of Terraform code
4. **Policy enforcement** with Azure Policy
5. **Disaster recovery** testing

The setup is complete when you can successfully run the Azure DevOps pipeline and see GitLab tracking your infrastructure state!