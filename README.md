# GameBank

Gerenciador multiplayer completo para o jogo de tabuleiro **Super Banco Imobiliário**. Substitui o banqueiro físico por uma aplicação web que controla saldos, propriedades, dívidas, negociações e recompensas em tempo real.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind CSS v4 + TypeScript |
| Animações | Framer Motion 12 + GSAP 3 |
| Estado | Zustand 5 (fonte de verdade) + SWR (fetching) |
| Backend | Express 4 + TypeScript |
| ORM | Prisma 7 + PostgreSQL 16 |
| Tempo real | Socket.IO 4 + Redis adapter |
| Auth | JWT + bcrypt + OAuth (Google, Discord) |
| Validação | Zod (schemas compartilhados) |
| Upload | Cloudinary (avatares e banners) via Multer |
| Infra | Docker Compose (dev e prod) |

## Funcionalidades

### Sessão de jogo
- Criação de sessões com senha opcional e modos solo/duplas
- Suporte a até 6 jogadores simultâneos com atualização em tempo real via Socket.IO
- Sistema de equipes para modo duplas
- Chat integrado por sessão
- Encerramento automático e ranking de resultado com confete

### Sistema bancário
- Depósito, saque e transferência entre jogadores
- Pagamento de aluguel simples e por ação de carta
- Receber de todos (carta sorte/revés)
- Histórico completo de movimentações por sessão

### Propriedades
- Compra, venda, hipoteca e deshipoteca
- Construção e venda de casas e hotéis
- Cálculo automático de aluguel por número de casas/hotéis

### Negociações
- Proposta de troca entre jogadores (dinheiro + propriedades)
- Notificações em tempo real para o jogador alvo
- Aceitar, recusar ou fazer contraproposta

### Dívidas
- Registro de dívidas entre jogadores
- Cobrança e quitação controladas pelo sistema

### Cartas Sorte e Revés
- Baralho configurável pelo admin
- Efeitos: ganhar, pagar, pagar por casa, ir para prisão, sair da prisão

### Perfil e progressão
- Sistema de XP e níveis com cálculo automático ao fim de partidas
- Coins (moeda gratuita) ganhos por posição e missões concluídas
- Histórico de partidas e estatísticas por jogador
- Ranking global

### Loja e cosméticos
- Banners de perfil (gradiente CSS ou imagem Cloudinary)
- Emblemas (badges) com imagem personalizada
- Títulos decorativos
- Inventário por usuário com equip/desequip e venda com reembolso de 50%

### Missões
- Missões configuráveis pelo admin (tipo, meta, recompensas de XP e coins)
- Progresso rastreado automaticamente ao fim de partidas
- Resgate de recompensa com proteção contra duplo claim

### Painel Admin
- Gerenciamento completo de usuários (coins, XP, nível, ban/unban)
- Controle de sessões ativas com encerramento forçado
- CRUD de itens da loja, banners, emblemas e missões
- Cards de sorte/revés configuráveis
- Auditoria de ações administrativas

## Desenvolvimento

### Pré-requisitos
- Docker e Docker Compose
- Make

### Iniciar ambiente de desenvolvimento

```bash
# Subir todos os serviços (server, client, db, redis) com rebuild
make dev

# Subir em background
make dev-up

# Acompanhar logs
make dev-logs

# Parar
make dev-down
```

A aplicação fica disponível em:
- **Cliente:** http://localhost:3000
- **API:** http://localhost:7000

### Banco de dados

```bash
make db-migrate        # Rodar migrations pendentes
make db-reset          # Resetar banco do zero (apaga dados)
make db-studio         # Abrir Prisma Studio
make db-purge-users    # Remover usuários de teste
make db-backup         # Dump do banco atual
```

### Outros comandos úteis

```bash
make dev-shell SVC=server   # Shell no container do servidor
make dev-shell SVC=client   # Shell no container do cliente
make dev-restart SVC=server # Reiniciar serviço sem rebuild
make test                   # Health check HTTP
```

### Após instalar dependências

Sempre rebuild a imagem do serviço afetado:

