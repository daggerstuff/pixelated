# Main infrastructure configuration for Pixelated Empathy Azure deployment

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${var.prefix}-azure-resources"
  location = var.location

  tags = {
    Environment = var.environment
    Project     = "pixelated-empathy"
    ManagedBy   = "terraform"
  }
}

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "${var.prefix}-vnet"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  address_space       = ["10.0.0.0/8"]

  tags = merge(var.custom_tags, {
    Name = "${var.prefix}-aks-vnet"
  })
}

# Subnet for AKS
resource "azurerm_subnet" "aks" {
  name                 = "default"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.240.0.0/16"]
}

# Subnet for Application Gateway
resource "azurerm_subnet" "agic" {
  name                 = "agic-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.241.0.0/24"]
}

# Public IP for Application Gateway
resource "azurerm_public_ip" "ag_main" {
  name                = "${var.prefix}-ag-ip-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = var.custom_tags
}

# Container Registry
resource "azurerm_container_registry" "main" {
  name                          = var.container_registry_name
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  sku                           = "Premium"
  admin_enabled                 = var.enable_acr_admin
  public_network_access_enabled = true

  georeplications {
    location = "West US"
  }

  # Container registry settings
  network_rule_set {
    default_action = "Allow"
  }

  tags = var.custom_tags
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.prefix}-law"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days

  tags = var.custom_tags
}

# Application Gateway
resource "azurerm_application_gateway" "main" {
  name                = "${var.prefix}-ag-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku {
    name     = "WAF_v2"
    tier     = "WAF_v2"
    capacity = 2
  }

  gateway_ip_configuration {
    name      = "gateway-ip-config"
    subnet_id = azurerm_subnet.agic.id
  }

  frontend_port {
    name = "port-80"
    port = 80
  }

  frontend_port {
    name = "port-443"
    port = 443
  }

  frontend_ip_configuration {
    name                 = "frontend-ip"
    public_ip_address_id = azurerm_public_ip.ag_main.id
  }

  backend_address_pool {
    name = "aks-backend-pool"
  }

  backend_http_settings {
    name                                = "http-setting"
    cookie_based_affinity               = "Disabled"
    port                                = 80
    protocol                            = "Http"
    request_timeout                     = 60
    pick_host_name_from_backend_address = false
  }

  http_listener {
    name                           = "http-listener"
    frontend_ip_configuration_name = "frontend-ip"
    frontend_port_name             = "port-80"
    protocol                       = "Http"
  }

  request_routing_rule {
    name                       = "http-rule"
    rule_type                  = "Basic"
    priority                   = 100
    http_listener_name         = "http-listener"
    backend_address_pool_name  = "aks-backend-pool"
    backend_http_settings_name   = "http-setting"
  }

  waf_configuration {
    enabled                  = true
    firewall_mode            = "Prevention"
    rule_set_type            = "OWASP"
    rule_set_version         = "3.2"
    request_body_check       = true
    max_request_body_size_kb = 128
    file_upload_limit_mb     = 100
  }

  # Modern SSL policy (required - default policy uses deprecated TLS)
  ssl_policy {
    policy_type = "Predefined"
    policy_name = "AppGwSslPolicy20220101"
  }

  # Note: Application Gateway does not support SystemAssigned identity
  # Use UserAssigned identity if needed, or omit identity block
  # identity {
  #   type = "SystemAssigned"
  # }

  tags = var.custom_tags
}

# AKS Cluster Configuration
# Using simple naming for now - can enhance later with proper naming

# Container Registry (matching your existing one)
# Data source removed - using direct reference to azurerm_container_registry.main instead

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.prefix}-aks-cluster"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix           = "${var.prefix}-aks"
  kubernetes_version   = var.kubernetes_version

  default_node_pool {
    name                = "default"
    # node_count is not used when enable_auto_scaling is true
    # The cluster will scale between min_count and max_count
    vm_size             = var.node_vm_size
    os_disk_type        = "Managed"
    os_disk_size_gb      = 128
    max_pods            = 110
    enable_auto_scaling = true
    min_count           = var.min_node_count
    max_count           = var.max_node_count

    # Note: Default node pool must be Regular priority (cannot be Spot)
    # For Spot instances, create separate node pools using azurerm_kubernetes_cluster_node_pool
  }

  network_profile {
    network_plugin = "azure"
    network_policy = "calico"
    load_balancer_sku = "standard"
    dns_service_ip = "172.16.0.10"
    service_cidr = "172.16.0.0/16"
    # docker_bridge_cidr is deprecated and removed
  }

  auto_scaler_profile {
    new_pod_scale_up_delay = "10s"
    scale_down_delay_after_add = "3m"
    scale_down_unneeded = "10m"
    scale_down_utilization_threshold = 0.5
  }

  # Azure Policy
  azure_policy_enabled = true
  
  # Note: Azure Monitor Agent (AMA) should be enabled separately via Azure Portal or CLI
  # The deprecated oms_agent block has been removed

  # SKU tier - Free tier for staging, Premium for production
  # Note: Kubernetes 1.29.0+ requires Premium tier with LTS support plan
  # For Free tier, use Kubernetes 1.33.x or newer
  sku_tier = var.environment == "production" ? "Premium" : "Free"
  
  # Support plan - KubernetesOfficial for Free tier, AKSLongTermSupport for Premium with LTS versions
  support_plan = var.environment == "production" ? "AKSLongTermSupport" : "KubernetesOfficial"

  identity {
    type = "SystemAssigned"
  }

  # Enable local accounts (for emergency access)
  local_account_disabled = false

  depends_on = [azurerm_log_analytics_workspace.main]

  timeouts {
    create = "2h"
    update = "2h"
    delete = "45m"
  }

  tags = var.custom_tags
}

# ACR Role Assignment for AKS
resource "azurerm_role_assignment" "aks_acr" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
}

# ACR Admin Enabled Toggle is now handled by the main registry resource above
# This duplicate resource has been removed to prevent naming conflicts

# Additional Node Pool (for production)
resource "azurerm_kubernetes_cluster_node_pool" "production" {
  count = var.environment == "production" ? 1 : 0

  name                  = "system"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = var.production_node_vm_size
  node_count            = var.production_node_count
  max_pods             = 110
  os_disk_size_gb      = 256

  enable_auto_scaling = true
  min_count           = var.production_min_node_count
  max_count           = var.production_max_node_count

  node_labels = {
    "node.kubernetes.io/role" = "system"
    "node.kubernetes.io/purpose" = "system-pods"
  }

  node_taints = [
    "CriticalAddonsOnly=true:NoSchedule"
  ]

  tags = var.custom_tags
}

# Kubernetes Provider Configuration (for managing k8s resources)
# Note: This provider is configured after the AKS cluster is created
# The configuration is done via a separate provider block that references
# the cluster's kube_config output
provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.main.kube_config.0.host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.main.kube_config.0.cluster_ca_certificate)
}

# System Namespace (kube-system) is automatically created by AKS
# We don't manage it with Terraform as it's a system namespace
# If you need to add labels, use kubectl:
# kubectl label namespace kube-system app.kubernetes.io/managed-by=terraform environment=staging