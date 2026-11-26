#!/bin/bash
# Verification script for PostgreSQL database backups
# Downloads the latest backup from S3 and restores to a temporary database, then checks connectivity

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

# Extract database name from DATABASE_URL
# Example: postgres://user:password@host:5432/dbname
DATABASE_URL_WITHOUT_PARAMS=$(echo "$DATABASE_URL" | sed 's/\?.*$//')
DB_NAME=$(basename "$DATABASE_URL_WITHOUT_PARAMS")
# Create a temporary database name
TEMP_DB_NAME="${DB_NAME}_temp_$(date +%s)"

# Extract connection details
PGHOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
PGPORT=$(echo "$DATABASE_URL" | sed -n 's/.*@[^:]*:\([0-9]*\)\/.*/\1/p')
PGUSER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\{0,1\}([^:@]*).*/\1/p')

# Set PGPASSWORD for psql/pg_restore
export PGPASSWORD

# Create temporary database
echo "Creating temporary database: $TEMP_DB_NAME"
PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "CREATE DATABASE $TEMP_DB_NAME;"

# Restore the backup to the temporary database
echo "Restoring backup to temporary database $TEMP_DB_NAME..."
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEMP_DB_NAME" "$BACKUP_FILE"

# Check if the temporary database is accepting connections
echo "Checking if temporary database is accepting connections..."
if PGPASSWORD="$PGPASSWORD" pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEMP_DB_NAME"; then
    echo "SUCCESS: Temporary database $TEMP_DB_NAME is accepting connections."
else
    echo "ERROR: Temporary database $TEMP_DB_NAME is not accepting connections."
    # Clean up: drop the temporary database
    PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "DROP DATABASE $TEMP_DB_NAME;"
    exit 1
fi

# Clean up: drop the temporary database
echo "Cleaning up temporary database $TEMP_DB_NAME..."
PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "DROP DATABASE $TEMP_DB_NAME;"

# Remove the downloaded backup file (optional)
# rm -f "$BACKUP_FILE"

echo "Backup verification completed successfully."