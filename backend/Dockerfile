FROM node:20-slim AS base
WORKDIR /app

# Prisma's query engine needs OpenSSL; node:20-slim doesn't include it.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Workspace-aware install: package.json files first for better layer caching.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=@car-rental/backend --workspace=@car-rental/shared --include-workspace-root

COPY packages/shared packages/shared
RUN npm run build --workspace=@car-rental/shared

COPY backend backend

WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

EXPOSE 4000
# Pending migrations are applied before the server starts listening, so the
# new code never runs against an old schema. A failed migration stops the
# container (and fails the deploy's health check) instead of serving errors.
# `exec` hands PID 1 to node so it receives Docker's stop signals directly.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
