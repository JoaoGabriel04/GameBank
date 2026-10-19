# Relatório final da otimização

> Plano: `docs/geral/OTIMIZACAO_SISTEMA.md`. Baseline: `baseline.md` (commit `6513a7e`). Detalhes e metodologia de cada fase: `fase-1.md` a `fase-6.md`.
> Todas as medições são do ambiente de dev local (Docker, WSL2), com os scripts de `scripts/otimizacao/`: partidas reais com 4 bots pela API e pelo Socket.IO, e Lighthouse mobile (4G lento simulado, cache limpo, mediana de 3). Nada foi medido no Render/Neon.

## Resumo

| | Baseline | Final | Variação |
|---|---|---|---|
| Broadcast `session:updated`, rodada 50 (bruto) | 153,7 KB | **12,9 KB** | −92% |
| Tráfego por cliente numa partida de 50 rodadas | 51 MB | **6,5 MB** | −87% |
| Queries por reconstrução da sessão (`loadSession`) | ~27 | **~10** | −63% |
| Queries por `escolher-movimento` (mediana) | 75 | **29** | −61% |
| p95 de `escolher-movimento` | 164 ms | **91 ms** | −45% |
| Peso total da loja (primeira carga) | 26,6 MB | **1,3 MB** | −95% |
| LCP mobile da tela de jogo | 35,2 s | **5,7 s** | −84% |
| Renders de componente por atualização do tabuleiro | 187 | **111** | −40% |
| Segunda requisição de um duplo clique | 423 em 45 de 45 | **0 × 423** | |
| Build do cliente sem rede | quebrava | **conclui** | |

## Metas da seção 4

| Meta | Baseline | Final | Situação |
|---|---|---|---|
| Broadcast típico < 15 KB | 18 a 154 KB | 7,8 a 13,3 KB | **Atingida** (Fase 2) |
| Queries por broadcast −60% | ~27 | ~10 | **Atingida** (Fase 2, −63%) |
| p95 de `escolher-movimento` < 400 ms com banco quente | 164 ms | 91 ms | **Atingida localmente.** Falta medir no Render/Neon, onde cada query paga a latência da rede |
| Imagens da primeira carga < 1,5 MB | Loja 23,5 MB; jogo 1,5 MB + 2,7 MB de música | Loja 0,9 MB; jogo 0,85 MB; música só ao tocar | **Atingida** (Fase 4) |
| LCP mobile da tela de jogo < 3 s | 35,2 s | 5,7 s | **Não atingida.** Ver "O que ficou para depois" |

Os números do Lighthouse só valem comparados lado a lado no mesmo dia: o TBT simulado depende da carga da máquina. Por isso o LCP "baseline" acima (35,2 s) é o da remedição da Fase 4, e não o 34,4 s do `baseline.md`.

## Itens da definição de pronto (seção 6)

| Item | Situação |
|---|---|
| Tabela "antes e depois" por fase | Em cada `fase-N.md` |
| `make validate` verde | Antes de cada push, em todas as fases (109 testes ao fim da Fase 5) |
| Nenhuma regressão em turno, compra, hipoteca, falência, leilão e empréstimo | Partidas completas de bots sem erro HTTP a cada fase, testes novos de lock, fila de emits, histórico, cosméticos e broadcast, e smoke no navegador. **Hipoteca, falência, leilão e empréstimo não são exercitados pelos bots.** A suíte cobre hipoteca (`rodada`, `economia-core`), leilão (`turno`) e empréstimo (`race`); **falência não tem teste** e não foi verificada |
| Entrypoint de produção sem `--accept-data-loss` | Feito (Fase 1). Uma migration com falha aborta o boot e alerta o Sentry |
| Lock com token | Feito (Fase 1). Também espera até ~1,5 s antes do 423 e tem fallback em memória sem Redis |

## O que foi feito, por fase

| Fase | Itens | Principais mudanças |
|---|---|---|
| 1 | P0.1, P0.2 | Boot sem `db push --accept-data-loss`. `withLock` com dono (liberação por script Lua), espera com backoff e fallback em memória. |
| 2 | P1.1, P1.2, P1.4 | Payload com as últimas 30 entradas do histórico (o resto é paginado por `GET /historico/:sessionId`). Cosméticos de todos os jogadores numa busca só, com cache de 60 s invalidado pelo admin. Broadcast sem o catálogo estático (`tabuleiro`, `sessionPosses[].propriedade`), recomposto no `gameStore`. |
| 3 | P1.3, P1.5 | Broadcasts consecutivos da mesma sessão, dentro de um `withLock`, coalescidos num só (`lib/fila-de-emits.ts`), ainda antes da resposta HTTP. Pool do Postgres configurável (`DB_POOL_MAX`) e com timeout de 10 s. Índice do histórico testado e descartado (o planner não o usa no volume atual). |
| 4 | P2.1, P2.2 | 17 PNGs → WebP no tamanho de uso (23,9 → 0,88 MB). Música só baixada ao tocar, por streaming. `loading="lazy"` em 36 `<img>` de listas. |
| 5 | P2.3, P2.4, P2.6 | Seletores (`useShallow`) nos 12 componentes que assinavam o `gameStore` inteiro, `memo` por valor em `BoardTile` e `PlayerAvatar`. `next/dynamic` só em `BauAbertura` e `PodiumModal` (os modais sempre montados foram testados e revertidos). `lang="pt-BR"` e fontes por variável CSS. |
| 6 | P3 | Fontes locais (build sem rede). Boot com o binário local do Prisma. Repositório sem `node_modules/` e `package.json` da raiz, `Zone.Identifier` e imagens sem uso. Log de tempo e tamanho de cada broadcast. Correção do logout por 429 do `/auth/me`. |

