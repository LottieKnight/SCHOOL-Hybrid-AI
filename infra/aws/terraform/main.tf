terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.tags, {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    })
  }
}

data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  account_id  = data.aws_caller_identity.current.account_id

  services = {
    api = {
      container_port = var.api_container_port
      health_path    = "/health"
      cpu            = var.api_cpu
      memory         = var.api_memory
      listener_rule  = ["api.${var.domain_name}"]
      priority       = 10
    }
    web = {
      container_port = var.web_container_port
      health_path    = "/health"
      cpu            = var.web_cpu
      memory         = var.web_memory
      listener_rule  = [var.domain_name, "www.${var.domain_name}"]
      priority       = 20
    }
  }
}

############################################
# ECR
############################################

resource "aws_ecr_repository" "this" {
  for_each = local.services

  name                 = "${local.name_prefix}-${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = var.environment != "prod"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.ecr_image_retention_count} images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.ecr_image_retention_count
        }
        action = { type = "expire" }
      }
    ]
  })
}

############################################
# Networking (existing VPC lookup)
############################################

data "aws_vpc" "this" {
  id = var.vpc_id
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Ingress for the public ALB"
  vpc_id      = data.aws_vpc.this.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "tasks" {
  name        = "${local.name_prefix}-tasks-sg"
  description = "Fargate tasks; only ALB may reach container ports"
  vpc_id      = data.aws_vpc.this.id

  egress {
    description = "All egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "tasks_from_alb" {
  for_each = local.services

  type                     = "ingress"
  description              = "ALB to ${each.key}"
  from_port                = each.value.container_port
  to_port                  = each.value.container_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.tasks.id
  source_security_group_id = aws_security_group.alb.id
}

############################################
# ALB + target groups
############################################

resource "aws_lb" "this" {
  name                       = "${local.name_prefix}-alb"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = var.public_subnet_ids
  idle_timeout               = 60
  enable_deletion_protection = var.environment == "prod"
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "this" {
  for_each = local.services

  name                 = "${local.name_prefix}-${each.key}-tg"
  port                 = each.value.container_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = data.aws_vpc.this.id
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = each.value.health_path
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  stickiness {
    type    = "lb_cookie"
    enabled = false
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
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

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["web"].arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = local.services.api.priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["api"].arn
  }

  condition {
    host_header {
      values = local.services.api.listener_rule
    }
  }
}

############################################
# IAM
############################################

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name_prefix}-ecs-task-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "secrets_read" {
  statement {
    sid = "ReadSsmParameters"

    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
    ]

    resources = ["arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter${var.ssm_parameter_prefix}/*"]
  }

  statement {
    sid       = "ReadSecretsManager"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.app_secrets_arn]
  }

  statement {
    sid       = "DecryptSecrets"
    actions   = ["kms:Decrypt"]
    resources = var.kms_key_arns
  }
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name   = "${local.name_prefix}-secrets-read"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.secrets_read.json
}

resource "aws_iam_role" "task" {
  name               = "${local.name_prefix}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "task_runtime" {
  statement {
    sid = "ExecuteCommandChannel"

    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task_runtime" {
  name   = "${local.name_prefix}-task-runtime"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_runtime.json
}

############################################
# Logging + cluster
############################################

resource "aws_cloudwatch_log_group" "this" {
  for_each = local.services

  name              = "/ecs/${local.name_prefix}-${each.key}"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_cluster" "this" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = var.min_capacity
    weight            = 1
  }
}

############################################
# Task definitions + services
############################################

resource "aws_ecs_task_definition" "this" {
  for_each = local.services

  family                   = "${local.name_prefix}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${aws_ecr_repository.this[each.key].repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = each.value.container_port
          hostPort      = each.value.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for k, v in merge(
          {
            NODE_ENV = "production"
            PORT     = tostring(each.value.container_port)
          },
          each.key == "api" ? {
            LOG_LEVEL   = "info"
            CORS_ORIGIN = "https://${var.domain_name}"
            APP_URL     = "https://${var.domain_name}"
            } : {
            HOSTNAME             = "0.0.0.0"
            NEXT_PUBLIC_API_URL  = "https://api.${var.domain_name}"
            NEXT_PUBLIC_SITE_URL = "https://${var.domain_name}"
            COURSE_OUTLINE_PATH  = "/app/packages/shared/content/course_outline.json"
            LESSON_CONTENT_PATH  = "/app/packages/shared/content/lessons"
          }
        ) : { name = k, value = v }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter${var.ssm_parameter_prefix}/DATABASE_URL"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter${var.ssm_parameter_prefix}/REDIS_URL"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${var.app_secrets_arn}:JWT_SECRET::"
        },
        {
          name      = "COOKIE_SECRET"
          valueFrom = "${var.app_secrets_arn}:COOKIE_SECRET::"
        },
        {
          name      = each.key == "api" ? "SENTRY_DSN" : "NEXT_PUBLIC_SENTRY_DSN"
          valueFrom = "${var.app_secrets_arn}:SENTRY_DSN::"
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this[each.key].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = each.key
        }
      }
    }
  ])
}

resource "aws_ecs_service" "this" {
  for_each = local.services

  name                               = "${local.name_prefix}-${each.key}"
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.this[each.key].arn
  desired_count                      = var.min_capacity
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = true
  propagate_tags                     = "SERVICE"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this[each.key].arn
    container_name   = each.key
    container_port   = each.value.container_port
  }

  lifecycle {
    # CI (deploy-ecs.yml) rolls new image tags; Terraform must not revert them.
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy.task_execution_secrets,
  ]
}

############################################
# Application Auto Scaling
############################################

resource "aws_appautoscaling_target" "this" {
  for_each = local.services

  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.min_capacity
  max_capacity       = var.max_capacity
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each = local.services

  name               = "${local.name_prefix}-${each.key}-cpu-target-tracking"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "alb_requests" {
  for_each = local.services

  name               = "${local.name_prefix}-${each.key}-alb-request-target-tracking"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = var.alb_request_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${local.alb_suffix}/${local.tg_suffix[each.key]}"
    }
  }
}

locals {
  alb_suffix = join("/", slice(split("/", aws_lb.this.arn_suffix), 0, 3))

  tg_suffix = {
    for k, tg in aws_lb_target_group.this : k => tg.arn_suffix
  }
}