```bash
docker compose -f docker-compose.dev.yml build --no-cache server
# ou
docker compose -f docker-compose.dev.yml build --no-cache client
```

### Variáveis de ambiente

Copiar `.env.example` para `.env` na raiz e preencher:

```env
# Banco
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...

# Admin (criado automaticamente no startup)
ADMIN_EMAIL=admin@gamebank.com
ADMIN_PASSWORD=...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_AVATAR_FOLDER=gamebank/avatars

# Redis
REDIS_URL=redis://redis:6379
```

Variáveis públicas do cliente (`NEXT_PUBLIC_*`) são injetadas via bloco `environment:` no `docker-compose.dev.yml` — não há `.env.local` no client.

## Arquitetura

### Servidor

```
Middleware (auth → room-auth → lock → validate)
  → Controller (req/res, HTTP status)
    → Service  (regras de negócio, transações, AppError)
      → Repository (queries Prisma puras)
```

Módulos em `server/src/modules/`: `admin`, `auth`, `avatar`, `badge`, `banco`, `banner`, `carta`, `divida`, `historico`, `missions`, `negociacao`, `profile`, `propriedade`, `ranking`, `session`, `shop`, `socket`, `user`.

Rotas em `server/src/api/routes/` — nunca dentro dos módulos.

### Cliente

Pages (App Router) em `client/src/app/user/`:
- `(main)/` — Dashboard, Sessões, Perfil, Ranking, Loja, Cofre, Recompensas, Nova Sessão
- `game/[sessionId]/` — Interface de jogo em tempo real

Zustand stores em `client/src/stores/` são a fonte de verdade. SWR cuida do fetching inicial; Socket.IO atualiza o estado via `session:updated`.

## Testes

Backend com Jest + Supertest, usando um banco isolado (`gamebank_test`). Rodam dentro do container:

```bash
make test-ci                       # roda toda a suíte
make dev-shell SVC=server          # ou entre no container e use:
  npm test                         # todos os testes
  npm run test:unit                # só unitários (sem banco)
  npm run test:integration         # só integração (banco de teste)
```

## Antes de fazer push

Sempre rodar antes de push para `main` (requer containers de dev rodando — `make dev-up`):

```bash
make validate      # valida tudo
make safe-push     # valida e só faz push se passar
```

O que é verificado (via Docker, banco local — nunca toca produção):
1. TypeScript sem erros (servidor e cliente)
2. Schema Prisma válido
3. Nenhuma migration com status `failed` (erro P3009)
4. Migrations sem pendências inesperadas
5. Build de produção passa (servidor e cliente)
6. Testes automatizados passam

### Instalação do hook pre-push

Após clonar o projeto, instalar o hook (não é versionado em `.git/hooks/`):

```bash
bash scripts/install-hooks.sh
```

O hook roda validações rápidas (TypeScript + Prisma + migrations) antes de cada push. A suíte completa roda no CI (GitHub Actions, `.github/workflows/validate.yml`), que dispara o deploy no Render apenas se tudo passar.

## Convenções de código

Regras detalhadas em [AGENTS.md](./AGENTS.md). Resumo:

| Área | Padrão |
|------|--------|
| **Componentes** | `export default function` + `type NomeProps` local + `index.tsx` |
| **Páginas** | `'use client'` → Zustand store → guard loading → `export default function` |
| **Store** | `create<NomeStore>()` com `loading: Record<string, boolean>` |
| **API client** | Objeto `xxxApi` + helpers `.then(res => res.data)` |
| **Server módulo** | 3 arquivos: `repository.ts` → `service.ts` → `controller.ts` |
| **Repository** | Class ou object literal, queries Prisma puras |
| **Service** | `AppError` para erros, cross-module via `new Servico()` |
| **Controller** | Object literal, Zod inline, `parseError()` helper |
| **Transações** | `$transaction([...])` (array) ou `async (tx) =>` (callback) |
| **Socket emit** | `emitUpdatedSession(sessionId)` após mutações |
| **Z-index** | `z-40` navbars, `z-100` header, `z-[200]` modais, `z-[100000]` toast |

## Licença

MIT
