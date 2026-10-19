# Baseline de desempenho (Etapa 0)

> Referência: `docs/geral/OTIMIZACAO_SISTEMA.md`, seção 3. Medido em 19/10/2026 no ambiente de dev local (Docker, WSL2), commit `6513a7e`.
> Nada de código da aplicação foi alterado. A instrumentação foi só externa e temporária: `log_statement = 'all'` no Postgres de dev (já desfeito), um `next start` temporário no lugar do cliente de dev (já restaurado) e um container descartável com Chromium para o Lighthouse (imagem já removida).

## Como foi medido

| Script | O que faz |
|---|---|
| `scripts/otimizacao/medir-partida.mjs` | Joga uma partida real do Modo Tabuleiro com 4 bots **pela API e pelo Socket.IO** (registro, perfil, sala, início, rolar/revelar/escolher/comprar). Mede o tamanho de cada `session:updated` (bruto, gzip e quebra por campo) e a latência de cada requisição. |
| `scripts/otimizacao/contar-queries.mjs` | Cruza o log de statements do Postgres com as janelas de cada requisição: queries por jogada, as mais frequentes, ruído de fundo e payload por rodada. |
| `scripts/otimizacao/lighthouse.mjs` | Lighthouse mobile (Moto G Power, 4G lento simulado), autenticado com o token de um bot, cache HTTP limpo antes de cada execução, mediana de 3. |

Partidas: 50 rodadas, 4 bots, ~485 requisições e 674 broadcasts cada. Os bots compram tudo o que podem, e o saldo inicial é alto (R$ 500 mil) para evitar leilões que pausam o turno. Rodei duas partidas:
- **Sessão 118**, com o log de statements ligado, para contar queries. O log deixa o banco mais lento, então a latência dessa partida não vale como baseline.
- **Sessão 119**, sem log, para medir a latência.

O payload das duas bateu, com diferença abaixo de 2%.

---

## 1. Payload de `session:updated` (4 jogadores)

| Rodada | Bruto (KB) | Gzip (KB) | historico (linhas / KB) | sessionPosses (KB) | jogadores (KB) | tabuleiro (KB) |
|---|---|---|---|---|---|---|
| 1 | **18,0** | 2,7 | 3 / 0,5 | 12,0 | 2,8 | 2,5 |
| 10 | 33,1 | 4,3 | 62 / 10,7 | 16,5 | 2,8 | 2,5 |
| **20** | **59,4** | **6,8** | 191 / 33,6 | 19,9 | 2,8 | 2,5 |
| 30 | 91,4 | 9,9 | 365 / 64,3 | 21,4 | 2,8 | 2,5 |
| 40 | 124,1 | 13,0 | 548 / 96,7 | 21,4 | 2,8 | 2,5 |
| **50** | **153,7** | **15,7** | 713 / 125,9 | 21,8 | 2,8 | 2,5 |

- **Total na partida:** 674 broadcasts × 4 clientes, 51 MB brutos por cliente.
- **O que trafega na rede é próximo do gzip:** o Socket.IO usa `perMessageDeflate` (nível 6, `server/src/lib/socket.ts:111`).
- **Onde o bruto pesa:** CPU do servidor (`JSON.stringify` e deflate × 4 sockets), CPU do celular (inflate e `JSON.parse`) e memória do store.
- **Broadcasts por jogada:** 1 em `rolar`, `revelar` e `comprar`; **2 em `escolher-movimento`**.

## 2. Queries por jogada (sessão 118)

| Jogada | n | Queries (mediana) | Queries (máx) | Broadcasts por requisição |
|---|---|---|---|---|
| Rolar dados | 214 | **37** | 299 | 1 |
| Revelar dados | 51 | **40** | 124 | 1 |
| Escolher movimento | 147 | **75** | 420 | 2 |
| Comprar | 24 | **58** | 307 | 1 |
| Virada de rodada (escolher) | 41 | **100** | 293 | 2 |
| Virada de rodada (comprar) | 4 | **73** | 96 | 1 |

**Um único `loadSession` (por broadcast) faz cerca de 27 queries.** Detalhe de um `revelar` mediano (40 queries):

