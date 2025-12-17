# Terraform variables for Pixelated Empathy Azure infrastructure

# General Settings
variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "staging"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "prefix" {
  description = "Resource name prefix"
  type        = string
  default     = "pixelated"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
  validation {
    condition = contains([
      "East US",
      "East US 2",
      "West US",
      "West US 2",
      "West US 3",
      "West Central US",
      "Central US",
      "North Central US",
      "South Central US",
      "North Europe",
      "West Europe",
      "UK South",
      "UK West",
      "Japan East",
      "Japan West",
      "Japan Central",
      "Southeast Asia",
      "East Asia",
      "Australia East",
      "Australia Southeast",
      "Canada Central",
      "Canada East",
      "Germany West Central",
      "Germany North",
      "France Central",
      "France South",
      "Switzerland North",
      "Switzerland West",
      "Norway East",
      "Norway West",
      "India Central",
      "India West",
      "India South",
      "Brazil South",
      "Brazil Southeast"
    ], var.location)
    error_message = "Location must be a valid Azure region."
  }
}

# Container Registry
variable "container_registry_name" {
  description = "Azure Container Registry name"
  type        = string
}

# Kubernetes Configuration
variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.29.0"
}

variable "node_count" {
  description = "Number of nodes in the AKS cluster"
  type        = number
  default     = 2
  validation {
    condition     = var.node_count >= 1 && var.node_count <= 50
    error_message = "Node count must be between 1 and 50."
  }
}

variable "node_vm_size" {
  description = "Azure VM size for nodes"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "min_node_count" {
  description = "Minimum number of nodes for auto-scaling"
  type        = number
  default     = 1
  validation {
    condition     = var.min_node_count >= 0
    error_message = "Min node count must be non-negative."
  }
}

variable "max_node_count" {
  description = "Maximum number of nodes for auto-scaling"
  type        = number
  default     = 5
}

# Production-specific settings
variable "production_node_count" {
  description = "Node count for production environment"
  type        = number
  default     = 3
}

variable "production_node_vm_size" {
  description = "VM size for production nodes"
  type        = string
  default     = "Standard_D8s_v3"
}

variable "production_min_node_count" {
  description = "Minimum nodes for production auto-scaling"
  type        = number
  default     = 2
}

variable "production_max_node_count" {
  description = "Maximum nodes for production auto-scaling"
  type        = number
  default     = 10
}

# ACR Admin Toggle
variable "enable_acr_admin" {
  description = "Enable admin access on container registry"
  type        = bool
  default     = false
}

# Network Configuration
variable "vnet_address_prefix" {
  description = "VNet address prefix"
  type        = string
  default     = "10.0.0.0/8"
}

variable "dns_zone_name" {
  description = "DNS zone name"
  type        = string
  default     = "pixelatedempathy.com"
}

# Resource Configuration
variable "log_retention_days" {
  description = "Log retention in days"
  type        = number
  default     = 30
  validation {
    condition = contains([7, 30, 60, 90, 120, 180, 365], var.log_retention_days)
    error_message = "Log retention must be one of: 7, 30, 60, 90, 120, 180, 365 days"
  }
}

# Tags
variable "custom_tags" {
  description = "Custom tags to apply to resources"
  type        = map(string)
  default = {
    Project     = "pixelated-empathy"
    Team        = "infrastructure"
    ManagedBy   = "terraform"
    Environment = "staging"
  }
}

# Azure Credentials
variable "azure_subscription_id" {
  description = "Azure subscription ID"
  type        = string
  sensitive   = true
}

variable "azure_client_id" {
  description = "Azure client ID"
  type        = string
  sensitive   = true
  default     = "" # Used for service principal auth
}

variable "azure_client_secret" {
  description = "Azure client secret"
  type        = string
  sensitive   = true
  default     = "" # Used for service principal auth
}

variable "azure_tenant_id" {
  description = "Azure tenant ID"
  type        = string
  sensitive   = true
}

variable "use_msi" {
  description = "Use Managed Service Identity for authentication"
  type        = bool
  default     = true
}

# GitLab Token for state backend (optional - backend uses TF_HTTP_PASSWORD env var)
variable "gitlab_token" {
  description = "GitLab token for state backend authentication (not used - backend uses TF_HTTP_PASSWORD env var)"
  type        = string
  sensitive   = true
  default     = ""
}

# Advanced Configuration
variable "enable_backup" {
  description = "Enable Velero backup for Kubernetes"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Kubernetes backup retention in days"
  type        = number
  default     = 7
}

variable "enable_monitoring" {
  description = "Enable Azure Monitor integration"
  type        = bool
  default     = true
}

variable "enable_security_scanning" {
  description = "Enable security scanning with Defender for Containers"
  type        = bool
  default     = true
}

variable "enable_cost_management" {
  description = "Enable cost management tracking"
  type        = bool
  default     = true
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}