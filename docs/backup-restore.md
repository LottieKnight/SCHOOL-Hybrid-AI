# Database Backup and restore-db.sh scripts/backup-db.sh scripts/verify-backup.md

# Database Backup and Restore

This document describes the backup and restore system for the PostgreSQL database used by the SCHOOL-Academic-Platform.

## Overview

The backup system consists of:
- A backup script (`scripts/backup-db.sh`) that dumps the PostgreSQL database and uploads the dump to an S3 bucket.
- A restore script (`scripts/restore-db.sh`) that downloads the latest backup from S3 and restores it to the database.
- A verification script (`scripts/verify-backup.sh`) that downloads the latest backup, restores it to a temporary database, and checks connectivity.
- A systemd timer (`infra/backup/db-backup.timer`) and service (`infra/backup/db-backup.service`) that runs the backup script nightly at 2:00 AM.

## Required Environment Variables

The following environment variables must be set in the environment where the scripts run (e.g., in `.env` or the systemd service environment):

- `AWS_ACCESS_KEY_ID`: AWS access key ID.
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key.
- `AWS_DEFAULT_REGION`: AWS region (e.g., `us-east-1`).
- `S3_BUCKET`: The name of the S3 bucket where backups will be stored.
- `DATABASE_URL`: The PostgreSQL connection URL (e.g., `postgres://user:password@host:5432/dbname`).

## Setup

1. Ensure the required environment variables are set. You can add them to a `.env` file in the project root and the systemd service will source it's EnvironmentFile` but the service file points to the `.env` file.

2. Make the scripts executable:
   ```bash
   chmod +x scripts/backup-db.sh scripts/restore-db.sh scripts/verify-backup.sh
   ```

3. Enable and start the systemd timer:
   ```bash
   sudo cp infra/backup/db-backup.service /etc/systemd/system/
   sudo cp infra/backup/db-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now db-backup.timer
   ```

   Alternatively, if you don't have systemd access, you can set up a cron job using the provided cron expression (see below).

## Usage

### Manual Backup
To manually trigger a backup:
```bash
./scripts/backup-db.sh
```

### Manual Restore
To restore from the latest backup in S3:
```bash
./scripts/restore-db.sh
```

### Verify Backup
To verify that the latest backup can be restored and the database is accessible:
```bash
./scripts/verify-backup.sh
```

## Cron Job Alternative

If you prefer to use cron instead of systemd, you can add the following line to the crontab (edit with `crontab -e`):

```
0 2 * * * /home/lottie/SCHOOL-Academic-Platform/scripts/backup-db.sh
```

This runs the backup script every day at 2:00 AM.

## Testing

To test the backup and restore process without affecting the production database, you can use the verification script which creates a temporary database.

Alternatively, you can manually run the backup script and then the restore script pointing to a different database by setting a different `DATABASE_URL` in your environment.

## Notes

- The backup script uses `pg_dump` to create a custom-format dump (`.dump` file) and uploads it to S3 with a timestamped filename.
- The restore script downloads the latest backup from S3 and uses `pg_restore` to restore it to the database specified by `DATABASE_URL`.
- The verification script creates a temporary database, restores the latest backup there, and checks connectivity with `pg_isready`. It then cleans up the temporary database.
- Ensure that the IAM user associated with the AWS credentials has permission to `s3:PutObject` and `s3:GetObject` on the specified S3 bucket.
- The database user must have permissions to create, drop, and restore databases.

## Troubleshooting

- If the backup script fails, check that `pg_dump` is installed and that the `DATABASE_URL` is correct.
- If the restore script fails, verify that the S3 bucket and credentials are correct, and that the database exists and is accessible.
- Check the systemd timer logs with `journalctl -u db-backup.timer` or `journalctl -u db-backup.service`.

## License

This backup and restore system is part of the SCHOOL-Academic-Platform and is subject to the same licensing terms.