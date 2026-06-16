# Plano de Infraestrutura — GameBank
## Implementação Incremental por Semanas

---

## REGRAS GERAIS PARA A IA

Antes de qualquer semana, a IA deve seguir estas regras sem exceção:

1. **Uma tarefa por vez** — nunca implementar duas tarefas da mesma semana
   simultaneamente, mesmo que pareçam relacionadas
2. **Não alterar o que não foi pedido** — se a tarefa é adicionar Sentry,
   não refatorar logging, não mudar error handlers que não foram mencionados
3. **Auditar antes de implementar** — sempre rodar os comandos de auditoria
   da etapa 0 de cada tarefa antes de escrever código
4. **Testar antes de commitar** — cada tarefa tem testes manuais obrigatórios.
   Não avançar para a próxima sem completá-los
5. **Não remover código existente** sem instrução explícita — adicionar,
   não substituir, exceto onde expressamente indicado
6. **Variáveis de ambiente** — nunca hardcodar valores. Sempre usar
   `process.env.NOME_DA_VARIAVEL` e adicionar ao `.env.example`

---

## SEMANA 1 — Observabilidade básica (risco baixo)

### Objetivo
Ter visibilidade de erros em produção antes de qualquer outra mudança.
Sem isso, qualquer problema futuro é investigado às cegas.

---

### TAREFA 1.1 — Sentry (error tracking)

**Risco:** 🟢 Baixo — apenas adiciona, não muda nada existente

**Por que primeiro:** Quando as próximas implementações causarem algum
erro inesperado em produção, o Sentry captura automaticamente com
stack trace completo, contexto do usuário e frequência.

#### Etapa 0 — Auditoria

```bash
# Ver error handler atual do Express
grep -rn "error.*handler\|handleError\|next(err)\|res.status(500)" \
  server/src --include="*.ts" | grep -v node_modules

# Ver se já há alguma integração Sentry
grep -rn "sentry\|@sentry" \
  server/src client/src --include="*.ts" --include="*.tsx" \
  | grep -v node_modules

# Ver o arquivo principal do servidor
cat server/src/index.ts

# Ver o middleware de erro global
find server/src -name "error*" -o -name "*error*" \
  | grep -v node_modules | head -10
```

#### Etapa 1 — Instalação

```bash
# Servidor
cd server && npm install @sentry/node @sentry/profiling-node

# Cliente
cd client && npm install @sentry/nextjs
```

#### Etapa 2 — Configuração do servidor

Criar `server/src/lib/sentry.ts`:

```typescript
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

export function initSentry() {
  // Não inicializar em desenvolvimento — apenas em produção e staging
  if (process.env.NODE_ENV === "development") return

  if (!process.env.SENTRY_DSN) {
    console.warn("[sentry] SENTRY_DSN não configurado — Sentry desabilitado")
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Rastrear 10% das transações em produção (não sobrecarregar)
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    // NÃO enviar dados sensíveis
    beforeSend(event) {
      // Remover headers de autorização dos eventos
      if (event.request?.headers) {
        delete event.request.headers["authorization"]
        delete event.request.headers["cookie"]
      }
      return event
    },
  })

  console.log("[sentry] Inicializado")
}

export { Sentry }
```

#### Etapa 3 — Inicializar no boot do servidor

No `server/src/index.ts`, adicionar na PRIMEIRA linha (antes de qualquer import):

```typescript
// DEVE ser a primeira coisa a rodar — antes de qualquer outro import
import { initSentry } from "./lib/sentry.js"
initSentry()

// ...resto dos imports existentes...
```

#### Etapa 4 — Integrar no error handler do Express

Localizar o middleware de erro global do Express e adicionar captura Sentry.
NÃO reescrever o handler — apenas adicionar a captura antes da resposta:

```typescript
// No middleware de erro existente, adicionar no início:
import { Sentry } from "../lib/sentry.js"

// Dentro do handler de erro (app.use((err, req, res, next) => {...})):
// Adicionar ANTES da resposta ao cliente:
if (process.env.NODE_ENV !== "development") {
  Sentry.captureException(err, {
    user: req.user ? { id: String(req.user.userId) } : undefined,
    extra: {
      url: req.url,
      method: req.method,
    },
  })
}
// ...resto do handler existente permanece igual...
```

#### Etapa 5 — Configuração do cliente Next.js

Criar `client/sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Não rastrear em desenvolvimento
  enabled: process.env.NODE_ENV !== "development",
  tracesSampleRate: 0.05,  // 5% no cliente — mais conservador
  // Ignorar erros de extensões do browser
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection",
  ],
})
```

Criar `client/sentry.server.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV !== "development",
  tracesSampleRate: 0.1,
})
```

Adicionar ao `client/next.config.ts`:

```typescript
import { withSentryConfig } from "@sentry/nextjs"

// ...config existente...

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,  // não poluir output do build
  disableLogger: true,
})
```

#### Etapa 6 — Variáveis de ambiente

Adicionar ao `.env` e `.env.example`:

```env
# Sentry
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=nome-da-org
SENTRY_PROJECT=gamebank
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...  # mesmo DSN, público
```

Adicionar ao Render (produção) e ao GitHub Actions (CI).

#### Testes obrigatórios antes de avançar

