# --- Target Group ---
resource "aws_lb_target_group" "api" {
  name        = local.tg_name
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = local.common_tags
}

# --- Application Load Balancer ---
resource "aws_lb" "api" {
  name               = local.alb_name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = local.common_tags
}

# --- HTTP Listener (redirects to HTTPS) ---
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# --- HTTPS Listener ---
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  # CodeDeploy manages the forwarding target group during blue/green deployments.
  lifecycle {
    ignore_changes = [default_action]
  }
}

# --- Blue/Green Target Group ---
resource "aws_lb_target_group" "api_green" {
  name        = local.tg_green_name
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = local.common_tags
}

# --- CodeDeploy IAM (for blue/green) ---
resource "aws_iam_role" "codedeploy" {
  name = "${local.label}-codedeploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "codedeploy" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}

# --- CodeDeploy Application ---
resource "aws_codedeploy_app" "ecs" {
  name             = local.codedeploy_app_name
  compute_platform = "ECS"
}

# --- CodeDeploy Deployment Group ---
resource "aws_codedeploy_deployment_group" "ecs" {
  app_name               = aws_codedeploy_app.ecs.name
  deployment_group_name   = local.codedeploy_dg_name
  service_role_arn        = aws_iam_role.codedeploy.arn
  deployment_config_name  = "CodeDeployDefault.ECSAllAtOnce"

  alarm_configuration {
    enabled = true
    alarms  = [
      aws_cloudwatch_metric_alarm.alb_5xx_high.alarm_name,
      aws_cloudwatch_metric_alarm.alb_target_response_time_high.alarm_name,
      aws_cloudwatch_metric_alarm.ecs_cpu_high.alarm_name,
      aws_cloudwatch_metric_alarm.ecs_memory_high.alarm_name,
    ]
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  blue_green_deployment_config {
    deployment_ready_option {
      action_on_timeout    = "STOP_DEPLOYMENT"
      wait_time_in_minutes = 5
    }

    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }
  }

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.main.name
    service_name = aws_ecs_service.api.name
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [aws_lb_listener.https.arn]
      }

      target_group {
        name = aws_lb_target_group.api.name
      }

      target_group {
        name = aws_lb_target_group.api_green.name
      }
    }
  }
}
