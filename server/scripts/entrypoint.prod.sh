#!/bin/sh
set -e

echo "[startup] DATABASE_URL host=$(echo "$DATABASE_URL" | sed -E 's|.*@([^/]+)/.*|\1|')"
echo "[startup] DIRECT_URL  host=$(echo "$DIRECT_URL"  | sed -E 's|.*@([^/]+)/.*|\1|')"
echo "[startup] DIRECT_URL set: $([ -n "$DIRECT_URL" ] && echo YES || echo NO)"

# Se uma migration falhar, o deploy FALHA (o Render mantém a versão anterior
# no ar) e o Sentry é avisado. Nunca "consertar" aqui com `db push
# --accept-data-loss` ou apagando linhas de _prisma_migrations: isso pode
# destruir colunas e dados de produção sem aviso. Para recuperar uma
# migration com falha, resolver à mão:
#   npx prisma migrate resolve --rolled-back <nome_da_migration>
# Binário local em vez de npx: o npx gasta 0,3–1,2 s só para resolver o pacote.
# O Prisma 7 ignora o `directUrl` do prisma.config.ts, então o migrate usa o
# DIRECT_URL (sem pooler) aqui: o pooler do Neon não segura o advisory lock
# do `migrate deploy` (P1002). O app continua no DATABASE_URL.
if DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" ./node_modules/.bin/prisma migrate deploy; then
  echo "[startup] Migrations aplicadas com sucesso"
else
  echo "[startup] ERRO: prisma migrate deploy falhou — abortando o boot" >&2
  node ./scripts/alertar-falha-boot.mjs "prisma migrate deploy falhou no boot" || true
  exit 1
fi

exec node dist/index.js
