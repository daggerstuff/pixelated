terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.10"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

locals {
  app_label               = "${var.app_name}-${var.environment}"
  cluster_name            = coalesce(var.gke_cluster_name, "${local.app_label}-cluster")
  sql_instance_name       = "${local.app_label}-postgres"
  redis_instance_name     = "${local.app_label}-redis"
  artifact_repo_name      = var.app_name
  compute_network_name    = "${local.app_label}-network"
  compute_subnetwork_name = "${local.app_label}-subnet"
}

provider "google" {
  project = var.project_id
  region  = var.gcp_region
}

# --- APIs ---
resource "google_project_service" "apis" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "container.googleapis.com",
    "compute.googleapis.com",
    "redis.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
  ])

  service = each.value
}

# --- Networking ---
resource "google_compute_network" "main" {
  name                            = local.compute_network_name
  auto_create_subnetworks         = false
  delete_default_routes_on_create = false
  routing_mode                    = "REGIONAL"
}

resource "google_compute_subnetwork" "gke" {
  name          = local.compute_subnetwork_name
  region        = var.gcp_region
  network       = google_compute_network.main.id
  ip_cidr_range = var.network_cidr

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_secondary_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_secondary_cidr
  }

  private_ip_google_access = true
}

resource "google_compute_global_address" "private_services" {
  name          = "${local.app_label}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

# --- Container platform ---
resource "google_container_cluster" "primary" {
  name     = local.cluster_name
  location = var.gcp_location

  deletion_protection = var.gke_deletion_protection
  enable_autopilot    = true

  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.gke.id

  networking_mode = "VPC_NATIVE"

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  release_channel {
    channel = "REGULAR"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  depends_on = [google_project_service.apis]
}

# --- Artifact Registry ---
resource "google_artifact_registry_repository" "app_images" {
  location      = var.gcp_region
  repository_id = local.artifact_repo_name
  description   = "Pixelated Empathy image repository"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}

# --- Datastore ---
resource "google_sql_database_instance" "postgres" {
  name                = local.sql_instance_name
  database_version    = var.postgres_version
  region              = var.gcp_region
  deletion_protection = var.enable_deletion_protection

  settings {
    tier              = var.postgres_tier
    availability_type = "ZONAL"
    disk_size         = var.postgres_disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = var.postgres_backup_start_time
      point_in_time_recovery_enabled = true

      backup_retention_settings {
        retained_backups = var.postgres_retained_backups
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
      dynamic "authorized_networks" {
        for_each = var.postgres_authorized_networks
        content {
          name  = authorized_networks.value.name
          value = authorized_networks.value.value
        }
      }
    }

    database_flags {
      name  = "max_connections"
      value = tostring(var.postgres_max_connections)
    }
  }

  depends_on = [
    google_project_service.apis,
    google_service_networking_connection.private_services,
  ]
}

resource "google_sql_database" "app" {
  instance = google_sql_database_instance.postgres.name
  name     = var.postgres_db_name
}

resource "google_sql_user" "app" {
  instance = google_sql_database_instance.postgres.name
  name     = var.postgres_username
  password = var.postgres_password
}

resource "google_redis_instance" "cache" {
  name               = local.redis_instance_name
  region             = var.gcp_region
  tier               = var.redis_tier
  memory_size_gb     = var.redis_memory_gb
  redis_version      = "REDIS_7_0"
  authorized_network = google_compute_network.main.id

  depends_on = [google_project_service.apis]
}
