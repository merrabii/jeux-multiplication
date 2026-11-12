# API REFERENCE

Phase 1 : un seul endpoint. Les prochains endpoints suivront les mêmes
règles : validation Zod côté serveur, autorisation vérifiée, aucune donnée
croisée entre comptes.

## Endpoints & actions (Phase 2.1)

L'authentification utilise des **Server Actions** Next.js (protection CSRF
Origin intégrée) appelées par les formulaires :

| Action | Fichier | Comportement |
|---|---|---|
| `registerParentAction` | `app/parent/auth-actions.ts` | Validation Zod, unicité e-mail (insensible à la casse), bcrypt, session + cookie, redirection `/parent`. Erreurs : champs invalides, e-mail déjà utilisé. |
| `loginParentAction` | `app/parent/auth-actions.ts` | Limitation des tentatives (persistée PostgreSQL), bcrypt, message générique, session + cookie, redirection `/parent`. Erreurs : générique, ou blocage temporaire avec délai. |
| `logoutParentAction` | `app/parent/auth-actions.ts` | Révocation en base + suppression du cookie + redirection `/parent/connexion`. |

Pages protégées :

| Route | Protection |
|---|---|
| `/parent` | `requireParentSession()` — 307 → `/parent/connexion` si session absente, expirée ou révoquée (vérifié en conditions réelles) |
| `/parent/connexion` | Redirige vers `/parent` si déjà connecté |
| `/parent/inscription` | Redirige vers `/parent` si déjà connecté |

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

- `CRUD /api/children` (Phase 2.2 — profils enfants, réservé au parent
  propriétaire)
- `POST /api/sessions`, `POST /api/attempts` (Phase 2 — enregistrement des
  sessions et tentatives ; scores et récompenses calculés **côté serveur**)
- `GET /api/progress` (Phase 4 — suivi pédagogique parent)
