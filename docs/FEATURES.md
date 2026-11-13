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
| Image Docker multi-stage + compose (db + app + healthchecks) | TESTED | `docker build` réussi (160 Mo) ; conteneur de fumée exécuté : `/api/health` → `{"status":"ok","database":"connected"}`, `/` 200, `/parent` sans session → 307 connexion |
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

### Étapes 2.2 à 2.5 — profils, noyau de jeu, gamification (réalisées)

| Fonctionnalité | Statut | Preuve |
|---|---|---|
| CRUD profils enfants (création ≤ 6/parent, mise à jour, suppression **logique**) | TESTED | Tests d'intégration + E2E navigateur (création « PerleE2E ») |
| Appartenance parent/enfant revérifiée à chaque requête | TESTED | Tests : enfant d'un autre parent → `not_found` (profils, stats, jeu) |
| Sélection d'avatar (8 avatars SVG locaux `public/avatars/`) | TESTED | E2E : `naturalWidth > 0` sur l'avatar affiché ; seed idempotent 8 avatars |
| Cookie enfant `rmm_child` (httpOnly, Lax, 90 j) + garde `requireChildContext` | TESTED | E2E : `/enfant` sans cookie → redirection connexion/parent |
| API de jeu `/api/game/{start,answer,complete}` | TESTED | Tests d'intégration + E2E (leçon 8 questions + défi 5 questions via navigateur) |
| Réponse attendue jamais envoyée au client ; `isCorrect` recalculée serveur (a×b) | TESTED | Tests d'intégration (`features/game`) ; inspecté dans le code + payload réseau |
| Complétion de session **idempotente** (aucune double récompense) | TESTED | Tests d'intégration (double complete → récompense unique) |
| Récompenses côté serveur (règles dans `features/rewards/rules.ts`) | TESTED | Tests unitaires + d'intégration ; E2E : +15 ⭐ leçon parfaite, +15 ⭐ +75 XP défi parfait |
| Apprentissage des tables (leçon visuelle : addition répétée + groupes) | TESTED | E2E : page leçon affiche « Comprendre : multiplier, c'est ajouter des groupes » |
| Entraînement libre + suggestions de révision (répétition espacée) | TESTED | E2E : 10 questions d'entraînement jouées dans le navigateur (9 bonnes + 1 erreur autorisée, bilan 90 %, +4 ⭐/+90 XP serveur) ; moteur de maîtrise testé en intégration ; les suggestions « À revoir en priorité » s'affichent dès qu'une révision est due |
| Défis 5/10/20 questions avec seuil de réussite | TESTED | E2E : défi 5 questions parfait terminé dans le navigateur |
| Récompenses enfant (étoiles, niveau, badges, maîtrise fine) | TESTED | E2E : badge « Défi parfait » et « Multiplications maîtrisées (n) » affichés après rechargement |
| Mondes magiques débloqués par leçons validées (`features/worlds/worlds.ts`) | TESTED | E2E : mondes verrouillés affichés avec la table manquante ; illustration SVG chargée |
| Tableau de bord enfant (mission du jour, progression, raccourcis) | TESTED | E2E : « Mission du jour » + avatar + pseudonyme |
| Espace parent : panneau statistiques par enfant (sessions, réussite, tables maîtrisées/à réviser, badges, 7 derniers jours) | TESTED | Tests d'intégration (agrégats + refus inter-parents) + E2E (« Sessions : 2 », « Tables maîtrisées : ») |

## Phase 3 — Gamification

Étoiles, pièces, XP, niveaux, badges : **TESTED** (voir §2.5 ci-dessus,
table `child_badges`, idempotence upsert). Trophées, boutique d'avatars,
missions longues — PLANNED.

## Phase 4 — Espace parent

Tableau de bord parent + gestion des profils + **statistiques
pédagogiques réelles** : TESTED. Historique détaillé, paramètres
(sound/timer via `game_settings`), export — PLANNED.

## Phase 5 — Intelligence pédagogique

Répétition espacée documentée et testée (`features/spaced-repetition`,
`multiplication_mastery`), détection des tables fragiles (< 70 %) dans
les stats parent : TESTED. Adaptation automatique de la difficulté,
recommandations avancées — PLANNED.

## Phase 6 — Optimisation et stabilisation

- **E2E Playwright réels (Chromium)** : TESTED — parcours complet
  (inscription → profil → leçon → défi → récompenses → stats parent) +
  persistance après **redémarrage du serveur** + test de sécurité. Les
  tests tournent contre un **build de production** (port 3100, base de
  test isolée) — `scripts/e2e-server.ts`.
- Responsive mobile/tablette : TESTED (E2E 375×812 et 768×1024).
- Audit d'accessibilité automatisé, sauvegardes/restauration,
  vérification du déploiement Coolify — PLANNED (accès Coolify
  indisponible).
