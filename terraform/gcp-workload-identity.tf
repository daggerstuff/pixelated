# Google Cloud Platform - Workload Identity Federation Configuration
# ================================================================
# This configuration sets up Workload Identity Federation for GitHub Actions
# to authenticate to Google Cloud without using service account keys

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# Variables for GCP configuration
variable "gcp_project_id" {
  description = "Google Cloud Project ID"
  type        = string
  default     = "pixelated-463209-e5"
}

variable "gcp_region" {
  description = "Google Cloud Region"
  type        = string
  default     = "us-central1"
}

variable "github_repository" {
  description = "GitHub repository for workload identity"
  type        = string
  default     = "pixelatedempathy/pixelated"
}

variable "workload_identity_pool_id" {
  description = "Workload Identity Pool ID"
  type        = string
  default     = "github-pool"
}

variable "workload_identity_provider_id" {
  description = "Workload Identity Provider ID"
  type        = string
  default     = "github-provider"
}

variable "service_account_id" {
  description = "Service Account ID for GitHub Actions"
  type        = string
  default     = "github-actions-sa"
}

variable "service_account_display_name" {
  description = "Service Account Display Name"
  type        = string
  default     = "GitHub Actions Service Account"
}

# Google Cloud Provider Configuration
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "google-beta" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Enable required Google Cloud APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "container.googleapis.com",
    "compute.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com"
  ])
  
  service = each.value
  
  disable_on_destroy = false
}

# Create Workload Identity Pool
resource "google_iam_workload_identity_pool" "github_pool" {
  workload_identity_pool_id = var.workload_identity_pool_id
  display_name              = "GitHub Actions Workload Identity Pool"
  description               = "Workload identity pool for GitHub Actions authentication"
  disabled                  = false
  
  depends_on = [google_project_service.required_apis]
}

# Create Workload Identity Provider
resource "google_iam_workload_identity_pool_provider" "github_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = var.workload_identity_provider_id
  display_name                        = "GitHub Provider"
  description                         = "OIDC provider for GitHub Actions"
  disabled                            = false
  
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
    allowed_audiences = [
      "https://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/providers/${var.workload_identity_provider_id}"
    ]
  }
  
  depends_on = [google_iam_workload_identity_pool.github_pool]
}

# Create Service Account for GitHub Actions
resource "google_service_account" "github_actions_sa" {
  account_id   = var.service_account_id
  display_name = var.service_account_display_name
  description  = "Service account for GitHub Actions to access Google Cloud resources"
  
  depends_on = [google_project_service.required_apis]
}

# Grant necessary IAM roles to the service account
resource "google_project_iam_member" "github_actions_roles" {
  for_each = toset([
    "roles/container.developer",
    "roles/container.viewer",
    "roles/compute.viewer",
    "roles/monitoring.viewer",
    "roles/logging.viewer",
    "roles/iam.serviceAccountTokenCreator"
  ])
  
  project = var.gcp_project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
  
  depends_on = [google_service_account.github_actions_sa]
}

# Allow the workload identity to impersonate the service account
resource "google_service_account_iam_member" "workload_identity_user" {
  service_account_id = google_service_account.github_actions_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/attribute.repository/${var.github_repository}"
  
  depends_on = [
    google_service_account.github_actions_sa,
    google_iam_workload_identity_pool.github_pool
  ]
}

# Create a custom role for GKE monitoring with minimal permissions
resource "google_project_iam_custom_role" "gke_monitoring_role" {
  role_id     = "gkeMonitoringRole"
  title       = "GKE Monitoring Role"
  description = "Custom role for GKE monitoring with minimal required permissions"
  permissions = [
    "container.clusters.get",
    "container.clusters.list",
    "container.operations.get",
    "container.operations.list",
    "container.pods.get",
    "container.pods.list",
    "container.deployments.get",
    "container.deployments.list",
    "container.services.get",
    "container.services.list",
    "container.namespaces.get",
    "container.namespaces.list",
    "monitoring.metricDescriptors.get",
    "monitoring.metricDescriptors.list",
    "monitoring.timeSeries.list",
    "logging.logEntries.list",
    "logging.logs.list",
    "resourcemanager.projects.get"
  ]
  
  depends_on = [google_project_service.required_apis]
}

# Grant the custom monitoring role to the service account
resource "google_project_iam_member" "gke_monitoring_role_binding" {
  project = var.gcp_project_id
  role    = google_project_iam_custom_role.gke_monitoring_role.id
  member  = "serviceAccount:${google_service_account.github_actions_sa.email}"
  
  depends_on = [
    google_service_account.github_actions_sa,
    google_project_iam_custom_role.gke_monitoring_role
  ]
}

# Outputs for GitHub Actions configuration
output "workload_identity_provider" {
  description = "Workload Identity Provider resource name"
  value       = google_iam_workload_identity_pool_provider.github_provider.name
}

output "service_account_email" {
  description = "Service account email for GitHub Actions"
  value       = google_service_account.github_actions_sa.email
}

output "project_id" {
  description = "Google Cloud Project ID"
  value       = var.gcp_project_id
}

output "workload_identity_pool_name" {
  description = "Workload Identity Pool name"
  value       = google_iam_workload_identity_pool.github_pool.name
}

# Documentation output
output "github_actions_configuration" {
  description = "Configuration values for GitHub Actions secrets"
  value = {
    GCP_WORKLOAD_IDENTITY_PROVIDER = google_iam_workload_identity_pool_provider.github_provider.name
    GCP_SERVICE_ACCOUNT_EMAIL       = google_service_account.github_actions_sa.email
    GCP_PROJECT_ID                  = var.gcp_project_id
    setup_instructions = <<-EOT
      Add these secrets to your GitHub repository:
      
      GCP_WORKLOAD_IDENTITY_PROVIDER: ${google_iam_workload_identity_pool_provider.github_provider.name}
      GCP_SERVICE_ACCOUNT_EMAIL: ${google_service_account.github_actions_sa.email}
      GCP_PROJECT_ID: ${var.gcp_project_id}
      
      The workload identity provider format is:
      projects/${var.gcp_project_id}/locations/global/workloadIdentityPools/${var.workload_identity_pool_id}/providers/${var.workload_identity_provider_id}
    EOT
  }
}