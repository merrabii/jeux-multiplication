# CURRENT STATE

- **Version** : 0.4.0 (application installable — assistant d'installation web + déploiements multi-plateformes)
- **Dernière mise à jour** : 2026-11-13

## Architecture actuelle

- Next.js 16.4.6 (App Router, TypeScript strict, Turbopack) — `app/` à la racine,
  sortie standalone (`npm run start`).
- Tailwind CSS 4 + design system magique (`app/globals.css`).
- Prisma ORM 7.10.1 + `@prisma/adapter-pg` (Rust-free) — client singleton
  dans `lib/database/client.ts`, généré dans `lib/database/generated`.
- PostgreSQL 18.6 via Docker (`docker-compose.yml`, port local 5434) ;
  base de test isolée `jeux_multiplication_test`.
- Vitest 5.1.0 ; Playwright 1.65 (Chromium) ; Zod 4.6.7.

## Fonctionnalités terminées (avec preuve)

- **Authentification parent** : inscription, connexion, déconnexion,
  sessions révocables (JWT HS256 + table `sessions`), limitation des
  tentatives persistée PostgreSQL, CSRF Server Actions.
- **Profils enfants** : création (≤ 6), mise à jour, suppression logique,
  cookie de sélection `rmm_child`, garde serveur à chaque requête,
  8 avatars SVG locaux.
- **Noyau de jeu serveur** : `features/game/service.ts` (LESSON /
  PRACTICE / CHALLENGE), réponses attendues jamais côté client,
  complétion idempotente, récompenses serveur (étoiles/XP/pièces/gemmes),
  badges, maîtrise par multiplication, répétition espacée (1 h/24 h/72 h).
- **Interface enfant** : dashboard (mission du jour, 5 mondes magiques
  débloqués par leçons), leçons visuelles (addition répétée),
  entraînement libre + suggestions de révision, défis, page récompenses.
- **Espace parent** : gestion des profils + panneau de statistiques
  pédagogiques PostgreSQL (réussite par table, tables à réviser < 70 %,
  badges, 7 derniers jours).
- **Infrastructure** : Dockerfile multi-stage standalone + compose
  (healthchecks, volume persistant) ; `.dockerignore` exclut tests/docs/
  secrets ; E2E lancés contre le build de production (port 3100).
- **Assistant d'installation web** (`/installation`, v0.4.0) : 6 étapes
  (environnement → application → base de données → initialisation
  réelle → premier administrateur → réussite), verrouillé définitivement
  après la création de l'administrateur, protection par jeton
  `INSTALL_TOKEN`, mode hérité (jamais proposé sur une base déjà
  utilisée). Récupération administrateur sécurisée sur
  `/recuperation-admin` (jeton `ADMIN_RECOVERY_TOKEN`).

## État des environnements

| Élément | État |
|---|---|
| Frontend | Complet enfant (dashboard, apprendre, entraîner, défis, récompenses) + espace parent (profils, stats) + assistant d'installation |
| Backend | `/api/health`, `/api/game/{start,answer,complete}`, Server Actions auth + enfants + installateur |
| PostgreSQL | 18.6 opérationnel (Docker) ; 4 migrations appliquées sur dev et sur la base de test ; aucune donnée de production |
| Dernière migration | `20261113011956_add_installation` (tables `installation` + `app_config`, non destructive) |
| Tests | 90/90 Vitest (dont 12 installateur) ; E2E Chromium **6/6 PASSED** : installation complète (assistant 6 étapes + verrouillage + connexion admin), parcours de jeu complet, persistance après redémarrage, sécurité (détails dans TESTING.md) |
| Docker | Image buildée + entrypoint (`docker/entrypoint.sh`) : attente PostgreSQL, migrations idempotentes, jeton d'installation dans les journaux |
| Coolify / Dokploy / Vercel / Netlify | **Configurations et procédures prêtes** (`docs/INSTALLATION.md`, `netlify.toml`) — non déployées réellement (aucun accès) |
| GitHub | ✔ Synchronisé sur `merrabii/jeux-multiplication` (`main`) |

## Problèmes connus

Voir [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — notamment : ne **jamais**
exécuter `npm test` et les E2E en même temps (même base de test), RGPD
non analysé (bloquant production), vulnérabilités npm dev-only.

## Prochaine étape recommandée

1. Déploiement réel sur Coolify (ou Dokploy) dès l'accès disponible —
   procédure complète dans `docs/INSTALLATION.md`.
2. Page /mondes détail (contenu pédagogique de chaque monde).
2. Scénario E2E créant un retard de révision (suggestions « À revoir »
   à l'écran).
3. Trophées / boutique d'avatars (Phase 3).
4. Déploiement Coolify dès que l'accès est disponible (procédure dans
   DEPLOYMENT.md).
