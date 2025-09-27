# Multi-Region Infrastructure Variables
# Configuration variables for global multi-region deployment

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "pixelated"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "production"
  
  validation {
    condition = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "pixelatedempathy.com"
}

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = "pixelated-multi-region"
}

variable "azure_subscription_id" {
  description = "Azure subscription ID"
  type        = string
  default     = ""
}

variable "azure_client_id" {
  description = "Azure client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_client_secret" {
  description = "Azure client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_tenant_id" {
  description = "Azure tenant ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS/GKE clusters"
  type        = string
  default     = "1.28"
}

variable "node_group_desired_size" {
  description = "Desired number of nodes in each node group"
  type        = number
  default     = 3
}

variable "node_group_max_size" {
  description = "Maximum number of nodes in each node group"
  type        = number
  default     = 10
}

variable "node_group_min_size" {
  description = "Minimum number of nodes in each node group"
  type        = number
  default     = 1
}

variable "node_instance_types" {
  description = "EC2 instance types for node groups"
  type        = list(string)
  default     = ["t3.large", "t3.xlarge"]
}

variable "postgres_version" {
  description = "PostgreSQL version for RDS instances"
  type        = string
  default     = "15.4"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS instances (GB)"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS instances (GB)"
  type        = number
  default     = 1000
}

variable "db_backup_retention_period" {
  description = "Database backup retention period (days)"
  type        = number
  default     = 30
}

variable "db_backup_window" {
  description = "Database backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Database maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 1
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  sensitive   = true
  default     = ""
}

variable "pagerduty_key" {
  description = "PagerDuty integration key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "enable_cross_region_replication" {
  description = "Enable cross-region database replication"
  type        = bool
  default     = true
}

variable "enable_global_load_balancer" {
  description = "Enable global load balancer"
  type        = bool
  default     = true
}

variable "enable_cdn" {
  description = "Enable CDN for static assets"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable monitoring and alerting"
  type        = bool
  default     = true
}

variable "enable_security_scanning" {
  description = "Enable security scanning"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 90
}

variable "enable_encryption" {
  description = "Enable encryption at rest and in transit"
  type        = bool
  default     = true
}

variable "encryption_key_rotation_days" {
  description = "Encryption key rotation period in days"
  type        = number
  default     = 90
}

variable "enable_vpc_flow_logs" {
  description = "Enable VPC flow logs"
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "VPC flow logs retention period in days"
  type        = number
  default     = 30
}

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "WAF rate limit per IP per 5 minutes"
  type        = number
  default     = 2000
}

variable "enable_ddos_protection" {
  description = "Enable DDoS protection"
  type        = bool
  default     = true
}

variable "enable_ssl" {
  description = "Enable SSL/TLS encryption"
  type        = bool
  default     = true
}

variable "ssl_certificate_arn" {
  description = "SSL certificate ARN for HTTPS"
  type        = string
  default     = ""
}

variable "enable_hsts" {
  description = "Enable HTTP Strict Transport Security"
  type        = bool
  default     = true
}

variable "hsts_max_age" {
  description = "HSTS max age in seconds"
  type        = number
  default     = 31536000
}

variable "enable_cors" {
  description = "Enable Cross-Origin Resource Sharing"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allowed_methods" {
  description = "List of allowed CORS methods"
  type        = list(string)
  default     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}

variable "cors_allowed_headers" {
  description = "List of allowed CORS headers"
  type        = list(string)
  default     = ["*"]
}

variable "enable_rate_limiting" {
  description = "Enable API rate limiting"
  type        = bool
  default     = true
}

variable "rate_limit_requests_per_minute" {
  description = "Maximum requests per minute per IP"
  type        = number
  default     = 100
}

variable "rate_limit_burst" {
  description = "Burst capacity for rate limiting"
  type        = number
  default     = 200
}

variable "enable_logging" {
  description = "Enable comprehensive logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
}

variable "enable_audit_logging" {
  description = "Enable audit logging"
  type        = bool
  default     = true
}

variable "audit_log_retention_days" {
  description = "Audit log retention period in days"
  type        = number
  default     = 365
}

variable "enable_performance_monitoring" {
  description = "Enable performance monitoring"
  type        = bool
  default     = true
}

variable "performance_monitoring_interval" {
  description = "Performance monitoring interval in seconds"
  type        = number
  default     = 60
}

variable "enable_health_checks" {
  description = "Enable health checks"
  type        = bool
  default     = true
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_retries" {
  description = "Number of health check retries"
  type        = number
  default     = 3
}

variable "enable_auto_scaling" {
  description = "Enable auto-scaling"
  type        = bool
  default     = true
}

variable "auto_scaling_min_capacity" {
  description = "Minimum auto-scaling capacity"
  type        = number
  default     = 2
}

variable "auto_scaling_max_capacity" {
  description = "Maximum auto-scaling capacity"
  type        = number
  default     = 20
}

variable "auto_scaling_target_cpu_utilization" {
  description = "Target CPU utilization for auto-scaling"
  type        = number
  default     = 70
}

variable "auto_scaling_target_memory_utilization" {
  description = "Target memory utilization for auto-scaling"
  type        = number
  default     = 80
}

variable "enable_failover" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "failover_threshold" {
  description = "Failover threshold (percentage of healthy instances)"
  type        = number
  default     = 50
}

variable "failover_timeout" {
  description = "Failover timeout in minutes"
  type        = number
  default     = 5
}

variable "enable_data_replication" {
  description = "Enable cross-region data replication"
  type        = bool
  default     = true
}

variable "data_replication_interval" {
  description = "Data replication interval in minutes"
  type        = number
  default     = 15
}

variable "enable_backup_replication" {
  description = "Enable backup replication across regions"
  type        = bool
  default     = true
}

variable "backup_replication_regions" {
  description = "Regions for backup replication"
  type        = list(string)
  default     = ["us-west-2", "eu-central-1"]
}

variable "enable_disaster_recovery" {
  description = "Enable disaster recovery"
  type        = bool
  default     = true
}

variable "disaster_recovery_rpo" {
  description = "Disaster Recovery Point Objective in minutes"
  type        = number
  default     = 15
}

variable "disaster_recovery_rto" {
  description = "Disaster Recovery Time Objective in minutes"
  type        = number
  default     = 60
}

variable "enable_compliance" {
  description = "Enable compliance features"
  type        = bool
  default     = true
}

variable "compliance_standards" {
  description = "Compliance standards to enable"
  type        = list(string)
  default     = ["HIPAA", "GDPR", "SOC2", "PCI-DSS"]
}

variable "enable_data_encryption" {
  description = "Enable data encryption"
  type        = bool
  default     = true
}

variable "data_encryption_algorithm" {
  description = "Data encryption algorithm"
  type        = string
  default     = "AES-256"
}

variable "enable_key_management" {
  description = "Enable key management"
  type        = bool
  default     = true
}

variable "key_rotation_enabled" {
  description = "Enable key rotation"
  type        = bool
  default     = true
}

variable "key_rotation_interval" {
  description = "Key rotation interval in days"
  type        = number
  default     = 90
}

variable "enable_access_control" {
  description = "Enable access control"
  type        = bool
  default     = true
}

variable "access_control_policy" {
  description = "Access control policy"
  type        = string
  default     = "least-privilege"
}

variable "enable_network_segmentation" {
  description = "Enable network segmentation"
  type        = bool
  default     = true
}

variable "network_segmentation_policy" {
  description = "Network segmentation policy"
  type        = string
  default     = "zero-trust"
}

variable "enable_container_security" {
  description = "Enable container security"
  type        = bool
  default     = true
}

variable "container_security_policy" {
  description = "Container security policy"
  type        = string
  default     = "restricted"
}

variable "enable_image_scanning" {
  description = "Enable container image scanning"
  type        = bool
  default     = true
}

variable "image_scanning_policy" {
  description = "Container image scanning policy"
  type        = string
  default     = "continuous"
}

variable "enable_runtime_security" {
  description = "Enable runtime security"
  type        = bool
  default     = true
}

variable "runtime_security_policy" {
  description = "Runtime security policy"
  type        = string
  default     = "monitor-and-block"
}

variable "enable_vulnerability_scanning" {
  description = "Enable vulnerability scanning"
  type        = bool
  default     = true
}

variable "vulnerability_scanning_interval" {
  description = "Vulnerability scanning interval in hours"
  type        = number
  default     = 24
}

variable "enable_penetration_testing" {
  description = "Enable penetration testing"
  type        = bool
  default     = true
}

variable "penetration_testing_interval" {
  description = "Penetration testing interval in days"
  type        = number
  default     = 90
}

variable "enable_security_monitoring" {
  description = "Enable security monitoring"
  type        = bool
  default     = true
}

variable "security_monitoring_interval" {
  description = "Security monitoring interval in minutes"
  type        = number
  default     = 5
}

variable "enable_incident_response" {
  description = "Enable incident response"
  type        = bool
  default     = true
}

variable "incident_response_timeout" {
  description = "Incident response timeout in minutes"
  type        = number
  default     = 15
}

variable "enable_threat_detection" {
  description = "Enable threat detection"
  type        = bool
  default     = true
}

variable "threat_detection_sensitivity" {
  description = "Threat detection sensitivity level"
  type        = string
  default     = "high"
  
  validation {
    condition = contains(["low", "medium", "high"], var.threat_detection_sensitivity)
    error_message = "Threat detection sensitivity must be one of: low, medium, high."
  }
}

variable "enable_anomaly_detection" {
  description = "Enable anomaly detection"
  type        = bool
  default     = true
}

variable "anomaly_detection_threshold" {
  description = "Anomaly detection threshold"
  type        = number
  default     = 0.95
}

variable "enable_behavioral_analysis" {
  description = "Enable behavioral analysis"
  type        = bool
  default     = true
}

variable "behavioral_analysis_window" {
  description = "Behavioral analysis window in minutes"
  type        = number
  default     = 60
}

variable "enable_ml_security" {
  description = "Enable ML-based security"
  type        = bool
  default     = true
}

variable "ml_security_model" {
  description = "ML security model"
  type        = string
  default     = "ensemble"
}

variable "enable_zero_trust" {
  description = "Enable zero-trust security model"
  type        = bool
  default     = true
}

variable "zero_trust_policy" {
  description = "Zero-trust policy"
  type        = string
  default     = "never-trust-always-verify"
}

variable "enable_privacy_protection" {
  description = "Enable privacy protection"
  type        = bool
  default     = true
}

variable "privacy_protection_level" {
  description = "Privacy protection level"
  type        = string
  default     = "maximum"
  
  validation {
    condition = contains(["minimum", "standard", "maximum"], var.privacy_protection_level)
    error_message = "Privacy protection level must be one of: minimum, standard, maximum."
  }
}

variable "enable_data_anonymization" {
  description = "Enable data anonymization"
  type        = bool
  default     = true
}

variable "data_anonymization_method" {
  description = "Data anonymization method"
  type        = string
  default     = "k-anonymity"
}

variable "enable_consent_management" {
  description = "Enable consent management"
  type        = bool
  default     = true
}

variable "consent_management_policy" {
  description = "Consent management policy"
  type        = string
  default     = "opt-in"
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "pixelated"
    Environment = "production"
    ManagedBy   = "terraform"
    Owner       = "devops-team"
  }
}