- [ ] Build do servidor sem erros de TypeScript
- [ ] Build do cliente sem erros
- [ ] Em produção: causar um erro intencional e verificar que aparece no Sentry
  ```typescript
  // Rota temporária de teste — REMOVER após validar
  router.get("/test-sentry", (req, res) => {
    throw new Error("Teste Sentry — pode remover")
  })
  ```
- [ ] Verificar que erros de desenvolvimento NÃO aparecem no Sentry
- [ ] Verificar que headers de autorização NÃO aparecem nos eventos
- [ ] Remover a rota de teste após validação

---

### TAREFA 1.2 — Compressão de respostas HTTP e Socket.IO

**Risco:** 🟢 Baixo — middleware que só comprime respostas, não muda lógica

**Por que agora:** Reduz bandwidth imediatamente sem nenhuma mudança
de arquitetura. Respostas da API podem ficar 5-10x menores.

#### Etapa 0 — Auditoria

```bash
# Ver se compression já está instalado
cat server/package.json | grep compression

# Ver middlewares globais do Express
grep -n "app.use" server/src/index.ts | head -20

# Ver configuração atual do Socket.IO
grep -n "new Server\|perMessageDeflate\|compression" \
  server/src/index.ts server/src/lib/socket.ts 2>/dev/null
```

#### Etapa 1 — Instalação

```bash
cd server && npm install compression
cd server && npm install -D @types/compression
```

#### Etapa 2 — Compressão HTTP

No `server/src/index.ts`, adicionar `compression` como o PRIMEIRO
middleware — antes de cors, helmet, e rotas:

```typescript
import compression from "compression"

// Adicionar ANTES de qualquer outro app.use():
app.use(compression({
  // Comprimir apenas respostas > 1KB (não vale a pena para respostas pequenas)
  threshold: 1024,
  // Nível 6 = bom equilíbrio entre velocidade e compressão (default é 6)
  level: 6,
}))

// ...resto dos middlewares existentes...
```

#### Etapa 3 — Compressão Socket.IO

Localizar onde o `new Server()` é criado e adicionar:

```typescript
const io = new Server(server, {
  // ...opções existentes — não remover nenhuma...
  perMessageDeflate: {
    zlibDeflateOptions: { level: 6 },
    // Comprimir apenas mensagens > 1KB
    threshold: 1024,
    // Não comprimir mensagens pequenas (custo > benefício)
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
  },
})
```

#### Testes obrigatórios antes de avançar

- [ ] Build sem erros
- [ ] Abrir DevTools → Network → verificar header `Content-Encoding: gzip`
  nas respostas da API
- [ ] Verificar que respostas pequenas (< 1KB) não têm o header (correto)
- [ ] Testar conexão Socket.IO — deve continuar funcionando normalmente
- [ ] Testar abertura de partida completa para garantir que eventos chegam

---

## SEMANA 2 — Logging e Cache (risco baixo-médio)

### Objetivo
Substituir `console.log` por logging estruturado e adicionar cache
de ranking para reduzir carga no banco.

---

### TAREFA 2.1 — Logging estruturado com Pino

**Risco:** 🟡 Médio — substitui console.log em todo o projeto,
mas não muda lógica de negócio

**ATENÇÃO:** Não remover nenhum `console.log` existente manualmente.
Usar script de migração para garantir que nenhum log importante seja perdido.

#### Etapa 0 — Auditoria

```bash
# Contar quantos console.log existem
grep -rn "console\." server/src --include="*.ts" | wc -l

# Ver os principais arquivos com logs
grep -rln "console\." server/src --include="*.ts" \
  | grep -v node_modules | head -20

# Ver se Pino já está instalado
cat server/package.json | grep pino
```

#### Etapa 1 — Instalação

```bash
cd server && npm install pino pino-pretty
cd server && npm install -D @types/pino 2>/dev/null || true
```

#### Etapa 2 — Criar o logger

Criar `server/src/lib/logger.ts`:

```typescript
import pino from "pino"

const isDev = process.env.NODE_ENV === "development"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  // Em desenvolvimento, formatar de forma legível
  // Em produção, JSON puro (para ingestão em ferramentas de log)
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  // Campos padrão em todo log
  base: {
    service: "gamebank-server",
    env: process.env.NODE_ENV,
  },
  // Redact de dados sensíveis — nunca logar estes campos
  redact: {
    paths: [
      "password", "passwordHash", "token", "refreshToken",
      "authorization", "cookie", "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
})

// Child loggers por módulo — para filtrar logs por contexto
export const authLogger    = logger.child({ module: "auth" })
export const shopLogger    = logger.child({ module: "shop" })
export const sessionLogger = logger.child({ module: "session" })
export const socketLogger  = logger.child({ module: "socket" })
export const bauLogger     = logger.child({ module: "bau" })
export const missionLogger = logger.child({ module: "missions" })
```

#### Etapa 3 — Migrar logs existentes

**NÃO fazer busca e substituição global.** Migrar módulo por módulo,
começando pelos mais críticos. Para cada arquivo:

1. Adicionar import do child logger apropriado
2. Substituir `console.log` por `logger.info`
3. Substituir `console.error` por `logger.error`
4. Substituir `console.warn` por `logger.warn`
5. Adicionar contexto estruturado quando relevante

