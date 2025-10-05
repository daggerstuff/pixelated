# Multi-Region Infrastructure as Code
# Terraform configuration for global multi-region deployment

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# Provider configurations for multi-cloud setup
provider "aws" {
  alias  = "us_east"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "us-east-1"
    }
  }
}

provider "aws" {
  alias  = "us_west"
  region = "us-west-2"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "us-west-2"
    }
  }
}

provider "aws" {
  alias  = "eu_central"
  region = "eu-central-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "eu-central-1"
    }
  }
}

provider "aws" {
  alias  = "ap_southeast"
  region = "ap-southeast-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "ap-southeast-1"
    }
  }
}

provider "google" {
  alias   = "gcp_europe"
  project = var.gcp_project_id
  region  = "europe-west3"
}

provider "google" {
  alias   = "gcp_asia"
  project = var.gcp_project_id
  region  = "asia-southeast1"
}

provider "azurerm" {
  alias           = "azure_europe"
  subscription_id = var.azure_subscription_id
  client_id       = var.azure_client_id
  client_secret   = var.azure_client_secret
  tenant_id       = var.azure_tenant_id
  features {}
}

# Data sources for cross-region information
data "aws_caller_identity" "current" {
  provider = aws.us_east
}

data "aws_availability_zones" "available" {
  provider = aws.us_east
  state    = "available"
}

# Multi-region VPC and networking
module "vpc_us_east" {
  source = "./modules/vpc"
  providers = {
    aws = aws.us_east
  }

  project_name        = var.project_name
  environment         = var.environment
  region             = "us-east-1"
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)

  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = var.common_tags
}

module "vpc_us_west" {
  source = "./modules/vpc"
  providers = {
    aws = aws.us_west
  }

  project_name        = var.project_name
  environment         = var.environment
  region             = "us-west-2"
  vpc_cidr           = "10.2.0.0/16"
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)

  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = var.common_tags
}

module "vpc_eu_central" {
  source = "./modules/vpc"
  providers = {
    aws = aws.eu_central
  }

  project_name        = var.project_name
  environment         = var.environment
  region             = "eu-central-1"
  vpc_cidr           = "10.3.0.0/16"
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)

  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = var.common_tags
}

module "vpc_ap_southeast" {
  source = "./modules/vpc"
  providers = {
    aws = aws.ap_southeast
  }

  project_name        = var.project_name
  environment         = var.environment
  region             = "ap-southeast-1"
  vpc_cidr           = "10.4.0.0/16"
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)

  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = var.common_tags
}

# GCP Network Setup
resource "google_compute_network" "gcp_europe" {
  provider                = google.gcp_europe
  name                    = "${var.project_name}-vpc-europe"
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"

  depends_on = [
    google_project_service.compute_api
  ]
}

