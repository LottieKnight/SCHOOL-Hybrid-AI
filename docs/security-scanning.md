# Security Scanning for Docker Images

This document describes the security scanning setup for Docker images in the SCHOOL-Academic-Platform repository.

## Overview

The repository uses Trivy and Snyk to scan Docker images for vulnerabilities. The scans are run in a GitHub Actions workflow and the results are reported to a Slack channel via a webhook.

## Workflow

The security scanning workflow is defined in `.github/workflows/security-scan.yml`. It runs on push and pull request events to the main branch.

The workflow:
1. Checks out the repository.
2. Sets up Docker Buildx for building multi-platform images.
3. Logs in to Docker Hub (if credentials are provided).
4. Builds the Docker images for the API and web applications.
5. Installs Trivy and Snyk.
6. Runs the `scripts/scan-images.sh` script to scan the images with Trivy and Snyk.
7. Posts the results to a Slack channel using the `SLACK_WEBHOOK_URL` secret.

## Script

The `scripts/scan-images.sh` script:
- Takes one or more Docker image names as arguments.
- Scans each image with Trivy (if installed) and Snyk (if `SNYK_TOKEN` is set).
- Collects the results and sends them to a Slack webhook.

## Setup

To enable security scanning:

1. Add a `SLACK_WEBHOOK_URL` secret to your GitHub repository settings.
2. (Optional) Add a `SNYK_TOKEN` secret if you want to run Snyk scans.
3. Ensure the workflow is enabled in the Actions tab of your repository.

## Customization

- To add more images to scan, edit the `scripts/scan-images.sh` call in the workflow.
- To adjust the Trivy or Snyk scan parameters, modify the script accordingly.

## Troubleshooting

- If the Slack webhook is not set, the script will exit with an error.
- If Snyk token is not set, Snyk scans are skipped.
- Ensure that the Docker images are built and available locally before scanning (the workflow builds them).
