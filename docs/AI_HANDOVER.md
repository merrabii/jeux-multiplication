# AI HANDOVER — Prise en main par un futur agent IA

## Contexte

« Royaume Magique des Multiplications » : plateforme éducative française
(tables de 1 à 10, enfants 7-8 ans). Les règles permanentes sont dans
`AGENTS.md` (à lire en premier, jamais écrasé).

## État au moment du handover (2026-11-12)

Phase 1 terminée — voir `docs/CURRENT_STATE.md` pour l'état précis et
`docs/FEATURES.md` pour les statuts prouvés. Dépôt officiel :
**https://github.com/merrabii/jeux-multiplication** (`main` = `cad8393`,
synchronisé — les anciens commits `315a465`/`a0bcf71`/`dc3c2b7` du dépôt
officiel sont préservés via le commit de fusion `4ffb1f6`).

## Technologies

| Domaine | Technologie |
|---|---|
| App | Next.js 16.4.6, App Router, TypeScript strict, Turbopack |
| Styling | Tailwind CSS 4 (tokens dans `app/globals.css`) |
| BD | PostgreSQL 18 (Docker, port local 5434) |
| ORM | Prisma 7.10.1 + `@prisma/adapter-pg` — **Rust-free** |
| Validation | Zod 4 |
| Tests | Vitest 5 (E2E Playwright en Phase 6) |

## Pièges Prisma 7 (important)

1. Le CLI ne charge plus `.env` : tout passe par `prisma.config.ts`
   (`import "dotenv/config"`).
2. Generator `prisma-client` (pas `prisma-client-js`), `output` **obligatoire**
   → `lib/database/generated` ; import : `@/lib/database/generated/client`.
3. Client : `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
4. `migrate dev` ne lance plus `generate` ni le seed automatiquement.
5. `latest` npm = 8.0.0 **RC** : ne pas installer sans décision
   (voir `docs/DECISIONS.md` D1).

## Pièges Next.js 16

- `output: "standalone"` → `next start` **ne fonctionne pas** ; utiliser
  `npm run start` (`node .next/standalone/server.js`), et copier
  `.next/static` dans `.next/standalone/.next/static` pour les assets.
- `cacheComponents` désactivé volontairement (D4).

## Organisation du code

```
app/                      pages + routes API (contrôles minces)
app/api/health            healthcheck (ping PostgreSQL)
app/parent/               connexion, inscription, dashboard protégé, auth-actions.ts
components/parent/auth/   formulaires client (useActionState)
features/auth/            service métier (register/authenticate) + rate-limit
lib/auth/                 config env, bcrypt, JWT, guards
lib/database/             client Prisma singleton + sessions + client généré
lib/validation/           schémas Zod (auth.ts, schemas.ts)
scripts/                  db-check, db-test-setup, auth-smoke
tests/unit/               tests Vitest unitaires (28)
tests/integration/        tests Vitest sur base PostgreSQL isolée (20)
prisma/                   schema + migrations versionnées (2)
docs/                     documentation complète
```

## Commandes utiles

```bash
docker compose up -d db   # PostgreSQL local (5434)
npm run dev               # développement
npm test                  # Vitest (unitaires + intégration)
npm run db:test:setup     # provisionner la base de test isolée
npm run db:migrate        # migration dev (génère + applique)
npm run db:generate       # régénérer le client Prisma
npm run db:deploy         # migrations staging/prod
npm run db:check          # vérification persistance PostgreSQL
npm run build && npm run start   # production locale
```

## Précautions absolues

- Ne jamais modifier une migration appliquée ; jamais `db push`/`reset`
  en production ; jamais supprimer le volume `pgdata`.
- Ne jamais committer `.env` ni de secrets ; ne jamais toucher aux
  autres projets PostgreSQL locaux (ports 5432/5433).
- Les scores et récompenses seront calculés **côté serveur** uniquement
  (jamais dans le navigateur).
- Déclarer une fonctionnalité faite **uniquement avec une preuve réelle**
  (test, sortie de commande, vérification manuelle documentée).
- Documenter après chaque intervention : `CURRENT_STATE.md`,
  `FEATURES.md`, `CHANGELOG.md`, et `KNOWN_ISSUES.md` si besoin.

## Prochaines tâches (Phase 2)

1. Authentification parent : bcrypt (bcryptjs), sessions httpOnly,
   limitation des tentatives, Zod pour toutes les entrées.
2. Modèles Prisma : `learning_sessions`, `question_attempts`,
   `child_progress` (nouvelle migration versionnée).
3. API profils enfants (autorisation stricte parent → ses enfants).
4. Dashboard enfant + apprentissage visuel d'une table
   (addition répétée + groupes) + entraînement + défi.
5. Tests d'intégration Vitest + premiers E2E Playwright.
6. Illustrations définitives (remplacer les emojis provisoires).