```typescript
// ANTES:
console.log("[shop] Compra realizada:", itemId)
console.error("[shop] Erro ao comprar:", error)

// DEPOIS:
shopLogger.info({ itemId, userId }, "compra realizada")
shopLogger.error({ err: error, itemId, userId }, "erro ao processar compra")
```

**Ordem de migração (um arquivo por vez):**
1. `server/src/index.ts` — logs de boot
2. `server/src/modules/shop/shop.service.ts`
3. `server/src/modules/missions/missions.service.ts`
4. `server/src/modules/bau/bau.service.ts`
5. `server/src/modules/session/session.service.ts`
6. Demais módulos em ordem de criticidade

#### Etapa 4 — Logger no middleware de requisições HTTP

Adicionar pino-http para logar todas as requisições automaticamente:

```bash
cd server && npm install pino-http
```

```typescript
import pinoHttp from "pino-http"
import { logger } from "./lib/logger.js"

// Adicionar após compression, antes das rotas:
app.use(pinoHttp({
  logger,
  // Não logar health checks (muito ruído)
  ignore: (req) => req.url === "/health",
  // Customizar nível por status code
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500) return "error"
    if (res.statusCode >= 400) return "warn"
    return "info"
  },
}))
```

#### Etapa 5 — Variáveis de ambiente

```env
LOG_LEVEL=info  # debug em dev, info em produção
```

#### Testes obrigatórios antes de avançar

- [ ] Build sem erros de TypeScript
- [ ] Em desenvolvimento: logs aparecem formatados com cores no console
- [ ] Em produção: logs aparecem como JSON válido
- [ ] Verificar que `password` e `token` aparecem como `[REDACTED]`
- [ ] Verificar que requisições HTTP são logadas com método, url e status
- [ ] Fazer uma compra na loja e verificar o log estruturado
- [ ] Zero `console.log` restantes em arquivos migrados

---

### TAREFA 2.2 — Cache de ranking no Redis

**Risco:** 🟡 Médio — nova lógica de cache, mas isolada no módulo de ranking

**Por que agora:** O ranking é a query mais pesada do banco (agrega
dados de todas as partidas de todos os usuários). Cache de 5 minutos
reduz carga do banco em ~95% sem impacto perceptível para o usuário.

#### Etapa 0 — Auditoria

```bash
# Ver a query atual de ranking
cat server/src/modules/ranking/ranking.service.ts

# Ver como Redis já é usado no projeto
grep -rn "redis\|Redis" server/src/lib --include="*.ts"
grep -rn "redis" server/src/modules --include="*.ts" | head -10

# Ver o tempo atual de resposta do ranking (adicionar log temporário)
# Medir via DevTools Network tab na página de ranking
```

#### Etapa 1 — Implementar cache no ranking service

```typescript
// server/src/modules/ranking/ranking.service.ts
import { redis } from "../../lib/redis.js"  // import do cliente Redis existente
import { logger } from "../../lib/logger.js"

const RANKING_CACHE_KEY = "ranking:global"
const RANKING_CACHE_TTL = 300  // 5 minutos em segundos

export class RankingService {
  async getRanking() {
    // 1. Tentar buscar do cache
    try {
      const cached = await redis.get(RANKING_CACHE_KEY)
      if (cached) {
        logger.debug("ranking servido do cache")
        return JSON.parse(cached)
      }
    } catch (cacheErr) {
      // Se Redis falhar, continuar sem cache (não quebrar o ranking)
      logger.warn({ err: cacheErr }, "redis indisponível — buscando ranking do banco")
    }

    // 2. Cache miss — buscar do banco (lógica existente, não alterar)
    const ranking = await this.getRankingFromDatabase()

    // 3. Salvar no cache (não bloquear se falhar)
    try {
      await redis.set(
        RANKING_CACHE_KEY,
        JSON.stringify(ranking),
        "EX",
        RANKING_CACHE_TTL
      )
      logger.debug("ranking salvo no cache")
    } catch (cacheErr) {
      logger.warn({ err: cacheErr }, "falha ao salvar ranking no cache")
    }

    return ranking
  }

  // Invalidar cache quando uma partida termina
  async invalidarCacheRanking() {
    try {
      await redis.del(RANKING_CACHE_KEY)
      logger.info("cache de ranking invalidado")
    } catch (err) {
      logger.warn({ err }, "falha ao invalidar cache de ranking")
    }
  }

  // Método existente renomeado — NÃO alterar a lógica interna
  private async getRankingFromDatabase() {
    // ...lógica existente de query ao banco INTACTA...
  }
}
```

#### Etapa 2 — Invalidar cache ao fim de partida

No service que finaliza a partida, adicionar invalidação:

```typescript
// No método de finalizar partida (game-end ou similar):
// APÓS salvar o resultado no banco, invalidar o cache:
const rankingService = new RankingService()
await rankingService.invalidarCacheRanking()
```

#### Testes obrigatórios antes de avançar

- [ ] Build sem erros
- [ ] Acessar página de ranking — deve funcionar normalmente
- [ ] Verificar no log que "ranking servido do cache" aparece na segunda requisição
- [ ] Verificar que após finalizar uma partida, o cache é invalidado
- [ ] **Testar falha do Redis:** derrubar Redis e verificar que ranking
  ainda funciona (buscando do banco com warning no log)
