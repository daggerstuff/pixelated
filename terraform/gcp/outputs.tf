output "gke_cluster_name" {
  description = "GKE cluster name."
  value       = google_container_cluster.primary.name
}

output "gke_cluster_location" {
  description = "GKE cluster location."
  value       = google_container_cluster.primary.location
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint."
  value       = google_container_cluster.primary.endpoint
}

output "gke_cluster_ca_certificate" {
  description = "Base64-encoded GKE cluster CA certificate."
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository path for app images."
  value       = "${google_artifact_registry_repository.app_images.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app_images.repository_id}"
}

output "artifact_registry_image_base" {
  description = "Artifact Registry image base for the API container."
  value       = "${google_artifact_registry_repository.app_images.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app_images.repository_id}/api"
}

output "cloud_sql_instance_name" {
  description = "Cloud SQL instance name."
  value       = google_sql_database_instance.postgres.name
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name."
  value       = google_sql_database_instance.postgres.connection_name
}

output "cloud_sql_private_ip_address" {
  description = "Cloud SQL private IP address if private networking is configured."
  value       = try(google_sql_database_instance.postgres.private_ip_address, null)
}

output "redis_instance_name" {
  description = "Memorystore instance name."
  value       = google_redis_instance.cache.name
}

output "redis_host" {
  description = "Redis host."
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "Redis port."
  value       = google_redis_instance.cache.port
}
