#!/bin/bash
# Runs ON the VPS, piped over SSH by .github/workflows/deploy.yml — never run
# it from a developer machine. Usage: remote-deploy.sh <app-dir> <commit-sha>
set -euo pipefail

APP_DIR="$1"
TARGET_SHA="$2"
BACKUP_SCRIPT="$HOME/backup-db.sh"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)

cd "$APP_DIR"

# Before touching anything: the migration that runs when the new backend
# starts is the one step that can't simply be redeployed away.
echo "==> Backing up database"
"$BACKUP_SCRIPT"

# --ff-only: refuse (and fail the deploy) rather than merge or discard if the
# VPS checkout ever diverged from main, e.g. after a manual edit on the server.
echo "==> Updating code to $TARGET_SHA"
git fetch --quiet origin main
git merge --ff-only "$TARGET_SHA"

# The backend container applies pending Prisma migrations itself before it
# starts listening (see backend/Dockerfile), so there's no separate step here.
echo "==> Rebuilding and restarting containers"
"${COMPOSE[@]}" up --build -d

echo "==> Waiting for the backend to report healthy"
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T backend node -e \
    "fetch('http://localhost:4000/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" \
    2>/dev/null; then
    echo "==> Backend healthy — deployed $(git rev-parse --short HEAD)"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 3
done

echo "!! Backend did not become healthy in time. Last logs:"
"${COMPOSE[@]}" logs backend --tail 50 --no-log-prefix
exit 1
