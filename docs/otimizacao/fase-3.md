# Fase 3: coalescer broadcasts (P1.3) + índices e pool (P1.5)

> Referência: `docs/geral/OTIMIZACAO_SISTEMA.md`, seção 4. Fases anteriores: `fase-1.md`, `fase-2.md`.
> Medição com a mesma metodologia: partida de 50 rodadas com 4 bots. A sessão 127, com log de statements, serviu para contar queries; a sessão 128, sem log, para a latência. "Antes" é o fim da Fase 2.

## O que mudou

| Commit | Item | Mudança |
|---|---|---|
| `6fe25ba` | P1.3 | `lib/fila-de-emits.ts`: dentro do `withLock` mais externo, os emits da sessão entram numa fila (`AsyncLocalStorage`) em ordem. No fim do escopo, ainda com o lock e **antes da resposta HTTP**, a fila é descarregada. Snapshots **consecutivos** da mesma sessão viram um só, com o estado final; um evento entre dois snapshots (ex.: `evento:mudou`) mantém os dois. Fora de um lock, tudo continua imediato. A fila também é descarregada quando a ação falha. `emitToRoom`, `emitToPlayer` e os eventos de sala do `socket.handler` passam pela fila. |
| `6800fac` | P1.5 | Pool do Postgres: `max` via `DB_POOL_MAX` (default 10), `connectionTimeoutMillis` de 10s e `idleTimeoutMillis` de 30s. |

### Ordem e momento preservados

- **Momento do broadcast:** a descarga acontece antes de soltar o lock, então o broadcast ainda sai **antes** da resposta HTTP, como antes. A lógica do cliente que depende disso (o hold do peão, a detecção de timeout da escolha) não muda.
- **Cache:** `emitUpdatedSession` invalida o cache na hora (leituras REST da mesma requisição veem o estado novo) e de novo na descarga (uma leitura concorrente pode ter repovoado o cache com estado antigo).
- **Ordem:** só coalesce snapshots **adjacentes**, sem nada entre eles. Por isso a virada de rodada continua com ~1,7 broadcast: snapshot, `evento:mudou`, snapshot.

## Antes e depois

### Broadcasts

| | Fim da Fase 2 | Fase 3 |
|---|---|---|
| `escolher-movimento` (por requisição) | 2,0 | **1,0** |
| `escolher-movimento` na virada de rodada | 2,0 | **1,7** |
| Broadcasts na partida (50 rodadas) | 681 | **529 (−22%)** |
| Tráfego por cliente na partida | 8,5 MB | **6,5 MB** |
| Baseline (Etapa 0), para referência | 674 broadcasts, 51 MB | |

### Queries por jogada (mediana)

| Jogada | Baseline | Fim da Fase 2 | Fase 3 |
|---|---|---|---|
| Escolher movimento | 75 | 36 | **29** |
| Virada de rodada (escolher) | 100 | 65 | **59** |
| Rolar | 37 | 19 | 19 |
| Revelar | 40 | 22 | 22 |
| Comprar | 58 | 40 | 40 |

A meta da seção 4 ("queries por broadcast −60%") já tinha sido atingida na Fase 2 (~27 → ~10 por `loadSession`). A Fase 3 corta os broadcasts **repetidos** dentro da mesma jogada.

### Latência (sem log no banco)

| Requisição | p50 baseline | p50 Fase 2 | p50 Fase 3 | p95 baseline | p95 Fase 2 | p95 Fase 3 |
|---|---|---|---|---|---|---|
| `escolher-movimento` | 124 | 78 | **71** | 164 | 104 | **91** |
| `escolher-movimento` (virada de rodada) | 206 | 149 | 151 | 321 | 188 | **172** |
| `rolar-dados` | 74 | 45 | 50 | 97 | 58 | 63 |
| `revelar-dados` | 71 | 43 | 47 | 112 | 58 | 70 |
| `comprar-casa-atual` | 96 | 55 | 88 | 221 | 114 | 114 |

- **Ganho onde havia broadcasts duplicados:** `escolher-movimento` melhorou p50 −9% e p95 −13%.
- **Demais jogadas:** já tinham 1 broadcast, então não havia o que coalescer. As variações ficam dentro do ruído da medição local; `comprar` tem só 25 amostras.
- **Meta "p95 de `escolher-movimento` < 400 ms":** atingida com folga localmente (91 ms). Ainda precisa ser medida no Render/Neon.

## P1.5: índices e pool

### Índice `Historico(sessionId, …)`: testado e **não adicionado**

Depois da P1.1, a consulta do payload passou a ser `WHERE sessionId = $1 ORDER BY id DESC LIMIT 30`. Testei o índice `(sessionId, id)` num `BEGIN ... ROLLBACK`, com `ANALYZE`, nas sessões 84 (993 linhas) e 59 (a mais antiga):

| Plano | Sessão 84 | Sessão 59 |
|---|---|---|
| Sem índice: chave primária de trás para frente + filtro | 0,58 ms (2.735 linhas descartadas) | 0,45 ms (2.858 descartadas) |
| Com índice + `ANALYZE` (consulta completa) | 0,93 ms (o planner **continua** usando a chave primária) | 0,83 ms (idem) |

No volume atual (~30 mil linhas, todas em cache), o planner não usa o índice e o tempo fica abaixo de 1 ms com ou sem ele. Pela regra do documento ("sem número depois não conta"), não entrou. **Rever** quando o histórico de produção passar da casa das centenas de milhares de linhas: o plano atual descarta as linhas das outras sessões, e esse custo cresce com o volume.

### Pool

| | Antes | Depois |
|---|---|---|
| `max` | 10 (padrão do pg, implícito) | `DB_POOL_MAX`, default 10 (documentado no `.env.example`: somar todas as instâncias e ficar abaixo do limite do banco) |
| Pool esgotado | A requisição esperava conexão **para sempre** | Erro em **10 s** ("timeout exceeded when trying to connect"), logado |

Verificado com `DB_POOL_MAX=1`: uma query presa em `pg_sleep(12)` fez a segunda falhar em 10,3 s.

**Não feito:** um log explícito de "esperando conexão" exigiria acessar o `pg.Pool` direto, e o pacote `pg` hoje só existe como dependência transitiva do `@prisma/adapter-pg`. Declará-lo no `package.json` pede `npm install` e reconstruir a imagem. O timeout já torna a saturação visível como erro.

## Verificação

- `make validate` verde antes de cada push (109 testes).
- `fila-de-emits.test.ts`: fora do escopo é imediato; snapshots consecutivos viram 1; um evento no meio mantém a ordem; escopo aninhado só repassa; descarrega mesmo com erro.
- Partidas completas de 50 rodadas sem nenhum erro HTTP.

## Observação de método

Uma das medições caiu na rodada 19 porque o `make validate` rodava em paralelo: o build (`prisma generate`/`tsc`) mexe em arquivos monitorados pelo `tsx watch` e reinicia o servidor de dev. Medições e validações precisam rodar **em sequência**.
