# Terraform outputs for Pixelated Empathy Azure infrastructure

# Resource Information
output "resource_group" {
  description = "Resource group information"
  value = {
    name     = azurerm_resource_group.main.name
    id       = azurerm_resource_group.main.id
    location = azurerm_resource_group.main.location
  }
}

output "aks_cluster" {
  description = "AKS cluster information"
  value = {
    name                = azurerm_kubernetes_cluster.main.name
    id                  = azurerm_kubernetes_cluster.main.id
    fqdn               = azurerm_kubernetes_cluster.main.fqdn
    private_fqdn       = azurerm_kubernetes_cluster.main.private_fqdn
    kubernetes_version = azurerm_kubernetes_cluster.main.kubernetes_version
    node_resource_group = azurerm_kubernetes_cluster.main.node_resource_group
    kubelet_identity_id = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  }
  sensitive = true
}

output "aks_kube_config" {
  description = "AKS cluster kubeconfig raw output"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

output "aks_node_pool_ids" {
  description = "AKS node pool IDs"
  value = {
    # Default node pool doesn't have a separate ID - it's part of the cluster
    cluster_id = azurerm_kubernetes_cluster.main.id
    production = var.environment == "production" ? azurerm_kubernetes_cluster_node_pool.production[0].id : null
  }
}

output "acr_login_server" {
  description = "ACR login server URL"
  value       = azurerm_container_registry.main.login_server
}

output "acr_admin_enabled" {
  description = "Whether ACR admin is enabled"
  value       = azurerm_container_registry.main.admin_enabled
}

output "acr_admin_credentials" {
  description = "ACR admin credentials (if enabled)"
  value       = var.enable_acr_admin ? azurerm_container_registry.main.admin_password : null
  sensitive   = true
}

# Networking
output "vnet_info" {
  description = "Virtual network information"
  value = {
    id                  = azurerm_virtual_network.main.id
    name               = azurerm_virtual_network.main.name
    address_space      = azurerm_virtual_network.main.address_space
    dns_servers        = azurerm_virtual_network.main.dns_servers
  }
}

output "subnet_ids" {
  description = "Subnet IDs"
  value = {
    aks = azurerm_subnet.aks.id
  }
}

output "log_analytics_workspace_id" {
  description = "Log Analytics Workspace ID"
  value       = azurerm_log_analytics_workspace.main.id
}

# Kubernetes Access
output "kubeconfig_file" {
  description = "Path to generated kubeconfig file"
  value       = abspath("${path.module}/kubeconfig-${var.environment}.config")
  depends_on  = [local_file.kubeconfig]
}

# Utility Outputs
output "azure_resources" {
  description = "All created Azure resources"
  value = {
    resource_group_id       = azurerm_resource_group.main.id
    aks_cluster_name        = azurerm_kubernetes_cluster.main.name
    aks_cluster_fqdn        = azurerm_kubernetes_cluster.main.fqdn
    acr_login_server        = azurerm_container_registry.main.login_server
    log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  }
}

# Local-exec provisioners to generate kubeconfig
resource "local_file" "kubeconfig" {
  content         = azurerm_kubernetes_cluster.main.kube_config_raw
  filename       = "${path.module}/kubeconfig-${var.environment}.config"
  file_permission = "0600"
}

# Connection info output
output "connection_info" {
  description = "Connection information for various services"
  value = {
    kubernetes_cluster_fqdn = azurerm_kubernetes_cluster.main.fqdn
    log_analytics_workspace_name = azurerm_log_analytics_workspace.main.name
    resource_group_name      = azurerm_resource_group.main.name
    subscription_id          = var.azure_subscription_id
  }
  sensitive = true
}

# Documentation output
output "next_steps" {
  description = "Next steps after deployment"
  value = <<EOT

🚀 Infrastructure deployed successfully!

Next steps:
1. Set KUBECONFIG environment variable:
   export KUBECONFIG=${path.module}/kubeconfig-${var.environment}.config

2. Verify AKS cluster connectivity:
   kubectl get nodes
   kubectl get pods -n kube-system

3. Kubernetes cluster setup (if not done automatically):
   - Install cert-manager (if not already installed):
     kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.0/cert-manager.yaml
   - Deploy Let's Encrypt ClusterIssuers:
     kubectl apply -f k8s/azure/letsencrypt-clusterissuer.yaml
   - Create namespaces:
     kubectl apply -f k8s/azure/pixelated-namespace.yaml
     kubectl apply -f k8s/azure/ollama-namespace.yaml

4. Deploy applications (via Azure Pipelines or manually):
   - Pixelated app: kubectl apply -f k8s/azure/pixelated-*.yaml
   - Ollama: kubectl apply -f k8s/azure/ollama-*.yaml
   - NeMo ingress: kubectl apply -f k8s/azure/nemo-ingress.yaml

5. Configure DNS:
   - Set A records for pixelatedempathy.com, nemo.pixelatedempathy.com, ollama.pixelatedempathy.com
   - Point to NGINX Ingress Controller external IP (check with: kubectl get svc -n ingress-nginx)
   - TLS certificates will be automatically provisioned by cert-manager

6. Set up monitoring:
   - Azure Monitor is configured for AKS
   - Check Azure Portal for container insights

7. Backup configuration:
   - Snapshot your terraform state:
     terraform state list
   - Consider setting up backup storage account

EOT
}