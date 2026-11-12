# TESTING

## Niveaux

| Niveau | Outil | État |
|---|---|---|
| Unitaires (logique métier pure) | Vitest 5.1.0 | **Actif** — `tests/unit/**` |
| Intégration (API + PostgreSQL) | Vitest + base de test | Phase 2 |
| E2E (parcours réels) | Playwright | Phase 6 |

## Commandes

```bash
npm test           # tous les tests unitaires (run unique)
npm run test:watch # mode watch
npm run db:check   # intégration : persistance PostgreSQL de bout en bout
npm run build      # vérifie la compilation TypeScript complète
```

## Couverture réelle (18 tests, tous passés le 2026-11-12)

- `tests/unit/features/multiplication/engine.test.ts` (9) : génération des
  questions, déterminisme par graine, restriction aux tables demandées,
  QCM contient toujours la bonne réponse (4 choix uniques), difficulté
  EASY, erreurs de tables invalides, count=0.
- `tests/unit/features/multiplication/tables.test.ts` (4) : 10 tables
  présentes, `multiply`, addition répétée (3×4 = « 4 + 4 + 4 »), thèmes
  complets.
- `tests/unit/lib/validation/schemas.test.ts` (5) : Zod valeurs par
  défaut, rejet hors bornes, pseudonyme enfant (longueur, caractères,
  minimisation des données).
- `npm run db:check` : transaction (user + profil + settings), relecture,
  suppression en cascade — exécuté avec succès contre PostgreSQL 18.6.

## Conventions

- La logique métier vit dans `features/` en pur TypeScript : toujours
  testable sans React ni base de données.
- Graine (`seed`) supportée par le moteur pour des tests déterministes.
- Les résultats de tests ne sont **jamais** inventés : chaque statut
  TESTED de [FEATURES.md](FEATURES.md) cite sa preuve.

## Non exécuté (honnêteté)

- Tests E2E (Playwright non encore installé).
- Tests d'intégration automatisés HTTP (le healthcheck a été vérifié
  manuellement : `{"status":"ok","database":"connected"}` + 200 sur
  `/`, `/enfant`, `/parent`).
- Audit d'accessibilité automatisé et tests responsive (Phase 6).