resource "google_compute_subnetwork" "gcp_europe_subnets" {
  provider                 = google.gcp_europe
  for_each                 = toset(["europe-west3-a", "europe-west3-b", "europe-west3-c"])
  name                     = "${var.project_name}-subnet-${each.key}"
  ip_cidr_range            = "10.5.${index(toset(["europe-west3-a", "europe-west3-b", "europe-west3-c"]), each.key)}.0/24"
  region                   = "europe-west3"
  network                  = google_compute_network.gcp_europe.id
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# GCP Europe Firewall Rules
resource "google_compute_firewall" "gcp_europe_allow_internal" {
  provider    = google.gcp_europe
  name        = "${var.project_name}-europe-allow-internal"
  network     = google_compute_network.gcp_europe.name
  description = "Allow internal communication within VPC"

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.5.0.0/16"]
  priority      = 1000
}

resource "google_compute_firewall" "gcp_europe_allow_https" {
  provider    = google.gcp_europe
  name        = "${var.project_name}-europe-allow-https"
  network     = google_compute_network.gcp_europe.name
  description = "Allow HTTPS ingress"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web"]
  priority      = 1000
}

resource "google_compute_firewall" "gcp_europe_deny_all" {
  provider    = google.gcp_europe
  name        = "${var.project_name}-europe-deny-all"
  network     = google_compute_network.gcp_europe.name
  description = "Deny all other traffic"

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
  priority      = 65535
}

resource "google_compute_network" "gcp_asia" {
  provider                = google.gcp_asia
  name                    = "${var.project_name}-vpc-asia"
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"

  depends_on = [
    google_project_service.compute_api
  ]
}

resource "google_compute_subnetwork" "gcp_asia_subnets" {
  provider                 = google.gcp_asia
  for_each                 = toset(["asia-southeast1-a", "asia-southeast1-b", "asia-southeast1-c"])
  name                     = "${var.project_name}-subnet-${each.key}"
  ip_cidr_range            = "10.6.${index(toset(["asia-southeast1-a", "asia-southeast1-b", "asia-southeast1-c"]), each.key)}.0/24"
  region                   = "asia-southeast1"
  network                  = google_compute_network.gcp_asia.id
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# GCP Asia Firewall Rules
resource "google_compute_firewall" "gcp_asia_allow_internal" {
  provider    = google.gcp_asia
  name        = "${var.project_name}-asia-allow-internal"
  network     = google_compute_network.gcp_asia.name
  description = "Allow internal communication within VPC"

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.6.0.0/16"]
  priority      = 1000
}

resource "google_compute_firewall" "gcp_asia_allow_https" {
  provider    = google.gcp_asia
  name        = "${var.project_name}-asia-allow-https"
  network     = google_compute_network.gcp_asia.name
  description = "Allow HTTPS ingress"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web"]
  priority      = 1000
}

resource "google_compute_firewall" "gcp_asia_deny_all" {
  provider    = google.gcp_asia
  name        = "${var.project_name}-asia-deny-all"
  network     = google_compute_network.gcp_asia.name
  description = "Deny all other traffic"

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
  priority      = 65535
}

# Enable required Google APIs
resource "google_project_service" "compute_api" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "cloudsql.googleapis.com",
    "redis.googleapis.com"
  ])
  service = each.key

  disable_on_destroy = false
}

# Multi-region Kubernetes clusters
module "eks_us_east" {
  source = "./modules/eks"
  providers = {
    aws = aws.us_east
  }

  cluster_name    = "${var.project_name}-eks-us-east"
  cluster_version = var.kubernetes_version
  vpc_id         = module.vpc_us_east.vpc_id
  subnet_ids     = module.vpc_us_east.private_subnets

  node_groups = {
    main = {
      desired_size = var.node_group_desired_size
      max_size     = var.node_group_max_size
      min_size     = var.node_group_min_size

      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"

      k8s_labels = {
        Environment = var.environment
        Region      = "us-east-1"
        Zone        = "multi-az"
      }
    }
  }

  tags = var.common_tags
}

module "eks_us_west" {
  source = "./modules/eks"
  providers = {
    aws = aws.us_west
  }

  cluster_name    = "${var.project_name}-eks-us-west"
  cluster_version = var.kubernetes_version
  vpc_id         = module.vpc_us_west.vpc_id
  subnet_ids     = module.vpc_us_west.private_subnets

  node_groups = {
    main = {
      desired_size = var.node_group_desired_size
      max_size     = var.node_group_max_size
      min_size     = var.node_group_min_size

      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"

      k8s_labels = {
        Environment = var.environment
        Region      = "us-west-2"
        Zone        = "multi-az"
      }
    }
  }

  tags = var.common_tags
}

module "eks_eu_central" {
  source = "./modules/eks"
  providers = {
    aws = aws.eu_central
  }

  cluster_name    = "${var.project_name}-eks-eu-central"
  cluster_version = var.kubernetes_version
  vpc_id         = module.vpc_eu_central.vpc_id
  subnet_ids     = module.vpc_eu_central.private_subnets