- [ ] Verificar que TTL de 5 minutos é respeitado (ranking atualiza após 5min)

---

## SEMANA 3 — Proteção e Resiliência (risco médio)

### Objetivo
Adicionar rate limiting nos eventos Socket.IO e graceful shutdown
para tornar o servidor resistente a abusos e restarts sem perda de estado.

---

### TAREFA 3.1 — Rate limiting nos eventos Socket.IO

**Risco:** 🟡 Médio — pode bloquear eventos legítimos se mal configurado.
Testar exaustivamente antes de ativar em produção.

**ATENÇÃO CRÍTICA:** Os limites abaixo são conservadores. Se o jogo
tiver ações rápidas legítimas (ex: chat muito ativo), ajustar antes
de ativar. Nunca ativar em produção sem testar em staging primeiro.

#### Etapa 0 — Auditoria

```bash
# Ver todos os eventos Socket.IO registrados
grep -rn "socket.on\|io.on" server/src/modules/socket \
  --include="*.ts" | grep -v node_modules

# Ver se há algum rate limiting de Socket.IO existente
grep -rn "throttle\|rateLimit\|rate_limit\|limite" \
  server/src/modules/socket --include="*.ts"

# Ver como o Redis é usado para garantir que o client está disponível
grep -rn "redis" server/src/lib/redis.ts 2>/dev/null | head -5
```

#### Etapa 1 — Criar middleware de rate limit para Socket.IO

Criar `server/src/middleware/socket-rate-limit.ts`:

```typescript
import { Socket } from "socket.io"
import { redis } from "../lib/redis.js"
import { logger } from "../lib/logger.js"

type RateLimitOptions = {
  // Identificador do tipo de evento (ex: "jogo", "chat", "transferencia")
  evento: string
  // Máximo de ocorrências na janela
  limite: number
  // Duração da janela em segundos
  janela: number
  // Mensagem de erro enviada ao cliente
  mensagem?: string
}

export async function socketRateLimit(
  socket: Socket,
  opts: RateLimitOptions
): Promise<boolean> {
  const userId = (socket as any).userId ?? socket.id
  const key = `rl:socket:${opts.evento}:${userId}`

  try {
    const pipeline = redis.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, opts.janela)
    const results = await pipeline.exec()

    const count = results?.[0]?.[1] as number ?? 0

    if (count > opts.limite) {
      logger.warn(
        { userId, evento: opts.evento, count, limite: opts.limite },
        "socket rate limit excedido"
      )
      socket.emit("erro:rate-limit", {
        evento: opts.evento,
        mensagem: opts.mensagem ?? "Muitas ações em pouco tempo. Aguarde.",
        aguardar: opts.janela,
      })
      return false  // bloqueado
    }

    return true  // permitido
  } catch (err) {
    // Se Redis falhar, PERMITIR a ação (não bloquear por falha de infra)
    logger.warn({ err, userId, evento: opts.evento }, "redis indisponível no rate limit — permitindo")
    return true
  }
}
```

#### Etapa 2 — Aplicar nos eventos críticos

**IMPORTANTE:** Aplicar evento por evento, não em todos de uma vez.
Começar pelos de maior risco de abuso:

```typescript
// Exemplo de aplicação em evento de transferência:
socket.on("banco:transferir", async (data) => {
  // Verificar rate limit ANTES de qualquer processamento
  const permitido = await socketRateLimit(socket, {
    evento: "transferencia",
    limite: 6,      // máximo 6 transferências
    janela: 60,     // por minuto
    mensagem: "Muitas transferências. Aguarde 1 minuto.",
  })
  if (!permitido) return  // encerrar sem processar

  // ...lógica existente intacta...
})

// Evento de chat:
socket.on("chat:mensagem", async (data) => {
  const permitido = await socketRateLimit(socket, {
    evento: "chat",
    limite: 20,
    janela: 10,   // 20 mensagens por 10 segundos
    mensagem: "Aguarde um momento antes de enviar mais mensagens.",
  })
  if (!permitido) return

  // ...lógica existente...
})

// Evento de ação de jogo (comprar propriedade, pagar aluguel, etc.):
socket.on("jogo:acao", async (data) => {
  const permitido = await socketRateLimit(socket, {
    evento: "jogo-acao",
    limite: 10,
    janela: 5,    // 10 ações por 5 segundos (muito generoso)
    mensagem: "Ação muito rápida. Aguarde.",
  })
  if (!permitido) return

  // ...lógica existente...
})
```

**Limites recomendados por tipo de evento:**

| Evento | Limite | Janela | Justificativa |
|--------|--------|--------|---------------|
| Transferência | 6 | 60s | Ação financeira, não deve ser rápida |
| Chat | 20 | 10s | 2 msg/s é razoável |
| Ação de jogo | 10 | 5s | Anti-spam de cliques |
| Abrir baú | 3 | 30s | Prevenção de abuso |
| Compra loja | 10 | 60s | Ação financeira |

#### Etapa 3 — Feedback no frontend

No cliente, tratar o evento de rate limit para mostrar feedback:

```typescript
// Onde o Socket.IO é inicializado no cliente:
socket.on("erro:rate-limit", (data: {
  evento: string
  mensagem: string
  aguardar: number
}) => {
  // Usar o sistema de toast existente do projeto
  toast.error(data.mensagem)
})
```