## Achados fora do plano

| Achado | Fase | Situação |
|---|---|---|
| O `AuthGuard` deslogava com 429 do limiter de login, que também contava o `/auth/me` | 5 | **Corrigido** (`55b75aa`) |
| A consulta do histórico não tinha `ORDER BY` e dependia da ordem física da tabela | Baseline | **Corrigido** na Fase 2 (`ORDER BY id DESC LIMIT 30`) |
| `server/client-economia-core.ts` é o ponto de montagem do teste do espelho do `economia-core`, não um arquivo solto | Baseline | Fora do Git e no `.gitignore` (Fase 6) |
| Sessão zumbi jogada pelos timers | Baseline | **Aberto.** A sessão 84 do banco de dev seguia "Em Andamento" na rodada 1.075 no fim da Fase 6. Em produção, salas abandonadas fazem o mesmo |
| `quitSession`, `desistirSession`, `kickPlayer` e `endSession` carregam a sessão inteira (`findByIdSimple`) só para checar status e dono | Baseline | **Aberto** |
| Índice redundante `session_posses(sessionId)`, coberto por `(sessionId, playerId)` | Baseline | **Aberto** (pede migration) |

## O que ficou para depois

1. **LCP da tela de jogo (5,7 s, meta de 3 s).** O elemento de LCP é o contêiner do tabuleiro com `fundo-tabuleiro.webp`, que só aparece depois do JS, do `load-session` e do socket. Alavancas: `<link rel="preload">` do fundo na rota do jogo e renderizar a moldura do tabuleiro antes de os dados chegarem.
2. **Medir no Render/Neon.** Todas as latências são locais. Lá, cada query paga a ida e volta da rede, então o corte de queries das Fases 2 e 3 deve render mais do que aqui, mas isso não foi medido. O log de broadcast da Fase 6 (`warn` acima de 500 ms ou 30 KB) já mostra os casos fora do normal em produção.
3. **Sessões abandonadas.** Encerrar automaticamente salas "Em Andamento" sem nenhum jogador conectado por um tempo, para os timers pararem de jogar por elas.
4. **Rotas que carregam a sessão inteira** só para checar status e dono (item 2 da tabela acima): trocar por uma consulta enxuta.
5. **Banners da loja vindos do Cloudinary** no tamanho original: pedir a versão otimizada na URL (`f_auto,q_auto,w_…`).
6. **Migrations fora do boot.** O Prisma ainda leva ~2,5 s por boot; só sai do caminho se as migrations virarem uma etapa separada do deploy no Render, o que depende da configuração do serviço.
7. **Índice do histórico `(sessionId, id)`.** Rever quando o histórico de produção chegar às centenas de milhares de linhas.
8. **Ícones (P2.5).** Migrar FontAwesome para Lucide aos poucos, ao tocar em cada arquivo. O `FontAwesomeIcon` ainda soma ~7.200 renders em 60 s de partida.
9. **Teste de falência.** Nenhum teste da suíte cobre falência, e os bots não chegam a falir. É o único fluxo da seção 6 sem verificação automática.
10. **Contagem de queries em produção.** Exigiria instrumentar o Prisma Client. Para investigar, o `scripts/otimizacao/contar-queries.mjs` continua valendo.
11. **Limpeza local.** O `node_modules/`, o `package.json` e o `package-lock.json` da raiz saíram do Git, mas continuam no disco de quem já tinha o repositório. O lockfile da raiz faz o Next avisar "multiple lockfiles" até ser apagado à mão.

## Como repetir as medições

Os comandos estão no cabeçalho de cada script em `scripts/otimizacao/`. Três cuidados aprendidos no caminho:
- **Limiter de login.** Não conta mais o `/auth/me`, mas o login dos bots continua limitado a 20 por 15 min por IP (duas partidas por janela). Reinicie o servidor de dev entre as medições: o limiter é em memória.
- **Medições e `make validate` em sequência, nunca em paralelo.** O build reinicia o servidor de dev pelo `tsx watch` e derruba a partida em andamento.
- **Lighthouse só lado a lado.** Compare os dois builds na mesma sessão; números de dias diferentes não são comparáveis.