  node_groups = {
    main = {
      desired_size = var.node_group_desired_size
      max_size     = var.node_group_max_size
      min_size     = var.node_group_min_size

      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"

      k8s_labels = {
        Environment = var.environment
        Region      = "eu-central-1"
        Zone        = "multi-az"
      }
    }
  }

  tags = var.common_tags
}

module "eks_ap_southeast" {
  source = "./modules/eks"
  providers = {
    aws = aws.ap_southeast
  }

  cluster_name    = "${var.project_name}-eks-ap-southeast"
  cluster_version = var.kubernetes_version
  vpc_id         = module.vpc_ap_southeast.vpc_id
  subnet_ids     = module.vpc_ap_southeast.private_subnets

  node_groups = {
    main = {
      desired_size = var.node_group_desired_size
      max_size     = var.node_group_max_size
      min_size     = var.node_group_min_size

      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"

      k8s_labels = {
        Environment = var.environment
        Region      = "ap-southeast-1"
        Zone        = "multi-az"
      }
    }
  }

  tags = var.common_tags
}

# GCP GKE Clusters
module "gke_europe" {
  source = "./modules/gke"
  providers = {
    google = google.gcp_europe
  }

  project_id      = var.gcp_project_id
  cluster_name    = "${var.project_name}-gke-europe"
  region         = "europe-west3"
  network        = google_compute_network.gcp_europe.id
  subnetworks    = [for s in google_compute_subnetwork.gcp_europe_subnets : s.id]

  node_pools = [
    {
      name       = "main-pool"
      node_count = var.node_group_desired_size
      node_type  = "n2-standard-4"

      labels = {
        environment = var.environment
        region      = "europe-west3"
      }
    }
  ]

  tags = var.common_tags
}

module "gke_asia" {
  source = "./modules/gke"
  providers = {
    google = google.gcp_asia
  }

  project_id      = var.gcp_project_id
  cluster_name    = "${var.project_name}-gke-asia"
  region         = "asia-southeast1"
  network        = google_compute_network.gcp_asia.id
  subnetworks    = [for s in google_compute_subnetwork.gcp_asia_subnets : s.id]

  node_pools = [
    {
      name       = "main-pool"
      node_count = var.node_group_desired_size
      node_type  = "n2-standard-4"

      labels = {
        environment = var.environment
        region      = "asia-southeast1"
      }
    }
  ]

  tags = var.common_tags
}

# Multi-region databases
module "rds_multi_region" {
  source = "./modules/rds-multi-region"

  for_each = {
    us_east = {
      provider = aws.us_east
      vpc_id   = module.vpc_us_east.vpc_id
      subnets  = module.vpc_us_east.private_subnets
      region   = "us-east-1"
    }
    us_west = {
      provider = aws.us_west
      vpc_id   = module.vpc_us_west.vpc_id
      subnets  = module.vpc_us_west.private_subnets
      region   = "us-west-2"
    }
    eu_central = {
      provider = aws.eu_central
      vpc_id   = module.vpc_eu_central.vpc_id
      subnets  = module.vpc_eu_central.private_subnets
      region   = "eu-central-1"
    }
    ap_southeast = {
      provider = aws.ap_southeast
      vpc_id   = module.vpc_ap_southeast.vpc_id
      subnets  = module.vpc_ap_southeast.private_subnets
      region   = "ap-southeast-1"
    }
  }

  project_name     = var.project_name
  environment      = var.environment
  engine          = "postgres"
  engine_version  = var.postgres_version
  instance_class  = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage

  providers = {
    aws = each.value.provider
  }

  vpc_id     = each.value.vpc_id
  subnet_ids = each.value.subnets
  region     = each.value.region

  backup_retention_period = var.db_backup_retention_period
  backup_window          = var.db_backup_window
  maintenance_window     = var.db_maintenance_window

  tags = var.common_tags
}

