# ARCHITECTURE

## Vue d'ensemble

Application monolithique modulaire Next.js (App Router) avec PostgreSQL.
Séparation stricte entre interface, logique métier, accès données et
validation. Déployée en un seul conteneur applicatif + un service
PostgreSQL (Docker/Coolify).

```
Navigateur (enfant / parent)
        │  HTTPS
        ▼
Next.js 16 (App Router, Node 22, standalone)
├── app/            pages + Server Actions d'auth (contrôles minces)
├── features/       logique métier pure et testable
│   ├── multiplication/   moteur de questions
│   └── auth/             inscription/connexion + limitation de tentatives
├── lib/            client Prisma, sessions, validation Zod, sécurité, guards
└── components/     composants UI (parent/auth, puis child/game/rewards/ui)
        │  adapter @prisma/adapter-pg
        ▼
PostgreSQL 18 (service séparé, volume persistant, jamais exposé sur Internet)
```

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

- Schéma et conventions base : [DATABASE.md](DATABASE.md)
- Sécurité : [SECURITY.md](SECURITY.md)
- Déploiement : [DEPLOYMENT.md](DEPLOYMENT.md)
