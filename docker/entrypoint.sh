#!/bin/sh
# Royaume Magique des Multiplications — point d'entrée du conteneur.
#
# Responsabilités (aucune n'est destructive) :
#  1. générer le jeton d'installation si absent (visible UNIQUEMENT dans
#     les journaux du conteneur — l'administrateur du serveur) ;
#  2. attendre que PostgreSQL soit joignable ;
#  3. appliquer les migrations versionnées (prisma migrate deploy :
#     idempotent, n'applique que les migrations manquantes, ne
#     supprime JAMAIS de données) ;
#  4. démarrer le serveur Next.js standalone.

set -eu
cd /app

# ------------------------------------------------------------------
# 1. Jeton d'installation (protection de l'assistant web)
# ------------------------------------------------------------------
# Si INSTALL_TOKEN est défini dans l'environnement, il est utilisé tel
# quel. Sinon, un jeton cryptographiquement sûr est généré une fois et
# écrit dans /app/.install_token (volume persistant recommandé pour le
# conserver entre recréations du conteneur).
if [ -z "${INSTALL_TOKEN:-}" ] && [ ! -f "${INSTALL_TOKEN_FILE:-/app/.install_token}" ]; then
  node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))" \
    > "${INSTALL_TOKEN_FILE:-/app/.install_token}"
fi
if [ -f "${INSTALL_TOKEN_FILE:-/app/.install_token}" ]; then
  echo ""
  echo "==============================================================="
  echo "  🔑 Jeton d'installation (à saisir à l'ouverture de l'assistant) :"
  echo "     $(cat "${INSTALL_TOKEN_FILE:-/app/.install_token}")"
  echo "  Cet identifiant n'est visible que dans les journaux du conteneur."
  echo "==============================================================="
  echo ""
fi

# ------------------------------------------------------------------
# 2-3. Attente de PostgreSQL puis migrations (idempotentes)
# ------------------------------------------------------------------
# Le CLI Prisma complet vit dans /app/prisma-cli (arbre de dépendances
# autonome) ; on y travaille pour que prisma.config.ts et le schéma
# prisma/schema.prisma soient résolus.
MIGRATOR_ROOT="${MIGRATOR_ROOT:-/app/prisma-cli}"
if [ ! -f "$MIGRATOR_ROOT/node_modules/prisma/build/index.js" ]; then
  MIGRATOR_ROOT="/app"
fi
PRISMA_CLI="node $MIGRATOR_ROOT/node_modules/prisma/build/index.js"
MAX_WAIT_LOOPS="${DB_WAIT_LOOPS:-30}"   # 30 x 4 s = 2 minutes
i=0
until (cd "$MIGRATOR_ROOT" && $PRISMA_CLI migrate deploy) >/tmp/migrate.log 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge "$MAX_WAIT_LOOPS" ]; then
    echo "❌ PostgreSQL injoignable ou migrations en échec après le délai maximum."
    echo "---- dernières sorties ----"
    cat /tmp/migrate.log
    exit 1
  fi
  echo "⏳ Attente de PostgreSQL… (tentative $i/$MAX_WAIT_LOOPS)"
  sleep 4
done
echo "✅ Migrations à jour (prisma migrate deploy, non destructif)."
tail -n 5 /tmp/migrate.log || true

# ------------------------------------------------------------------
# 4. Serveur Next.js (standalone)
# ------------------------------------------------------------------
exec node server.js
