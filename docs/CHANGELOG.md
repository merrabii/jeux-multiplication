# CHANGELOG

Format : date — version — modifications — fichiers — migrations — tests — impact.

## 2026-11-12 — v0.3.0 (noyau de jeu, gamification, espace parent, E2E réels)

### Ajouté
- **Noyau de jeu côté serveur** (`features/game/service.ts`) :
  `startGameSession`, `submitAnswer`, `completeGameSession`. La réponse
  attendue (a×b) n'est jamais envoyée au client ; `isCorrect` est
  recalculée côté serveur ; la complétion est **idempotente**
  (`updateMany WHERE completedAt IS NULL` — aucun double crédit).
- **API de jeu** : `POST /api/game/start`, `/api/game/answer`,
  `/api/game/complete` (gardes session + cookie enfant, Zod, 401/400/404).
- **Récompenses** (`features/rewards/rules.ts`) : étoiles, XP, pièces,
  gemmes, niveaux, badges (`first_session`, `perfect_challenge`, …) —
  upserts idempotents ; calcul **uniquement côté serveur**.
- **Répétition espacée** (`features/spaced-repetition/schedule.ts` +
  table `multiplication_mastery`) : maîtrise 0–3, révisions 1 h / 24 h /
  72 h, erreur → niveau 1.
- **Mondes magiques** (`features/worlds/worlds.ts`) : 5 mondes, déblocage
  par leçons validées ; illustrations **SVG locales** (`public/images/
  worlds/`) + 8 avatars SVG (`public/avatars/`) — zéro dépendance externe.
- **Interface enfant** : en-tête partagé, tableau de bord (mission du
  jour, mondes, raccourcis), pages d'apprentissage (leçon visuelle avec
  addition répétée), entraînement (suggestions de révision), défis
  5/10/20, page récompenses (badges + maîtrise fine).
- **Espace parent** : panneau de statistiques pédagogiques par enfant
  (`features/children/stats.ts`) — sessions, taux de réussite global et
  par table, tables maîtrisées, tables à réviser (< 70 %), badges,
  activité des 7 derniers jours ; agrégats PostgreSQL, appartenance
  revérifiée.
- **E2E Playwright réels (Chromium)** :
  - `tests/e2e/journey.spec.ts` — parcours complet : inscription parent →
    création profil + avatar → dashboard → leçon table 2 (8 questions
    réussies dans le navigateur) → défi 5 questions parfait (+15 ⭐,
    +75 XP) → **entraînement libre table 3 (10 questions, 9 bonnes +
    1 erreur volontaire : +4 ⭐, +90 XP)** → étoiles persistées →
    stats parent → responsive 375×812.
  - `tests/e2e/persistence.spec.ts` — vérification **après redémarrage
    réel du serveur** : cookies, étoiles (≥ 30), leçon validée
    (« Validée ✓ »), stats parent intactes ; + test de sécurité
    (contexte sans cookies → redirection).
  - `scripts/e2e-server.ts` : serveur E2E sur **build de production**
    standalone (port 3100) contre la base de test isolée — l'environnement
    dev (HMR Turbopack) annulait aléatoirement des navigations.
  - `playwright.config.ts` ; artefacts hors image Docker (`.dockerignore`).

### Migration
`20261112214817_add_game_core` — colonnes `coins`/`diamonds`/`xp` sur
`child_profiles` ; tables `learning_sessions`, `question_attempts`,
`child_progress`, `multiplication_mastery`, `child_badges`,
`daily_activity` (cascade + index/unique). **Non destructive.**

### Tests exécutés (réels)
- `npm test` → **67/67** (unitaires + intégration sur
  `jeux_multiplication_test`, incluant idempotence, isolation
  inter-parents, règles de récompense, répétition espacée, stats).
- `npm run lint` → 0 erreur ; `npm run build` → 15 routes.
- E2E Chromium : parcours complet **PASSED** ; persistance après
  redémarrage serveur **PASSED (2/2)** ; données vérifiées aussi en SQL
  direct (`child_progress` table 2 : lessonsCompleted=1, correct=8).

### Impact
Aucune donnée supprimée ; migrations non destructives ; anciens tests
conservés. **Règle d'exploitation : ne jamais exécuter `npm test`
concurrently avec les E2E** (les deux purgent/écrivent la même base de
test ; le nettoyage Vitest des comptes `@auth-test.example` invalide les
sessions E2E en cours).

## 2026-11-12 — v0.2.0-phase2.1 (authentification parent)

### Ajouté
- **Authentification parent complète** :
  - `features/auth/service.ts` : inscription + connexion (bcrypt 12,
    e-mail normalisé minuscules, message d'échec générique, comparaison
    factice anti-oracle temporel, gestion de la course P2002).
  - `features/auth/rate-limit.ts` : limitation persistée en PostgreSQL —
    5 échecs max sur fenêtre glissante de 15 min → blocage 15 min,
    purge des tentatives > 24 h, comptage insensible à la casse,
    réinitialisation après succès.
  - `lib/auth/` : `config.ts` (env obligatoires, aucun secret par
    défaut), `password.ts` (bcrypt), `session-token.ts` (JWT HS256
    jose), `guards.ts` (`requireParentSession`).
  - `lib/database/session.ts` : création/résolution/révocation de
    sessions — la table `sessions` est la source de vérité de la
    révocation (un JWT copié devient inutilisable après déconnexion).
  - Server Actions CSRF : `app/parent/auth-actions.ts` (inscription,
    connexion, déconnexion) — protection Origin intégrée Next.js.
  - Pages : `/parent/inscription`, `/parent/connexion` (formulaires
    accessibles, univers magique) ; `/parent` protégé côté serveur.
  - `scripts/auth-smoke.ts` (vérification manuelle des jetons).
  - Base de test isolée : `scripts/db-test-setup.ts` +
    `npm run db:test:setup` (migrations sur `jeux_multiplication_test`).
