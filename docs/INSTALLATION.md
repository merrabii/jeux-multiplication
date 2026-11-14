# INSTALLATION

Guide complet d'installation de l'application sur toutes les
plateformes prises en charge. Le premier démarrage ouvre
**automatiquement un assistant d'installation dans le navigateur**
(`/installation`) : vérification de l'environnement, configuration,
base de données, migrations, premier administrateur.

---

## 1. Vue d'ensemble

| Plateforme | Méthode | Base de données |
|---|---|---|
| Docker Compose (VPS ou local) | `docker compose up -d --build` | PostgreSQL incluse (volume persistant) |
| Coolify | Déploiement GitHub | PostgreSQL incluse (ressource Coolify) |
| Dokploy | Compose GitHub | PostgreSQL incluse (volume persistant) |
| VPS sans panneau | `scripts/install-vps.sh` | PostgreSQL incluse |
| Vercel / Netlify | Déploiement Git | **PostgreSQL externe obligatoire** |

Après l'installation, toute la gestion courante est couverte ici :
mise à jour, sauvegarde/restauration, récupération administrateur.

---

## 2. Installation Docker Compose (recommandée)

```bash
git clone https://github.com/merrabii/jeux-multiplication.git
cd jeux-multiplication
cp .env.example .env
# Éditer .env : AUTH_SECRET (obligatoire, 32+ caractères) et
# POSTGRES_PASSWORD. Génération :
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
docker compose up -d --build
```

- PostgreSQL n'est **jamais exposé** sur Internet (réseau interne
  compose ; en local : bind 127.0.0.1).
- Le volume `pgdata` est **persistant** : les données survivent aux
  recréations de conteneurs. Ne jamais le supprimer.
- Au démarrage, `docker/entrypoint.sh` attend PostgreSQL puis applique
  les migrations versionnées (`prisma migrate deploy`, idempotent,
  **jamais destructif**).
- Si `INSTALL_TOKEN` n'est pas défini, le conteneur génère un jeton
  d'installation et l'imprime dans ses journaux :

```bash
docker compose logs app | grep -A2 "Jeton d"
```

Ouvrez ensuite `http://<hôte>:3000` : l'assistant s'affiche.

---

## 3. L'assistant d'installation (navigateur)

Six étapes, en français, responsives :

1. **Environnement** — version de l'application, Node.js, présence de
   `DATABASE_URL` (valeur jamais affichée), connexion PostgreSQL,
   migrations, tables, permissions, données de référence, stockage.
   Chaque erreur affiche une solution. « Revérifier » recharge les
   vérifications.
2. **Application** — nom, URL principale, langue, fuseau horaire,
   organisation (facultatif). Stockés en base (`app_config`), jamais de
   secret à cet endroit.
3. **Base de données** — mode *automatique* (Docker/Coolify/Dokploy :
   utilise `DATABASE_URL`) ou *externe* (hôte, port, base, utilisateur,
   mot de passe, SSL) avec un bouton **« Tester la connexion »** qui
   valide réellement côté serveur. La base est créée automatiquement
   si l'utilisateur dispose du droit CREATEDB ; sinon le diagnostic
   explique quoi faire. **Aucun mot de passe n'est stocké, affiché ou
   journalisé** : la connexion réelle de l'application reste définie
   par `DATABASE_URL`.
4. **Initialisation** — progression **réelle**, étape par étape :
   connexion, `prisma migrate deploy` (idempotent), vérification des
   tables, insertion des avatars (upsert), enregistrement. En cas
   d'échec, l'erreur est explicite, la configuration reste corrigeable
   et **aucune donnée n'est supprimée**.
5. **Administrateur** — pseudonyme, e-mail, mot de passe (8+
   caractères, haché bcrypt). Création **atomique** (`SELECT FOR
   UPDATE`) : deux soumissions simultanées ne peuvent jamais créer
   deux administrateurs. C'est le **véritable** compte administrateur
   (rôle `admin` du système d'authentification existant). Pas de mot
   de passe par défaut. Blocage anti-abus après 5 échecs (15 min).
6. **Terminé** — bouton « Accéder à l'application » vers la connexion.

### Verrouillage définitif

Dès la création de l'administrateur, la table `installation` passe en
`completed` : l'assistant est **fermé définitivement**. Toute visite de
`/installation` redirige vers la connexion. Aucune URL, aucun appel
d'API ne permet de recréer un administrateur initial.

### Compatibilité avec les installations existantes

Si l'application est déjà utilisée (comptes ou profils enfants
existants, bases de développement), l'assistant n'est **jamais
proposé** — les pages normales s'affichent (mode hérité).

