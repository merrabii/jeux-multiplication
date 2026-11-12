# DATABASE

PostgreSQL est la source de vérité de toutes les données persistantes.
`localStorage` n'est utilisé pour rien (ni scores, ni progression).

## Configuration

| Élément | Valeur |
|---|---|
| SGBD | PostgreSQL 18.6 (image `postgres:18-alpine`) |
| Développement local | Docker, `127.0.0.1:5434` (5432/5433 occupés par d'autres projets) |
| Volume | `pgdata` → `/var/lib/postgresql` (nouveau layout PostgreSQL 18+) |
| Schéma | `public` |

## Conventions

- Modèles Prisma en PascalCase, tables en snake_case (`@@map`).
- Colonnes en camelCase non mappées (choix simple et cohérent, documenté
  dans [DECISIONS.md](DECISIONS.md)).
- `createdAt` / `updatedAt` sur toutes les tables applicatives.
- Toute évolution structurelle passe par une **migration versionnée**
  (`prisma/migrations`), jamais modifiée après application.
- Migrations de production **non destructives par défaut**.

## Modèles (Phase 1 + 2.1)

Migration `20261112142545_init_foundation` : `users`, `child_profiles`,
`avatars`, `game_settings`.

Migration `20261112172058_add_auth_foundation` : `sessions`,
`login_attempts`, colonnes de consentement sur `users`, index unique
`LOWER(email)`.

### users
Compte parent (responsable légal).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| email | TEXT | UNIQUE + index unique `LOWER(email)` (anti-contournement par casse) |
| passwordHash | TEXT | bcrypt coût 12 (configurable), jamais de mot de passe en clair |
| displayName | TEXT nullable | |
| role | TEXT | défaut `parent` |
| termsAcceptedAt | TIMESTAMP nullable | trace du consentement aux conditions |
| termsVersion | TEXT nullable | version des conditions acceptées |
| createdAt / updatedAt | TIMESTAMP(3) | |

### sessions
Session de connexion parent. **Source de vérité de la révocation.**

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK, référencé par le JWT (`jti`) |
| userId | TEXT | FK → users, ON DELETE CASCADE, index |
| expiresAt | TIMESTAMP(3) | aligné sur l'expiration du JWT (défaut 72 h) |
| revokedAt | TIMESTAMP nullable | déconnexion : rend le JWT inutilisable |
| createdAt | TIMESTAMP(3) | |

### login_attempts
Tentatives de connexion (limitation persistante, pas en mémoire).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| userId | TEXT nullable | FK → users, ON DELETE SET NULL |
| email | TEXT | **normalisé minuscules** — comptage insensible à la casse |
| success | BOOLEAN | |
| ipAddress | TEXT nullable | donnée technique de sécurité, purgée (24 h) |
| attemptedAt | TIMESTAMP(3) | défaut now(), index (email, attemptedAt) et (attemptedAt) |

### child_profiles
Profil enfant. Minimisation des données : pseudonyme uniquement.

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| userId | TEXT | FK → users, ON DELETE CASCADE, index |
| pseudonym | TEXT | validé côté serveur (2–20 car., sans données personnelles) |
| avatarId | TEXT nullable | FK → avatars |
| level / totalStars / dailyGoal | INTEGER | défauts 1 / 0 / 20 |
| deletedAt | TIMESTAMP nullable | suppression logique (Phase 4) |
| createdAt / updatedAt | TIMESTAMP(3) | |

### avatars
Données de référence (seed prévue en Phase 2).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT | PK (clé stable ex. `unicorn-1`) |
| name / imageKey / rarity | TEXT | |
| createdAt | TIMESTAMP(3) | |

### game_settings
Paramètres par profil enfant, modifiables **uniquement depuis l'espace
parent** (Phase 4).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| childProfileId | TEXT | UNIQUE, FK → child_profiles, ON DELETE CASCADE |
| soundEnabled / musicEnabled / animationsEnabled / timerEnabled | BOOLEAN | |
| difficulty | TEXT | `EASY` \| `NORMAL` \| `HARD` |
| accessibleTables | INTEGER[] | défaut `[1..10]` |
| advisedSessionMin | INTEGER | défaut 20 |
| createdAt / updatedAt | TIMESTAMP(3) | |

## Relations

```
users 1 ──< child_profiles (cascade)
users 1 ──< sessions (cascade)
users 1 ──< login_attempts (SetNull)
child_profiles 1 ──1 game_settings (cascade)
avatars 1 ──< child_profiles (nullable, pas de cascade)
```

## ERD (texte)

```
+----------+        +-----------------+        +----------------+
|  users   |1──────*| child_profiles  |1──────1| game_settings  |
+----------+ userId |                 | profId +----------------+
                     | avatarId *───1 | avatars
```

## Commandes

```bash
npm run db:migrate   # prisma migrate dev (génère + applique)
npm run db:deploy    # prisma migrate deploy (staging/production)
npm run db:status    # état des migrations
npm run db:generate  # régénère le client (output lib/database/generated)
npm run db:check     # vérification transactionnelle + cascade de bout en bout
npm run db:test:setup # crée la base de test isolée + applique les migrations
```

Prisma 7 : le CLI ne charge plus `.env` automatiquement — la variable est
lue via `prisma.config.ts` (dotenv). `migrate dev` ne lance plus
automatiquement `generate` ni le seed.
