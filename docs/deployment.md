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

Self-hosted VPS (OVH) — one dedicated instance per client agency, per the multi-tenant-capable-but-single-tenant-deployed model (see `CLAUDE.md`).

## Production (OVH VPS)

1. **Domain + VPS**: buy both through OVH (one dashboard/invoice). Cheapest VPS tier is enough for one agency. In the domain's DNS zone, add an `A` record for the domain (and `www` if used) pointing at the VPS's public IP. Wait for it to resolve (`dig +short your-domain`) before continuing — Caddy's certificate step below fails without it.
2. **VPS setup**: SSH in, install Docker + the Compose plugin (`curl -fsSL https://get.docker.com | sh`), open the firewall for SSH/HTTP/HTTPS only (`ufw allow 22,80,443/tcp`), then clone this repo onto the VPS.
3. **Resend (transactional email)**: sign up at resend.com, add and verify your domain (they give you DNS records — SPF/DKIM, sometimes DMARC — add these in the same OVH DNS zone as step 1), then create an API key.
4. **Configure**: copy `.env.production.example` → `.env` next to `docker-compose.prod.yml`, fill in every value (`DOMAIN`, `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` via `openssl rand -base64 48`, the Resend API key, `EMAIL_FROM` using your now-verified domain, Cloudinary credentials).
5. **Launch**:
   ```
   docker compose -f docker-compose.prod.yml --env-file .env up --build -d
   docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
   docker compose -f docker-compose.prod.yml exec backend npm run seed
   ```
   Caddy (the only service with published ports) terminates TLS and obtains/renews its Let's Encrypt certificate automatically for `DOMAIN`; it routes `/api/*` to the backend and everything else to the static frontend build, both over the compose network — postgres/backend/frontend have no ports exposed to the host.
6. **Redeploying** after a code change: `git pull`, then rerun the `up --build -d` command from step 5 (image rebuild only, no need to repeat migrate/seed unless the schema changed — then rerun `migrate deploy` too).

Registering a new agency on its own VPS later: repeat this whole section with a fresh VPS, domain (or subdomain), and Resend-verified sender — never point a second agency's frontend at an existing agency's backend.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for local development, or `.env.production.example` for a production (`docker-compose.prod.yml`) deployment. Never commit a real `.env` file — `.gitignore` already excludes it.
