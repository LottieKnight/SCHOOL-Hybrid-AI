#!/bin/bash
# Backup script for PostgreSQL database
# Dumps the database to a local file and uploads to S3

set -euo pipefail

# Load environment variables (if needed)
# Assuming DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, S3_BUCKET are set

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y-%m-%d-%H-%M-%S)
BACKUP_FILE="backup-${TIMESTAMP}.sql"
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
FULL_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Dump the database using pg_dump
echo "Dumping database to ${FULL_PATH}..."
pg_dump "$DATABASE_URL" -f "$FULL_PATH"

# Upload to S3
echo "Uploading ${FULL_PATH} to s3://${S3_BUCKET}/backups/${BACKUP_FILE}..."
aws s3 cp "$FULL_PATH" "s3://${S3_BUCKET}/backups/${BACKUP_FILE}"

echo "Backup completed successfully."