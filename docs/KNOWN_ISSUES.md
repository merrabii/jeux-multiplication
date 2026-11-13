# KNOWN ISSUES

| # | Problème | Impact | Contournement | Statut |
|---|---|---|---|---|
| 1 | 8 vulnérabilités npm « moderate » (minimatch DoS) via `eslint-config-next` → `typescript-eslint` | Outils de développement uniquement ; aucune dépendance runtime affectée | Aucun correctif compatible avec Next 16 pour l'instant ; surveiller les mises à jour d'`eslint-config-next` | Ouvert, surveillé (D9) |
| 2 | ~~Aucune illustration définitive (licornes, dragons, mondes)~~ **Résolu (Plan B)** : la génération d'images externes était indisponible → 8 avatars + 5 mondes en **SVG locaux** (`public/avatars/`, `public/images/worlds/`), vérifiés chargés en E2E (`naturalWidth > 0`) | Identité visuelle simplifiée mais réelle, sans droits ni dépendances externes | — | Résolu (illustrations vectorielles) |
| 3 | `npm audit fix --force` proposé casse Next 16 (retrograde eslint-config-next) | — | Ne pas exécuter `--force` | Documenté (D9) |
| 4 | Le pool pg de l'adapter n'a pas de timeout par défaut | Connexions potentiellement longues en cas de lenteur base | À configurer si nécessaire (docs adapter pg) | À surveiller en Phase 2 |
| 5 | Pseudonyme : unicité non garantie entre profils du même parent | Deux profils peuvent porter le même pseudonyme | Acceptable pour le produit (les profils sont distingués par l'avatar/le parent) ; unicité à trancher en Phase 4 | Décision à prendre |
| 6 | Déploiement Coolify non vérifié (accès indisponible) | État de déploiement inconnu | Procédure documentée dans DEPLOYMENT.md ; image Docker à construire/tester localement d'abord | En attente d'accès |
| 7 | Conformité juridique (RGPD / mineurs) non analysée | Obligatoire avant production réelle | Analyse spécialisée à mener | Bloquant pour la production |
| 8 | **Ne jamais exécuter `npm test` et les E2E simultanément** : les deux partagent la base `jeux_multiplication_test` et le domaine `@auth-test.example` ; la purge Vitest supprime le compte E2E en cours de session (échec observé le 2026-11-12 : 307 vers `/parent/connexion` en pleine session) | Faux négatifs E2E | Séquencer : Vitest d'abord, puis E2E (documenté dans TESTING.md) | Documenté — règle d'exploitation |
| 9 | `next dev` (HMR Turbopack) annule aléatoirement des navigations pendant les tests navigateur (« Navigation interrupted », pages vides) | Tests E2E instables en dev | Les E2E tournent contre un **build de production** standalone (`scripts/e2e-server.ts`) — problème éliminé | Résolu par le choix d'infra E2E |
