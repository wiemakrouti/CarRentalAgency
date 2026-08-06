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

WORKDIR /app/frontend
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
