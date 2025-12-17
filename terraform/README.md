# Terraform Infrastructure for Pixelated Empathy (GitLab-managed State)

This directory contains complete infrastructure-as-code configuration to manage Azure resources for Pixelated Empathy using Terraform with GitLab-managed state backend.

## 🚀 Quick Start

1. **Configure GitLab Project** (if not already done):
   - Create GitLab project: `pixelated-infrastructure`
   - Get Project ID for state management
   - Create GitLab access token with `api` scope

2. **Set up Backend Configuration**:
   ```bash
   cd terraform
   cp backend.config.example backend.config
   # Edit backend.config with your GitLab project ID
   ```

3. **Test Locally**:
   ```bash
   export TF_HTTP_PASSWORD="your-gitlab-token"
   terraform init -backend-config=backend.config
   terraform plan -var-file=environments/staging.tfvars
   ```

## 📁 Project Structure

```
terraform/
├── main.tf                 # Main infrastructure resources
├── providers.tf            # Provider configurations
├── backend.tf             # GitLab HTTP backend definition
├── backend.config.example  # GitLab backend configuration template
├── variables.tf           # Input variables
├── outputs.tf             # Output values
├── terraform.auto.tfvars.example  # Example local configuration
├── azure-pipelines-terraform.yml  # Azure DevOps pipeline for Terraform
├── documentation/
│   ├── terraform-gitlab-integration.md   # Complete setup guide
│   └── infrastructure-overview.md        # Architecture overview
├── environments/
│   ├── staging.tfvars     # Staging environment configuration
│   └── production.tfvars  # Production environment configuration
└── README.md              # This file
```

## 🔄 What This Manages

### Core Infrastructure
- **Azure Kubernetes Service (AKS)** with auto-scaling
- **Azure Container Registry (ACR)** Premium tier
- **Virtual Network** with proper subnetting
- **Application Gateway** with WAF protection
- **Log Analytics** for centralized monitoring
- **DNS Zones** for domain management

### Advanced Features
- **Spot instances** for non-production (cost optimization)
- **Multiple node pools** for workloads
- **Network policies** with Calico
- **Azure Policy** enforcement
- **Managed identity** authentication
- **State locking** via GitLab API

## 🎯 Environment Configurations

| Feature | Staging | Production |
|---------|---------|------------|
| Node Count | 2 | 3+ |
| VM Size | Standard_D4s_v3 | Standard_D8s_v3+ |
| Auto-scaling | 1-3 nodes | 2-10 nodes |
| Spot Instances | ✅ | ❌ |
| ACR Admin | ✅ | ❌ |
| Backup Retention | 7 days | 30 days |
| Log Retention | 30 days | 90 days |

## ⚡ GitLab-managed State Benefits

### ✅ What You Get
- **State version control** - Track all infrastructure changes
- **State locking** - Prevents concurrent modifications
- **Audit trail** - Complete history of changes
- **Team collaboration** - Multiple engineers can work safely
- **Disaster recovery** - Rollback to any previous state
- **Access control** - Via GitLab project permissions

### 🔄 Common Operations
```bash
# View state versions
curl "https://gitlab.com/api/v4/projects/77130665/terraform/states" \
  -H "PRIVATE-TOKEN: glpat-xxxxxx"

# Compare state versions
kubectl diff -f k8s/azure/staging/  # Compare against current cluster

# Manual lock/unlock (if needed)
curl -X POST "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock" \
  -H "PRIVATE-TOKEN: glpat-xxxxxx"
```

## 🔧 Configuration Files

### `backend.config`
```hcl
address = "https://gitlab.com/api/v4/projects/YOUR_PROJECT_ID/terraform/state/pixelated-azure-infrastructure"
lock_address = "https://gitlab.com/api/v4/projects/YOUR_PROJECT_ID/terraform/state/pixelated-azure-infrastructure/lock"
unlock_address = "https://gitlab.com/api/v4/projects/YOUR_PROJECT_ID/terraform/state/pixelated-azure-infrastructure/lock"
username = "gitlab-ci-token"
lock_method = "POST"
unlock_method = "DELETE"
```

