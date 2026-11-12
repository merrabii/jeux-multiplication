# KNOWN ISSUES

| # | Problème | Impact | Contournement | Statut |
|---|---|---|---|---|
| 1 | 8 vulnérabilités npm « moderate » (minimatch DoS) via `eslint-config-next` → `typescript-eslint` | Outils de développement uniquement ; aucune dépendance runtime affectée | Aucun correctif compatible avec Next 16 pour l'instant ; surveiller les mises à jour d'`eslint-config-next` | Ouvert, surveillé (D9) |
| 2 | Aucune illustration définitive (licornes, dragons, mondes) | Identité visuelle incomplète | Emojis + décor CSS, documenté comme provisoire | Ouvert — ressources à créer en Phase 2/3 |
| 3 | `npm audit fix --force` proposé casse Next 16 (retrograde eslint-config-next) | — | Ne pas exécuter `--force` | Documenté (D9) |
| 4 | Le pool pg de l'adapter n'a pas de timeout par défaut | Connexions potentiellement longues en cas de lenteur base | À configurer si nécessaire (docs adapter pg) | À surveiller en Phase 2 |
| 5 | Pseudonyme : unicité non garantie entre profils du même parent | Deux profils peuvent porter le même pseudonyme | Acceptable pour le produit (les profils sont distingués par l'avatar/le parent) ; unicité à trancher en Phase 2 | Décision à prendre |
| 6 | ~~Déploiement Coolify non vérifié (accès indisponible)~~ | État de déploiement inconnu | Procédure documentée dans DEPLOYMENT.md | En attente d'accès |
| 6bis | ~~Push bloqué (403) sur l'ancien dépôt~~ **Résolu 2026-11-12** : dépôt officiel corrigé vers `merrabii/jeux-multiplication`, push réussi (`main` = `cad8393`) | — | — | Résolu |
| 7 | Conformité juridique (RGPD / mineurs) non analysée | Obligatoire avant production réelle | Analyse spécialisée à mener | Bloquant pour la production |
