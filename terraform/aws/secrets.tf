locals {
  # Secret names to keep in AWS Secrets Manager (rotated or sensitive)
  sm_secret_names   = toset(["DATABASE_URL", "AUTH0_CLIENT_SECRET"])
  # Secret names to migrate to SSM Parameter Store (static, no rotation needed)
  ssm_secret_names  = toset(["API_KEY", "JWT_SECRET", "REDIS_URL", "SENTRY_DSN"])
  # Full set for maintaining existing Secrets Manager resources
  secret_names      = toset(["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "API_KEY", "SENTRY_DSN", "AUTH0_CLIENT_SECRET"])

  # Computed values (REDIS_URL depends on apply-time ElastiCache address)
  secret_values = {
    DATABASE_URL        = var.secret_database_url != "" ? var.secret_database_url : "placeholder-update-in-aws-console"
    REDIS_URL           = var.secret_redis_url != "" ? var.secret_redis_url : "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
    JWT_SECRET          = var.secret_jwt_secret != "" ? var.secret_jwt_secret : "placeholder-update-in-aws-console"
    API_KEY             = var.secret_api_key != "" ? var.secret_api_key : "placeholder-update-in-aws-console"
    SENTRY_DSN          = var.secret_sentry_dsn != "" ? var.secret_sentry_dsn : "placeholder-update-in-aws-console"
    AUTH0_CLIENT_SECRET = var.secret_auth0_client_secret != "" ? var.secret_auth0_client_secret : "placeholder-update-in-aws-console"
  }
}

# --- AWS Secrets Manager (for secrets that may need rotation) ---
resource "aws_secretsmanager_secret" "app_secrets" {
  for_each    = local.secret_names
  name        = "${local.secrets_prefix}/${each.key}"
  description = "Pixelated Empathy ${each.key}"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  for_each      = aws_secretsmanager_secret.app_secrets
  secret_id     = each.value.id
  secret_string = local.secret_values[each.key]
}

# --- SSM Parameter Store (static secrets, free tier) ---
data "aws_secretsmanager_secret_version" "migrated_ssm" {
  for_each  = local.ssm_secret_names
  secret_id = aws_secretsmanager_secret.app_secrets[each.key].id
}

resource "aws_ssm_parameter" "app_params" {
  for_each = local.ssm_secret_names
  name     = "/${local.secrets_prefix}/${each.key}"
  type     = "SecureString"
  value    = data.aws_secretsmanager_secret_version.migrated_ssm[each.key].secret_string

  tags = local.common_tags
}
