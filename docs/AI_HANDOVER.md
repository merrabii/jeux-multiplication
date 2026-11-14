# AI HANDOVER — Prise en main par un futur agent IA

## Contexte

« Royaume Magique des Multiplications » : plateforme éducative française
(tables de 1 à 10, enfants 7-8 ans). Les règles permanentes sont dans
`AGENTS.md` (à lire en premier, jamais écrasé).

## État au moment du handover (2026-11-13, v0.4.0)

Phase 1 + Phase 2 (auth, profils enfants, noyau de jeu, gamification,
espace parent, E2E réels) **+ Phase 3 (application installable : assistant
d'installation web, Docker/Coolify/Dokploy/VPS/Vercel/Netlify)** terminées
— voir `docs/CURRENT_STATE.md` pour l'état précis, `docs/FEATURES.md`
pour les statuts prouvés, `docs/TESTING.md` pour la couverture et
**`docs/INSTALLATION.md`** pour les procédures d'installation. Dépôt
officiel : **https://github.com/merrabii/jeux-multiplication** (`main`,
synchronisé).

## Technologies

| Domaine | Technologie |
|---|---|
| App | Next.js 16.4.6, App Router, TypeScript strict, Turbopack |
| Styling | Tailwind CSS 4 (tokens dans `app/globals.css`) |
| BD | PostgreSQL 18 (Docker, port local 5434) |
| ORM | Prisma 7.10.1 + `@prisma/adapter-pg` — **Rust-free** |
| Validation | Zod 4 |
| Tests | Vitest 5 (90 tests) + Playwright 1.65 E2E Chromium (build prod, 6 tests) |

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
app/api/game/             start, answer, complete (API de jeu gardée)
app/api/health            healthcheck (ping PostgreSQL)
app/parent/               connexion, inscription, dashboard protégé, actions auth/enfants
app/enfant/               dashboard, apprendre/[table], entrainement, defis, recompenses
app/installation/         assistant d'installation (page + Server Actions)
app/recuperation-admin/   récupération sécurisée administrateur (jeton serveur)
components/game/          ChildHeader + composants de jeu client
components/parent/auth/   formulaires client (useActionState)
components/installer/     assistant 6 étapes + formulaire de récupération (client)
features/auth/            service métier (register/authenticate) + rate-limit
features/children/        profils (service) + statistiques parentales (stats)
features/game/            boucle de jeu serveur (start/answer/complete, idempotent)
features/installer/       statut, environnement, service, admin, db-config, token, schemas
features/rewards/         règles de récompense (étoiles, XP, pièces, badges)
features/worlds/          5 mondes magiques + règles de déblocage
features/spaced-repetition/ intervalles de révision (maîtrise 0–3)
features/multiplication/  moteur de questions + métadonnées des tables
features/avatars/         seed d'avatars réutilisé par le seed, l'E2E et l'assistant
lib/auth/                 config env, bcrypt, JWT, guards, child-guard, install-guard
lib/database/             client Prisma singleton + sessions + client généré
lib/validation/           schémas Zod (auth.ts, schemas.ts)
lib/version.ts            version applicative (0.4.0)
docker/entrypoint.sh      attente PostgreSQL + migrations idempotentes + jeton d'installation
scripts/                  db-check, db-test-setup, e2e-server (build prod + port 3100),
                           mark-installed, install-vps.sh, update-vps.sh
tests/unit/               tests Vitest unitaires (39)
tests/integration/        tests Vitest sur base PostgreSQL isolée (51)
tests/e2e/                specs Playwright (installation + journey + persistence)
public/avatars/           8 avatars SVG locaux
public/images/worlds/     5 illustrations de mondes SVG locales
prisma/                   schema + migrations versionnées (4) + seed avatars
docs/                     documentation complète (dont INSTALLATION.md)
```

## Commandes utiles

```bash
docker compose up -d db   # PostgreSQL local (5434)
npm run dev               # développement
npm test                  # Vitest (unitaires + intégration) — JAMAIS en parallèle des E2E
npm run db:test:setup     # provisionner la base de test isolée
npm run db:migrate        # migration dev (génère + applique)
npm run db:generate       # régénérer le client Prisma
npm run db:deploy         # migrations staging/prod
npm run db:check          # vérification persistance PostgreSQL
npm run build && npm run start   # production locale
npx tsx scripts/e2e-server.ts    # serveur E2E (build prod, port 3100) puis Ctrl+C
npx playwright test              # suite E2E (serveur démarré au préalable)
```

## Précautions absolues

- Ne jamais modifier une migration appliquée ; jamais `db push`/`reset`
  en production ; jamais supprimer le volume `pgdata`.
- **L'installateur est verrouillé dès la création du premier
  administrateur** : la ligne `installation` (`status=completed`) est la
  source de vérité. Ne jamais la supprimer en production (cela
  rouvrirait l'assistant) — la migration est non destructive, la
  suppression de ligne est une opération manuelle et dangerous.
- Le CLI Prisma n'est **pas** complet dans l'image applicative par
  défaut : il est installé dans `/app/prisma-cli` (étape `migrator` du
  Dockerfile). `runPrismaMigrations` cherche `/app/prisma-cli` puis le
  dossier du projet.
- Toute page qui interroge la base doit être `force-dynamic` : sinon
  elle est prérendue au build et échoue (ou fige l'état) en Docker
  (observé le 2026-11-13 : prérendu `/enfant/defis` → erreur Prisma au
  build).
- Ne jamais committer `.env` ni de secrets ; ne jamais toucher aux
  autres projets PostgreSQL locaux (ports 5432/5433).
- **Jamais exécuter `npm test` (Vitest) et `npx playwright test` en
  parallèle** : même base de test, la purge Vitest invalide les sessions
  E2E (problème n°8 de KNOWN_ISSUES.md).
- Les scores et récompenses sont calculés **côté serveur** uniquement
  (jamais dans le navigateur) ; la complétion de session est idempotente
  à préserver absolument.
- La réponse attendue d'une question ne quitte **jamais** le serveur.
- Déclarer une fonctionnalité faite **uniquement avec une preuve réelle**
  (test, sortie de commande, vérification manuelle documentée).
- Documenter après chaque intervention : `CURRENT_STATE.md`,
  `FEATURES.md`, `CHANGELOG.md`, et `KNOWN_ISSUES.md` si besoin.

## Prochaines tâches

1. Déploiement réel Coolify (ou Dokploy) dès accès disponible —
   `docs/INSTALLATION.md`.
2. Valider `scripts/install-vps.sh` / `update-vps.sh` sur un VPS réel
   (Debian/Ubuntu) et tester une restauration de sauvegarde.
3. Page de détail d'un monde (contenu pédagogique) — actuellement les
   mondes s'affichent verrouillés/débloqués sans page propre.
4. Scénario E2E créant un retard de révision pour vérifier l'affichage
   des suggestions « À revoir en priorité ».
5. Trophées / boutique d'avatars (Phase 3 restante).
6. Paramètres enfants via `game_settings` côté parent (Phase 4).
7. Analyse RGPD/mineurs (bloquant production).