#### Testes obrigatórios antes de avançar

- [ ] Build sem erros
- [ ] Testar ação normal — deve funcionar sem bloqueio
- [ ] Testar spam de transferências — deve bloquear após 6 em 1 minuto
- [ ] Verificar toast de erro no cliente ao ser bloqueado
- [ ] **Testar falha do Redis:** derrubar Redis e verificar que eventos
  continuam funcionando (sem bloquear por falha de infra)
- [ ] Verificar nos logs os eventos de rate limit excedido
- [ ] Testar reconexão após janela de tempo expirar

---

### TAREFA 3.2 — Graceful Shutdown completo

**Risco:** 🟡 Médio — muda o ciclo de vida do servidor, testar com deploy real

**Por que necessário:** Sem graceful shutdown, um restart do servidor
(deploy, crash, scale down) derruba todas as partidas ativas sem aviso.
Com graceful shutdown, o servidor avisa os jogadores e aguarda as
partidas terminarem antes de encerrar.

#### Etapa 0 — Auditoria

```bash
# Ver processo de shutdown atual
grep -rn "SIGTERM\|SIGINT\|process.on\|server.close" \
  server/src/index.ts

# Ver como partidas ativas são rastreadas
grep -rn "partida.*ativa\|session.*active\|activeSession" \
  server/src --include="*.ts" | grep -v node_modules

# Ver como Socket.IO encerra conexões
grep -rn "io.close\|socket.disconnect" \
  server/src --include="*.ts" | grep -v node_modules
```

#### Etapa 1 — Implementar graceful shutdown

No `server/src/index.ts`, substituir o handler de SIGTERM existente
(ou adicionar se não existir):

```typescript
import { logger } from "./lib/logger.js"

// Tempo máximo para shutdown (30 segundos)
const SHUTDOWN_TIMEOUT = 30_000

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, "iniciando graceful shutdown")

  // 1. Parar de aceitar novas conexões HTTP
  server.close(() => {
    logger.info("servidor HTTP encerrado — sem novas conexões")
  })

  // 2. Avisar todos os jogadores conectados via Socket.IO
  io.emit("servidor:reiniciando", {
    mensagem: "Servidor reiniciando em breve. Sua sessão será preservada.",
    em: 10_000,  // 10 segundos
  })

  // 3. Aguardar partidas ativas terminarem (até SHUTDOWN_TIMEOUT)
  const inicio = Date.now()
  let partidasAtivas = await contarPartidasAtivas()

  logger.info({ partidasAtivas }, "aguardando partidas ativas")

  while (partidasAtivas > 0 && Date.now() - inicio < SHUTDOWN_TIMEOUT) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    partidasAtivas = await contarPartidasAtivas()
    logger.info({ partidasAtivas, elapsed: Date.now() - inicio }, "aguardando...")
  }

  if (partidasAtivas > 0) {
    logger.warn({ partidasAtivas }, "timeout atingido com partidas ativas — encerrando forçado")
  }

  // 4. Encerrar conexões Socket.IO graciosamente
  await new Promise<void>(resolve => io.close(() => resolve()))
  logger.info("Socket.IO encerrado")

  // 5. Fechar conexão Redis
  try {
    await redis.quit()
    logger.info("Redis desconectado")
  } catch (err) {
    logger.warn({ err }, "erro ao desconectar Redis")
  }

  // 6. Fechar conexão com banco de dados
  try {
    await prisma.$disconnect()
    logger.info("banco de dados desconectado")
  } catch (err) {
    logger.warn({ err }, "erro ao desconectar banco")
  }

  logger.info("graceful shutdown concluído")
  process.exit(0)
}

// Registrar para os dois sinais de encerramento
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT",  () => gracefulShutdown("SIGINT"))

// Capturar erros não tratados ANTES do Sentry para garantir log
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaught exception — encerrando")
  process.exit(1)
})

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandled promise rejection")
  // Não encerrar por rejection — Sentry captura
})
```

#### Etapa 2 — Implementar contarPartidasAtivas

```typescript
// Verificar como sessões ativas são armazenadas no projeto atual
// e implementar a função de contagem adequada:

async function contarPartidasAtivas(): Promise<number> {
  try {
    // Ajustar o where conforme o status usado no projeto
    const count = await prisma.session.count({
      where: {
        status: "ativa",  // ajustar para o valor real usado no projeto
      },
    })
    return count
  } catch {
    return 0  // em caso de erro, assumir zero e continuar shutdown
  }
}
```

#### Etapa 3 — Frontend: tratar aviso de restart

```typescript
// No cliente, onde Socket.IO é configurado:
socket.on("servidor:reiniciando", (data: {
  mensagem: string
  em: number
}) => {
  // Mostrar aviso persistente (não dismissível)
  toast.warning(data.mensagem, { duration: data.em })
})
```

#### Testes obrigatórios antes de avançar

- [ ] Build sem erros
- [ ] Testar com servidor sem partidas ativas: `kill -SIGTERM <pid>`
  → deve encerrar limpo em < 5 segundos
- [ ] Testar com partida ativa: enviar SIGTERM e verificar aviso no cliente
- [ ] Verificar que após SHUTDOWN_TIMEOUT o servidor encerra mesmo com partidas
- [ ] Verificar logs de shutdown no console
- [ ] Fazer deploy real no Render e verificar que não há conexões perdidas

