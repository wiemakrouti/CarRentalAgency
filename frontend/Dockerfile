FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY backend/package.json backend/package.json
RUN npm ci --workspace=@car-rental/frontend --workspace=@car-rental/shared --include-workspace-root

COPY packages/shared packages/shared
RUN npm run build --workspace=@car-rental/shared

COPY frontend frontend

# Vite inlines import.meta.env.VITE_* at build time, and .dockerignore
# excludes every .env file from the build context (so a real frontend/.env
# never leaks into the image) — this build arg is the only way to get a
# real API URL into the compiled bundle for a production build. Writing it
# to .env.production (Vite's own production-mode env file) rather than
# exporting it as a shell var, since that's the one mechanism guaranteed to
# work regardless of how `vite build` resolves its env.
ARG VITE_API_URL
RUN if [ -n "$VITE_API_URL" ]; then echo "VITE_API_URL=$VITE_API_URL" > frontend/.env.production; fi

WORKDIR /app/frontend
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
