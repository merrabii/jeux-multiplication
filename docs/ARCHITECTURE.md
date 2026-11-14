# ARCHITECTURE

## Vue d'ensemble

Application monolithique modulaire Next.js (App Router) avec PostgreSQL.
Séparation stricte entre interface, logique métier, accès données et
validation. Déployée en un seul conteneur applicatif + un service
PostgreSQL (Docker/Coolify).

```
Navigateur (enfant / parent / installateur)
        │  HTTPS
        ▼
Next.js 16 (App Router, Node 22, standalone)
├── app/            pages + Server Actions d'auth (contrôles minces)
│   ├── installation/       assistant 6 étapes (verrouillage persistant)
│   └── recuperation-admin/ récupération admin (jeton serveur)
├── features/       logique métier pure et testable
│   ├── multiplication/   moteur de questions
│   ├── installer/        statut, environnement, init, admin atomique
│   └── auth/             inscription/connexion + limitation de tentatives
├── lib/            client Prisma, sessions, validation Zod, sécurité, guards
└── components/     composants UI (parent/auth, child/game, installer)
        │  adapter @prisma/adapter-pg
        ▼
PostgreSQL 18 (service séparé, volume persistant, jamais exposé sur Internet)
```

## Flux d'installation (v0.4.0)

```
GET /  ──► lib/auth/install-guard.ts ──► features/installer/status.ts
              │                                  │  table `installation` (singleton)
              │ non installé                    ▼
              ▼                         InstallationState { pending | completed | legacy }
        redirect(/installation)
              │
              ▼
/installation (force-dynamic)
   ├── Étape 1 : features/installer/environment.ts  (contrôles réels)
   ├── Étape 2 : app_config (clé/valeur)
   ├── Étape 3 : mode auto (DATABASE_URL) ou externe (test de connexion)
   ├── Étape 4 : initializeDatabase() → prisma migrate deploy + tables + avatars
   ├── Étape 5 : createFirstAdmin() → transaction + SELECT … FOR UPDATE
   │              (bcrypt, rôle admin, verrou `completed` posé)
   └── Étape 6 : succès → /parent/connexion
```

Le verrou est **persistant en base** : `installation.status=completed`
ferme définitivement l'assistant. Un serveur déjà utilisé (comptes ou
profils existants) bascule en mode « hérité » : l'assistant n'est jamais
proposé. Le CLI de migration est embarqué dans `/app/prisma-cli` (image
Docker) ; en local il provient de `node_modules/prisma`.

## Flux d'authentification parent (Phase 2.1)

```
/parent/inscription  ─┐
/parent/connexion     ├─ Server Action (CSRF Origin vérifié par Next)
                      │        │
                      │        ▼
                      │  features/auth/service.ts   (Zod, bcrypt, anti-énumération)
                      │  features/auth/rate-limit.ts (limitation persistée PostgreSQL)
                      │        │
                      │        ▼
                      │  lib/database/session.ts → INSERT sessions + JWT HS256 (jose)
                      │        │
                      ▼        ▼
                 Cookie httpOnly rmm_session
                      │
/parent  ◄─ requireParentSession() : JWT vérifié (signature+expiration)
             PUIS session vérifiée en base (non révoquée, non expirée)
             sinon → 307 /parent/connexion
```

La table `sessions` est la source de vérité de la révocation : la
déconnexion écrit `revokedAt`, ce qui rend tout jeton copié inutilisable.

## Règles d'organisation

- **`features/`** : logique métier pure (moteur de multiplication, calcul de
  scores, répétition espacée…). Aucune dépendance à React ni à la base :
  testable unitairement.
- **`lib/`** : infrastructure. `lib/database/client.ts` expose le singleton
  Prisma (adapter pg). `lib/validation/schemas.ts` centralise Zod.
- **`app/`** : routes de pages et d'API. Les routes API valident les entrées
  avec Zod, délèguent à `features/`, puis écrivent en base.
- Les règles métier sensibles (scores, récompenses, déblocages) sont
  centralisées **côté serveur** (Phase 3) ; le navigateur ne fait qu'afficher.

## Décisions structurantes

- Next.js 16 + Turbopack (défaut du scaffold), TypeScript strict.
- Prisma ORM **7** (dernière stable ; `latest` v8 est une release candidate).
- `output: standalone` pour une image Docker minimale.
- `cacheComponents` désactivé pour l'instant (application quasi
  entièrement personnalisée par profil) — voir [DECISIONS.md](DECISIONS.md).

## Environments

| Environnement | Rôle | Base de données |
|---|---|---|
| Development | Machine locale | PostgreSQL via `docker compose up -d db` (port hôte 5434) |
| Staging (futur Coolify) | Tests réels | PostgreSQL conteneurisé dans le projet Coolify |
| Production | Future | Coolify + PostgreSQL conteneurisé, volume persistant, sauvegardes |

## Liens

- Installation et déploiements : [INSTALLATION.md](INSTALLATION.md)
- Schéma et conventions base : [DATABASE.md](DATABASE.md)
- Sécurité : [SECURITY.md](SECURITY.md)
- Déploiement : [DEPLOYMENT.md](DEPLOYMENT.md)
