#!/bin/bash
# Restore script for PostgreSQL database
# Downloads the latest backup from S3 and restores it to the database

set -euo pipefail

# Load environment variables (if needed)
# Assuming DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, S3_BUCKET are set

# Create backups directory if it doesn't exist
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Find the latest backup file in S3
echo "Finding latest backup in s3://${S3_BUCKET}/backups/..."
LATEST_BACKUP=$(aws s3 ls "s3://${S3_BUCKET}/backups/" | sort | tail -n 1 | awk '{print $4}')
if [ -z "$LATEST_BACKUP" ]; then
    echo "No backups found in s3://${S3_BUCKET}/backups/"
    exit 1
fi

echo "Latest backup found: $LATEST_BACKUP"

# Download the latest backup
BACKUP_FILE="${BACKUP_DIR}/${LATEST_BACKUP}"
echo "Downloading s3://${S3_BUCKET}/backups/${LATEST_BACKUP} to ${BACKUP_FILE}..."
aws s3 cp "s3://${S3_BUCKET}/backups/${LATEST_BACKUP}" "$BACKUP_FILE"

# Drop and recreate the database (optional - comment out if you want to preserve existing data)
# Note: This assumes you want to drop and recreate the database
# In production, you might want to use pg_restore --clean or similar
echo "Dropping and recreating database..."
DATABASE_URL_WITHOUT_PARAMS=$(echo "$DATABASE_URL" | sed 's/\?.*$//')
DB_NAME=$(basename "$DATABASE_URL_WITHOUT_PARAMS")
# Extract connection details
PGHOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
PGPORT=$(echo "$DATABASE_URL" | sed -n 's/.*@[^:]*:\([0-9]*\)\/.*/\1/p')
PGUSER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\{0,1\}([^:@]*).*/\1/p')

# Set PGPASSWORD for psql/pg_restore
export PGPASSWORD

# Drop and recreate database
PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "CREATE DATABASE $DB_NAME;"

# Restore the database
echo "Restoring database from ${BACKUP_FILE}..."
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB_NAME" "$BACKUP_FILE"

echo "Restore completed successfully."