| Statement | Por requisição | Origem |
|---|---|---|
| SELECT session_players | 6 | Validações de turno + `jogadores` + `sessionPosses.player` + `debts.player` |
| SELECT loja_itens | 4 | `resolveUserItems`, 1 por jogador |
| SELECT banners / frames / badges | 4 + 4 + 4 | `include` do `shopItem.findMany`, 1 de cada por jogador |
| SELECT sessions | 3 | Validação + `findByIdSimple` |
| SELECT users | 2 | `user.findUnique` em lote (o Prisma agrupa) |
| BEGIN/COMMIT, UPDATE, demais relações | 15 | Consumo do crédito, times, histórico, posses, dívidas, propriedades |

Top 5 da partida inteira, em média por requisição: `SELECT session_players` 10,0; `SELECT loja_itens` 5,9; `SELECT frames` 5,9; `SELECT badges` 5,9; `SELECT banners` 5,9. Ou seja, **4 dos 5 statements mais frequentes são cosméticos**.

Também há trabalho fora das janelas das requisições: 1.472 statements, ~4,5% do total, vindos de timers, do progresso de missões (164 `INSERT usuario_missoes`) e do cleanup de negociações. Os picos de 300 a 420 queries numa requisição coincidem com esse trabalho caindo dentro da janela seguinte.

## 3. Latência (sessão 119, sem log no banco)

| Requisição | n | p50 (ms) | p95 (ms) | Máx (ms) |
|---|---|---|---|---|
| `rolar-dados` | 215 | **74** | **97** | 158 |
| `revelar-dados` | 51 | 71 | 112 | 147 |
| `escolher-movimento` | 151 | **124** | **164** | 279 |
| `escolher-movimento` (virada de rodada) | 37 | 206 | 321 | 342 |
| `comprar-casa-atual` | 19 | **96** | **221** | 221 |
| `comprar-casa-atual` (virada de rodada) | 9 | 95 | 185 | 185 |

**A latência cresce com a partida, junto com o payload:**

| Requisição | p50 rodadas 1-10 | p50 rodadas 21-30 | p50 rodadas 41-50 |
|---|---|---|---|
| `rolar-dados` | 37 | 76 | 84 |
| `escolher-movimento` | 61 | 125 | 155 |
| `revelar-dados` | 35 | 73 | 81 |

Banco local com cache quente e sem latência de rede até o Postgres. No Render free e no Neon, cada uma das ~27 a 75 idas ao banco por jogada paga a latência da rede, então lá o número de queries pesa muito mais do que aqui.

## 4. EXPLAIN ANALYZE (sessão 118: 724 linhas de histórico, ~30 mil no banco)

| Consulta | Plano | Tempo |
|---|---|---|
| `historico WHERE sessionId = $1` (como o Prisma faz hoje, **sem ORDER BY**) | Bitmap Index Scan em `historico_sessionId_idx` | 0,17 ms |
| `historico ... ORDER BY data DESC LIMIT 30` (proposta P1.1) | O mesmo índice + top-N heapsort | 0,23 ms |
| `dividas WHERE pago = false AND sessionId = $1` | Índice `dividas_sessionId_idx` + filtro | 0,02 ms |
| `dividas` por sessão + jogador | BitmapAnd dos dois índices | 0,05 ms |
| `session_posses` + `propriedades` da sessão | Índice composto + hash join | 0,08 ms |
| `session_players WHERE sessionId = $1` | Seq Scan (65 linhas na tabela) | 0,03 ms |

**Nenhuma consulta é lenta.** O gargalo é a **quantidade** de queries e o tamanho do resultado, não o plano. O índice `Historico(sessionId, data)` não se paga hoje.

## 5. Cliente: Lighthouse mobile (build de produção, cache limpo, mediana de 3)

