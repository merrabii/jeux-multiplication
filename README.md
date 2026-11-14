# Royaume Magique des Multiplications

Plateforme éducative interactive en français pour apprendre les tables de
multiplication de 1 à 10, destinée aux enfants de 7 à 8 ans. Univers magique
(licornes, fées, dragons, châteaux), progression persistante, espace parent,
**application installable** (Docker/Coolify/Dokploy/VPS/Vercel/Netlify).

> **État actuel : v0.4.0 — application installable de bout en bout**
> (jeu jouable + assistant d'installation web en 6 étapes, verrouillé
> après le premier administrateur).
> Détails dans [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md).

## Installation (nouveau déploiement)

Le guide complet est dans **[docs/INSTALLATION.md](docs/INSTALLATION.md)**.

Installation Docker (recommandée) :

```bash
git clone https://github.com/merrabii/jeux-multiplication.git
cd jeux-multiplication
cp .env.example .env      # renseigner AUTH_SECRET + POSTGRES_PASSWORD
docker compose up -d --build
```

Puis ouvrir `http://<hôte>:3000` : l'**assistant d'installation** s'affiche
automatiquement (environnement → configuration → base de données →
initialisation réelle → premier administrateur → réussite). Après le
premier administrateur, l'assistant est **verrouillé définitivement**.

| Plateforme | Statut |
|---|---|
| Docker Compose | **Compatible et testé** (build + installation neuve vérifiées) |
| Coolify / Dokploy | Compatible par architecture — configuration et procédure prêtes, **non déployé** (pas d'accès) |
| VPS (scripts SSH) | Compatible par architecture — scripts `install-vps.sh` / `update-vps.sh` fournis (syntaxe vérifiée, non exécutés sur un VPS réel) |
| Vercel / Netlify | Compatible par architecture (base PostgreSQL **externe** obligatoire, `PGPOOL_MAX`, migrations en build) — **non déployé** |

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
npx playwright test             # installation complète + parcours de jeu + persistance
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

## Administrateur (v0.4.0)

- Le **premier administrateur** est créé par l'assistant d'installation
  (rôle `admin` du système d'authentification existant, mot de passe
  bcrypt, aucun mot de passe par défaut).
- L'assistant est **verrouillé définitivement** après sa création : il
  ne peut être rouvert ni par URL, ni par appel d'API.
- **Récupération d'accès** : `/recuperation-admin`, activée par la
  variable serveur `ADMIN_RECOVERY_TOKEN` (vide = désactivée) ; elle
  réinitialise le mot de passe et révoque toutes les sessions.

## Stack

| Domaine | Technologie |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, TypeScript strict) |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion (Phase 3) |
| Base de données | PostgreSQL 18 |
| ORM | Prisma ORM 7 (adapter `@prisma/adapter-pg`) |
| Validation | Zod |
| Tests | Vitest (90) + Playwright Chromium (6 E2E) |
| Conteneurisation | Docker multi-stage, `output: standalone`, entrypoint (migrations + jeton) |
| Hébergement | Docker Compose, Coolify, Dokploy, VPS (SSH), Vercel, Netlify |

## Documentation

Toute la documentation technique se trouve dans [`docs/`](docs/README.md) :
**installation** ([`docs/INSTALLATION.md`](docs/INSTALLATION.md)), état
actuel, architecture, base de données, sécurité, déploiement, tests,
décisions techniques, feuille de route.

Les règles permanentes pour les agents IA sont dans [`AGENTS.md`](AGENTS.md).
