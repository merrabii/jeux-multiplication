# CURRENT STATE

- **Version** : 0.1.0 (Phase 1 — Fondations techniques)
- **Dernière mise à jour** : 2026-11-12

## Architecture actuelle

- Next.js 16.4.6 (App Router, TypeScript strict, Turbopack) — `app/` à la racine.
- Tailwind CSS 4 + design system magique (`app/globals.css`).
- Prisma ORM 7.10.1 + `@prisma/adapter-pg` (Rust-free) — client singleton
  dans `lib/database/client.ts`, généré dans `lib/database/generated`.
- PostgreSQL 18.6 via Docker (`docker-compose.yml`, port local 5434).
- Vitest 5.1.0 ; Zod 4.6.7 ; Framer Motion installé (utilisé en Phase 3).

## Fonctionnalités terminées (avec preuve)

- Application compilable et démarrable : `npm run build` OK (5 routes),
  serveur standalone vérifié.
- PostgreSQL connecté et fiable : migration
  `20261112142545_init_foundation` appliquée ; `npm run db:check` OK
  (transaction, relecture, cascade) ; healthcheck réel
  `{"status":"ok","database":"connected"}`.
- Moteur de multiplication pur et testé (18 tests Vitest).
- Pages d'accueil + `/enfant` + `/parent` (placeholder magique) : HTTP 200
  vérifiés.
- `GET /api/health` : vérifié en conditions réelles.
- Docker : Dockerfile multi-stage + compose (non encore buildés —
  Phase 2).

## Fonctionnalités partielles

- Interface enfant/parent : pages d'attente uniquement (Phase 2).
- Illustrations : emojis provisoires documentés.

## Fonctionnalités absentes

- Authentification, profils, apprentissage, entraînement, défis,
  récompenses, mondes, espace parent complet, répétition espacée
  (Phases 2 à 5).

## État des environnements

| Élément | État |
|---|---|
| Frontend | Squelette + accueil magique, pages d'attente |
| Backend | `/api/health` uniquement |
| PostgreSQL | 18.6 opérationnel (Docker local), 1 migration appliquée, 0 donnée réelle |
| Dernière migration | `20261112142545_init_foundation` |
| Tests | 18/18 Vitest passés ; `db:check` OK ; E2E non installés |
| Docker | Fichiers prêts, image **non construite** |
| Coolify | **Non déployé, non vérifié** (accès indisponible) |

## Problèmes connus

Voir [KNOWN_ISSUES.md](KNOWN_ISSUES.md) (7 entrées, dont vulnérabilités
npm dev-only et absence d'illustrations définitives).

## Prochaine étape

Phase 2 — MVP pédagogique : authentification parent, gestion des profils
enfants, tableau de bord enfant, apprentissage des tables 1 à 10,
entraînement, défis, enregistrement persistant des réponses.