---

## SEMANA 4 — Filas assíncronas (risco alto)

### Objetivo
Mover processamento de recompensas e missões para filas BullMQ,
adicionando retry automático e eliminando falhas silenciosas.

**ATENÇÃO:** Esta é a semana de maior risco. As filas alteram o fluxo
de recompensas e missões. Testar exaustivamente em staging antes
de ativar em produção. Manter o código antigo comentado (não deletado)
até validar completamente.

---

### TAREFA 4.1 — Setup BullMQ

**Risco:** 🔴 Alto (configuração) — a configuração em si é baixo risco,
mas prepara o terreno para a Tarefa 4.2 que é alto risco

#### Etapa 0 — Auditoria

```bash
# Ver o fluxo atual de distribuição de recompensas
grep -rn "recompensa\|reward\|xp.*coins\|coins.*xp" \
  server/src/modules --include="*.ts" | grep -v node_modules | head -20

# Ver onde missões são atualizadas
grep -rn "mission.*update\|updateMission\|progresso.*missao" \
  server/src/modules --include="*.ts" | grep -v node_modules | head -10

# Confirmar que Redis está funcionando
node -e "const {createClient}=require('redis');const c=createClient({url:process.env.REDIS_URL});c.connect().then(()=>{console.log('redis ok');c.quit()})"
```

#### Etapa 1 — Instalação

```bash
cd server && npm install bullmq
```

#### Etapa 2 — Configuração das filas

Criar `server/src/lib/queues.ts`:

```typescript
import { Queue, Worker, QueueEvents } from "bullmq"
import { logger } from "./logger.js"

// Conexão Redis para BullMQ — separada da conexão principal
// para não interferir com Socket.IO adapter
const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379"),
  password: process.env.REDIS_PASSWORD,
}

// Configuração padrão de retry
const defaultJobOptions = {
  attempts: 3,           // tentar 3 vezes em caso de falha
  backoff: {
    type: "exponential" as const,
    delay: 2000,         // 2s, 4s, 8s entre tentativas
  },
  removeOnComplete: {
    age: 86400,          // remover jobs completos após 24h
    count: 1000,         // manter no máximo 1000 completos
  },
  removeOnFail: {
    age: 7 * 86400,      // manter jobs com falha por 7 dias (auditoria)
  },
}

// ── FILA: Recompensas de partida ─────────────────────────────────────────
export const recompensasQueue = new Queue("recompensas-partida", {
  connection,
  defaultJobOptions,
})

// ── FILA: Progresso de missões ───────────────────────────────────────────
export const missoesQueue = new Queue("progresso-missoes", {
  connection,
  defaultJobOptions,
})

// ── FILA: Invalidação de cache ───────────────────────────────────────────
export const cacheQueue = new Queue("cache-invalidation", {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 5 },
})

// Monitorar eventos das filas para logging
export function initQueueMonitoring() {
  const filas = [
    { nome: "recompensas-partida", fila: recompensasQueue },
    { nome: "progresso-missoes",   fila: missoesQueue },
    { nome: "cache-invalidation",  fila: cacheQueue },
  ]

  filas.forEach(({ nome, fila }) => {
    const events = new QueueEvents(nome, { connection })

    events.on("completed", ({ jobId }) => {
      logger.info({ fila: nome, jobId }, "job concluído")
    })

    events.on("failed", ({ jobId, failedReason }) => {
      logger.error({ fila: nome, jobId, motivo: failedReason }, "job falhou")
    })

    events.on("stalled", ({ jobId }) => {
      logger.warn({ fila: nome, jobId }, "job travado — será reprocessado")
    })
  })

  logger.info("monitoramento de filas iniciado")
}
```

#### Etapa 3 — Inicializar filas no boot

No `server/src/index.ts`, adicionar após inicializar Redis:

```typescript
import { initQueueMonitoring } from "./lib/queues.js"

// Após redis.connect():
initQueueMonitoring()
```

#### Testes obrigatórios antes de avançar

- [ ] Build sem erros
- [ ] Servidor inicia sem erros de conexão com BullMQ
- [ ] Logs mostram "monitoramento de filas iniciado"
- [ ] Verificar no Redis que as filas foram criadas:
  ```bash
  redis-cli keys "bull:*"
  ```
- [ ] **NÃO avançar para 4.2 sem concluir estes testes**

---

### TAREFA 4.2 — Migrar recompensas para BullMQ

**Risco:** 🔴 Alto — fluxo crítico de negócio. Testar em staging primeiro.

**REGRA CRÍTICA:** Manter o código síncrono atual comentado (não deletado)
até validar completamente em produção por pelo menos 48 horas.

#### Etapa 0 — Auditoria detalhada

```bash
# Mapear exatamente onde recompensas são distribuídas hoje
grep -rn "distribuirRecompensa\|rewardPlayers\|creditar.*xp\|creditar.*coins" \
  server/src/modules --include="*.ts" | grep -v node_modules

# Ver o fluxo de fim de partida
cat server/src/modules/session/session.service.ts | grep -A 30 "finalizar\|encerrar\|finish"

# Ver se há transação envolvida na distribuição atual
grep -B5 -A20 "distribuirRecompensa\|rewardPlayers" \
  server/src/modules/session/session.service.ts 2>/dev/null
```

