.PHONY: dev dev-up dev-down dev-down-v dev-build dev-rebuild dev-logs dev-shell dev-restart
.PHONY: prod prod-up prod-down prod-down-v prod-build prod-rebuild prod-logs prod-shell
.PHONY: db-reset db-migrate db-studio db-backup db-purge-users
.PHONY: test test-ci status clean prune setup help
.PHONY: up down build logs shell restart

SVC ?= server

# ─── Atalhos (padrão = produção) ─────────────────────────────
up: prod-up
down: prod-down
build: prod-build
logs: prod-logs
shell: prod-shell
restart: prod-restart

# ─── Setup inicial ────────────────────────────────────────────
setup:
	@echo "Copiando .env.example para .env (se nao existir)..."
	@if not exist .env copy .env.example .env >nul 2>&1 && echo ".env criado — edite com suas configuracoes!" || echo ".env ja existe."

# ─── Desenvolvimento ─────────────────────────────────────────
dev:
	docker compose -f docker-compose.dev.yml up --build

dev-up:
	docker compose -f docker-compose.dev.yml up -d --build

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-down-v:
	docker compose -f docker-compose.dev.yml down -v

dev-build:
	docker compose -f docker-compose.dev.yml build --no-cache

dev-rebuild:
	docker compose -f docker-compose.dev.yml up -d --build $(SVC)

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

dev-shell:
	docker compose -f docker-compose.dev.yml exec $(SVC) sh

dev-restart:
	docker compose -f docker-compose.dev.yml restart $(SVC)

dev-ps:
	docker compose -f docker-compose.dev.yml ps

# ─── Produção ────────────────────────────────────────────────
prod:
	docker compose up --build

prod-up:
	docker compose up -d --build

prod-down:
	docker compose down

prod-down-v:
	docker compose down -v

prod-build:
	docker compose build --no-cache

prod-rebuild:
	docker compose up -d --build $(SVC)

prod-logs:
	docker compose logs -f

prod-shell:
	docker compose exec $(SVC) sh

prod-restart:
	docker compose restart $(SVC)

prod-ps:
	docker compose ps

# ─── Banco ───────────────────────────────────────────────────
db-reset:
	docker compose -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.dev.yml up -d db migration

db-migrate:
	docker compose -f docker-compose.dev.yml exec server npx prisma migrate dev

db-studio:
	docker compose -f docker-compose.dev.yml exec server npx prisma studio

db-purge-users:
	docker compose -f docker-compose.dev.yml exec server npm run purge-users

db-backup:
	@mkdir -p backups
	docker compose -f docker-compose.dev.yml exec -T db pg_dump -U postgres ${DB_NAME:-supermaquina} > backups/sgp_$$(date +%Y%m%d_%H%M%S).sql

# ─── Testes / Health Check ───────────────────────────────────
test:
	@echo "=== Health Check ==="
	@echo ""
	@echo "--- Server API ---"
	@curl -s --max-time 5 http://localhost:7000/api/sessions/test > nul 2>&1 && (echo "  OK") || (echo "  FALHOU")
	@echo "--- Client ---"
	@curl -s --max-time 5 http://localhost:3000 > nul 2>&1 && (echo "  OK") || (echo "  FALHOU")

test-ci:
	@echo "Nenhum framework de testes configurado."
	@echo "Para adicionar: make dev-shell SVC=server"
	@echo "  npm install --save-dev jest ts-jest @types/jest @jest/globals"

# ─── Utilitários ─────────────────────────────────────────────
status:
	docker ps --filter "name=sgp-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

clean:
	docker compose -f docker-compose.dev.yml down -v 2>nul; true
	docker compose down -v 2>nul; true

prune:
	docker system prune -a --volumes -f

help:
	@echo "╔══════════════════════════════════════════════════════════╗"
	@echo "║           sgpController - Docker Makefile                ║"
	@echo "╠══════════════════════════════════════════════════════════╣"
	@echo "║                                                          ║"
	@echo "║  🧪 DESENVOLVIMENTO                                     ║"
	@echo "║    make dev             Sobe dev com logs                ║"
	@echo "║    make dev-up          Sobe dev detached                ║"
	@echo "║    make dev-down        Para dev                         ║"
	@echo "║    make dev-down-v      Para dev + apaga volume DB       ║"
	@echo "║    make dev-logs        Logs dev                         ║"
	@echo "║    make dev-shell       Shell no container               ║"
	@echo "║    make dev-rebuild SVC=server  Reconstroi servio        ║"
	@echo "║    make dev-restart SVC=server  Restart sem rebuild      ║"
	@echo "║                                                          ║"
	@echo "║  🚀 PRODUÇÃO                                            ║"
	@echo "║    make up / prod       Sobre produo                     ║"
	@echo "║    make down            Derruba                          ║"
	@echo "║    make logs            Logs produo                      ║"
	@echo "║    make shell           Shell no container               ║"
	@echo "║    make prod-rebuild SVC=server  Reconstroi              ║"
	@echo "║                                                          ║"
	@echo "║  🗄️  BANCO                                               ║"
	@echo "║    make db-backup       Dump do PostgreSQL (.sql)        ║"
	@echo "║    make db-reset        Recria banco do zero             ║"
	@echo "║    make db-studio       Prisma Studio                    ║"
	@echo "║    make db-migrate      Roda migrate manual              ║"
	@echo "║                                                          ║"
	@echo "║  🔍 TESTES                                              ║"
	@echo "║    make test            Health check HTTP                ║"
	@echo "║                                                          ║"
	@echo "║  ⚙️  UTILITRIOS                                         ║"
	@echo "║    make setup           Cria .env a partir do exemplo    ║"
	@echo "║    make status          Status dos containers            ║"
	@echo "║    make clean           Limpa containers e volumes       ║"
	@echo "║    make help            Mostra esta ajuda                ║"
	@echo "║                                                          ║"
	@echo "╚══════════════════════════════════════════════════════════╝"