| Página | Score | FCP (s) | LCP (s) | TBT (ms) | CLS | JS (KB) | Imagens (KB) | Total (KB) |
|---|---|---|---|---|---|---|---|---|
| `/login` | 88 | 0,9 | 3,5 | 181 | 0 | 309 | 0 | 3.045 |
| `/user` | 80 | 0,9 | 2,0 | 819 | 0 | 354 | 1.967 | 5.073 |
| `/user/loja` | **24** | 0,9 | **96,2** | **1.624** | **0,665** | 348 | **23.532** | **26.632** |
| Tela de jogo (`/user/game/119`, rodada 51) | 54 | 1,0 | **34,4** | 896 | 0 | 437 | 1.492 | 6.824 |

- **Música carregada em toda página:** `airs-of-change.mp3` (2.658 KB) é o maior recurso de **todas** as páginas, incluindo `/login`, e é baixado antes de qualquer interação.
- **Loja:** baixa 23,5 MB de imagens. Também tem o pior CLS (0,665), provavelmente porque as imagens das listas são `<img>` sem dimensões; isso fica a confirmar na Fase 4.
- **Tela de jogo:** LCP de 34 s com 1,5 MB de imagens mais a música. O elemento exato do LCP não foi registrado nesta medição; a Fase 4 deve guardar o relatório completo para identificá-lo.

## 6. Cold start do servidor (container de dev, `dist` compilado)

| Etapa | 1ª | 2ª | 3ª |
|---|---|---|---|
| `npx prisma migrate deploy` (nada pendente) | 1.815 ms | 1.270 ms | 1.268 ms |
| `node_modules/.bin/prisma migrate deploy` | 984 ms | 991 ms | 993 ms |
| `node dist/index.js` até "servidor iniciado" | 2.615 ms | 2.130 ms | 2.185 ms |

- **Boot com migrate:** ~3,4 a 4,4 s via `npx` e ~3,1 s com o binário local.
- **Boot sem migrate:** ~2,2 s.
- **Sem o hibernar do Render:** o despertar do container no free tier, que costuma levar dezenas de segundos, não entra nessa conta.

---

## Os achados da seção 2 batem com o código?

| Achado | Veredito | Observação |
|---|---|---|
| P0.1 `db push --accept-data-loss` no boot | **Confirmado** | `server/scripts/entrypoint.prod.sh`, com o `DELETE` da migration `20260608000001_add_animated_flag` fixo no script |
| P0.2 `withLock` sem dono e sem espera | **Confirmado** | 423 imediato, `del` sem conferir o token, TTL de 10s, nenhum lock sem Redis. O `revelarDados` já deixou de depender dele (consumo atômico, commit `d57da8e`), mas o resto continua exposto |
| P1.1 `historico: true` sem limite | **Confirmado e medido** | 125,9 KB na rodada 50, 82% do payload. **Correções:** (a) `UltimasJogadas` mostra só as **5** últimas (`slice(-5)`), não 30; a aba `Historico` usa o histórico inteiro. (b) `findAll`, a lista do lobby, também inclui `historico` de todas as salas em espera. (c) A consulta não tem `ORDER BY` e a ordem depende da ordem física da tabela |
| P1.2 N+1 de cosméticos | **Confirmado, maior que o estimado** | O `user.findUnique` é agrupado pelo Prisma (1 query), mas `shopItem.findMany` com `include` de banner, frame e badge **não**: são **4 queries por jogador**, ou 17 por broadcast com 4 jogadores e 25 com 6 (o documento estimava ~12) |
| P1.3 Cache invalidado a cada escrita | **Confirmado** | São **41** pontos de chamada (o documento diz 42). `escolher-movimento` gera 2 broadcasts e cada um reconstrói tudo (~27 queries) |
| P1.4 Payload desnecessário | **Confirmado e medido** | `sessionPosses` (com `player` e `propriedade` completos) pesa 12 KB já na rodada 1 e 21,8 KB no fim: **é o maior campo até a rodada ~15**. `tabuleiro` tem 2,5 KB (o documento diz 2,7). `jogadores` 2,8 KB |
| P1.5 Índices e pool | **Confirmado** | Os índices atendem e tudo roda abaixo de 0,3 ms. O índice composto do histórico não é necessário agora. Há um índice redundante: `session_posses_sessionId_idx` já é coberto por `(sessionId, playerId)`. `PrismaPg` usa a configuração padrão (`pg.Pool` com `max` 10) |
| P2.1 Imagens e áudio | **Confirmado** | `public/` tem 37 MB, 20 imagens acima de 300 KB (29 MB). MP3 de 2,7 MB e de 1,9 MB. A música é baixada em toda página |
| P2.2 `<img>` | **Corrigido** | São **22** arquivos com `<img>` (o documento diz 32) e 4 com `next/image` |
| P2.3 `useGameStore()` sem seletor | **Confirmado** | 13 componentes |
| P2.4 Sem `dynamic()` | **Confirmado** | 0 usos. `Inicio` tem 1.753 linhas, `BauAbertura` 887, `Board` 876 |
| P2.5 Duas libs de animação e de ícones | **Ajustado** | GSAP em 9 arquivos e Framer Motion em 20 (confere). FontAwesome em **15 arquivos** e Lucide em **48**. Os 34 e 51 do documento parecem contar imports, não arquivos |
| P2.6 Layout raiz | **Confirmado** | `<html lang="en" className={... jaro.className inconsolata.className}>` |
| P3 `node_modules/` da raiz versionado | **Confirmado** | 759 arquivos. O `package.json` da raiz tem `dotenv`, `lenis` e `zod` |
| P3 `nul` e `Zone.Identifier` | **Já resolvido** | Removidos no commit `dd9e104`; o `.gitignore` agora cobre `*:Zone.Identifier` |
| P3 `server/client-economia-core.ts` solto | **Confirmado, com explicação** | Arquivo **vazio, dono `root`, versionado**. É o ponto de montagem criado pelo volume do teste de cópia idêntica em `docker-compose.dev.yml`. Se for removido do git, o Docker recria no próximo `up`; o certo é ignorá-lo, não apagá-lo |
| P3 Fontes do Google no build | **Confirmado** | `next/font/google` (Jaro e Inconsolata) em `layout.tsx` |

