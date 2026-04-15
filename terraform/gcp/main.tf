provider "google" {
  project = var.project_id
  region  = var.gcp_region
}

data "google_project" "current" {
  project_id = var.project_id
}

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
  artifact_repo_kms_key = (
    var.artifact_registry_kms_key_name != ""
    ? var.artifact_registry_kms_key_name
    : try(google_kms_crypto_key.artifact_registry[0].id, "")
  )
  compute_network_name    = "${local.app_label}-network"
  compute_subnetwork_name = "${local.app_label}-subnet"
}

# --- APIs ---
resource "google_project_service" "apis" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "container.googleapis.com",
    "compute.googleapis.com",
    "redis.googleapis.com",
    "sqladmin.googleapis.com",
    "cloudkms.googleapis.com",
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

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 1.0
    metadata             = "INCLUDE_ALL_METADATA"
  }
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

  resource_labels = {
    app         = var.app_name
    environment = var.environment
    managed_by  = "terraform"
  }

  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.gke.id

  networking_mode = "VPC_NATIVE"

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = var.network_cidr
      display_name = "VPC subnetwork"
    }
  }

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

  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  enable_intranode_visibility = true

  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }

  authenticator_groups_config {
    security_group = "gke-security-groups@${var.project_id}.iam.gserviceaccount.com"
  }

  node_config {
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot = true
      enable_integrity_monitoring = true
    }

    metadata = {
      disable-legacy-endpoints = true
    }
  }



  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
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
  kms_key_name  = local.artifact_repo_kms_key
  depends_on    = [google_project_service.apis, google_kms_crypto_key.artifact_registry, google_kms_crypto_key_iam_member.artifact_registry]
}

resource "google_kms_key_ring" "artifact_registry" {
  count    = var.artifact_registry_kms_key_name == "" ? 1 : 0
  name     = "${local.artifact_repo_name}-artifact-registry"
  location = var.gcp_region
  project  = var.project_id
}

resource "google_kms_crypto_key" "artifact_registry" {
  count           = var.artifact_registry_kms_key_name == "" ? 1 : 0
  name            = "${local.artifact_repo_name}-artifact-registry-key"
  key_ring        = google_kms_key_ring.artifact_registry[0].id
  rotation_period = "7776000s"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key_iam_member" "artifact_registry" {
  count         = var.artifact_registry_kms_key_name == "" ? 1 : 0
  crypto_key_id = google_kms_crypto_key.artifact_registry[0].id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-artifactregistry.iam.gserviceaccount.com"
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
      ssl_mode        = "TRUSTED_CLIENT_CERTIFICATE_REQUIRED"
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

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_hostname"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    database_flags {
      name  = "log_statement"
      value = "all"
    }

    database_flags {
      name  = "log_min_error_statement"
      value = "error"
    }

    database_flags {
      name  = "pgaudit.log"
      value = "all"
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
  auth_enabled       = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  redis_version      = "REDIS_7_0"
  authorized_network = google_compute_network.main.id

  depends_on = [google_project_service.apis]
}
