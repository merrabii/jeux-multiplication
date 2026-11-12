# FEATURES — Inventaire des fonctionnalités

Statuts : `PLANNED` → `IN_PROGRESS` → `IMPLEMENTED` → `TESTED` → `DEPLOYED`
(ou `BLOCKED`). Aucun statut sans preuve réelle.

## Phase 1 — Fondations techniques

| Fonctionnalité | Statut | Preuve |
|---|---|---|
| Application Next.js 16 + TypeScript strict initialisée | TESTED | `npm run build` réussi (compilation + génération 5 routes) |
| Tailwind CSS 4 + design system tokens magiques | TESTED | `app/globals.css` compilé dans le build |
| Client Prisma 7 singleton + adapter pg | TESTED | `npm run db:check` (transaction + relecture + cascade) |
| Migration initiale `20261112142545_init_foundation` | TESTED | Appliquée sur PostgreSQL 18.6, tables vérifiées via psql |
| Healthcheck applicatif `/api/health` (ping PostgreSQL) | TESTED | Réponse réelle : `{"status":"ok","database":"connected"}` |
| Moteur de multiplication (génération, QCM, difficultés) | TESTED | 9 tests Vitest (déterminisme, tables, distracteurs) |
| Métadonnées pédagogiques des 10 tables | TESTED | 4 tests Vitest |
| Validation Zod (API + pseudonyme enfant) | TESTED | 5 tests Vitest |
| Vérification persistance PostgreSQL (`npm run db:check`) | TESTED | Insertion transactionnelle, relecture, suppression en cascade |
| Image Docker multi-stage + compose (db + app + healthchecks) | IMPLEMENTED | Image non encore construite ; build prévu en Phase 2 |
| Documentation complète | TESTED | docs/ à jour (17 fichiers) |

## Phase 2 — MVP pédagogique (à venir)

| Fonctionnalité | Statut |
|---|---|
| Authentification parent (bcrypt, sessions sécurisées, limitation) | PLANNED |
| Gestion des profils enfants | PLANNED |
| Tableau de bord enfant | PLANNED |
| Apprentissage des tables 1..10 (progressif, visuel) | PLANNED |
| Mode entraînement (sans chronomètre, indices) | PLANNED |
| Mode défi (5/10/20 questions) | PLANNED |
| Enregistrement des réponses + progression persistante | PLANNED |
| Tests E2E Playwright des parcours réels | PLANNED |

## Phase 3 — Gamification

Étoiles, pièces, badges, trophées, avatars, niveaux, récompenses côté
serveur (transactions PostgreSQL), mondes magiques, missions — PLANNED.

## Phase 4 — Espace parent

Tableau de bord parent, statistiques, historique, paramètres, gestion des
profils — PLANNED.

## Phase 5 — Intelligence pédagogique

Répétition espacée documentée et testée, détection des difficultés,
adaptation de la difficulté, recommandations de révision — PLANNED.

## Phase 6 — Optimisation et stabilisation

Performance, accessibilité, responsive complet, E2E, sauvegardes/restauration,
vérification du déploiement Coolify — PLANNED.
