variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Base name for all generated resources."
  type        = string
  default     = "pixelated-empathy"
}

variable "environment" {
  description = "Deployment environment label."
  type        = string
  default     = "staging"
}

variable "vpc_cidr" {
  description = "VPC CIDR block."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks (one per AZ)."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "Availability zones for subnets."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks for ECS and ElastiCache (one per AZ)."
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 365
}

variable "hetzner_s3_bucket" {
  description = "Hetzner Object Storage bucket name for ALB access logs."
  type        = string
  default     = "pixel-data"
}

variable "hetzner_s3_endpoint" {
  description = "Hetzner Object Storage API endpoint for ALB access logs (no trailing slash)."
  type        = string
  default     = "hel1.your-objectstorage.com"
}

variable "ecs_cpu" {
  description = "ECS task CPU units (256 = 0.25 vCPU)."
  type        = string
  default     = "256"
}

variable "ecs_memory" {
  description = "ECS task memory in MiB (512 = 0.5 GB)."
  type        = string
  default     = "512"
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks."
  type        = number
  default     = 1
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type."
  type        = string
  default     = "cache.t3.micro"
}

variable "container_port" {
  description = "Container port the app listens on."
  type        = number
  default     = 4321
}

variable "health_check_path" {
  description = "Health check endpoint path."
  type        = string
  default     = "/health"
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS listener."
  type        = string
  default     = ""
}

variable "github_org" {
  description = "GitHub organization name for OIDC trust."
  type        = string
  default     = "daggerstuff"
}

variable "github_repo" {
  description = "GitHub repository name for OIDC trust (defaults to app_name)."
  type        = string
  default     = "pixelated"
}

# --- Secrets (sensitive) ---
variable "secret_database_url" {
  description = "Database connection string (Neon PostgreSQL or similar)."
  type        = string
  default     = ""
}

variable "secret_redis_url" {
  description = "Redis connection string (auto-computed from ElastiCache if empty)."
  type        = string
  default     = ""
}

variable "secret_jwt_secret" {
  description = "JWT signing secret."
  type        = string
  default     = ""
}

variable "secret_api_key" {
  description = "Internal API key."
  type        = string
  default     = ""
}

variable "secret_sentry_dsn" {
  description = "Sentry DSN for error tracking."
  type        = string
  default     = ""
}

variable "secret_auth0_client_secret" {
  description = "Auth0 client secret."
  type        = string
  default     = ""
}
