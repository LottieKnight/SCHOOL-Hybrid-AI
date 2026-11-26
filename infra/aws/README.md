# AWS ECR/ECS deployment — SCHOOL Academic Platform

Infrastructure scaffolding to run the monorepo's two long-lived services on AWS Fargate:

| Service | Source                 | Dockerfile          | Port | Health path |
| ------- | ---------------------- | ------------------- | ---- | ----------- |
| `api`   | `apps/api` (Fastify)   | `apps/api/Dockerfile` | 4000 | `/health` (`apps/api/src/routes/health.ts`) |
| `web`   | `apps/web` (Next.js)   | `apps/web/Dockerfile` | 3000 | `/health` (`apps/web/app/health/route.ts`) |

Both Dockerfiles already exist in the repo and build from the **repo root** context, so no
`Dockerfile.web` was added here.

## Files

```
infra/aws/
├── README.md
├── ecs-task-def-api.json      # Fargate task definition (placeholder-templated)
├── ecs-task-def-web.json
└── terraform/
    ├── main.tf                # ECR, ECS cluster, Fargate services, ALB, autoscaling, IAM
    ├── variables.tf
    └── outputs.tf
.github/workflows/deploy-ecs.yml
```

Task-definition placeholders replaced by CI at deploy time:
`<AWS_ACCOUNT_ID>`, `<AWS_REGION>`, `<IMAGE_TAG>`.

## Terraform

```bash
cd infra/aws/terraform
terraform init
terraform plan  -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

The stack **consumes an existing VPC** (`vpc_id`, `public_subnet_ids`, `private_subnet_ids`) —
private subnets need NAT egress so tasks can pull from ECR and reach Postgres/Redis/Sentry.

### Required variables (no default)

| Variable              | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `vpc_id`              | Existing VPC hosting the ALB + tasks                                |
| `public_subnet_ids`   | ≥2 public subnets for the internet-facing ALB                       |
| `private_subnet_ids`  | ≥2 private subnets for the Fargate tasks                            |
| `acm_certificate_arn` | ACM cert covering the apex and `api.` subdomain (HTTPS listener)    |
| `app_secrets_arn`     | Secrets Manager secret ARN holding the JSON app secrets             |

### Notable defaults

| Variable                    | Default                              |
| --------------------------- | ------------------------------------ |
| `aws_region`                | `af-south-1`                         |
| `project_name` / `environment` | `school` / `prod`                 |
| `domain_name`               | `school.ditshego-ventures.co.za`     |
| `ssm_parameter_prefix`      | `/school/prod`                       |
| `min_capacity` / `max_capacity` | `2` / `10`                       |
| `cpu_target_value`          | `60` (% average CPU)                 |
| `alb_request_target_value`  | `1000` requests per target           |
| `api_cpu` / `api_memory`    | `512` / `1024`                       |
| `web_cpu` / `web_memory`    | `512` / `1024`                       |
| `image_tag`                 | `latest` (bootstrap only; CI deploys git SHAs) |
| `ecr_image_retention_count` | `30`                                 |
| `log_retention_days`        | `30`                                 |

Autoscaling attaches **two target-tracking policies per service** (CPU 60% and
`ALBRequestCountPerTarget`); ECS scales out on whichever fires first and only scales in
when both are satisfied.

`aws_ecs_service` sets `ignore_changes = [task_definition, desired_count]` so Terraform never
reverts an image rolled out by the GitHub Actions workflow or an autoscaling decision.

## Runtime configuration

Mirrors `apps/api/src/config.ts` (zod schema) and `docker-compose.yml`.

### SSM Parameter Store — `SecureString` at `${ssm_parameter_prefix}/`

| Parameter      | Consumed by | Notes                                              |
| -------------- | ----------- | -------------------------------------------------- |
| `DATABASE_URL` | api, web    | `postgres://user:pass@host:5432/db` (required)      |
| `REDIS_URL`    | api, web    | `redis://host:6379` (required)                      |

```bash
aws ssm put-parameter --name /school/prod/DATABASE_URL --type SecureString --value '...'
aws ssm put-parameter --name /school/prod/REDIS_URL    --type SecureString --value '...'
```

### Secrets Manager — JSON secret at `app_secrets_arn`

