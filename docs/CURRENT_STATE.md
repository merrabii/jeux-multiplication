# CURRENT STATE

- **Version** : 0.3.0 (noyau de jeu + gamification + espace parent + E2E réels)
- **Dernière mise à jour** : 2026-11-12

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

## État des environnements

| Élément | État |
|---|---|
| Frontend | Complet enfant (dashboard, apprendre, entraîner, défis, récompenses) + espace parent (profils, stats) |
| Backend | `/api/health`, `/api/game/{start,answer,complete}`, Server Actions auth + enfants |
| PostgreSQL | 18.6 opérationnel (Docker) ; 3 migrations appliquées sur dev et sur la base de test ; aucune donnée de production |
| Dernière migration | `20261112214817_add_game_core` (6 tables de jeu, non destructive) |
| Tests | 67/67 Vitest ; E2E Chromium : parcours complet + persistance après redémarrage serveur + sécurité — **3/3 PASSED** (détails dans TESTING.md) |
| Docker | Image buildée (`docker build` OK) et **vérifiée en conditions réelles** : conteneur démarré sur le réseau compose, `/api/health` → `database: connected`, garde d'accès active |
| Coolify | **Non déployé, non vérifié** (accès indisponible — jamais déclaré déployé sans preuve) |
| GitHub | ✔ Synchronisé sur `merrabii/jeux-multiplication` (`main`) |

## Problèmes connus

Voir [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — notamment : ne **jamais**
exécuter `npm test` et les E2E en même temps (même base de test), RGPD
non analysé (bloquant production), vulnérabilités npm dev-only.

## Prochaine étape recommandée

1. Page /mondes détail (contenu pédagogique de chaque monde) — les
   mondes s'affichent verrouillés/débloqués mais n'ont pas encore de
   page propre.
2. Scénario E2E créant un retard de révision (suggestions « À revoir »
   à l'écran).
3. Trophées / boutique d'avatars (Phase 3).
4. Déploiement Coolify dès que l'accès est disponible (procédure dans
   DEPLOYMENT.md).
