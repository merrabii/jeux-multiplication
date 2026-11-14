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

## Modèles (Phase 1 + 2.1 + noyau de jeu)

Migration `20261112142545_init_foundation` : `users`, `child_profiles`,
`avatars`, `game_settings`.

Migration `20261112172058_add_auth_foundation` : `sessions`,
`login_attempts`, colonnes de consentement sur `users`, index unique
`LOWER(email)`.

Migration `20261112214817_add_game_core` : colonnes `coins`, `diamonds`,
`xp` sur `child_profiles` ; tables `learning_sessions`,
`question_attempts`, `child_progress`, `multiplication_mastery`,
`child_badges`, `daily_activity`. **Non destructive.**

Migration `20261113011956_add_installation` : tables `installation`
(singleton) et `app_config` (clé/valeur). **Non destructive** (2 CREATE
TABLE, aucune donnée existante touchée).

### installation
Verrou d'installation (une seule ligne, `id = 'installation'`).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT | PK, valeur fixe `installation` |
| status | TEXT | `pending` → `completed` |
| completedAt | TIMESTAMP(3) nullable | posé à la création du premier admin → installateur verrouillé |
| adminUserId | TEXT nullable | identifiant de l'administrateur créé |
| appVersion | TEXT nullable | version de l'application au moment de l'installation |
| attemptsCount | INTEGER | échecs de création d'admin (anti-abus) |
| blockedUntil | TIMESTAMP(3) nullable | blocage temporaire après 5 échecs |
| createdAt / updatedAt | TIMESTAMP(3) | |

### app_config
Configuration applicative (clé/valeur) écrite par l'assistant :
`app.name`, `app.url`, `app.language`, `app.timezone`,
`app.organization`. **Aucun secret ici** (les secrets restent dans
l'environnement).

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
| coins / diamonds / xp | INTEGER | récompenses agrégées (défauts 0), mises à jour uniquement côté serveur |
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

### learning_sessions
Une session de jeu (LESSON, PRACTICE ou CHALLENGE). La complétion est
**idempotente** : `updateMany WHERE completedAt IS NULL` (aucune double
récompense possible, même en double-clic ou double requête).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| childProfileId | TEXT | FK → child_profiles, ON DELETE CASCADE, index (childProfileId, createdAt) |
| kind | TEXT | `LESSON` \| `PRACTICE` \| `CHALLENGE` |
| tableList | INTEGER[] | tables concernées |
| difficulty | TEXT | `EASY` \| `NORMAL` \| `HARD` |
| questionCount | INTEGER | taille prévue |
| correctCount / wrongCount | INTEGER | remplis côté serveur à la complétion |
| durationSeconds | INTEGER | durée déclarée, bornée |
| targetPercent | INTEGER nullable | seuil de réussite du défi |
| starsEarned / xpEarned / coinsEarned | INTEGER | récompenses calculées **côté serveur** à la complétion |
| completedAt | TIMESTAMP nullable | NULL = session en cours |
| createdAt | TIMESTAMP(3) | |

### question_attempts
Chaque réponse individuelle. **La réponse attendue n'est jamais stockée
côté client** : `isCorrect` est recalculée côté serveur (a×b).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| sessionId | TEXT | FK → learning_sessions, ON DELETE CASCADE, index |
| childProfileId | TEXT | FK → child_profiles, ON DELETE CASCADE, index (childProfileId, a, b) |
| a / b | INTEGER | facteurs de la question |
| offeredChoices | INTEGER[] | 4 choix proposés (audit pédagogique) |
| givenAnswer | INTEGER nullable | réponse de l'enfant (NULL = non répondu) |
| isCorrect | BOOLEAN | recalculé serveur : givenAnswer === a×b |
| answeredAt | TIMESTAMP(3) | |

### child_progress
Agrégat par table et par profil (UNIQUE childProfileId+table).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| childProfileId | TEXT | FK cascade, UNIQUE avec table |
| table | INTEGER | 1..10 |
| lessonsCompleted / practiceSessions / challengesPassed | INTEGER | compteurs |
| correctCount / wrongCount | INTEGER | base des statistiques parentales |
| lastPracticedAt | TIMESTAMP nullable | |
| updatedAt | TIMESTAMP(3) | |

### multiplication_mastery
Maîtrise fine par multiplication (a, b) — répétition espacée.

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| childProfileId | TEXT | FK cascade, UNIQUE avec (a, b) |
| a / b | INTEGER | facteurs |
| correctCount / wrongCount | INTEGER | |
| masteryLevel | INTEGER | 0–3 (intervals de révision 1 h / 24 h / 72 h ; une erreur retombe au niveau 1) |
| nextReviewAt / lastReviewedAt | TIMESTAMP nullable | source des suggestions de révision |

### child_badges
Badges débloqués (UNIQUE childProfileId+badgeKey, upsert idempotent).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| childProfileId | TEXT | FK cascade, UNIQUE avec badgeKey |
| badgeKey | TEXT | ex. `first_session`, `perfect_challenge` |
| earnedAt | TIMESTAMP(3) | |

### daily_activity
Agrégat journalier par profil (UNIQUE childProfileId+day, upsert).
Alimente « Mission du jour » et l'activité récente de l'espace parent.

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT (uuid) | PK |
| childProfileId | TEXT | FK cascade, UNIQUE avec day |
| day | TIMESTAMP(3) | jour UTC tronqué |
| questionsAnswered / correctAnswers / starsEarned / xpEarned / sessionCount | INTEGER | compteurs |

## Relations

```
users 1 ──< child_profiles (cascade)
users 1 ──< sessions (cascade)
users 1 ──< login_attempts (SetNull)
child_profiles 1 ──1 game_settings (cascade)
child_profiles 1 ──< learning_sessions (cascade)
child_profiles 1 ──< question_attempts (cascade)
child_profiles 1 ──< child_progress (cascade, unique par table)
child_profiles 1 ──< multiplication_mastery (cascade, unique par a,b)
child_profiles 1 ──< child_badges (cascade, unique par badgeKey)
child_profiles 1 ──< daily_activity (cascade, unique par jour)
avatars 1 ──< child_profiles (nullable, pas de cascade)
learning_sessions 1 ──< question_attempts (cascade)
```

## ERD (texte)

```
+----------+        +-----------------+        +----------------+
|  users   |1──────*| child_profiles  |1──────1| game_settings  |
+----------+ userId |                 | profId +----------------+
                     | avatarId *───1 | avatars
                     |  ├──* learning_sessions ──* question_attempts
                     |  ├──* child_progress
                     |  ├──* multiplication_mastery
                     |  ├──* child_badges
                     |  └──* daily_activity
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
