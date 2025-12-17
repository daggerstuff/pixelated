# Staging environment configuration
environment = "staging"
prefix = "pixelated"
location = "East US"

# Container Registry
container_registry_name = "pixelatedregistry"

# Kubernetes staging configuration
# Using 1.33.5 (doesn't require Premium tier/LTS like 1.29.0 does)
kubernetes_version = "1.33.5"
node_count = 2
# Using standard_dc4s_v3 (Standard_D4s_v3 not available in this subscription/region)
node_vm_size = "standard_dc4s_v3"
min_node_count = 1
max_node_count = 3

# Enable admin access for easier debugging in staging
enable_acr_admin = true

# Staging tags
custom_tags = {
  Environment    = "staging"
  Project       = "pixelated-empathy"
  Team          = "engineering"
  ManagedBy     = "terraform"
  Purpose       = "development"
  CostCenter    = "eng-dev"
  Backup        = "true"
  Retention     = "30-days"
}

# Enable all features for staging environment
enable_backup = true
backup_retention_days = 7
enable_monitoring = true
enable_security_scanning = true
enable_cost_management = true

# Staging-specific settings
log_retention_days = 30

# Azure subscription (will be overridden by CI pipeline)
azure_subscription_id = "b125799a-7bf1-475d-adce-fff747834f73"
azure_tenant_id = "15760c36-862d-4476-9c87-baeb9fb6e1cd"

# Use managed identity for staging
use_msi = true