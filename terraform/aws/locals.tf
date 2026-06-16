locals {
  label            = "${var.app_name}-${var.environment}"
  aws_account_id   = data.aws_caller_identity.current.account_id

  # --- VPC ---
  vpc_name         = "${local.label}-vpc"
  igw_name         = "${local.label}-igw"
  rt_name          = "${local.label}-public-rt"

  # --- Security ---
  alb_sg_name      = "${local.label}-alb-sg"
  ecs_sg_name      = "${local.label}-ecs-sg"
  redis_sg_name    = "${local.label}-redis-sg"

  # --- ALB ---
  alb_name         = "${local.label}-alb"
  tg_name          = "${local.label}-tg"
  tg_green_name    = "${local.label}-green"

  # --- ECS ---
  cluster_name     = local.label
  service_name     = "${local.label}-api"
  task_family      = "${var.app_name}-api"
  log_group_name   = "/ecs/${var.app_name}-api"

  # --- ECR ---
  ecr_repo_name    = "${var.app_name}-api"

  # --- Redis / ElastiCache ---
  redis_subnet_group_name = "${local.label}-redis-sg"
  redis_cluster_id        = "${local.label}-redis"

  # --- CodeDeploy ---
  codedeploy_app_name     = "${var.app_name}-ecs"
  codedeploy_dg_name      = "${var.app_name}-ecs-dg"

  # --- Secrets ---
  secrets_prefix   = "pixelated"

  # --- IAM ---
  ecs_exec_role_name = "${local.label}-ecs-exec"
  ecs_task_role_name = "${local.label}-ecs-task"
  github_oidc_role   = "${var.app_name}-github-actions"

  # --- Tags ---
  common_tags = {
    App         = var.app_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
