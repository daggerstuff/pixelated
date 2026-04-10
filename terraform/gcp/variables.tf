variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "environment" {
  description = "Deployment environment label."
  type        = string
  default     = "staging"
}

variable "app_name" {
  description = "Base name for all generated resources."
  type        = string
  default     = "pixelated-empathy"
}

variable "gcp_region" {
  description = "GCP region for all regional resources."
  type        = string
  default     = "us-west1"
}

variable "gcp_location" {
  description = "GKE control-plane location (region or zone)."
  type        = string
  default     = "us-west1"
}

variable "gke_cluster_name" {
  description = "Optional explicit GKE cluster name. If unset, defaults to `<app_name>-<environment>-cluster`."
  type        = string
  default     = ""
}

variable "gke_deletion_protection" {
  description = "Whether to enable cluster deletion protection."
  type        = bool
  default     = false
}

variable "enable_deletion_protection" {
  description = "Whether to enable Cloud SQL deletion protection."
  type        = bool
  default     = false
}

variable "network_cidr" {
  description = "Primary VPC subnet CIDR."
  type        = string
  default     = "10.0.0.0/16"
}

variable "pods_secondary_cidr" {
  description = "Secondary CIDR range for pod IPs."
  type        = string
  default     = "10.4.0.0/19"
}

variable "services_secondary_cidr" {
  description = "Secondary CIDR range for service IPs."
  type        = string
  default     = "10.4.32.0/20"
}

variable "postgres_version" {
  description = "Cloud SQL PostgreSQL version."
  type        = string
  default     = "POSTGRES_15"
}

variable "postgres_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-f1-micro"
}

variable "postgres_disk_size_gb" {
  description = "Cloud SQL storage size in GiB."
  type        = number
  default     = 20
}

variable "postgres_db_name" {
  description = "Default application database."
  type        = string
  default     = "pixelated_empathy"
}

variable "postgres_username" {
  description = "Database username."
  type        = string
  default     = "pixelated_user"
}

variable "postgres_password" {
  description = "Database user password."
  type        = string
  sensitive   = true
}

variable "postgres_backup_start_time" {
  description = "Cloud SQL backup start time in UTC (HH:MM)."
  type        = string
  default     = "03:00"
}

variable "postgres_retained_backups" {
  description = "How many automated backups to retain."
  type        = number
  default     = 7
}

variable "postgres_max_connections" {
  description = "PostgreSQL max_connections."
  type        = number
  default     = 200
}

variable "postgres_authorized_networks" {
  description = "Authorized networks for Cloud SQL public endpoint."
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "redis_tier" {
  description = "Memorystore Redis tier."
  type        = string
  default     = "BASIC"
}

variable "redis_memory_gb" {
  description = "Redis memory in GiB."
  type        = number
  default     = 1
}