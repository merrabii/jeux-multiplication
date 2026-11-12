# DEPLOYMENT

Architecture cible : GitHub → Coolify → [App Next.js] + [PostgreSQL] avec
volume persistant et HTTPS.

## Image Docker

`Dockerfile` multi-stage (Node 22 Alpine) :

1. `deps` — `npm ci`.
2. `builder` — `prisma generate` + `npm run build` (`output: standalone`).
   Prisma 7 est Rust-free (adapter pg en JavaScript) : aucun binaire à
   copier, compatible Alpine.
3. `runner` — standalone + `prisma/` + `prisma.config.ts` + dépendances
   minimales pour `prisma migrate deploy`. Utilisateur non-root `appuser`.

## Service PostgreSQL

- Image `postgres:18-alpine`, volume **persistant** `pgdata`
  (`/var/lib/postgresql`, layout PostgreSQL 18+).
- Healthcheck `pg_isready`.
- **Jamais exposé sur Internet** (en local : bind `127.0.0.1` uniquement).

## Migrations (procédure contrôlée)

```bash
# Staging/production — migrations uniquement (jamais de reset) :
npm run db:deploy       # prisma migrate deploy
npm run db:status       # vérifier l'état avant/après
```

Interdits en production : `db push`, `migrate reset`, toute commande
destructive, suppression du volume `pgdata`.

## Healthchecks

- Application : `GET /api/health` → 200 (PostgreSQL connecté) / 503.
- PostgreSQL : `pg_isready` (voir `docker-compose.yml`).

## En attente (accès Coolify non disponible)

Le déploiement réel sur Coolify n'a **pas** été effectué ni vérifié :

1. Créer le projet Coolify depuis le dépôt GitHub (compose).
2. Configurer les variables (`POSTGRES_PASSWORD` fort, `DATABASE_URL`).
3. Vérifier HTTPS, healthchecks, logs, redémarrage auto.
4. Paramétrer les sauvegardes du volume `pgdata` et **tester la
   restauration** (procédure à écrire et valider, Phase 6).

Les données de test de staging doivent rester identifiables et séparées
des futures données de production.
