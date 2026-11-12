# CURRENT STATE

- **Version** : 0.2.0-phase2.1 (Phase 2.1 — Authentification parent terminée)
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
| Frontend | Accueil + pages auth parent (connexion/inscription) + dashboard parent protégé |
| Backend | `/api/health` + authentification parent complète (inscription, connexion, déconnexion, sessions révocables, limitation des tentatives) |
| PostgreSQL | 18.6 opérationnel (Docker local), 2 migrations appliquées, 0 donnée réelle ; base de test isolée `jeux_multiplication_test` |
| Dernière migration | `20261112172058_add_auth_foundation` (sessions, login_attempts, consentement, index LOWER(email)) |
| Tests | 48/48 Vitest passés (28 unitaires + 20 intégration sur base isolée) ; `db:check` OK ; E2E non installés |
| Docker | Fichiers prêts, image **non construite** |
| Coolify | **Non déployé, non vérifié** (accès indisponible) |
| GitHub | ✔ Synchronisé : `merrabii/jeux-multiplication`, `main`, `AGENTS.md` conservé |

## Problèmes connus

Voir [KNOWN_ISSUES.md](KNOWN_ISSUES.md) (7 entrées, dont vulnérabilités
npm dev-only et absence d'illustrations définitives).

## Prochaine étape

Étape 2.2 — Gestion des profils enfants : API `/api/children` autorisée par
parent propriétaire, écran de sélection d'avatar (seed avatars),
suppression logique confirmée.
