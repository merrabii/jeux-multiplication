# TESTING

## Niveaux

| Niveau | Outil | État |
|---|---|---|
| Unitaires (logique métier pure) | Vitest 5.1.0 | **Actif** — `tests/unit/**` |
| Intégration (services + PostgreSQL de test isolé) | Vitest + `TEST_DATABASE_URL` | **Actif** — `tests/integration/**` |
| E2E (parcours réels, navigateur Chromium) | Playwright 1.65 | **Actif** — `tests/e2e/**`, serveur build de production port 3100 |

## Commandes

```bash
npm run db:test:setup   # provisionne la base de test isolée (migrations + seed avatars)
npm test                # tous les tests Vitest (unitaires + intégration)
npm run test:watch      # mode watch
npm run db:check        # intégration : persistance PostgreSQL de bout en bout
npm run db:backup       # sauvegarde PostgreSQL → backups/backup-<date>.sql
npm run db:restore -- backups/backup-<date>.sql   # restauration (RESTORE_CONFIRM=1)
npm run build           # vérifie la compilation TypeScript complète
npx tsx scripts/e2e-server.ts   # serveur E2E (build prod, port 3100) — Ctrl+C pour arrêter
npx playwright test             # suite E2E (le serveur doit être démarré)
```

Variables d'environnement utiles pour les E2E : `E2E_BASE_URL`
(serveur ciblé, défaut `http://localhost:3100`), `INSTALL_TOKEN`
(déclenche l'étape « jeton d'installation » dans le parcours),
`TEST_DATABASE_URL` (base purgée par le spec d'installation).

**⚠️ Règle d'exploitation : ne jamais exécuter `npm test` (Vitest) et
`npx playwright test` en même temps.** Les deux utilisent la même base
`jeux_multiplication_test` et le même domaine de données
`@auth-test.example` : la purge Vitest supprimerait le compte E2E en
cours de session (échec observé le 2026-11-12).

Les tests d'intégration utilisent **exclusivement** `TEST_DATABASE_URL`
(base `jeux_multiplication_test`) — jamais la base de développement ni la
production. Leurs données portent le domaine `@auth-test.example`
(`@installer-test.example` pour l'installateur, non purgé par les autres
fichiers) et sont purgées avant et après exécution.

## Couverture réelle (90 tests Vitest, tous passés le 2026-11-13)

### Unitaires (28 + 11 = 39)
- `tests/unit/features/multiplication/engine.test.ts` (10) : génération des
  questions, déterminisme par graine, restriction aux tables demandées,
  QCM contient toujours la bonne réponse (4 choix uniques), difficulté
  EASY, erreurs de tables invalides, count=0.
- `tests/unit/features/multiplication/tables.test.ts` (8) : 10 tables
  présentes, `multiply`, addition répétée (3×4 = « 4 + 4 + 4 »), thèmes
  complets.
- `tests/unit/lib/auth/password.test.ts` (5) : bcrypt hachage ≠ clair,
  salage unique, vérification valide, rejet incorrect, comparaison factice.
- `tests/unit/lib/auth/session-token.test.ts` (5) : JWT valide, expiré,
  falsifié, forgé avec autre clé, charge utile incomplète.
- `tests/unit/features/installer/token.test.ts` (5) : jeton d'installation
  (exigence, comparaison exacte, trim, longueurs différentes rejetées sans
  exception), jeton de récupération (désactivé sans variable, comparaison
  à temps constant).
- `tests/unit/features/installer/schemas.test.ts` (11) : Zod de l'assistant
  — configuration (nom trop court, URL mal formée vs vide), base externe
  (port hors bornes, sslMode inconnu), administrateur (confirmation,
  longueur minimale, e-mail normalisé), jeton vide.

### Intégration (39 + 12 = 51, sur `jeux_multiplication_test`)
- `tests/integration/features/auth/service.test.ts` (20) : les 18
  scénarios d'authentification exigés : inscription (réelle, doublon,
  doublon par casse, champs invalides, course concurrente P2002),
  connexion (réussie, mot de passe faux, compte inconnu générique),
  limitation (blocage après 5 échecs, expiration, comptage insensible à
  la casse, réinitialisation après succès), sessions (création/validité,
  révocation, jeton copié rendu inutilisable, expiration, falsification,
  accès sans session, isolation stricte entre comptes).
- `tests/integration/features/children/service.test.ts` (7) : création
  avec avatar seedé et paramètres par défaut, pseudonyme/avatar invalides,
  isolation inter-parents (lecture + modification refusées), mise à
  jour, suppression logique (données conservées), limite 6 profils,
  comptage des profils actifs.
- `tests/integration/features/children/stats.test.ts` (2) : agrégats
  réels après un défi (réussite 75 %, XP, badges) + refus d'un enfant
  d'un autre parent.
- `tests/integration/features/game/service.test.ts` (10) : boucle de jeu
  serveur — session créée **sans réponses exposées**, entrées invalides
  rejetées, `isCorrect` recalculé (a×b) pour bonne/mauvaise réponse,
  question d'une autre session/enfant refusée, récompenses attribuées
  **une seule fois malgré un double appel** (idempotence), progression
  par table + maîtrise mises à jour, leçon marquée validée ; règles
  reward/répétition espacée testées en même fichier (paliers de maîtrise
  plafonnés au niveau 3, intervalles croissants, calcul LESSON/PRACTICE/
  CHALLENGE).

