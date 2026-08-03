# Deployment

## Local development (no Docker required)

1. `npm install` (root — installs all workspaces).
2. Start Postgres locally, or `docker compose up postgres` if you'd rather not install it.
3. Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`, fill in values.
4. `npm run prisma:migrate` (applies migrations), `npm run seed` (creates the admin user + default settings).
5. `npm run dev:backend` and `npm run dev:frontend` in separate terminals.
   - API: http://localhost:4000/api/v1 (health check at `/api/v1/health`)
   - Frontend: http://localhost:5173

## Docker (dev or deployment)

```
docker compose up --build
```

Brings up Postgres, the backend (Express, built + run via Node), and the frontend (built static assets served by nginx). Override secrets via a `.env` file at the repo root (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLOUDINARY_*`) — `docker-compose.yml` falls back to development placeholders if unset, which must never be used in a real deployment.

After first boot, run migrations + seed inside the backend container:

```
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed
```

## Target environment

Not yet decided (self-hosted VPS vs. managed cloud) — the Docker Compose setup above works either way; see `docs/business-rules.md` "Open items".

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list. Never commit a real `.env` file — `.gitignore` already excludes it.