- **Tests** : 30 nouveaux (5 mot de passe, 5 jetons JWT, 20 intégration
  sur base isolée couvrant les 18 scénarios exigés + cas limites).
  Total : 48/48 passés.

### Modifié
- `prisma/schema.prisma` : modèles `Session`, `LoginAttempt` ;
  `users` + `termsAcceptedAt`, `termsVersion`, relations sessions/tentatives.
- `.env.example` : `AUTH_SECRET`, `TEST_DATABASE_URL`, paramètres de
  session et de limitation documentés.
- `vitest.config.ts` : tests d'intégration inclus + `tests/setup.ts`.
- Design system : tokens bouton (`--color-button`, `--color-button-hover`).
- Documentation : CURRENT_STATE, FEATURES, DATABASE, API_REFERENCE,
  SECURITY, ENVIRONMENT, TESTING, AI_HANDOVER.

### Migration
`20261112172058_add_auth_foundation` — CREATE TABLE `sessions`,
`login_attempts` ; ALTER TABLE `users` ADD COLUMN (consentement) ;
index unique `LOWER(email)` ; FK cascade/SetNull. **Non destructive.**

### Tests exécutés (réels)
- `npm test` → **48/48** (base de test isolée `jeux_multiplication_test`).
- `npm run lint` → 0 erreur, 0 avertissement.
- `npm run build` → 7 routes.
- Protection des routes vérifiée par curl sur serveur standalone :
  sans session → 307 `/parent/connexion` ; jeton valide → 200 ;
  jeton révoqué → 307.

### Impact
Aucune donnée supprimée ; migrations non destructives ; anciens tests
conservés.

## 2026-11-12 — v0.1.1 (correction dépôt GitHub)

### Modifié
- Remote `origin` corrigé : `stablestreamsllc/jeux-multiplication` →
  **`merrabii/jeux-multiplication`** (dépôt officiel).
- `.gitignore` : `!.env.example` pour versionner le modèle d'environnement
  (le scaffold ignorait `.env*` en bloc, empêchant le suivi de
  `.env.example` exigé par le Master Prompt).

### Ajouté
- Commit de fusion `4ffb1f6` reliant les deux historiques (le dépôt
  officiel avait un historique indépendant contenant uniquement
  `AGENTS.md`, contenu identique — aucun commit distant perdu, aucun
  force push utilisé).

### Fichiers
`.gitignore`, `.env.example` (désormais versionné), `docs/*`.

### Tests
- `git ls-remote origin` → `cad8393` sur `main` ; `git status` →
  branche synchronisée sans divergence.
- 65 fichiers sur `origin/main` (AGENTS.md + docs/ + code Phase 1).
- Aucune donnée ni migration touchée.

### Impact
Le dépôt GitHub officiel contient désormais toute la Phase 1.

## 2026-11-12 — v0.1.0 (Phase 1 : fondations)

### Ajouté
- **Application** : scaffold Next.js 16.4.6 (App Router, TypeScript strict,
  Tailwind 4, Turbopack, ESLint), fusionné à la racine du dépôt.
- **Base de données** : Prisma 7.10.1 + `@prisma/adapter-pg`, singleton
  `lib/database/client.ts`, `prisma.config.ts` (dotenv).
- **Schéma initial** : `users`, `child_profiles`, `avatars`,
  `game_settings` (conventions + index + cascade documentés).
- **Métier** : moteur de multiplication (`features/multiplication/`) :
  génération QCM avec distracteurs pédagogiques, 3 difficultés, graine
  déterministe ; métadonnées pédagogiques des 10 tables.
- **Validation** : schémas Zod (génération de questions, pseudonyme enfant).
- **API** : `GET /api/health` (ping PostgreSQL, 200/503).
- **UI** : page d'accueil univers magique, pages d'attente `/enfant` et
  `/parent`, design system (tokens, boutons larges, focus visible,
  `prefers-reduced-motion`), polices Fredoka + Nunito.
- **Infra** : Dockerfile multi-stage standalone, docker-compose.yml
  (db 18-alpine + app, healthchecks, volume persistant), `.env.example`,
  `.dockerignore`.
- **Tests** : Vitest, 18 tests unitaires ; script `db:check` (persistance
  transactionnelle + cascade).
- **Documentation** : 17 fichiers dans `docs/` + README + `docs/README.md`.

### Fichiers principaux
`package.json`, `next.config.ts`, `tsconfig.json`, `prisma/schema.prisma`,
`prisma.config.ts`, `lib/database/client.ts`,
`features/multiplication/{tables,engine}.ts`, `lib/validation/schemas.ts`,
`app/**` (layout, page, enfant, parent, api/health, globals.css),
`tests/unit/**`, `scripts/db-check.ts`, `Dockerfile`,
`docker-compose.yml`, `docs/**`.

### Migration
`20261112142545_init_foundation` — création des 4 tables (aucun contenu
destructif, première migration du projet).

### Tests exécutés (réels)
- `npm test` → 18/18 passés (Vitest 5.1.0).
- `npm run build` → réussi (5 routes générées).
- `npm run db:check` → persistance PostgreSQL vérifiée de bout en bout.
- Healthcheck en conditions réelles (serveur standalone) :
  `/api/health` → `{"status":"ok","database":"connected"}` ; `/`,
  `/enfant`, `/parent` → HTTP 200.

### Impact
Aucun — projet neuf. Port PostgreSQL local : 5434 (5432/5433 occupés par
d'autres projets, non modifiés).