### `terraform.auto.tfvars`
```hcl
environment = "staging"
prefix = "pixelated"
location = "East US"
container_registry_name = "pixelatedregistry"

# Azure credentials (use these keys for CI/CD)
azure_subscription_id = null  # Set via CI/CD
azure_tenant_id = null  # Set via CI/CD
```

## 🚀 Azure DevOps Pipeline

The pipeline (`azure-pipelines-terraform.yml`) provides:
- **Plan & Apply** workflow with approval gates
- **State validation** before operations
- **Cost estimation** during planning
- **Drift detection** through refresh operations
- **Output persistence** for downstream consumption

### Pipeline Parameters
```yaml
terraformAction: plan|apply|refresh|destroy
environment: staging|production
terraformVersion: "1.9.0"
```

## 🔒 Security Setup

### Required Azure DevOps Variables:
- `TF_HTTP_PASSWORD` - GitLab API token (secret)
- `TERRAFORM_STATE_ADDRESS` - GitLab state endpoint
- `TERRAFORM_LOCK_ADDRESS` - Lock endpoint
- `TERRAFORM_UNLOCK_ADDRESS` - Unlock endpoint

### Authentication Methods:
1. **Managed Identity** (recommended in CI/CD)
2. **Service Principal** via environment variables
3. **Azure CLI** session tokens

## 🐛 Troubleshooting

### Common Issues

**405 Method Not Allowed on First Run**:
```bash
# State file doesn't exist yet - create without locking
terraform plan -var-file=environments/staging.tfvars -lock=false
```

**Backend Configuration Changed**:
```bash
# Update backend without migrating state
terraform init -backend-config=backend.config -reconfigure
```

**State Lock Held**:
```bash
# Check lock status via GitLab UI
# Or force unlock (careful - ensure no other operations running)
curl -X DELETE "https://gitlab.com/api/v4/projects/77130665/terraform/state/pixelated-azure-infrastructure/lock" \
  -H "PRIVATE-TOKEN: glpat-xxxxxx"
```

## 📊 Monitoring & Troubleshooting

### Pipeline Monitoring
Check Azure DevOps for Pipeline executions and review:
- Terraform plan artifacts
- Build metadata with changes detected
- Output variables for deployment
- Pipeline logs for detailed errors

### State Observation
- **GitLab UI**: Project → Infrastructure → Terraform States
- **State versions**: Compare different infrastructure versions
- **State locking**: Visual lock status and history

### Resource Health
```bash
# After deployment
export TF_HTTP_PASSWORD="your-token"
terraform output -json  # Get connection details
kubectl get nodes -A    # Verify AKS health
```

## 🛡️ Backup & Disaster Recovery

### Automatic Backups
- GitLab retains all state versions automatically
- Unlimited history with rollback capability
- State locking prevents concurrent destructive operations

### Manual Recovery
```bash
# Export current state
terraform state pull > backup-$(date +%Y%m%d).tfstate

# Compare changes over time
TF_LOG=DEBUG terraform plan -var-file=environments/staging.tfvars
```

### Recovery Options
1. **Roll back via GitLab UI** - Restore previous state version
2. **Roll back via API** - Use GitLab Terraform State REST API
3. **Manual import** - `terraform import` for drifted resources

## 🎯 Next Steps

1. **Review Setup** - Go through the complete integration guide in `terraform-gitlab-integration.md`
2. **Test Deployment** - Run the Azure DevOps pipeline with plan action
3. **Validate Resources** - Verify AKS cluster and supporting infrastructure
4. **Integrate with Existing Pipeline** - Update your main deployment to use Terraform-managed infrastructure

## 🔗 Reference Materials

- [Terraform Azure Provider Docs](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [GitLab Terraform State Management](https://docs.gitlab.com/ee/user/infrastructure/terraform_state.html)
- [Azure DevOps Terraform Tasks](https://marketplace.visualstudio.com/items?itemName=ms-devlabs.vsts-extension-multivol)

Ready to convert your manual Azure operations into version-controlled infrastructure as code! 🚀