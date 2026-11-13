# API REFERENCE

Endpoints et Server Actions réels de l'application. Règles communes :
validation Zod côté serveur, autorisation vérifiée (session parent +
cookie enfant, appartenance revérifiée en base), aucune donnée croisée
entre comptes.

## Endpoints & actions (Phase 2.1)

L'authentification utilise des **Server Actions** Next.js (protection CSRF
Origin intégrée) appelées par les formulaires :

| Action | Fichier | Comportement |
|---|---|---|
| `registerParentAction` | `app/parent/auth-actions.ts` | Validation Zod, unicité e-mail (insensible à la casse), bcrypt, session + cookie, redirection `/parent`. Erreurs : champs invalides, e-mail déjà utilisé. |
| `loginParentAction` | `app/parent/auth-actions.ts` | Limitation des tentatives (persistée PostgreSQL), bcrypt, message générique, session + cookie, redirection `/parent`. Erreurs : générique, ou blocage temporaire avec délai. |
| `logoutParentAction` | `app/parent/auth-actions.ts` | Révocation en base + suppression du cookie + redirection `/parent/connexion`. |

Actions enfants (Phase 2.2) :

| Action | Fichier | Comportement |
|---|---|---|
| `createChildAction` | `app/parent/children-actions.ts` | Création d'un profil (max 6/parent), pseudonyme Zod, avatar de référence obligatoire. |
| `updateChildAction` | `app/parent/children-actions.ts` | Mise à jour pseudonyme/avatar — **appartenance revérifiée en base**. |
| `deleteChildAction` | `app/parent/children-actions.ts` | Suppression **logique** (`deletedAt`), jamais physique ; confirmation requise. |
| `selectChildAction` | `app/parent/children-actions.ts` | Pose le cookie `rmm_child` après vérification d'appartenance → `/enfant`. |
| `exitChildSpaceAction` | `app/parent/children-actions.ts` | Efface le cookie `rmm_child` → retour `/parent`. |

Pages protégées :

| Route | Protection |
|---|---|
| `/parent` | `requireParentSession()` — 307 → `/parent/connexion` si session absente, expirée ou révoquée (vérifié en conditions réelles) |
| `/parent/connexion` | Redirige vers `/parent` si déjà connecté |
| `/parent/inscription` | Redirige vers `/parent` si déjà connecté |
| `/enfant`, `/enfant/*` | `requireChildContext()` — 307 → `/parent/connexion` sans session, 307 → `/parent` si aucun enfant valide sélectionné ; appartenance enfant/parent revérifiée à chaque requête |

## API de jeu (Phase 2 — noyau apprentissage)

Trois endpoints JSON, tous gardés par la même paire session + cookie
enfant (401 sans session, 404 si l'enfant n'appartient pas au parent).
Les réponses attendues ne quittent **jamais** le serveur : `correct` est
recalculé à partir de `a×b`.

| Endpoint | Corps | Réponse | Erreurs |
|---|---|---|---|
| `POST /api/game/start` | `{ kind: LESSON\|PRACTICE\|CHALLENGE, tables: number[], difficulty, questionCount, targetPercent? }` | `{ sessionId, questions: [{ questionId, a, b, choices }] }` — la réponse attendue n'est pas envoyée | 400 corps/paramètres invalides |
| `POST /api/game/answer` | `{ sessionId, questionId, answer }` | `{ correct, expectedAfter?… }` — correction révélée **après** soumission | 401/400/404 session ou question inconnue |
| `POST /api/game/complete` | `{ sessionId, durationSeconds }` | `{ completed, rewards: { stars, xp, coins, diamonds }, badges: [key] }` — **idempotent** (`updateMany WHERE completedAt IS NULL`), aucun double crédit | 401/400/404 |

Récompenses (documentées dans `features/rewards/rules.ts`) :
LESSON 10⭐ + 5⭐ si sans faute / 50 XP + 20 XP si sans faute ;
PRACTICE 1⭐ / 2 bonnes réponses et 10 XP / bonne réponse ;
CHALLENGE 1⭐ / bonne réponse + 10⭐ bonus si sans faute, 15 XP / bonne
réponse, 1💎 si sans faute ; pièces = XP/20 ; niveau = XP/100 + 1.
Les mondes (`features/worlds/worlds.ts`) se débloquent par leçons
validées — règle de code, pas de base de données.

## GET /api/health

Healthcheck applicatif (Docker Compose + Coolify).

- **Réponse 200** :
  ```json
  { "status": "ok", "database": "connected", "timestamp": "2026-11-12T15:03:27.222Z" }
  ```
- **Réponse 503** (PostgreSQL injoignable) :
  ```json
  { "status": "degraded", "database": "unreachable" }
  ```
- Dynamique (`force-dynamic`), jamais mise en cache.

## Endpoints planifiés

- `GET /api/parent/stats/:childId` (Phase 4 — alternative JSON au rendu
  serveur actuel de l'espace parent, qui interroge déjà PostgreSQL via
  `features/children/stats.ts`)
