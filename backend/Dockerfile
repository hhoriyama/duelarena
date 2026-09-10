FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---- 依存関係インストール ----
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund
RUN npx prisma generate

# ---- ビルド ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
RUN npx tsc -p tsconfig.build.json

# ---- 本番イメージ ----
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3001
CMD ["/app/start.sh"]
