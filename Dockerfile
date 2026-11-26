# syntax=docker/dockerfile:1

# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY . ./
RUN npm ci && npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD curl -f http://localhost:3000/health || exit 1
CMD ["npm", "run", "start"]
