# Royaume Magique des Multiplications

Plateforme éducative interactive en français pour apprendre les tables de
multiplication de 1 à 10, destinée aux enfants de 7 à 8 ans. Univers magique
(licornes, fées, dragons, châteaux), progression persistante, espace parent,
déploiement Docker/Coolify.

> **État actuel : Phase 1 (Fondations techniques) terminée.**
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
npm test                    # tests unitaires Vitest
npm run db:check            # vérifie la persistance PostgreSQL de bout en bout
npm run build               # build de production
npm run start               # démarre le serveur standalone (.next/standalone)
```

## Stack

| Domaine | Technologie |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, TypeScript strict) |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion (Phase 3) |
| Base de données | PostgreSQL 18 |
| ORM | Prisma ORM 7 (adapter `@prisma/adapter-pg`) |
| Validation | Zod |
| Tests | Vitest (Playwright en Phase 6) |
| Conteneurisation | Docker multi-stage, `output: standalone` |
| Hébergement | Coolify |

## Documentation

Toute la documentation technique se trouve dans [`docs/`](docs/README.md) :
état actuel, architecture, base de données, sécurité, déploiement, tests,
décisions techniques, feuille de route.

Les règles permanentes pour les agents IA sont dans [`AGENTS.md`](AGENTS.md).
