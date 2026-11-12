# ENVIRONMENT

## Variables d'environnement

Copier `.env.example` → `.env` (jamais committé).

| Variable | Obligatoire | Exemple | Notes |
|---|---|---|---|
| `DATABASE_URL` | Oui | `postgresql://jeux_user:MOT_DE_PASSE@localhost:5434/jeux_multiplication?schema=public` | Source de vérité. Dev : Docker local port **5434**. Coolify : variable injectée par l'interface, jamais dans le code. |
| `NODE_ENV` | Non (défaut dev) | `production` | Défini dans le Dockerfile pour l'image. |
| `HOSTNAME` / `PORT` | Non | `0.0.0.0` / `3000` | Server standalone Next.js (définis dans le Dockerfile). |

Chargement :
- **Next.js** charge `.env` automatiquement (dev et build).
- **CLI Prisma 7** : via `prisma.config.ts` (`import "dotenv/config"`).
- **Scripts tsx** (`scripts/db-check.ts`) : `import "dotenv/config"` explicite.

## Développement local

```bash
docker compose up -d db   # PostgreSQL 18.6 sur 127.0.0.1:5434 uniquement
```

Ports : 5432 et 5433 sont déjà utilisés par d'autres projets locaux
(`icode-postgres`, `code-diali-test-db-1`) — ce projet utilise **5434** et
ne modifie jamais les autres services.

## Production (Coolify)

Toutes les variables se configurent dans l'interface Coolify. Le fichier
`docker-compose.yml` fournit des valeurs par défaut de développement
uniquement ; en production, `POSTGRES_PASSWORD` doit être un secret fort.
Aucun secret dans le dépôt Git.
