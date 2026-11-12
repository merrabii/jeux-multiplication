# CHANGELOG

Format : date — version — modifications — fichiers — migrations — tests — impact.

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
