#!/bin/bash
# Daily Postgres backup for the production deployment (see docs/deployment.md
# "Backups"). Lives at /home/ubuntu/backup-db.sh on the VPS, run by cron.
set -euo pipefail

APP_DIR="/home/ubuntu/app"
BACKUP_DIR="/home/ubuntu/backups"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

docker compose -f "$APP_DIR/docker-compose.prod.yml" exec -T postgres \
  pg_dump -U postgres car_rental_agence | gzip > "$BACKUP_DIR/car_rental_agence_${TIMESTAMP}.sql.gz"

find "$BACKUP_DIR" -name "car_rental_agence_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
