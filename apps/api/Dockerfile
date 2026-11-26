FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json tsconfig.base.json
COPY apps/api/package.json apps/api/package.json
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json

RUN npm ci

COPY apps/api apps/api
COPY packages/shared/src packages/shared/src

RUN npm run build -w apps/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/migrations ./apps/api/migrations
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/migrate-and-start.sh ./apps/api/migrate-and-start.sh
COPY --from=builder /app/apps/api/run-migrations.ts ./apps/api/run-migrations.ts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/node_modules ./node_modules

RUN chmod +x ./apps/api/migrate-and-start.sh

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
