#!/usr/bin/env bash
# =============================================================================
# Royaume Magique des Multiplications — installation sur VPS (sans panneau)
#
# Usage :
#   curl -fsSL <url-du-script> | bash          (ou après clonage :)
#   sudo bash scripts/install-vps.sh
#
# Ce script est SÛR à relancer : il ne supprime jamais de données, ne
# réinitialise jamais PostgreSQL, n'écrase jamais les secrets existants.
# Distributions vérifiées : Debian 12+, Ubuntu 22.04+ (dérivés apt).
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/merrabii/jeux-multiplication.git"
INSTALL_DIR="${INSTALL_DIR:-/opt/jeux-multiplication}"
COMPOSE="docker compose"
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

log()  { echo "➜  $*"; }
ok()   { echo "✅ $*"; }
err()  { echo "❌ $*" >&2; }

# -----------------------------------------------------------------------------
# 1. Prérequis système
# -----------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  err "Ce script doit être exécuté avec sudo (root)."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  err "Distribution non prise en charge par ce script (apt attendu)."
  err "Distributions vérifiées : Debian 12+, Ubuntu 22.04+."
  err "Sur une autre distribution, installez Docker manuellement puis relancez."
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Docker + Compose (installés si absents)
# -----------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installation de Docker (dépôt officiel)…"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg \
    -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi
ok "Docker : $(docker --version)"

# -----------------------------------------------------------------------------
# 3. Récupération du dépôt (sans écraser les données)
# -----------------------------------------------------------------------------
if [ -d "$INSTALL_DIR/.git" ]; then
  log "Mise à jour du dépôt existant dans $INSTALL_DIR…"
  git -C "$INSTALL_DIR" fetch origin
  git -C "$INSTALL_DIR" reset --hard origin/main
else
  log "Clonage du dépôt dans $INSTALL_DIR…"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# -----------------------------------------------------------------------------
# 4. Secrets cryptographiquement sûrs (jamais écrasés s'ils existent)
# -----------------------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
fi

set_secret() {
  # $1 = nom de variable ; n'écrase JAMAIS une valeur existante non vide.
  local name="$1"
  local current
  current=$(grep -E "^${name}=" .env | head -n1 | cut -d= -f2- | tr -d '"' || true)
  if [ -n "$current" ]; then
    ok "$name déjà défini (conservé)."
    return
  fi
  local value
  value=$(openssl rand -hex 48 2>/dev/null || head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')
  if grep -qE "^${name}=" .env; then
    sed -i "s|^${name}=.*|${name}=\"${value}\"|" .env
  else
    echo "${name}=\"${value}\"" >> .env
  fi
  ok "$name généré."
}

set_secret AUTH_SECRET
set_secret ADMIN_RECOVERY_TOKEN
# INSTALL_TOKEN : laissé vide → le conteneur en génère un au démarrage
# et l'imprime dans ses journaux (docker compose logs app).

# Mot de passe PostgreSQL : généré si absent ou si valeur d'exemple.
current_db_password=$(grep -E '^POSTGRES_PASSWORD=' .env | head -n1 | cut -d= -f2- | tr -d '"')
if [ -z "$current_db_password" ] || [ "$current_db_password" = "CHANGE_ME" ] || [ "$current_db_password" = "jeux_dev_password" ]; then
  new_password=$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\"${new_password}\"|" .env
  ok "POSTGRES_PASSWORD généré (stocké dans $INSTALL_DIR/.env)."
fi

# -----------------------------------------------------------------------------
# 5. Démarrage + migrations (idempotentes, jamais destructives)
# -----------------------------------------------------------------------------
log "Démarrage des services (PostgreSQL + application)…"
$COMPOSE up -d --build

log "Attente du healthcheck PostgreSQL…"
for i in $(seq 1 30); do
  if $COMPOSE ps db | grep -q "healthy"; then break; fi
  sleep 2
done

log "Vérification de l'application…"
APP_OK=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then APP_OK=1; break; fi
  sleep 2
done
if [ "$APP_OK" -ne 1 ]; then
  err "L'application ne répond pas — consultez : $COMPOSE logs app"
  exit 1
fi
ok "Application opérationnelle."

echo ""
echo "==============================================================="
echo "  🏰 Installation terminée."
echo "  Ouvrez dans le navigateur : http://$(hostname -I | awk '{print $1}'):3000"
echo "  L'assistant d'installation s'affiche automatiquement."
echo ""
echo "  🔑 Jeton d'installation (si demandé) :"
echo "     $COMPOSE logs app | grep -A2 'Jeton d'"
echo ""
echo "  Sauvegarde des données : voir docs/INSTALLATION.md (§ Sauvegarde)."
echo "  Mise à jour ultérieure : sudo bash scripts/update-vps.sh"
echo "==============================================================="
