# TESTING

## Niveaux

| Niveau | Outil | État |
|---|---|---|
| Unitaires (logique métier pure) | Vitest 5.1.0 | **Actif** — `tests/unit/**` |
| Intégration (services + PostgreSQL de test isolé) | Vitest + `TEST_DATABASE_URL` | **Actif** — `tests/integration/**` |
| E2E (parcours réels) | Playwright | Phase 6 |

## Commandes

```bash
npm run db:test:setup # provisionne la base de test isolée (migrations)
npm test              # tous les tests (unitaires + intégration)
npm run test:watch    # mode watch
npm run db:check      # intégration : persistance PostgreSQL de bout en bout
npm run build         # vérifie la compilation TypeScript complète
```

Les tests d'intégration utilisent **exclusivement** `TEST_DATABASE_URL`
(base `jeux_multiplication_test`) — jamais la base de développement ni la
production. Leurs données portent le domaine `@auth-test.example` et sont
purgées avant et après exécution.

## Couverture réelle (48 tests, tous passés le 2026-11-12)

### Unitaires (28)
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
- `tests/unit/lib/auth/password.test.ts` (5) : bcrypt hachage ≠ clair,
  salage unique, vérification valide, rejet incorrect, comparaison factice.
- `tests/unit/lib/auth/session-token.test.ts` (5) : JWT valide, expiré,
  falsifié, forgé avec autre clé, charge utile incomplète.

### Intégration (20, sur `jeux_multiplication_test`)
- `tests/integration/features/auth/service.test.ts` couvre les 18
  scénarios d'authentification exigés : inscription (réelle, doublon,
  doublon par casse, champs invalides, course concurrente P2002),
  connexion (réussie, mot de passe faux, compte inconnu générique),
  limitation (blocage après 5 échecs, expiration, comptage insensible à
  la casse, réinitialisation après succès), sessions (création/validité,
  révocation, jeton copié rendu inutilisable, expiration, falsification,
  accès sans session, isolation stricte entre comptes).

### Vérifications système
- `npm run db:check` : transaction (user + profil + settings), relecture,
  suppression en cascade — exécuté avec succès contre PostgreSQL 18.6.
- Protection des routes vérifiée par curl sur le serveur standalone :
  sans session → 307 `/parent/connexion` ; jeton valide → 200 ;
  jeton révoqué → 307.
- `npm run db:test:setup` : création de `jeux_multiplication_test` +
  application des 2 migrations (vérifié).

## Conventions

- La logique métier vit dans `features/` en pur TypeScript : toujours
  testable sans React ni base de données.
- Graine (`seed`) supportée par le moteur pour des tests déterministes.
- Les résultats de tests ne sont **jamais** inventés : chaque statut
  TESTED de [FEATURES.md](FEATURES.md) cite sa preuve.

## Non exécuté (honnêteté)

- Tests E2E de bout en bout via navigateur (Playwright non installé) :
  le parcours complet du **formulaire** (clic → soumission → redirection)
  n'a pas été automatisé ; la logique métier est testée par les tests
  d'intégration et la protection des routes a été vérifiée manuellement
  avec curl.
- Audit d'accessibilité automatisé et tests responsive (Phase 6).
- Vérification du cookie `Secure` derrière HTTPS réel (nécessite
  Coolify ; activé conditionnellement si NODE_ENV=production).