#### Etapa 1 — Criar worker de recompensas

Criar `server/src/workers/recompensas.worker.ts`:

```typescript
import { Worker, Job } from "bullmq"
import { prisma } from "../lib/prisma.js"
import { logger } from "../lib/logger.js"

type RecompensaJob = {
  sessionId: string
  jogadores: Array<{
    userId: number
    posicao: number
    patrimonio: number
    duracaoMinutos: number
  }>
}

export function createRecompensasWorker() {
  const worker = new Worker<RecompensaJob>(
    "recompensas-partida",
    async (job: Job<RecompensaJob>) => {
      const { sessionId, jogadores } = job.data

      logger.info({ sessionId, qtdJogadores: jogadores.length }, "processando recompensas")

      // LÓGICA EXISTENTE DE RECOMPENSAS — mover para cá sem alterar
      // Apenas encapsular na fila, não mudar o cálculo
      for (const jogador of jogadores) {
        await prisma.$transaction(async (tx) => {
          // ...código existente de cálculo e crédito de XP e coins...
          // Copiar exatamente do service atual
        })
      }

      logger.info({ sessionId }, "recompensas distribuídas com sucesso")
    },
    {
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: parseInt(process.env.REDIS_PORT ?? "6379"),
        password: process.env.REDIS_PASSWORD,
      },
      concurrency: 5,  // processar até 5 jobs simultaneamente
    }
  )

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, sessionId: job?.data?.sessionId, err },
      "falha ao processar recompensas"
    )
    // Sentry já captura via error handler global
  })

  return worker
}
```

#### Etapa 2 — Enfileirar ao fim da partida

No service de fim de partida, substituir a chamada síncrona por
enfileiramento (manter código antigo comentado):

```typescript
import { recompensasQueue } from "../lib/queues.js"

// No método de finalizar partida:

// CÓDIGO ANTIGO — manter comentado por 48h em produção:
// await distribuirRecompensas(sessionId, jogadores)

// CÓDIGO NOVO — enfileirar:
await recompensasQueue.add(
  `recompensa-${sessionId}`,
  { sessionId, jogadores },
  {
    // Job ID único previne duplicatas se a requisição for repetida
    jobId: `recompensa-${sessionId}`,
  }
)

logger.info({ sessionId }, "recompensas enfileiradas")
```

#### Etapa 3 — Inicializar worker no boot

```typescript
// server/src/index.ts
import { createRecompensasWorker } from "./workers/recompensas.worker.js"

// Após inicializar filas:
const recompensasWorker = createRecompensasWorker()
logger.info("worker de recompensas iniciado")

// No graceful shutdown, adicionar:
await recompensasWorker.close()
logger.info("worker de recompensas encerrado")
```

#### Testes obrigatórios antes de avançar

- [ ] Build sem erros
- [ ] Finalizar uma partida em staging e verificar que recompensas são distribuídas
- [ ] Verificar log "recompensas distribuídas com sucesso"
- [ ] Verificar no Redis que job foi processado (status: completed)
- [ ] Testar falha forçada no worker e verificar que retry acontece
- [ ] Aguardar 48 horas em produção sem problemas antes de remover código antigo
- [ ] Após 48h: remover código antigo comentado e commitar
- [ ] **NÃO avançar para missões antes de validar recompensas por 48h**

---

## SEMANA 5 — Sequence Numbers (risco alto)

### Objetivo
Adicionar números de sequência em eventos Socket.IO para detectar
e rejeitar eventos fora de ordem, prevenindo exploits de timing.

**ATENÇÃO:** Esta tarefa requer mudança simultânea em cliente E servidor.
Deve ser feita em um único deploy coordenado — não deploy parcial.

---

### TAREFA 5.1 — Sequence numbers nos eventos de jogo

**Risco:** 🔴 Alto — muda o protocolo de comunicação. Clientes antigos
(abas abertas antes do deploy) não enviarão sequence numbers e serão
rejeitados. Planejar janela de manutenção ou período de transição.

#### Etapa 0 — Auditoria completa

```bash
# Listar TODOS os eventos Socket.IO do servidor
grep -rn "socket\.on(" server/src/modules/socket \
  --include="*.ts" | grep -v node_modules

# Listar TODOS os emits do cliente
grep -rn "socket\.emit(" client/src \
  --include="*.tsx" --include="*.ts" | grep -v node_modules | head -30

# Ver como o estado da partida é estruturado
grep -rn "interface.*Session\|type.*Session\|SessionState" \
  server/src --include="*.ts" | grep -v node_modules
```

#### Etapa 1 — Tipos compartilhados

Criar `server/src/shared/socket-events.ts` (e espelhar no cliente):

```typescript
// Estrutura base de todo evento de jogo
export type GameEvent<T = unknown> = {
  seq: number     // número de sequência — incrementa por jogador por partida
  sessionId: string
  payload: T
}

// Estado de sequência por jogador (armazenado no Redis)
export type PlayerSeqState = {
  lastSeq: number
}
```

#### Etapa 2 — Middleware de validação no servidor

