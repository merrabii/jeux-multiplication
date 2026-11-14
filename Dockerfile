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

FROM node:22-alpine AS migrator
# CLI Prisma COMPLET et autonome (le CLI a besoin de ses dépendances :
# @prisma/config, effect, engines…). L'arbre est installé à part pour ne
# pas polluer les dépendances de l'application.
WORKDIR /prisma-cli
RUN npm init -y >/dev/null 2>&1 \
 && npm install --no-audit --no-fund prisma@7.10.1 dotenv@18.0.10

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Schéma + migrations versionnées (assistant d'installation, diagnostic).
COPY --from=builder /app/prisma ./prisma

# Outil de migration : CLI Prisma complet dans /app/prisma-cli
# (prisma.config.ts + prisma/ y sont copiés pour que la résolution du
# schéma fonctionne depuis ce dossier).
COPY --from=migrator /prisma-cli/node_modules ./prisma-cli/node_modules
COPY --from=builder /app/prisma ./prisma-cli/prisma
COPY --from=builder /app/prisma.config.ts ./prisma-cli/prisma.config.ts

# Point d'entrée : attente PostgreSQL + migrations non destructives + jeton
# d'installation (voir docker/entrypoint.sh).
COPY --from=builder /app/docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

# L'utilisateur applicatif écrit le jeton d'installation (et /tmp pour les logs).
RUN chown -R appuser:appgroup /app && chmod 777 /tmp

USER appuser
EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
