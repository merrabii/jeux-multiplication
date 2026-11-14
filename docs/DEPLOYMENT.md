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

En conteneur, les migrations sont appliquées **automatiquement** au
démarrage par `docker/entrypoint.sh` (`prisma migrate deploy`, à temps
constant : idempotent, jamais destructif) après attente effective de
PostgreSQL. Le CLI Prisma complet est embarqué dans `/app/prisma-cli`
(arbre de dépendances autonome : `@prisma/config`, `effect`, engines).

## Healthchecks

- Application : `GET /api/health` → 200 (PostgreSQL connecté) / 503.
- PostgreSQL : `pg_isready` (voir `docker-compose.yml`).

## Plateformes supportées (statuts honnêtes)

| Plateforme | Statut | Preuve |
|---|---|---|
| Docker Compose (local/VPS) | **Compatible et testé** | image construite + installation neuve vérifiée (entrypoint, migrations, assistant, healthcheck) |
| Coolify | Compatible par architecture | Dockerfile + `docker-compose.yml` + procédure dans INSTALLATION.md — **non déployé** (accès indisponible) |
| Dokploy | Compatible par architecture | Compose compatible (services, réseau, volume, healthchecks) — **non déployé** |
| VPS SSH (scripts) | Compatible par architecture | `scripts/install-vps.sh` / `update-vps.sh` (syntaxe vérifiée) — **non exécutés sur un VPS réel** |
| Vercel | Compatible par architecture | base externe + `PGPOOL_MAX` + migrations en build — **non déployé** |
| Netlify | Compatible par architecture | `netlify.toml` fourni — **non déployé** |

Procédures détaillées, variables et commandes :
[INSTALLATION.md](INSTALLATION.md).

## En attente (accès Coolify non disponible)

Le déploiement réel sur Coolify n'a **pas** été effectué ni vérifié :

1. Créer le projet Coolify depuis le dépôt GitHub (compose).
2. Configurer les variables (`POSTGRES_PASSWORD` fort, `DATABASE_URL`,
   `AUTH_SECRET`).
3. Vérifier HTTPS, healthchecks, logs, redémarrage auto.
4. Paramétrer les sauvegardes du volume `pgdata` et **tester la
   restauration** (procédure écrite dans INSTALLATION.md, à valider sur
   l'infrastructure réelle).

Les données de test de staging doivent rester identifiables et séparées
des futures données de production.
