#!/bin/bash
set -e

# Validação Pré-Deploy do GameBank.
# Roda via Docker (containers dev) para usar o banco LOCAL e nunca tocar o
# banco de produção (Neon) configurado em server/.env.
# Pré-requisito: containers de dev rodando (make dev-up).

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   GameBank — Validação Pré-Deploy    ║"
echo "╚══════════════════════════════════════╝"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
info() { echo -e "${YELLOW}  → $1${NC}"; }

COMPOSE="docker compose -f docker-compose.dev.yml"
DC_SERVER="$COMPOSE exec -T server"
DC_CLIENT="$COMPOSE exec -T client"

# ─── Pré-requisito: containers up ─────────────────────────────────────────
if ! $COMPOSE ps --services --filter "status=running" 2>/dev/null | grep -q "^server$"; then
  fail "Container 'server' não está rodando. Rode 'make dev-up' antes de validar."
fi
if ! $COMPOSE ps --services --filter "status=running" 2>/dev/null | grep -q "^client$"; then
  fail "Container 'client' não está rodando. Rode 'make dev-up' antes de validar."
fi

# ─── 1. TypeScript — servidor ─────────────────────────────────────────────
echo "[ 1/6 ] Verificando tipos — servidor"
if $DC_SERVER npx tsc --noEmit; then
  ok "TypeScript server sem erros"
else
  fail "Erros de TypeScript no servidor — corrija antes de fazer push"
fi

# ─── 2. TypeScript — cliente ──────────────────────────────────────────────
echo ""
echo "[ 2/6 ] Verificando tipos — cliente"
if $DC_CLIENT npx tsc --noEmit; then
  ok "TypeScript client sem erros"
else
  fail "Erros de TypeScript no cliente — corrija antes de fazer push"
fi

# ─── 3. Prisma schema válido ──────────────────────────────────────────────
echo ""
echo "[ 3/6 ] Validando schema Prisma"
if $DC_SERVER npx prisma validate; then
  ok "Schema Prisma válido"
else
  fail "Schema Prisma inválido — corrija antes de fazer push"
fi

# ─── 4. Migrations sem estado de falha ────────────────────────────────────
echo ""
echo "[ 4/6 ] Verificando estado das migrations"
STATUS=$($DC_SERVER npx prisma migrate status 2>&1 || true)

if echo "$STATUS" | grep -qi "failed\|P3009"; then
  echo ""
  echo -e "${RED}  ✗ Migration com status FAILED detectada:${NC}"
  echo "$STATUS" | grep -i "failed\|P3009"
  echo ""
  echo "  Para resolver, rode:"
  echo "  cd server && npx prisma migrate resolve --rolled-back \"NOME_DA_MIGRATION\""
  echo "  ou"
  echo "  make db-reset  (apaga dados — só em dev)"
  exit 1
else
  ok "Nenhuma migration com status failed"
fi

if echo "$STATUS" | grep -qi "not yet applied\|pending"; then
  info "Atenção: existem migrations pendentes não aplicadas:"
  echo "$STATUS" | grep -i "not yet applied\|pending"
  echo ""
  read -p "  Continuar mesmo assim? (s/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    fail "Deploy cancelado — aplique as migrations antes"
  fi
fi

# ─── 5. Build de produção ─────────────────────────────────────────────────
echo ""
echo "[ 5/6 ] Testando build de produção"
echo "  Building servidor..."
if $DC_SERVER npm run build; then
  ok "Build do servidor OK"
else
  fail "Build do servidor falhou — corrija antes de fazer push"
fi

echo "  Building cliente... (pode demorar)"
if $DC_CLIENT npm run build; then
  ok "Build do cliente OK"
else
  fail "Build do cliente falhou — corrija antes de fazer push"
fi

# ─── 6. Testes automatizados ──────────────────────────────────────────────
echo ""
echo "[ 6/6 ] Rodando testes"
# Garante que o banco de teste existe (idempotente)
$COMPOSE exec -T db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='gamebank_test'" 2>/dev/null | grep -q 1 \
  || $COMPOSE exec -T db psql -U postgres -c "CREATE DATABASE gamebank_test;" >/dev/null 2>&1 || true

if $DC_SERVER env DOTENV_CONFIG_QUIET=true npm test -- --passWithNoTests; then
  ok "Todos os testes passando"
else
  fail "Testes falhando — corrija antes de fazer push"
fi

# ─── Resultado final ──────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo -e "║  ${GREEN}✓ Tudo certo — pode fazer o push!${NC}   ║"
echo "╚══════════════════════════════════════╝"
echo ""
