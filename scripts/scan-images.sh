#!/bin/bash
set -euo pipefail

# Script to scan Docker images with Trivy and Snyk and post results to Slack

# Usage: ./scripts/scan-images.sh <image1> [<image2> ...]

# Slack is optional. The scan still prints results when the webhook is unset.
if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
  echo "Warning: SLACK_WEBHOOK_URL is not set. Scan results will be printed only."
fi

# Array to hold scan results
RESULTS=""

# Function to send message to Slack
send_to_slack() {
  local message="$1"
  payload=$(printf '{"text": %s}' "$(jq -Rs . <<<"$message")")
  curl -s -X POST -H 'Content-type: application/json' --data "$payload" "$SLACK_WEBHOOK_URL" >/dev/null
}

# Scan each image with Trivy
for image in "$@"; do
  echo "Scanning $image with Trivy..."
  trivy_output=$(trivy image --format table "$image" 2>/dev/null || true)
  RESULTS+=$'\n'"*Trivy scan results for $image:*\n\`\`\`\n$trivy_output\n\`\`\`"$'\n'
done

# Scan each image with Snyk (requires Snyk token; we assume it's set as SNYK_TOKEN)
if [[ -n "${SNYK_TOKEN:-}" ]]; then
  for image in "$@"; do
    echo "Scanning $image with Snyk..."
    # Snyk container test requires the image to be accessible locally
    snyk_output=$(snyk container test "$image" --json 2>/dev/null || true)
    # Format the JSON output for Slack (we'll extract a summary)
    # For simplicity, we'll just output the raw JSON in a code block
    RESULTS+=$'\n'"*Snyk scan results for $image:*\n\`\`\`json\n$snyk_output\n\`\`\`"$'\n'
  done
else
  echo "Warning: SNYK_TOKEN not set, skipping Snyk scan."
fi

# Send results to Slack when a webhook is configured. Always print them.
if [[ -n "$RESULTS" ]]; then
  printf '%s\n' "$RESULTS"
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    send_to_slack "$RESULTS"
  fi
else
  echo "No scan results to send."
fi