- `tests/integration/features/installer/installer.test.ts` (7) : scénarios
  de la mission — statut sans ligne + cohérence du garde, mode hérité
  (utilisateur existant → assistant jamais proposé), création du premier
  administrateur (rôle admin, bcrypt, verrou `completed`, `adminUserId`),
  refus quand un admin existe, anti-abus (5 échecs → blocage 15 min),
  **atomicité de deux créations simultanées** (exactement un `created`,
  un seul admin en base), configuration `app_config` sauvegardée/relue.

### E2E — Playwright Chromium (contre build de production, base de test)
- `tests/e2e/installation.spec.ts` — **PASSED (3/3)** : purge SQL directe
  (installation + utilisateurs) → `/` redirige vers `/installation` →
  parcours complet des 6 étapes dans le navigateur (vérifications
  d'environnement réelles, configuration, mode base automatique,
  **initialisation réelle** (migrations + avatars), création du premier
  administrateur) → page de réussite → connexion de l'administrateur
  créé → **verrouillage** (`/installation` → redirection connexion).
- `tests/e2e/journey.spec.ts` — **PASSED** : inscription parent → création
  profil enfant + avatar (SVG chargé, `naturalWidth > 0`) → dashboard →
  leçon table 2 (8 questions réussies via l'UI, validation serveur) →
  défi 5 questions parfait (+15 ⭐, +75 XP affichés) → entraînement libre
  table 3 (10 questions : 9 bonnes + 1 erreur volontaire ; bilan 90 %,
  +4 ⭐, +90 XP) → étoiles ≥ 34 après rechargement → badge « Défi
  parfait » → stats parent (« Sessions : 3 ») → responsive 375×812.
- `tests/e2e/persistence.spec.ts` — **PASSED (2/2)** après **redémarrage
  réel du processus serveur** : cookies session/enfant valides, niveau 2,
  30 ⭐, 6 🪙, 1 💎, « 1/10 leçons validées », « Validée ✓ » sur
  /enfant/apprendre, stats parent intactes ; + sécurité : contexte sans
  cookies → redirection vers l'espace parent.
- Données revérifiées indépendamment en SQL direct (`psql` sur
  `jeux_multiplication_test`) : `child_progress` table 2 →
  `lessonsCompleted=1`, `correctCount=8` ; ligne `installation` →
  `status=completed` après l'assistant, verrou actif.

### Docker — installation neuve vérifiée
- Image `jeux-multiplication:installer-check` (build avec entrypoint) ;
  conteneur applicatif + conteneur PostgreSQL **jetables** dédiés au
  test (le volume de dev n'est jamais touché) : entrypoint → attente
  PostgreSQL → `prisma migrate deploy` → jeton d'installation imprimé
  dans les journaux → `/` 307 vers `/installation` → assistant 200 →
  `/api/health` `database: connected`.

### Vérifications système
- `npm run db:check` : transaction (user + profil + settings), relecture,
  suppression en cascade — exécuté avec succès contre PostgreSQL 18.6.
- Sauvegarde/restauration (2026-11-14) : `npm run db:backup` (pg_dump du
  conteneur) puis suppression volontaire de 2 lignes (`app_config`,
  `installation`) et `npm run db:restore -- <fichier>` → relecture SQL :
  données et verrou retrouvés, 4 migrations appliquées cohérentes.
- Protection des routes vérifiée par curl sur le serveur standalone :
  sans session → 307 `/parent/connexion` ; jeton valide → 200 ;
  jeton révoqué → 307.
- `npm run db:test:setup` : création de `jeux_multiplication_test` +
  application des 4 migrations + seed avatars (vérifié).

## Conventions

- La logique métier vit dans `features/` en pur TypeScript : toujours
  testable sans React ni base de données.
- Graine (`seed`) supportée par le moteur pour des tests déterministes.
- Les résultats de tests ne sont **jamais** inventés : chaque statut
  TESTED de [FEATURES.md](FEATURES.md) cite sa preuve.
- Les E2E tournent contre un **build de production** standalone :
  l'environnement dev (HMR Turbopack) annule aléatoirement des
  navigations et rend les tests instables (problème observé puis éliminé
  le 2026-11-12).

## Non exécuté (honnêteté)

- Déploiements réels Coolify / Dokploy / Vercel / Netlify (aucun accès
  disponible) : configurations prêtes et procédures écrites, statuts
  « compatible par architecture », jamais « déployé ».
- Déploiement VPS réel (aucun serveur disponible) : scripts
  `install-vps.sh` / `update-vps.sh` vérifiés syntaxiquement
  (`bash -n`) mais non exécutés sur une machine réelle.

- E2E de la page de détail d'un monde (les mondes s'affichent
  verrouillés/débloqués sur le dashboard mais n'ont pas de page propre).
- Affichage des suggestions « À revoir en priorité » à l'écran : le
  mécanisme est testé en intégration et le mode entraînement est joué en
  E2E, mais aucun scénario ne crée volontairement un retard de révision
  pour faire apparaître la suggestion dans le navigateur.
- Audit d'accessibilité automatisé (à ajouter en Phase 6).
- Vérification du cookie `Secure` derrière HTTPS réel (nécessite
  Coolify ; activé conditionnellement si NODE_ENV=production).
- Test de restauration de sauvegarde PostgreSQL.
