# DECISIONS

Journal des décisions techniques importantes (problème → options → choix →
conséquences).

## D1 — Prisma 7 (stable) plutôt que Prisma 8

- **Date** : 2026-11-12
- **Problème** : `npm latest` de Prisma pointe vers `8.0.0-rc.33`.
- **Options** : Prisma 8 RC (nouvelles API : contract, `db sign`) / Prisma 7.
- **Choix** : **Prisma 7.10.1** — dernière version stable, pleinement
  supportée ; une RC est interdite pour un produit en production.
- **Conséquences** : schéma `schema.prisma` classique, generator
  `prisma-client` avec `output` obligatoire, driver adapter
  (`@prisma/adapter-pg`), `prisma.config.ts` avec dotenv. Migration vers 8
  plus tard, une fois stable, via le guide officiel.
- **Alternatives rejetées** : rester sur Prisma 6 (2 majeurs de retard).

## D2 — Driver adapter pg (Rust-free) sur Node 22 Alpine

- **Problème** : images Docker légères sans engine Rust Prisma.
- **Choix** : `@prisma/adapter-pg` (JavaScript pur) + `node:22-alpine`.
- **Conséquences** : build Docker simple ; pool de connexions géré par pg
  (pas de timeout par défaut — à surveiller si lenteurs).

## D3 — `output: standalone` et script `start`

- **Problème** : `next start` est incompatible avec standalone (Next 16).
- **Choix** : `output: "standalone"` + `"start": "node .next/standalone/server.js"`.
- **Conséquences** : image Docker minimale ; en local, tester en production
  après copie de `.next/static` dans `.next/standalone/.next/static`.

## D4 — `cacheComponents` désactivé (Next 16)

- **Problème** : application quasi entièrement personnalisée par profil
  enfant (données dynamiques) ; le nouveau paradigme de cache explicite
  ajouterait des frontières `Suspense`/`use cache` partout sans bénéfice
  réel à ce stade.
- **Choix** : désactivé pour l'instant ; à réévaluer en Phase 6 (perf).
- **Conséquences** : modèle de rendu classique et bien documenté.

## D5 — PostgreSQL 18 avec nouveau layout de volume

- **Problème** : `postgres:18-alpine` refuse le volume sur
  `/var/lib/postgresql/data` (nouveau layout `pg_ctlcluster`).
- **Choix** : volume monté sur `/var/lib/postgresql`.
- **Conséquences** : compatible pg_upgrade futur ; volume jamais supprimé.

## D6 — Port 5434 en développement local

- **Problème** : 5432 et 5433 déjà utilisés par d'autres projets locaux.
- **Choix** : bind `127.0.0.1:5434`. Aucun autre service modifié.
- **Conséquences** : `DATABASE_URL` local pointe sur 5434.

## D7 — Colonnes PostgreSQL en camelCase non mappées

- **Problème** : style de nommage des colonnes.
- **Choix** : tables snake_case (`@@map`), colonnes camelCase par défaut.
- **Conséquences** : moins de verbosité dans le schéma ; cohérence à
  maintenir ; à ne pas confondre avec un style SQL « brut ».

## D8 — Emojis comme illustrations provisoires

- **Problème** : aucune illustration définitive disponible.
- **Choix** : emojis + décor CSS, clairement documentés comme provisoires
  dans [UI_DESIGN.md](UI_DESIGN.md).
- **Conséquences** : identité visuelle à compléter en Phase 2/3 ; aucune
  image générique ne sera présentée comme définitive.

## D9 — npm audit : vulnérabilités dev-only acceptées

- **Problème** : 8 vulnérabilités modérées (minimatch/DoS) via
  `eslint-config-next` → `typescript-eslint`.
- **Choix** : conservées (chaîne d'outils de développement uniquement, non
  présente dans le bundle runtime). Le `--force` proposé rétrograderait
  `eslint-config-next` et casserait Next 16.
- **Suivi** : [KNOWN_ISSUES.md](KNOWN_ISSUES.md) ; à réévaluer à chaque
  mise à jour de dépendances.
