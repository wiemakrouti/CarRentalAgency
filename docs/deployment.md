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

The backend applies pending migrations itself on startup. After first boot, seed inside the backend container:

```
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
   docker compose -f docker-compose.prod.yml exec backend npm run seed
   ```
   The backend container applies pending Prisma migrations itself on every start (`backend/Dockerfile` runs `prisma migrate deploy` before the server), so the first `up` already creates the schema the seed needs.
   Caddy (the only service with published ports) terminates TLS and obtains/renews its Let's Encrypt certificate automatically for `DOMAIN`; it routes `/api/*` to the backend and everything else to the static frontend build, both over the compose network — postgres/backend/frontend have no ports exposed to the host.
6. **Redeploying** after a code change: use the **Deploy** button (see "Automated deployment" below). The manual equivalent is `~/backup-db.sh`, `git pull`, then the `up --build -d` command from step 5 — migrations apply on their own when the new backend starts. Never rerun the seed.
7. **Enable automated deployment** for this VPS — one-time setup, see below.

## Automated deployment (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`) runs lint + typecheck + build on every push to `main` and every pull request.
- **Deploy** (`.github/workflows/deploy.yml`) is manual only: GitHub → *Actions* → *Deploy* → *Run workflow*, pick the agency's environment. It re-runs CI, then SSHes into that agency's VPS and pipes `scripts/remote-deploy.sh` to it, which backs up the database, fast-forwards the checkout to the deployed commit (`--ff-only`: fails instead of overwriting if the VPS checkout diverged), rebuilds/restarts the containers, and waits for the backend's health check. The workflow finally checks the public `/api/v1/health` URL. Deploys only run from `main`, and two deploys to the same VPS never overlap.

### One-time setup per agency VPS

1. **Deploy key** — on your own machine, create a key used only by GitHub (no passphrase, CI can't type one):
   ```
   ssh-keygen -t ed25519 -f deploy_key_<agency> -C "github-deploy-<agency>" -N ""
   ```
   Append `deploy_key_<agency>.pub` to `~/.ssh/authorized_keys` on the VPS (`ubuntu` user — it needs Docker access, which that user already has).
2. **GitHub environment** — repo → *Settings* → *Environments* → *New environment*, named after the agency (e.g. `houssemalouirentcar`). Optionally add yourself as a *required reviewer* for a confirmation click before each deploy. Then add:
   - Secret `DEPLOY_SSH_KEY`: the full contents of the **private** key file `deploy_key_<agency>`.
   - Variables:
     - `DEPLOY_HOST`: the VPS IP.
     - `DEPLOY_USER`: `ubuntu`.
     - `DEPLOY_PATH`: `/home/ubuntu/app`.
     - `DEPLOY_URL`: `https://<domain>` (no trailing slash).
     - `DEPLOY_KNOWN_HOSTS`: output of `ssh-keyscan -t ed25519 <vps-ip>` (the line without `#`) — pins the server's identity.
3. Delete both local key files once the secret is saved; if the key ever leaks, remove its line from `authorized_keys` and generate a new one.

The backup script (`~/backup-db.sh`, see "Backups") must already be installed on the VPS — the deploy calls it and fails if it's missing.

## Backups

`scripts/backup-db.sh` dumps the Postgres database (`pg_dump` through the `postgres` container, gzipped) into `/home/ubuntu/backups/` and prunes dumps older than 14 days. On the VPS it's installed outside the repo (so `git pull` never touches it) and run daily by cron:

```
scp scripts/backup-db.sh ubuntu@<vps-ip>:/home/ubuntu/backup-db.sh
ssh ubuntu@<vps-ip> "chmod +x /home/ubuntu/backup-db.sh"
ssh ubuntu@<vps-ip> '(crontab -l 2>/dev/null; echo "15 3 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1") | crontab -'
```

To restore a dump: `gunzip -c /home/ubuntu/backups/<file>.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres car_rental_agence`.

## One-off data repairs

Repair scripts live in `backend/src/scripts/`, ship compiled inside the backend image, and are dry-run by default (they only list what they'd change until passed `--apply`). Always take a backup first:

```
~/backup-db.sh
docker compose -f docker-compose.prod.yml exec backend node dist/scripts/<script>.js           # dry run
docker compose -f docker-compose.prod.yml exec backend node dist/scripts/<script>.js --apply
```

- `revert-premature-activations` — puts back to `RESERVED` (car `AVAILABLE`) the rentals created as "Location immédiate" with a future pickup date before that was blocked. Rentals whose date has since arrived are only listed for manual checking.

Registering a new agency on its own VPS later: repeat this whole section with a fresh VPS, domain (or subdomain), and Resend-verified sender — never point a second agency's frontend at an existing agency's backend.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for local development, or `.env.production.example` for a production (`docker-compose.prod.yml`) deployment. Never commit a real `.env` file — `.gitignore` already excludes it.
