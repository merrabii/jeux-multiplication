# Royaume Magique des Multiplications

Plateforme éducative interactive en français pour apprendre les tables de
multiplication de 1 à 10, destinée aux enfants de 7 à 8 ans. Univers magique
(licornes, fées, dragons, châteaux), progression persistante, espace parent,
déploiement Docker/Coolify.

> **État actuel : v0.3.0 — jeu jouable de bout en bout** (auth parent,
> profils enfants, leçons/entraînement/défis, récompenses serveur, mondes
> magiques, stats parent, E2E Chromium).
> Détails dans [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

## Démarrage rapide (développement)

Prérequis : Node.js ≥ 22.18, Docker (pour PostgreSQL), npm.

```bash
npm install
docker compose up -d db     # PostgreSQL 18 sur 127.0.0.1:5434 (volume persistant)
npm run db:migrate          # applique les migrations versionnées
npm run dev                 # http://localhost:3000
```

Vérifications :

```bash
npm run db:test:setup      # provisionne la base de test isolée (1re fois)
npm test                   # tests unitaires + intégration (67 tests)
npm run db:check           # vérifie la persistance PostgreSQL de bout en bout
npm run build              # build de production
npm run start              # démarre le serveur standalone (.next/standalone)
```

## Le jeu (v0.3.0)

- **Espace parent** : inscription/connexion, création des profils enfants
  (pseudonyme + avatar), statistiques pédagogiques PostgreSQL (réussite
  par table, tables à réviser, badges, 7 derniers jours).
- **Espace enfant** : `/enfant` — tableau de bord (mission du jour,
  mondes magiques débloqués par leçons validées), `/enfant/apprendre/[n]`
  (leçon visuelle : addition répétée + 8 questions), `/enfant/entrainement`
  (libre, suggestions de révision), `/enfant/defis` (5/10/20 questions),
  `/enfant/recompenses` (étoiles, badges, maîtrise fine).
- **Serveur seul juge** : la réponse attendue ne quitte jamais le
  serveur, la complétion de session est idempotente (aucune double
  récompense), récompenses documentées dans
  `features/rewards/rules.ts`.

## E2E (Playwright, Chromium)

```bash
npx tsx scripts/e2e-server.ts   # build production + serveur port 3100 (base de test)
npx playwright test             # parcours complet + persistance après redémarrage
```

⚠️ Ne jamais exécuter `npm test` et `npx playwright test` simultanément
(même base de test — voir docs/TESTING.md).

## Authentification parent (Phase 2.1)

- **Inscription** : `/parent/inscription` (e-mail + mot de passe + conditions).
- **Connexion** : `/parent/connexion`.
- **Espace parent** : `/parent` — protégé côté serveur (session vérifiée
  en PostgreSQL à chaque requête).
- **Sécurité** : bcrypt, JWT HS256 signé (`AUTH_SECRET`), sessions
  révocables en base (la déconnexion invalide réellement le jeton),
  limitation des tentatives persistée en PostgreSQL.
- Variables requises : `DATABASE_URL`, `AUTH_SECRET` (voir
  `.env.example` et `docs/ENVIRONMENT.md`).

## Stack

| Domaine | Technologie |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, TypeScript strict) |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion (Phase 3) |
| Base de données | PostgreSQL 18 |
| ORM | Prisma ORM 7 (adapter `@prisma/adapter-pg`) |
| Validation | Zod |
| Tests | Vitest (67) + Playwright Chromium (E2E) |
| Conteneurisation | Docker multi-stage, `output: standalone` |
| Hébergement | Coolify |

## Documentation

Toute la documentation technique se trouve dans [`docs/`](docs/README.md) :
état actuel, architecture, base de données, sécurité, déploiement, tests,
décisions techniques, feuille de route.

Les règles permanentes pour les agents IA sont dans [`AGENTS.md`](AGENTS.md).
