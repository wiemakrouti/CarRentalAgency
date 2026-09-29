#!/bin/bash
# Runs ON the VPS, piped over SSH by .github/workflows/deploy.yml — never run
# it from a developer machine. Usage: remote-deploy.sh <app-dir> <commit-sha>
#
# This file arrives on stdin (`ssh … bash -s < remote-deploy.sh`), so any
# command that reads stdin (docker compose exec does, even with -T) would
# swallow the rest of the script and bash would exit 0 having silently
# skipped every later step. Two guards: everything lives in main(), which
# bash must read in full before running it, and every such command gets
# </dev/null anyway.
set -euo pipefail

main() {
  local app_dir="$1"
  local target_sha="$2"
  local backup_script="$HOME/backup-db.sh"
  local compose=(docker compose -f docker-compose.prod.yml --env-file .env)

  cd "$app_dir"

  # Before touching anything: the migration that runs when the new backend
  # starts is the one step that can't simply be redeployed away.
  echo "==> Backing up database"
  "$backup_script" </dev/null

  # --ff-only: refuse (and fail the deploy) rather than merge or discard if
  # the VPS checkout ever diverged from main, e.g. after a manual edit.
  echo "==> Updating code to $target_sha"
  git fetch --quiet origin main
  git merge --ff-only "$target_sha"

  # The backend container applies pending Prisma migrations itself before it
  # starts listening (see backend/Dockerfile), so there's no separate step.
  echo "==> Rebuilding and restarting containers"
  "${compose[@]}" up --build -d </dev/null

  echo "==> Waiting for the backend to report healthy"
  for _ in $(seq 1 30); do
    if "${compose[@]}" exec -T backend node -e \
      "fetch('http://localhost:4000/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" \
      </dev/null 2>/dev/null; then
      echo "==> Backend healthy — deployed $(git rev-parse --short HEAD)"
      docker image prune -f </dev/null >/dev/null
      return 0
    fi
    sleep 3
  done

  echo "!! Backend did not become healthy in time. Last logs:"
  "${compose[@]}" logs backend --tail 50 --no-log-prefix </dev/null
  return 1
}

main "$@"
