# API REFERENCE

Phase 1 : un seul endpoint. Les prochains endpoints suivront les mêmes
règles : validation Zod côté serveur, autorisation vérifiée, aucune donnée
croisée entre comptes.

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

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
  (Phase 2 — limitation des tentatives, cookies httpOnly sécurisés)
- `CRUD /api/children` (Phase 2 — profils enfants, réservé au parent
  propriétaire)
- `POST /api/sessions`, `POST /api/attempts` (Phase 2 — enregistrement des
  sessions et tentatives ; scores et récompenses calculés **côté serveur**)
- `GET /api/progress` (Phase 4 — suivi pédagogique parent)
