FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g turbo

FROM base AS pruner
COPY . .
RUN turbo prune @radius/web --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@radius/web

# Serve with nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infrastructure/nginx/spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
