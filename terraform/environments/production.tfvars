# Production environment configuration
environment = "production"
prefix = "pixelated"
location = "East US"

# Container Registry
container_registry_name = "pixelatedregistry"

# Production node configuration
node_count = 3  # Start with 3 nodes
node_vm_size = "Standard_D8s_v3"  # Larger VMs for production
min_node_count = 2  # Minimum for redundancy
max_node_count = 10  # Higher max for scaling

# System node pool for critical pods
production_node_count = 3
production_node_vm_size = "Standard_D16s_v3"
production_min_node_count = 2
production_max_node_count = 15

# Additional settings for production
enable_backup = true
backup_retention_days = 30
enable_monitoring = true
enable_security_scanning = true
enable_cost_management = true

# Disable admin access in production
enable_acr_admin = false

# Production tags
custom_tags = {
  Environment    = "production"
  Project       = "pixelated-empathy"
  Team          = "engineering"
  ManagedBy     = "terraform"
  Purpose       = "production"
  CostCenter    = "eng-prod"
  SLA           = "99.9"
  Backup        = "true"
  Retention     = "long-term"
  CostAlert     = "enabled"
}

# Longer log retention for production
log_retention_days = 90

# Production-specific monitoring
azure_subscription_id = "your-production-subscription-id"
azure_tenant_id = "your-tenant-id"

# Use managed identity for production
use_msi = true

# Production backup strategy
enable_velero_backup = true
velero_backup_schedule = "daily"
velero_backup_retention = "30d"