### Jeton d'installation (serveur exposé publiquement)

Pour protéger l'assistant avant la fin de la procédure, définissez
`INSTALL_TOKEN` (variable d'environnement). En Docker, s'il est vide,
le conteneur en génère un au démarrage et l'imprime dans ses journaux
(visible uniquement de l'administrateur du serveur). Le navigateur le
demande en première étape ; la validation pose un cookie signé
(httpOnly, 24 h).

---

## 4. Coolify

1. **+ New Resource → Deploy from GitHub** → `merrabii/jeux-multiplication`, branche `main`.
2. **Build** : Pack Docker (Dockerfile inclus). Build command : rien à
   ajouter. Start command : rien à ajouter (entrypoint gère les
   migrations). Port : **3000**.
3. **PostgreSQL** : ajoutez une ressource *PostgreSQL* dans le même
   projet (Coolify gère son volume). **Jamais exposée sur Internet.**
4. **Variables d'environnement** (application) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `postgresql://jeux_user:<mot-de-passe>@<service-postgres>:5432/jeux_multiplication` (hôte = nom du service Coolify) |
| `AUTH_SECRET` | 48 octets hexadécimaux |
| `INSTALL_TOKEN` | vide (génération + journaux) ou valeur choisie |
| `ADMIN_RECOVERY_TOKEN` | jeton de récupération (voir §8) |

5. **Healthcheck** : chemin `/api/health` (retourne `database:
   connected`). 
6. **Domaine** : configurez le domaine + HTTPS (Let's Encrypt intégré).
7. **Déployer**. Le premier démarrage applique les migrations ; ouvrez
   le domaine → assistant d'installation.

> Les données Coolify PostgreSQL survivent aux redéploiements (volume
> géré par Coolify). Ne supprimez jamais la ressource PostgreSQL pour
> « repartir de zéro » : cela effacerait les comptes et la progression.

---

## 5. Dokploy

Utilisez le **Docker Compose** fourni (`docker-compose.yml`) :

1. **+ Create Service → Docker Compose** → dépôt GitHub, branche `main`.
2. Dokploy respecte services, réseau interne, volume `pgdata` et
   healthchecks du fichier.
3. Variables d'environnement : définissez `AUTH_SECRET`
   (obligatoire) ; `POSTGRES_PASSWORD` fort ; `INSTALL_TOKEN` vide.
4. Domaine + HTTPS via l'onglet Domain de Dokploy (port 3000).
5. Les redéploiements conservent le volume `pgdata` : ne modifiez pas
   le nom du volume ni du projet.

---

## 6. VPS sans panneau (scripts)

Distributions vérifiées : **Debian 12+, Ubuntu 22.04+** (autres :
installez Docker manuellement puis relancez).

```bash
git clone https://github.com/merrabii/jeux-multiplication.git /opt/jeux-multiplication
cd /opt/jeux-multiplication
sudo bash scripts/install-vps.sh
```

Le script : installe Docker si absent, génère des secrets
cryptographiquement sûrs **sans jamais écraser** ceux qui existent,
crée `.env`, démarre les services, attend PostgreSQL, vérifie
`/api/health` et affiche l'URL à ouvrir.

**Mise à jour** (conserve toutes les données) :

```bash
sudo bash scripts/update-vps.sh
```

Elle sauvegarde la base **avant** de mettre à jour, récupère la
nouvelle version, reconstruit, applique les migrations (idempotentes)
et vérifie le healthcheck. En cas d'échec, la commande de rollback est
affichée.

---

## 7. Vercel et Netlify (serverless)

**Base PostgreSQL externe obligatoire** (Neon, Supabase, RDS…). Jamais
de base locale ni de fichier éphémère.

### Configuration commune

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | URL de la base externe (directe, **pas** pgbouncer, pour les migrations) |
| `AUTH_SECRET` | 48 octets hexadécimaux |
| `PGPOOL_MAX` | `3` (pool adapté au serverless) |
| `ADMIN_RECOVERY_TOKEN` | jeton de récupération |

### Vercel

1. Importez le dépôt GitHub. Next.js est détecté automatiquement.
2. Variables d'environnement (Production) : celles du tableau.
3. **Migrations** : ajoutez une commande de build :
   `npx prisma generate && npx prisma migrate deploy && npm run build`
   (étape de déploiement contrôlée — jamais à chaque requête).
4. Les Server Actions, sessions JWT et PostgreSQL fonctionnent en
   fonctions serverless. Le seed des avatars est exécuté par
   l'assistant d'installation (ou `npx prisma db seed` une fois).

### Netlify

`netlify.toml` est fourni (build : generate + migrate deploy + build).
Configurez les variables dans *Site settings → Environment*. Statut
honnête : **build vérifié par architecture** ; un déploiement réel
n'a pas été effectué par l'équipe (pas de compte) — les Server
Actions Next 16 sont supportées par le runtime Netlify, mais testez le
parcours complet après votre premier déploiement.

---

## 8. Récupération d'un accès administrateur

Page dédiée `/recuperation-admin` (distincte de l'installation) :

- disponible **uniquement** si la variable
  `ADMIN_RECOVERY_TOKEN` est définie sur le serveur ;
- exige le jeton, l'e-mail administrateur et un nouveau mot de passe
  (haché bcrypt) ;
- **révoque toutes les sessions** actives du compte ;
- limitée à 3 tentatives/heure/instance ; comparaison du jeton à temps
  constant.

Procédure : définissez `ADMIN_RECOVERY_TOKEN` (48 octets hex) dans
l'environnement, redémarrez l'application, ouvrez
`/recuperation-admin`, saisissez le jeton + e-mail + nouveau mot de
passe, puis **retirez la variable** après usage.

---

## 9. Sauvegarde et restauration PostgreSQL

**Commandes du projet** (Docker) :

```bash
npm run db:backup                                   # → backups/backup-<date>.sql
RESTORE_CONFIRM=1 npm run db:restore -- backups/backup-....sql
```

`db:backup` utilise `pg_dump` du conteneur PostgreSQL (dump rejouable :
`--clean --if-exists`). `db:restore` exige une confirmation explicite
(`RESTORE_CONFIRM=1`) et n'est **jamais** exécuté automatiquement ; il
n'efface rien de lui-même (seules les tables du dump sont remplacées).
Variables optionnelles : `DB_CONTAINER`, `POSTGRES_USER`, `POSTGRES_DB`.

**Sauvegarde manuelle** (équivalent) :

```bash
docker compose exec -T db pg_dump -U jeux_user -d jeux_multiplication | gzip > backup-$(date +%F).sql.gz
```

**Restauration manuelle** (contenu de la base cible remplacé — à
n'exécuter qu'en connaissance de cause) :

```bash
gunzip -c backup-2026-11-13.sql.gz | docker compose exec -T db psql -U jeux_user -d jeux_multiplication
```

**Vérifications** :

```bash
npm run db:status   # état des migrations
npm run db:check    # persistance + cascade de bout en bout
curl -s http://127.0.0.1:3000/api/health   # database: connected
```

`scripts/update-vps.sh` sauvegarde automatiquement avant chaque mise à
jour (dossier `backups/`).

> **Testé (2026-11-14)** : sauvegarde de la base de test, suppression
> volontaire de deux lignes (`app_config`, `installation`), restauration,
> relecture SQL → données et verrou retrouvés, 4 migrations appliquées
> cohérentes.

---

## 10. Variables d'environnement (référence)

| Variable | Requis | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | Connexion PostgreSQL (source de vérité) |
| `AUTH_SECRET` | oui (32+ car.) | Signature des JWT de session |
| `INSTALL_TOKEN` | non | Protection de l'assistant avant installation |
| `ADMIN_RECOVERY_TOKEN` | non | Récupération administrateur (vide = désactivé) |
| `PGPOOL_MAX` | non | Limite du pool (serverless : 3) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose uniquement | Création du service PostgreSQL |

Consulter `.env.example` pour les réglages fins de session et bcrypt.

---

## 11. Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| L'assistant affiche « Connexion PostgreSQL : erreur » | `DATABASE_URL` mal formée / service injoignable | Vérifier le nom d'hôte (nom du service compose, pas `localhost`) ; `docker compose logs app` |
| « Migrations : échec » | Base ancienne ou verrou migration | Voir `docs/DATABASE.md` ; jamais de reset automatique |
| « Permissions » en erreur | Utilisateur PostgreSQL sans droits d'écriture | Utiliser l'utilisateur applicatif (pas le super-utilisateur) |
| Assistant demande un jeton | `INSTALL_TOKEN` défini (ou fichier généré) | Récupérer : `docker compose logs app` |
| Boucle de redirection vers `/installation` | Base vide, installation non terminée | C'est le comportement attendu : suivre l'assistant |
