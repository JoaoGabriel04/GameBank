#!/bin/sh
set -e

echo "[startup] DATABASE_URL host=$(echo "$DATABASE_URL" | sed -E 's|.*@([^/]+)/.*|\1|')"
echo "[startup] DIRECT_URL  host=$(echo "$DIRECT_URL"  | sed -E 's|.*@([^/]+)/.*|\1|')"
echo "[startup] DIRECT_URL set: $([ -n "$DIRECT_URL" ] && echo YES || echo NO)"

if npx prisma migrate deploy; then
  echo "[startup] Migrations aplicadas com sucesso"
else
  echo "[startup] migrate deploy falhou — limpando registro da migration quebrada..."

  echo "DELETE FROM _prisma_migrations WHERE migration_name = '20260608000001_add_animated_flag';" \
    | npx prisma db execute --stdin 2>/dev/null || true

  if npx prisma migrate deploy; then
    echo "[startup] Migrations aplicadas com sucesso após limpeza"
  else
    echo "[startup] migrate deploy falhou novamente — rodando db push..."
    npx prisma db push --accept-data-loss
  fi
fi

exec node dist/index.js
