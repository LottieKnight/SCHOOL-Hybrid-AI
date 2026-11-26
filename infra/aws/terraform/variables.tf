variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "af-south-1"
}

variable "project_name" {
  description = "Short project slug used to prefix every resource name."
  type        = string
  default     = "school"
}

variable "environment" {
  description = "Deployment environment (prod, staging, dev)."
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Apex domain served by the web service. The API is served at api.<domain_name>."
  type        = string
  default     = "school.ditshego-ventures.co.za"
}

variable "vpc_id" {
  description = "ID of the existing VPC hosting the ALB and Fargate tasks."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs (>= 2 AZs) for the internet-facing ALB."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "An ALB requires subnets in at least two availability zones."
  }
}

variable "private_subnet_ids" {
  description = "Private subnet IDs (>= 2 AZs, NAT egress required) for the Fargate tasks."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "Provide private subnets in at least two availability zones."
  }
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate attached to the HTTPS listener. Must cover the apex and api subdomain."
  type        = string
}

variable "ssm_parameter_prefix" {
  description = "SSM Parameter Store path prefix holding DATABASE_URL and REDIS_URL (no trailing slash)."
  type        = string
  default     = "/school/prod"
}

variable "app_secrets_arn" {
  description = "Secrets Manager secret ARN with JSON keys JWT_SECRET, COOKIE_SECRET, SENTRY_DSN, METRICS_TOKEN."
  type        = string
}

variable "kms_key_arns" {
  description = "KMS key ARNs used to encrypt the SSM parameters / Secrets Manager secret."
  type        = list(string)
  default     = ["*"]
}

variable "image_tag" {
  description = "Container image tag Terraform bootstraps the task definitions with. CI then deploys git-SHA tags."
  type        = string
  default     = "latest"
}

variable "api_container_port" {
  description = "Port the Fastify API listens on (matches apps/api EXPOSE and PORT default)."
  type        = number
  default     = 4000
}

variable "web_container_port" {
  description = "Port the Next.js standalone server listens on."
  type        = number
  default     = 3000
}

variable "api_cpu" {
  description = "Fargate CPU units for the API task."
  type        = string
  default     = "512"
}

variable "api_memory" {
  description = "Fargate memory (MiB) for the API task."
  type        = string
  default     = "1024"
}

variable "web_cpu" {
  description = "Fargate CPU units for the web task."
  type        = string
  default     = "512"
}

variable "web_memory" {
  description = "Fargate memory (MiB) for the web task."
  type        = string
  default     = "1024"
}

variable "min_capacity" {
  description = "Minimum number of tasks per service."
  type        = number
  default     = 2

  validation {
    condition     = var.min_capacity >= 2
    error_message = "Production requires at least 2 tasks for multi-AZ availability."
  }
}

variable "max_capacity" {
  description = "Maximum number of tasks per service."
  type        = number
  default     = 10
}

variable "cpu_target_value" {
  description = "Target average CPU utilisation percentage for target-tracking scaling."
  type        = number
  default     = 60
}

variable "alb_request_target_value" {
  description = "Target ALB request count per target for target-tracking scaling."
  type        = number
  default     = 1000
}

variable "ecr_image_retention_count" {
  description = "Number of images kept per ECR repository before lifecycle expiry."
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Extra tags merged into the provider default tags."
  type        = map(string)
  default     = {}
}