```typescript
// server/src/middleware/sequence-validator.ts
import { Socket } from "socket.io"
import { redis } from "../lib/redis.js"
import { logger } from "../lib/logger.js"

export async function validateSequence(
  socket: Socket,
  sessionId: string,
  seq: number
): Promise<boolean> {
  const userId = (socket as any).userId
  const key = `seq:${sessionId}:${userId}`

  try {
    const lastSeqStr = await redis.get(key)
    const lastSeq = lastSeqStr ? parseInt(lastSeqStr) : -1

    // Aceitar seq = lastSeq + 1 (próximo esperado)
    // Aceitar seq = 0 (reconexão — resetar sequência)
    if (seq !== 0 && seq !== lastSeq + 1) {
      logger.warn(
        { userId, sessionId, esperado: lastSeq + 1, recebido: seq },
        "evento com sequência inválida — rejeitando"
      )
      socket.emit("erro:sequencia", {
        esperado: lastSeq + 1,
        recebido: seq,
        mensagem: "Evento fora de ordem. Recarregue a página se o problema persistir.",
      })
      return false
    }

    // Atualizar sequência (TTL = duração máxima de partida)
    await redis.set(key, String(seq), "EX", 3600)
    return true
  } catch (err) {
    // Se Redis falhar, permitir (não quebrar o jogo)
    logger.warn({ err, userId, sessionId }, "redis indisponível na validação de sequência")
    return true
  }
}
```

#### Etapa 3 — Aplicar nos eventos de ação de jogo

**Aplicar APENAS em eventos de ação de jogo** — não em eventos de
status, chat ou notificações. Começar com 1 evento e expandir:

```typescript
// Exemplo — evento de comprar propriedade:
socket.on("jogo:comprar-propriedade", async (event: GameEvent<{ propriedadeId: string }>) => {
  // Validar sequência primeiro
  const valido = await validateSequence(socket, event.sessionId, event.seq)
  if (!valido) return

  // ...lógica existente intacta...
})
```

#### Etapa 4 — Cliente: incrementar sequência

```typescript
// client/src/lib/socket-sequence.ts

// Contador por sessão — resetar ao entrar em nova partida
const seqCounters = new Map<string, number>()

export function nextSeq(sessionId: string): number {
  const current = seqCounters.get(sessionId) ?? -1
  const next = current + 1
  seqCounters.set(sessionId, next)
  return next
}

export function resetSeq(sessionId: string) {
  seqCounters.set(sessionId, -1)
}
```

```typescript
// No cliente, ao emitir evento de jogo:
import { nextSeq } from "@/lib/socket-sequence"

// ANTES:
socket.emit("jogo:comprar-propriedade", { propriedadeId })

// DEPOIS:
socket.emit("jogo:comprar-propriedade", {
  seq: nextSeq(sessionId),
  sessionId,
  payload: { propriedadeId },
})
```

#### Etapa 5 — Período de transição

Para evitar que clientes antigos (abas abertas) quebrem:

```typescript
// No servidor, durante a primeira semana após deploy:
// Aceitar eventos SEM seq (clientes antigos) mas logar warning

if (event.seq === undefined) {
  logger.warn({ userId, evento: "comprar-propriedade" }, "evento sem sequência — cliente desatualizado")
  // Processar mesmo assim durante transição
} else {
  const valido = await validateSequence(socket, event.sessionId, event.seq)
  if (!valido) return
}

// Após 1 semana: remover o bloco de compatibilidade e exigir seq em todos
```

#### Testes obrigatórios antes de avançar

- [ ] Build sem erros em cliente e servidor
- [ ] Evento em ordem aceito corretamente
- [ ] Evento fora de ordem rejeitado com mensagem ao cliente
- [ ] Reconexão (seq = 0) funciona corretamente
- [ ] Verificar que Redis salva e lê sequências corretamente
- [ ] **Testar falha do Redis:** eventos devem continuar funcionando
- [ ] Testar com 2 jogadores simultâneos — sequências independentes
- [ ] Verificar logs de sequência inválida quando forçado

---

## CHECKLIST FINAL DE PRODUÇÃO

Antes de considerar a implementação completa, validar:

### Segurança
- [ ] Sentry capturando erros com contexto (sem dados sensíveis)
- [ ] Rate limiting ativo em todos os eventos críticos Socket.IO
- [ ] Sequence numbers ativos em todos os eventos de ação de jogo
- [ ] Redis indisponível não quebra nenhuma funcionalidade (fallback)

### Performance
- [ ] Compressão HTTP ativa (`Content-Encoding: gzip` nas respostas)
- [ ] Compressão Socket.IO ativa
- [ ] Cache de ranking com TTL de 5 minutos
- [ ] Cache invalidado ao fim de partida

### Resiliência
- [ ] Graceful shutdown aguarda partidas ativas
- [ ] Workers BullMQ reiniciam automaticamente em falha
- [ ] Recompensas têm retry automático em caso de erro

### Observabilidade
- [ ] Logs estruturados com Pino em todos os módulos críticos
- [ ] Sentry recebendo erros de produção
- [ ] Logs de rate limit, sequência inválida e cache miss visíveis

### Reversão
Para cada implementação, o procedimento de reversão é:
1. Reverter o commit específico da tarefa
2. Fazer deploy
3. Verificar que comportamento anterior foi restaurado

Cada tarefa foi projetada para ser revertida independentemente
sem afetar as demais.