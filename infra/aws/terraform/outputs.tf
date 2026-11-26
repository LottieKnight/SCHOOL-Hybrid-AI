output "ecr_repository_urls" {
  description = "ECR repository URLs keyed by service. Feed these into the deploy workflow."
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "ecr_registry" {
  description = "ECR registry host for docker login."
  value       = "${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "ecs_cluster_name" {
  description = "ECS cluster name (ECS_CLUSTER in the deploy workflow)."
  value       = aws_ecs_cluster.this.name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN."
  value       = aws_ecs_cluster.this.arn
}

output "ecs_service_names" {
  description = "ECS service names keyed by service."
  value       = { for k, s in aws_ecs_service.this : k => s.name }
}

output "task_definition_families" {
  description = "Task definition families keyed by service."
  value       = { for k, t in aws_ecs_task_definition.this : k => t.family }
}

output "task_execution_role_arn" {
  description = "ECS task execution role ARN (pulls images, reads secrets)."
  value       = aws_iam_role.task_execution.arn
}

output "task_role_arn" {
  description = "ECS task role ARN assumed by the running containers."
  value       = aws_iam_role.task.arn
}

output "alb_dns_name" {
  description = "Public DNS name of the ALB — point Route53 records here."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Hosted zone ID of the ALB for Route53 alias records."
  value       = aws_lb.this.zone_id
}

output "target_group_arns" {
  description = "Target group ARNs keyed by service."
  value       = { for k, tg in aws_lb_target_group.this : k => tg.arn }
}

output "log_group_names" {
  description = "CloudWatch log group names keyed by service."
  value       = { for k, lg in aws_cloudwatch_log_group.this : k => lg.name }
}

output "autoscaling_bounds" {
  description = "Configured autoscaling range applied to every service."
  value = {
    min                    = var.min_capacity
    max                    = var.max_capacity
    cpu_target             = var.cpu_target_value
    alb_request_per_target = var.alb_request_target_value
  }
}