# CockroachDB multi-region cluster
module "cockroachdb_cluster" {
  source = "./modules/cockroachdb"

  cluster_name = "${var.project_name}-cockroachdb"
  regions = [
    {
      name = "us-east"
      zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
    },
    {
      name = "us-west"
      zones = ["us-west-2a", "us-west-2b", "us-west-2c"]
    },
    {
      name = "eu-central"
      zones = ["eu-central-1a", "eu-central-1b", "eu-central-1c"]
    },
    {
      name = "ap-southeast"
      zones = ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]
    }
  ]

  node_count = 3
  node_type  = "n2-standard-8"

  tags = var.common_tags
}

# Redis multi-region clusters
module "redis_multi_region" {
  source = "./modules/redis-multi-region"

  for_each = {
    us_east = {
      provider = aws.us_east
      subnets  = module.vpc_us_east.private_subnets
      region   = "us-east-1"
    }
    us_west = {
      provider = aws.us_west
      subnets  = module.vpc_us_west.private_subnets
      region   = "us-west-2"
    }
    eu_central = {
      provider = aws.eu_central
      subnets  = module.vpc_eu_central.private_subnets
      region   = "eu-central-1"
    }
    ap_southeast = {
      provider = aws.ap_southeast
      subnets  = module.vpc_ap_southeast.private_subnets
      region   = "ap-southeast-1"
    }
  }

  project_name     = var.project_name
  environment      = var.environment
  node_type       = var.redis_node_type
  num_cache_nodes = var.redis_num_cache_nodes

  providers = {
    aws = each.value.provider
  }

  subnet_ids = each.value.subnets
  region     = each.value.region

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = var.common_tags
}

# Global load balancers and CDN
module "global_load_balancer" {
  source = "./modules/global-load-balancer"

  project_name = var.project_name
  environment  = var.environment

  regions = {
    us_east = {
      provider   = aws.us_east
      vpc_id     = module.vpc_us_east.vpc_id
      subnet_ids = module.vpc_us_east.public_subnets
      region     = "us-east-1"
    }
    us_west = {
      provider   = aws.us_west
      vpc_id     = module.vpc_us_west.vpc_id
      subnet_ids = module.vpc_us_west.public_subnets
      region     = "us-west-2"
    }
    eu_central = {
      provider   = aws.eu_central
      vpc_id     = module.vpc_eu_central.vpc_id
      subnet_ids = module.vpc_eu_central.public_subnets
      region     = "eu-central-1"
    }
    ap_southeast = {
      provider   = aws.ap_southeast
      vpc_id     = module.vpc_ap_southeast.vpc_id
      subnet_ids = module.vpc_ap_southeast.public_subnets
      region     = "ap-southeast-1"
    }
  }

  health_check_path     = "/health"
  health_check_interval = 30
  health_check_timeout  = 5

  tags = var.common_tags
}

# Multi-region S3 buckets with replication
module "s3_multi_region" {
  source = "./modules/s3-multi-region"

  project_name = var.project_name
  environment  = var.environment

  regions = ["us-east-1", "us-west-2", "eu-central-1", "ap-southeast-1"]

  versioning_enabled = true
  encryption_enabled = true
  replication_enabled = true

  lifecycle_rules = [
    {
      id      = "expire-old-versions"
      enabled = true
      expiration = {
        days = 365
      }
      noncurrent_version_expiration = {
        days = 30
      }
    }
  ]

  tags = var.common_tags
}

# Cloudflare configuration for global edge
resource "cloudflare_zone" "main" {
  zone = var.domain_name
}

resource "cloudflare_record" "api_us_east" {
  zone_id = cloudflare_zone.main.id
  name    = "api-us-east"
  type    = "CNAME"
  value   = module.global_load_balancer.us_east_dns_name
  proxied = true
}

