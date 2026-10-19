# Fase 2: payload enxuto e cosméticos em lote (P1.1, P1.2, P1.4)

> Referência: `docs/geral/OTIMIZACAO_SISTEMA.md`, seção 4. Baseline em `docs/otimizacao/baseline.md`.
> Medição com a mesma metodologia do baseline: partida de 50 rodadas com 4 bots pela API e pelo Socket.IO. A sessão 123, com log de statements, serviu para contar queries; a sessão 124, sem log, para a latência.

## O que mudou

| Commit | Item | Mudança |
|---|---|---|
| `a666bb2` | P1.1 | O payload leva só as **últimas 30** entradas do histórico, em ordem crescente como antes. A lista do lobby não leva mais histórico. A aba Histórico busca o resto em `GET /historico/:sessionId?limite=&antesDe=` (paginado por cursor, com `authenticate` + `authenticateRoom`), que substitui o antigo `/historico/all/:id`, público e sem uso. |
| `5dd866f` | P1.2 | Os cosméticos de todos os jogadores são resolvidos com **uma** busca no catálogo, usando o `user_items` que a query da sessão já traz. O catálogo (`loja_itens` + banner/frame/badge) fica em cache em memória por 60s e é invalidado por qualquer escrita bem-sucedida em `/api/admin`. Comprar e equipar mudam o `user_items`, que é sempre lido fresco. |
| `35b0498` | P1.4 | O broadcast não leva mais o catálogo estático (`tabuleiro` e `sessionPosses[].propriedade`); o REST continua completo. O cliente recompõe esses campos no `gameStore` a partir do que aprendeu nos payloads completos. As queries perderam o `sessionPosses.player`. |

**Divergência resolvida com o Gabriel:** o documento supunha que o cliente já tinha o catálogo de propriedades, mas não tinha (`sp.propriedade` é lido em 38 lugares). A opção escolhida foi reidratar no cliente, sem mexer nos 38 usos.

## Antes e depois

### Payload de `session:updated` (4 jogadores)

| Rodada | Bruto antes (KB) | Bruto depois (KB) | Gzip antes (KB) | Gzip depois (KB) |
|---|---|---|---|---|
| 1 | 18,0 | **7,8** | 2,7 | **1,2** |
| 20 | 59,4 | **12,9** | 6,8 | **2,2** |
| 50 | 153,7 | **12,9** | 15,7 | **2,3** |
| Total por cliente na partida | 51 MB | **8,5 MB** | | |

O payload deixou de crescer com a partida. Na rodada 50, o bruto ficou **−92%**.

### Queries

| | Antes | Depois | Variação |
|---|---|---|---|
| Por `loadSession` (1 broadcast) | ~27 | **~10** | **−63%** |
| Rolar (mediana por requisição) | 37 | 19 | −49% |
| Revelar | 40 | 22 | −45% |
| Escolher movimento | 75 | 36 | −52% |
| Comprar | 58 | 40 | −31% |
| Virada de rodada (escolher) | 100 | 65 | −35% |

As 17 queries de cosméticos por broadcast (`loja_itens`, `banners`, `frames`, `badges`, `users`) saíram do caminho quente: com o cache aquecido, ficam 0. Um `loadSession` agora faz: sessão, jogadores, times (2), usuários, posses, propriedades, histórico, dívidas e o jogador de cada dívida.

### Latência (sem log no banco)

| Requisição | p50 antes | p50 depois | p95 antes | p95 depois |
|---|---|---|---|---|
| `rolar-dados` | 74 | **45** | 97 | **58** |
| `revelar-dados` | 71 | **43** | 112 | **58** |
| `escolher-movimento` | 124 | **78** | 164 | **104** |
| `escolher-movimento` (virada de rodada) | 206 | **149** | 321 | **188** |
| `comprar-casa-atual` | 96 | **55** | 221 | **114** |

A latência deixou de crescer com a partida. O p50 de `escolher-movimento` era de 61 ms nas rodadas 1-10 e 155 ms nas 41-50; agora é **51 ms → 83 ms**.

## Metas da seção 4

| Meta | Antes | Depois | Situação |
|---|---|---|---|
| Broadcast típico < 15 KB | 18 a 154 KB | **7,8 a 12,9 KB** | **Atingida** |
| Queries por broadcast −60% | ~27 | ~10 | **Atingida (−63%)** |
| p95 de `escolher-movimento` < 400 ms | 164 ms | 104 ms | Atingida localmente (falta medir no Render/Neon) |

## Verificação

- **Testes novos (`make validate` verde antes de cada push):**
  - `historico.test.ts`: payload com 30 entradas em ordem crescente; paginação até acabar.
  - `cosmeticos.test.ts`: o lote dá o mesmo resultado que o individual; o mapper funciona com e sem `user_items` na query; o cache vale até ser invalidado; equipar aparece na hora.
  - `session-broadcast.test.ts`: o broadcast sai sem catálogo, sem mutar o objeto do REST e mantendo o mascaramento de `ultimoDado1/2`.
- **Smoke no navegador (`scripts/otimizacao/smoke-navegador.mjs`):**
  - Tela de jogo aberta no Chromium durante 90s de broadcasts reais: **0 exceções de JavaScript**.
  - Nomes das propriedades continuam na tela (24 no início e 24 no fim).
- **Partidas de 50 rodadas:** sem nenhum erro HTTP usando só os broadcasts enxutos.

## Observações

- **Cache entre instâncias:** em produção com mais de uma instância, uma edição de cosmético no admin aparece nas outras instâncias em até 60s (TTL do cache). Na instância que recebeu a edição, aparece na hora.
- **Busca da aba Histórico:** ela pesquisa nas entradas já carregadas (a primeira página tem 100 e o botão "Carregar mais antigos" traz o resto), não no histórico inteiro de uma vez.
- **Ainda há 2 broadcasts por `escolher-movimento`:** cada um reconstrói a sessão inteira. Isso é a P1.3 (coalescer emits), na Fase 3.
