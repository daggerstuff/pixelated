# --- CloudWatch Log Group ---
resource "aws_cloudwatch_log_group" "api" {
  name              = local.log_group_name
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = local.common_tags
}

# --- ECS Cluster ---
resource "aws_ecs_cluster" "main" {
  name = local.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

# --- ECS Task Definition ---
resource "aws_ecs_task_definition" "api" {
  family                   = local.task_family
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  cpu                = var.ecs_cpu
  memory             = var.ecs_memory
  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "${var.app_name}-api"
      image     = "${aws_ecr_repository.api.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "APP_NAME", value = var.app_name },
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.container_port) },
        { name = "HOST", value = "0.0.0.0" },
        { name = "CORS_ORIGIN", value = "https://pixelatedempathy.com,https://www.pixelatedempathy.com" },
      ]
      secrets = concat(
        [for k in local.ssm_secret_names : {
          name      = k
          valueFrom = aws_ssm_parameter.app_params[k].arn
        }],
        [for k in local.sm_secret_names : {
          name      = k
          valueFrom = aws_secretsmanager_secret.app_secrets[k].arn
        }],
      )
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])

  tags = local.common_tags
}

# --- ECS Service ---
resource "aws_ecs_service" "api" {
  name            = local.service_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.ecs_desired_count

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 80
  }
  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 20
  }

  health_check_grace_period_seconds = 60

  deployment_controller {
    type = "CODE_DEPLOY"
  }

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "${var.app_name}-api"
    container_port   = var.container_port
  }

  lifecycle {
    ignore_changes = [
      task_definition,
      desired_count,
      load_balancer,
    ]
  }

  tags = local.common_tags
}
