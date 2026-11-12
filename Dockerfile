# Royaume Magique des Multiplications — image de production (Coolify)
# Multi-stage : dépendances -> build -> runtime standalone minimal.
# Prisma ORM 7 est "Rust-free" (adapter pg en JavaScript pur) : aucune binaire
# d'engine à copier, compatible Alpine.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL factice : la génération du client Prisma n'a pas besoin de connexion.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migrations versionnées : appliquées via une procédure contrôlée (voir docs/DEPLOYMENT.md).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/package.json ./package.json

USER appuser
EXPOSE 3000

CMD ["node", "server.js"]
