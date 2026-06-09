#!/bin/sh
set -e

echo "[startup] DATABASE_URL host=$(echo "$DATABASE_URL" | sed -E 's|.*@([^/]+)/.*|\1|')"
echo "[startup] DIRECT_URL  host=$(echo "$DIRECT_URL"  | sed -E 's|.*@([^/]+)/.*|\1|')"
echo "[startup] DIRECT_URL set: $([ -n "$DIRECT_URL" ] && echo YES || echo NO)"

if npx prisma migrate deploy; then
  echo "[startup] Migrations aplicadas com sucesso"
else
  echo "[startup] migrate deploy falhou — tentando resolver migration quebrada..."
  npx prisma migrate resolve --rolled-back 20260608000001_add_animated_flag 2>/dev/null || true

  if npx prisma migrate deploy; then
    echo "[startup] Migrations aplicadas com sucesso após resolve"
  else
    echo "[startup] migrate deploy falhou novamente — rodando db push..."
    npx prisma db push --accept-data-loss
  fi
fi

exec node dist/index.js