| JSON key        | Consumed by            | Notes                                                    |
| --------------- | ---------------------- | -------------------------------------------------------- |
| `JWT_SECRET`    | api, web               | Required, min length 1                                    |
| `COOKIE_SECRET` | api, web               | Required, min length 1                                    |
| `SENTRY_DSN`    | api (`SENTRY_DSN`), web (`NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN`) | Optional; use `""` to disable |
| `METRICS_TOKEN` | api                    | Optional; guards the Prometheus `/metrics` route          |

```bash
aws secretsmanager create-secret --name school/prod/app-secrets \
  --secret-string '{"JWT_SECRET":"...","COOKIE_SECRET":"...","SENTRY_DSN":"","METRICS_TOKEN":""}'
```

### Plain environment variables (baked into the task definitions)

**api:** `NODE_ENV=production`, `PORT=4000`, `LOG_LEVEL=info`, `CORS_ORIGIN`, `APP_URL`,
`NEXT_PUBLIC_SITE_URL`, `ENABLE_WORKER=false`.

**web:** `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_SITE_URL`, `COURSE_OUTLINE_PATH`, `LESSON_CONTENT_PATH`.

Everything else in `apps/api/src/config.ts` (PayFast/Stripe/Twilio/Resend keys, wallet and
booking tuning knobs) has a schema default. Add any you actually use as extra JSON keys in
the Secrets Manager secret and a matching `secrets` entry in the task definitions.

## GitHub Actions — `.github/workflows/deploy-ecs.yml`

Triggers on push to `main` (paths-filtered) and `workflow_dispatch`
(`services: both | api | web`). Auth is **OIDC only** — no long-lived AWS keys.

### Repository secret

| Secret                 | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`  | `arn:aws:iam::<ACCOUNT_ID>:role/<gha-deploy-role>` — **placeholder, must be created** |

### Repository variables

| Variable                | Example                          | Source                                   |
| ----------------------- | -------------------------------- | ---------------------------------------- |
| `AWS_REGION`            | `af-south-1`                     | `var.aws_region`                          |
| `ECS_CLUSTER`           | `school-prod-cluster`            | output `ecs_cluster_name`                 |
| `ECS_SERVICE_API`       | `school-prod-api`                | output `ecs_service_names["api"]`         |
| `ECS_SERVICE_WEB`       | `school-prod-web`                | output `ecs_service_names["web"]`         |
| `ECR_REPOSITORY_API`    | `school-prod-api`                | output `ecr_repository_urls["api"]` (name part) |
| `ECR_REPOSITORY_WEB`    | `school-prod-web`                | output `ecr_repository_urls["web"]` (name part) |

The workflow also uses a `production` GitHub Environment on the deploy job — add required
reviewers there if you want manual approval before an ECS rollout.

### OIDC trust policy (create once)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:<ORG>/<REPO>:*" }
    }
  }]
}
```

Permissions the deploy role needs: ECR (`GetAuthorizationToken`, push/pull on the two repos),
`ecs:DescribeServices`, `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`,
`ecs:UpdateService`, `sts:GetCallerIdentity`, and `iam:PassRole` limited to the task execution
and task roles (`task_execution_role_arn`, `task_role_arn` outputs).

### Pipeline steps

1. Build `apps/api/Dockerfile` and `apps/web/Dockerfile` from the repo root with Buildx + GHA cache.
2. Push each image tagged `${{ github.sha }}` **and** `latest`.
3. Render `<AWS_ACCOUNT_ID>` / `<AWS_REGION>` / `<IMAGE_TAG>` in the task-definition JSON, validate with `python3 -m json.tool`.
4. `amazon-ecs-render-task-definition` injects the SHA-tagged image.
5. `amazon-ecs-deploy-task-definition` registers the revision, updates the service, and waits up to 15 minutes for stability. The service's deployment circuit breaker auto-rolls back on failure.

## Notes / prerequisites

- `apps/web/Dockerfile` copies `.next/standalone`, so `apps/web/next.config.mjs` must keep `output: "standalone"`.
- DB migrations are **not** run by this workflow. `apps/api` ships `migrate-and-start.sh`; either switch the container command to it or add a one-off `aws ecs run-task` migration step before deploy.
- Route53: alias the apex/`www` and `api.` records at the `alb_dns_name` / `alb_zone_id` outputs.
- No Terraform backend is configured — add an S3 + DynamoDB backend block before team use.