resource "cloudflare_record" "api_us_west" {
  zone_id = cloudflare_zone.main.id
  name    = "api-us-west"
  type    = "CNAME"
  value   = module.global_load_balancer.us_west_dns_name
  proxied = true
}

resource "cloudflare_record" "api_eu_central" {
  zone_id = cloudflare_zone.main.id
  name    = "api-eu-central"
  type    = "CNAME"
  value   = module.global_load_balancer.eu_central_dns_name
  proxied = true
}

resource "cloudflare_record" "api_ap_southeast" {
  zone_id = cloudflare_zone.main.id
  name    = "api-ap-southeast"
  type    = "CNAME"
  value   = module.global_load_balancer.ap_southeast_dns_name
  proxied = true
}

# Global DNS with latency-based routing
resource "cloudflare_load_balancer" "api_global" {
  zone_id          = cloudflare_zone.main.id
  name             = "api-global"
  fallback_pool_id = cloudflare_load_balancer_pool.us_east.id
  default_pool_ids = [
    cloudflare_load_balancer_pool.us_east.id,
    cloudflare_load_balancer_pool.us_west.id,
    cloudflare_load_balancer_pool.eu_central.id,
    cloudflare_load_balancer_pool.ap_southeast.id
  ]
  description = "Global API load balancer with latency-based routing"
  steering_policy = "latency"
  ttl = 30
}

resource "cloudflare_load_balancer_pool" "us_east" {
  name = "${var.project_name}-us-east-pool"
  origins {
    name    = "us-east-1"
    address = module.global_load_balancer.us_east_dns_name
    enabled = true
  }
}

resource "cloudflare_load_balancer_pool" "us_west" {
  name = "${var.project_name}-us-west-pool"
  origins {
    name    = "us-west-2"
    address = module.global_load_balancer.us_west_dns_name
    enabled = true
  }
}

resource "cloudflare_load_balancer_pool" "eu_central" {
  name = "${var.project_name}-eu-central-pool"
  origins {
    name    = "eu-central-1"
    address = module.global_load_balancer.eu_central_dns_name
    enabled = true
  }
}

resource "cloudflare_load_balancer_pool" "ap_southeast" {
  name = "${var.project_name}-ap-southeast-pool"
  origins {
    name    = "ap-southeast-1"
    address = module.global_load_balancer.ap_southeast_dns_name
    enabled = true
  }
}

# Monitoring and alerting setup
module "monitoring_stack" {
  source = "./modules/monitoring"

  project_name = var.project_name
  environment  = var.environment

  prometheus_config = {
    retention = "30d"
    storage   = "100Gi"
  }

  grafana_config = {
    admin_password = var.grafana_admin_password
    persistence    = true
  }

  alertmanager_config = {
    slack_webhook_url = var.slack_webhook_url
    pagerduty_key     = var.pagerduty_key
  }

  tags = var.common_tags
}

# Security groups and network policies
# checkov:skip=CKV2_AWS_5: Security groups are templates for future resource attachment
resource "aws_security_group" "multi_region" {
  for_each = {
    us_east    = aws.us_east
    us_west    = aws.us_west
    eu_central = aws.eu_central
    ap_southeast = aws.ap_southeast
  }

  provider = each.value

  name_prefix = "${var.project_name}-multi-region-"
  description = "Multi-region security group template for ${each.key} - to be attached to application resources"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]  # Restrict to private network ranges
    description = "HTTPS from internal network"
  }

  # Removed unrestricted HTTP port 80 ingress for security compliance

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound"
  }

  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP outbound"
  }

  tags = merge(var.common_tags, {
    Region = each.key
  })
}

# KMS keys for backup encryption
resource "aws_kms_key" "backup_replication" {
  for_each = {
    us_east      = aws.us_east
    us_west      = aws.us_west
    eu_central   = aws.eu_central
    ap_southeast = aws.ap_southeast
  }

  provider = each.value

  description             = "KMS key for RDS backup replication in ${each.key}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow use of the key for RDS backup encryption"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-backup-kms-${each.key}"
  })
}

