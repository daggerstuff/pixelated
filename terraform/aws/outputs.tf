output "aws_region" {
  description = "AWS region."
  value       = var.aws_region
}

output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs."
  value       = aws_subnet.public[*].id
}

output "alb_dns_name" {
  description = "ALB DNS name for CNAME record."
  value       = aws_lb.api.dns_name
}

output "alb_arn" {
  description = "ALB ARN."
  value       = aws_lb.api.arn
}

output "alb_listener_arn" {
  description = "ALB HTTP listener ARN."
  value       = aws_lb_listener.http.arn
}

output "alb_https_listener_arn" {
  description = "ALB HTTPS listener ARN."
  value       = aws_lb_listener.https.arn
}

output "target_group_arn" {
  description = "Target group ARN."
  value       = aws_lb_target_group.api.arn
}

output "ecr_repository_url" {
  description = "ECR repository URL for the API image."
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_repository_arn" {
  description = "ECR repository ARN."
  value       = aws_ecr_repository.api.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.api.name
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN."
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  description = "ECS task role ARN."
  value       = aws_iam_role.ecs_task.arn
}

output "codedeploy_app_name" {
  description = "CodeDeploy application name."
  value       = aws_codedeploy_app.ecs.name
}

output "codedeploy_deployment_group_name" {
  description = "CodeDeploy deployment group name."
  value       = aws_codedeploy_deployment_group.ecs.deployment_group_name
}

output "redis_address" {
  description = "Redis endpoint address."
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis endpoint port."
  value       = aws_elasticache_cluster.redis.cache_nodes[0].port
}

output "secrets_arns" {
  description = "Map of secret names to ARNs."
  value = {
    for k, secret in aws_secretsmanager_secret.app_secrets : k => secret.arn
  }
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC."
  value       = aws_iam_role.github_actions.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name."
  value       = aws_cloudwatch_log_group.api.name
}
