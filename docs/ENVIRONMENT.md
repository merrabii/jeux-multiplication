# ENVIRONMENT

## Variables d'environnement

Copier `.env.example` → `.env` (jamais committé).

| Variable | Obligatoire | Exemple | Notes |
|---|---|---|---|
| `DATABASE_URL` | Oui | `postgresql://jeux_user:MOT_DE_PASSE@localhost:5434/jeux_multiplication?schema=public` | Source de vérité. Dev : Docker local port **5434**. Coolify : variable injectée par l'interface, jamais dans le code. |
| `TEST_DATABASE_URL` | Tests d'intégration | `postgresql://jeux_user:MOT_DE_PASSE@localhost:5434/jeux_multiplication_test?schema=public` | Base de test **isolée**. Provisionnement : `npm run db:test:setup`. |
| `AUTH_SECRET` | Oui (auth) | 96 caractères hexadécimaux | Secret JWT HS256. **32 caractères minimum**, généré via `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Jamais versionné, jamais affiché. |
| `AUTH_SESSION_HOURS` | Non (72) | `72` | Durée de vie d'une session en heures. |
| `AUTH_BCRYPT_ROUNDS` | Non (12) | `12` | Coût bcrypt, borné 10–15. |
| `AUTH_MAX_LOGIN_ATTEMPTS` | Non (5) | `5` | Échecs tolérés dans la fenêtre avant blocage. |
| `AUTH_ATTEMPT_WINDOW_MIN` | Non (15) | `15` | Fenêtre glissante de comptabilisation des échecs (minutes). |
| `AUTH_BLOCK_MINUTES` | Non (15) | `15` | Durée du blocage après dépassement (minutes). |
| `AUTH_ATTEMPT_RETENTION_HOURS` | Non (24) | `24` | Conservation puis purge des tentatives (heures). |
| `NODE_ENV` | Non (défaut dev) | `production` | Active `Secure` sur le cookie de session en production. |
| `HOSTNAME` / `PORT` | Non | `0.0.0.0` / `3000` | Server standalone Next.js (définis dans le Dockerfile). |
| `INSTALL_TOKEN` | Non | jeton hexadécimal | Protège l'assistant `/installation` tant que l'application n'est pas installée. En Docker, **vide → le conteneur en génère un au démarrage** et l'imprime dans ses journaux (`docker compose logs app`). |
| `INSTALL_TOKEN_FILE` | Non | `/app/.install_token` | Emplacement du fichier de jeton (Docker). |
| `ADMIN_RECOVERY_TOKEN` | Non | jeton hexadécimal | Active `/recuperation-admin`. **Vide = mécanisme désactivé.** À retirer après usage. |
| `PGPOOL_MAX` | Non | `3` | Limite du pool de connexions PostgreSQL (serverless Vercel/Netlify : 1–5 ; conteneur dédié : laisser vide). |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose | `jeux_user` / secret fort / `jeux_multiplication` | Création du service PostgreSQL par Compose. **Ne jamais commiter un mot de passe réel.** |
| `DB_WAIT_LOOPS` | Non (30) | `30` | Nombre de tentatives d'attente PostgreSQL dans l'entrypoint Docker (30 × 4 s = 2 min). |
| `MIGRATOR_ROOT` | Non | `/app/prisma-cli` | Dossier du CLI Prisma embarqué (image Docker). |

Chargement :
- **Next.js** charge `.env` automatiquement (dev et build).
- **CLI Prisma 7** : via `prisma.config.ts` (`import "dotenv/config"`).
- **Scripts tsx** (`scripts/*.ts`) : `import "dotenv/config"` explicite.
- **Vitest** : via `tests/setup.ts` (`import "dotenv/config"`).

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