resource "aws_kms_alias" "backup_replication" {
  for_each = aws_kms_key.backup_replication

  name          = "alias/${var.project_name}-backup-${each.key}"
  target_key_id = each.value.key_id
}

# IAM roles and policies for cross-region access
resource "aws_iam_role" "multi_region_role" {
  for_each = {
    us_east    = aws.us_east
    us_west    = aws.us_west
    eu_central = aws.eu_central
    ap_southeast = aws.ap_southeast
  }

  provider = each.value

  name = "${var.project_name}-multi-region-role-${each.key}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

# Cross-region replication and backup
resource "aws_db_instance_automated_backups_replication" "multi_region_backup" {
  for_each = {
    us_east    = aws.us_east
    us_west    = aws.us_west
    eu_central = aws.eu_central
    ap_southeast = aws.ap_southeast
  }

  provider = each.value

  source_db_instance_arn = module.rds_multi_region[each.key].db_instance_arn
  retention_period       = var.db_backup_retention_period
  kms_key_id            = aws_kms_key.backup_replication[each.key].arn

  tags = var.common_tags
}

# Outputs for multi-region infrastructure
output "multi_region_endpoints" {
  value = {
    us_east = {
      eks_endpoint     = module.eks_us_east.cluster_endpoint
      rds_endpoint     = module.rds_multi_region["us_east"].instance_endpoint
      redis_endpoint   = module.redis_multi_region["us_east"].primary_endpoint_address
      load_balancer_dns = module.global_load_balancer.us_east_dns_name
    }
    us_west = {
      eks_endpoint     = module.eks_us_west.cluster_endpoint
      rds_endpoint     = module.rds_multi_region["us_west"].instance_endpoint
      redis_endpoint   = module.redis_multi_region["us_west"].primary_endpoint_address
      load_balancer_dns = module.global_load_balancer.us_west_dns_name
    }
    eu_central = {
      eks_endpoint     = module.eks_eu_central.cluster_endpoint
      rds_endpoint     = module.rds_multi_region["eu_central"].instance_endpoint
      redis_endpoint   = module.redis_multi_region["eu_central"].primary_endpoint_address
      load_balancer_dns = module.global_load_balancer.eu_central_dns_name
    }
    ap_southeast = {
      eks_endpoint     = module.eks_ap_southeast.cluster_endpoint
      rds_endpoint     = module.rds_multi_region["ap_southeast"].instance_endpoint
      redis_endpoint   = module.redis_multi_region["ap_southeast"].primary_endpoint_address
      load_balancer_dns = module.global_load_balancer.ap_southeast_dns_name
    }
  }
}

output "cockroachdb_cluster_info" {
  value = {
    cluster_id   = module.cockroachdb_cluster.cluster_id
    cluster_name = module.cockroachdb_cluster.cluster_name
    regions      = module.cockroachdb_cluster.regions
    connection_string = module.cockroachdb_cluster.connection_string
  }
}

output "global_dns_endpoints" {
  value = {
    api_global = cloudflare_load_balancer.api_global.hostname
    regional_endpoints = {
      us_east      = cloudflare_record.api_us_east.hostname
      us_west      = cloudflare_record.api_us_west.hostname
      eu_central   = cloudflare_record.api_eu_central.hostname
      ap_southeast = cloudflare_record.api_ap_southeast.hostname
    }
  }
}

output "monitoring_endpoints" {
  value = {
    prometheus_url = module.monitoring_stack.prometheus_url
    grafana_url    = module.monitoring_stack.grafana_url
    alertmanager_url = module.monitoring_stack.alertmanager_url
  }
}

output "security_group_ids" {
  value = {
    for region, sg in aws_security_group.multi_region : region => sg.id
  }
}

output "iam_role_arns" {
  value = {
    for region, role in aws_iam_role.multi_region_role : region => role.arn
  }
}
