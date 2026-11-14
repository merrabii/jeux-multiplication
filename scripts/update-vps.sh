#!/usr/bin/env bash
# =============================================================================
# Royaume Magique des Multiplications — mise à jour sur VPS
#
# Aucune donnée n'est jamais supprimée : le volume PostgreSQL est conservé,
# les migrations appliquées sont idempotentes et non destructives.
# Usage : sudo bash scripts/update-vps.sh
# =============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/jeux-multiplication}"
COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

log()  { echo "➜  $*"; }
ok()   { echo "✅ $*"; }
err()  { echo "❌ $*" >&2; }

[ "$(id -u)" -eq 0 ] || { err "Exécuter avec sudo."; exit 1; }
[ -d "$INSTALL_DIR/.git" ] || { err "$INSTALL_DIR n'est pas une installation (install-vps.sh d'abord)."; exit 1; }
cd "$INSTALL_DIR"

# 1. Sauvegarde de la base AVANT toute mise à jour (stratégie documentée).
log "Sauvegarde de PostgreSQL avant mise à jour…"
mkdir -p backups
BACKUP="backups/backup-$(date +%Y%m%d-%H%M%S).sql.gz"
DB_NAME=$(grep -E '^POSTGRES_DB=' .env | head -n1 | cut -d= -f2- | tr -d '"')
DB_USER=$(grep -E '^POSTGRES_USER=' .env | head -n1 | cut -d= -f2- | tr -d '"')
$COMPOSE exec -T db pg_dump -U "${DB_USER:-jeux_user}" -d "${DB_NAME:-jeux_multiplication}" \
  | gzip > "$BACKUP"
ok "Sauvegarde : $BACKUP"

# 2. Récupération de la nouvelle version (aucune donnée touchée).
log "Récupération de la nouvelle version…"
git fetch origin
git reset --hard origin/main

# 3. Rebuild + redémarrage (volume PostgreSQL conservé).
log "Reconstruction et redémarrage…"
$COMPOSE up -d --build

# 4. Les migrations sont appliquées par docker/entrypoint.sh au démarrage
#    (prisma migrate deploy : idempotent, non destructif).

# 5. Healthcheck final.
APP_OK=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then APP_OK=1; break; fi
  sleep 2
done
if [ "$APP_OK" -ne 1 ]; then
  err "Healthcheck en échec après la mise à jour."
  err "Pour revenir en arrière : git reset --hard <sha-precedent> puis $COMPOSE up -d --build"
  err "Pour restaurer la base : gunzip -c $BACKUP | $COMPOSE exec -T db psql -U ${DB_USER:-jeux_user} -d ${DB_NAME:-jeux_multiplication}"
  exit 1
fi
ok "Mise à jour terminée, application opérationnelle. Données conservées."
