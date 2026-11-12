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

## Phase 2 — MVP pédagogique

### Étape 2.1 — Authentification parent

| Fonctionnalité | Statut | Preuve |
|---|---|---|
| Inscription parent (Zod, unicité e-mail insensible à la casse, bcrypt 12, consentement tracé) | TESTED | 5 tests d'intégration sur `jeux_multiplication_test` (création, doublon, casse, champs invalides, course P2002) |
| Connexion parent (bcrypt, message générique, anti-oracle temporel) | TESTED | Tests d'intégration (succès, mot de passe faux, compte inconnu) |
| Déconnexion avec **révocation réelle** en base | TESTED | Tests : jeton copié avant déconnexion rendu inutilisable ; vérifié aussi via HTTP (jeton révoqué → 307) |
| Sessions JWT HS256 + table `sessions` (source de vérité de la révocation) | TESTED | Tests : valide, expirée, falsifiée, révoquée, sans session |
| Cookies httpOnly / Secure (production) / SameSite=Lax / expiration | IMPLEMENTED | `lib/database/session.ts` ; Secure activé si NODE_ENV=production (à re-vérifier derrière HTTPS Coolify) |
| Limitation des tentatives persistée en PostgreSQL (5 échecs / 15 min → blocage 15 min, purge 24 h) | TESTED | Tests d'intégration : blocage, expiration, comptage insensible à la casse, réinitialisation après succès |
| Protection des routes serveur (`requireParentSession`) | TESTED | curl en conditions réelles : sans session → 307 connexion ; valide → 200 ; révoquée → 307 |
| CSRF (Server Actions — vérification d'Origin intégrée Next.js) | IMPLEMENTED | Mécanisme natif Next.js ; E2E navigateur en Phase 6 |
| Interface connexion/inscription (univers magique, accessible, responsive) | IMPLEMENTED | Pages 200 vérifiées ; test responsive/accessibilité détaillé en Phase 6 |
| Traçabilité du consentement (termsAcceptedAt, termsVersion) | TESTED | Test d'intégration (colonnes renseignées à l'inscription) |
| Base de test PostgreSQL isolée + `npm run db:test:setup` | TESTED | Provisionnement réel : 2 migrations appliquées sur `jeux_multiplication_test` |

### Étapes 2.2 à 2.5 (à venir)

| Fonctionnalité | Statut |
|---|---|
| Gestion des profils enfants (API + autorisation parent) | PLANNED |
| Sélection d'un profil enfant + avatars (seed) | PLANNED |
| Tableau de bord enfant | PLANNED |
| Apprentissage des tables 1..10 (progressif, visuel) | PLANNED |
| Mode entraînement (sans chronomètre, indices) | PLANNED |
| Mode défi (5/10/20 questions) | PLANNED |
| Enregistrement des réponses + progression persistante | PLANNED |
| Tests E2E Playwright des parcours réels | PLANNED (Phase 6) |

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