## Achados novos (fora do documento)

1. **Sessão zumbi sendo jogada por timers:** a sessão 84 ("Bug6 Teste") está "Em Andamento" na **rodada 867**. O timeout de 60s continua jogando por ela sem ninguém conectado, gerando queries, histórico e broadcasts. Em produção, salas abandonadas fazem o mesmo. Não mexi nela.
2. **Rotas pesadas só para ler o status:** `quitSession`, `desistirSession`, `kickPlayer` e `endSession` carregam `findByIdSimple` inteiro (histórico, posses, dívidas) só para checar status e dono.
3. **Ordem do histórico:** sem `ORDER BY`, o cliente depende da ordem física da tabela.

## Metas da seção 4 frente ao baseline

| Meta | Hoje | Situação |
|---|---|---|
| Broadcast típico < 15 KB | 18 KB (rodada 1) a 154 KB (rodada 50) brutos | Fora, mesmo na rodada 1 (`sessionPosses` + `tabuleiro`) |
| Queries por broadcast −60% | ~27 por `loadSession` | Meta: ≤ 11 |
| p95 de `escolher-movimento` < 400 ms | 164 ms (321 ms na virada), local | Já dentro localmente. A meta só faz sentido medida no Render/Neon |
| LCP mobile da tela de jogo < 3 s | **34,4 s** | Muito fora |
| Imagens na primeira carga < 1,5 MB | Jogo 1,5 MB + 2,7 MB de música; loja 23,5 MB | Fora (loja e música) |

## Dados de teste deixados no banco de dev

Três salas `Baseline <timestamp>` (117 a 119, marcadas como "Finalizada") e 12 usuários `bot.otim.*@teste.local`. Para limpar, quando quiser:

```sql
-- sessions 117-119 e usuários bot.otim.* (banco de dev)
SELECT id FROM sessions WHERE nome LIKE 'Baseline %';
SELECT id FROM users WHERE email LIKE 'bot.otim.%@teste.local';
```

Para repetir a medição ao fim de cada fase, os comandos estão no cabeçalho de cada script em `scripts/otimizacao/`. O limite de autenticação (20 requisições a cada 15 minutos por IP) só permite **duas partidas** por janela de 15 minutos.
