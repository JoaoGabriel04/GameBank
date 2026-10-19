# Otimização geral do GameBank: auditoria, plano e medição

> Base: clone do `main` em 19/10/2026 (commit `783f98a`). Escopo: servidor, banco, sockets, cliente, build e deploy do **Modo Tabuleiro e plataforma**. Mapa 2D fora do escopo.
> Cada achado diz se foi **MEDIDO** (número real do código/build) ou **ESTIMADO** (precisa ser confirmado na Etapa 0).

---

## 0. Regras de execução (gate de aprovação)
1. **Etapa 0 e 1 são somente medição e leitura.** Não altere código de aplicação.
2. Apresente os números e **aguarde aprovação** antes de implementar qualquer fase.
3. Implemente **uma fase por vez**, um commit por item, `make validate` antes de cada push, e **rode a medição de novo** ao fim de cada fase para provar o ganho. Otimização sem número "depois" não conta como feita.
4. Se algo contradizer este documento, pare e reporte.

---

## 1. O que foi medido nesta auditoria

| Item | Resultado |
|---|---|
| Build do cliente (Next 16 + Turbopack) | Compila em 12,5s, TypeScript em 13,8s, 30 páginas. **Saudável.** |
| JS total do cliente (todas as rotas) | 2,3 MB bruto / ~680 KB gzip. Maior chunk compartilhado: 304 KB (gsap + socket.io). **Razoável.** |
| Pasta `client/public` | **37 MB** (imagens 31 MB, sons 4,7 MB) |
| Imagens acima de 300 KB | **20 arquivos, ~29,5 MB** (várias de 1,6 a 2,5 MB, em PNG) |
| Sons | `airs-of-change.mp3` 2,7 MB, `tempo-acabando.mp3` 1,9 MB |
| Uso de `<img>` x `next/image` | 32 arquivos com `<img>`, só 4 com `next/image` |
| `useGameStore()` sem seletor | 13 componentes (re-renderizam a cada mudança do store) |
| Pontos que chamam `emitUpdatedSession` | 42 |
| `tabuleiro` estático dentro do payload | 2,7 KB em **todo** broadcast |

Não foi possível medir latência real, queries por jogada nem cold start: o ambiente de auditoria não tem o banco/Redis/Render. A **Etapa 0** abaixo mede isso na máquina do Gabriel.

---

## 2. Achados por prioridade

### P0: segurança operacional (corrigir primeiro, é pequeno)

**P0.1 `db push --accept-data-loss` no boot de produção** (MEDIDO)
`server/scripts/entrypoint.prod.sh`: se `migrate deploy` falha duas vezes, o script roda `npx prisma db push --accept-data-loss`. Isso pode **apagar colunas e dados** de produção sem aviso. Também apaga manualmente uma linha de `_prisma_migrations` com nome fixo.
Correção: remover o `db push`. Se a migration falhar, **o deploy deve falhar** e alertar (Sentry), não destruir. Corrigir a migration `20260608000001_add_animated_flag` de forma definitiva e tirar o `DELETE` hardcoded.

**P0.2 `withLock` sem dono e sem espera** (MEDIDO)
`server/src/middleware/lock.middleware.ts`:
- Se o lock está ocupado, responde **423 na hora** ("Recurso ocupado"). É a causa de erros falsos já vistos em jogo (clique que perde a corrida contra o timeout, duplo clique).
- O `finally` faz `redis.del(lockKey)` **sem conferir o dono**: se a ação passar de 10s (free tier lento), o lock expira, outra requisição o pega, e a primeira apaga o lock da segunda. Duas ações passam ao mesmo tempo.
- Sem Redis, executa **sem nenhum lock**.
Correção: valor único por aquisição (token) e liberação via script Lua (só apaga se o token for o seu); espera curta com retry/backoff (ex.: até ~1,5s) antes de devolver 423; TTL proporcional; logar quando o lock estoura o TTL.

### P1: maior ganho de desempenho no servidor

**P1.1 `historico: true` sem limite no payload da sessão** (MEDIDO, impacto ESTIMADO)
`session.repository.ts` (`findByIdSimple`, e outros dois): carrega **todo o histórico da partida** em toda leitura e em todo broadcast para todos os jogadores. O histórico cresce a cada aluguel, renda passiva (uma linha por jogador por rodada), compra e evento. Em partida longa, estimativa de **100 KB ou mais por broadcast** (a confirmar na Etapa 0), enviado a até 6 clientes a cada ação.
Correção: o payload da sessão leva só as **últimas N entradas** (N = 30, o que a UI de "Últimas jogadas" usa); a aba Histórico completa busca por endpoint paginado sob demanda. Confirmar quais telas leem `session.historico`.

**P1.2 N+1 de cosméticos em toda reconstrução da sessão** (MEDIDO)
`session-mapper.ts` chama `shopRepository.resolveUserItems` **por jogador**, e cada chamada faz `user.findUnique` (linha inteira do usuário, sem `select`, inclusive campos sensíveis) + `shopItem.findMany`. Com 6 jogadores são **~12 queries extras por broadcast**, para dados que quase nunca mudam (banner, moldura, título).
Correção: (a) uma query em lote (`user.findMany` com `select` mínimo + um único `shopItem.findMany`); (b) cache de cosméticos resolvidos por usuário (Redis ou memória, TTL de minutos), **invalidado ao equipar/desequipar/comprar**; (c) sempre usar `select`.

**P1.3 Cache invalidado em toda escrita, então nunca ajuda** (MEDIDO)
`emitUpdatedSession` faz `invalidateCache` e depois `loadSession`: toda mutação reconstrói tudo do banco. O cache só serve leituras REST. Com 42 pontos de chamada e várias chamadas por jogada (rolar, revelar, escolher, resolver casa), uma única jogada dispara várias reconstruções completas.
Correção: **coalescer emits** por sessão (várias chamadas no mesmo tick/~50ms viram um broadcast só, sempre com o estado final); manter ordem e garantir que nenhum evento dependente do snapshot (`evento:mudou`, toasts) seja emitido antes dele.

**P1.4 Payload sem necessidade** (MEDIDO)
- `sessionPosses` inclui `player: true` (linha inteira do jogador, duplicada) e `propriedade: true` (catálogo estático repetido a cada broadcast). Usar `select` e referenciar a propriedade por `propId` (o cliente já tem o catálogo).
- `tabuleiro` (2,7 KB) vai em todo broadcast: enviar só no primeiro carregamento.
- `user_items` cru no select dos jogadores quando já se resolve os cosméticos.
Meta: broadcast típico **abaixo de 15 KB** no fim da partida.

**P1.5 Índices e timers**
- Índices existem nas tabelas de jogo (bom). Confirmar na Etapa 0, com `EXPLAIN`, as consultas quentes de `Debt` (filtradas por `pago`), `Historico` (por `sessionId` + ordenação) e `SessionPlayer`; adicionar índice composto `Historico(sessionId, data)` se houver ordenação.
- Pool de conexões: `PrismaPg` está com configuração padrão. Definir `max` conforme o limite do banco hospedado e logar espera por conexão.

### P2: cliente (carregamento e fluidez)

**P2.1 Imagens e áudio pesados** (MEDIDO)
20 PNGs entre 0,9 e 2,5 MB (~29,5 MB) servidos como estão; sons de 2,7 MB e 1,9 MB.
Correção: converter para **WebP/AVIF** nas dimensões reais de uso (a maioria exibe em centenas de px, não 2000), usar `next/image` com `sizes`; meta: cada imagem de UI abaixo de 150 KB, fundos abaixo de 300 KB. Reduzir os MP3 (música de fundo para ~96 kbps, efeito de tempo acabando recortado/comprimido), **carregar música só após interação** e pré-carregar apenas os SFX curtos. Isso pesa mais no mobile e no free tier de banda do que qualquer otimização de JS.

**P2.2 `<img>` em 32 arquivos** (MEDIDO)
Sem `loading="lazy"`/dimensões o navegador baixa tudo cedo e causa saltos de layout. Migrar as imagens de lista (loja, cofre, ranking) para `next/image` ou, no mínimo, `loading="lazy"`, `decoding="async"` e `width/height`.

**P2.3 Re-renders por store sem seletor** (MEDIDO)
13 componentes usam `useGameStore()` inteiro (Game/sections, Loja, PropertyDetailModal, Board, TurnoBanner, LeilaoModal...). Qualquer mudança no store (cada broadcast, cada flag de `loading`) re-renderiza todos. Trocar por seletores (`useGameStore(s => s.currentSession)`, `useShallow` para vários campos). `Board/index.tsx` e `Inicio/index.tsx` (1.753 linhas) são os mais caros.

**P2.4 Código pesado carregado de início** (MEDIDO, nenhum `dynamic()` no projeto)
`BauAbertura` (887 linhas), `PodiumModal`, `NegotiationResponseModal`, `LeilaoModal`, `TurnoModal` e as telas admin não precisam estar no bundle inicial. Carregar com `next/dynamic` onde o uso é condicional.

**P2.5 Duas bibliotecas de animação e duas de ícones** (MEDIDO)
GSAP (9 arquivos) e Framer Motion (20 arquivos) convivem; FontAwesome (34 imports) e Lucide (51). A preferência do projeto é Lucide ou FontAwesome, sem emojis. Consolidar ícones gradualmente (migrar FontAwesome para Lucide quando tocar no arquivo). Não migrar animações em massa: só remover se uma das bibliotecas ficar sem uso.

**P2.6 Detalhes do layout raiz** (MEDIDO)
`layout.tsx`: `<html lang="en">` num app pt-BR (acessibilidade/hifenização); as duas classes de fonte (`jaro.className` e `inconsolata.className`) vão no mesmo elemento e uma sobrescreve a outra. Ajustar `lang="pt-BR"` e aplicar fontes via variáveis CSS (`variable`) em vez de `className` duplicado.

### P3: deploy, build e higiene

- **Boot do servidor**: `npx prisma migrate deploy` roda a cada start (cold start do Render já é lento). Usar o binário local (`node_modules/.bin/prisma`) e medir o tempo de boot; considerar rodar migrations como etapa separada do deploy.
- **Build do cliente depende do Google Fonts** (`next/font/google`): se o fetch falhar, o build quebra (reproduzido na auditoria). Trocar por `next/font/local` com os arquivos em `public/fonts` (já existe `Inter` local).
- **Dockerfile do cliente** copia `next.config.ts` e roda `npx next start` (ok), mas o deploy real é Netlify. Confirmar qual caminho é usado em produção para não manter dois.
- **Higiene do repositório**: `node_modules/` na **raiz está versionado** (759 arquivos) e há `package-lock.json` na raiz que faz o Next avisar "multiple lockfiles" e inferir a raiz errada (definir `turbopack.root` ou remover o `package.json` da raiz); arquivos `nul`, `FIX_COMPRA_TRAVADA_LOADING.md:Zone.Identifier` e `server/client-economia-core.ts` soltos. Limpar com aprovação.
- **Observabilidade**: Sentry tem amostragem baixa (0,05 a 0,1), adequada. Falta métrica própria: tempo de `emitUpdatedSession`, tamanho do payload, contagem de queries por requisição. Adicionar logs de timing (pino) para os endpoints de turno.

---

## 3. Etapa 0: baseline (medir antes de mexer)

Rodar localmente com Docker (`make dev-up`) e entregar uma tabela "antes":

1. **Payload**: tamanho (bytes brutos e gzip) do evento `session:updated` em partida de 4 jogadores nos pontos: rodada 1, 20, 50. Script de bots via Socket.IO ou instrumentação temporária no `emitSessionUpdated`.
2. **Queries por jogada**: ativar log de queries do Prisma (`log: ["query"]`) e contar queries em: rolar dados, revelar, escolher movimento, comprar, virada de rodada. Reportar total e as 5 mais frequentes.
3. **Latência**: p50/p95 de `rolar-dados`, `escolher-movimento`, `comprar` com 4 jogadores (script `autocannon` ou `k6`).
4. **EXPLAIN ANALYZE** das consultas de `findByIdSimple`, `Debt`, `Historico`.
5. **Cliente**: Lighthouse mobile (Moto G / 4G lento) em `/login`, `/user`, `/user/loja` e na tela de jogo; reportar LCP, TBT, CLS, JS transferido e bytes de imagem.
6. **Cold start**: tempo de boot do servidor (do início ao `servidor iniciado`) com e sem `migrate deploy`.

Salvar tudo em `docs/otimizacao/baseline.md`.

---

## 4. Fases de implementação (após aprovação de cada uma)

| Fase | Conteúdo | Medir depois |
|---|---|---|
| 1 | P0.1 e P0.2 (entrypoint seguro, lock com token e retry) | testes de concorrência; nenhum 423 falso em duplo clique |
| 2 | P1.1, P1.2, P1.4 (payload enxuto, cosméticos em lote/cache) | bytes do broadcast, queries por broadcast |
| 3 | P1.3 (coalescer emits) + P1.5 (índices, pool) | queries por jogada, p95 |
| 4 | P2.1 e P2.2 (imagens, áudio, lazy) | bytes de imagem, LCP |
| 5 | P2.3, P2.4, P2.6 (seletores, `dynamic`, layout) | TBT, re-renders (React Profiler) |
| 6 | P3 (boot, fontes locais, higiene, métricas) | tempo de boot, build offline |

Metas de aceite: broadcast típico < 15 KB; queries por broadcast reduzidas em pelo menos 60%; p95 de `escolher-movimento` abaixo de 400 ms com banco quente; LCP mobile da tela de jogo abaixo de 3 s em 4G; peso de imagens da primeira carga abaixo de 1,5 MB.

---

## 5. Riscos e o que não mexer
- Não alterar regras do jogo, economia nem ordem de turnos. Otimização não pode mudar comportamento.
- **Sigilo dos dados às cegas**: o mascaramento de `ultimoDado1/2` enquanto `aguardandoEscolha` (e o campo `duplo`) deve permanecer em qualquer payload novo.
- Coalescer emits e cachear cosméticos exigem teste de ordem e invalidação: sem isso reaparecem bugs de "tela desatualizada" já corrigidos antes.
- Qualquer mudança de schema (índice) via migration normal, nunca `db push`.
- Mantém o padrão do projeto: `finally` + timeout + estado visível em toda trava de UI.

## 6. Definição de pronto
- Tabela "antes e depois" por fase, com as metas da seção 4 atingidas ou justificadas.
- `make validate` verde, nenhuma regressão em turno, compra, hipoteca, falência, leilão, empréstimo.
- Entrypoint de produção sem `--accept-data-loss`; lock com token.
- Documento `docs/otimizacao/relatorio.md` com resultados finais e o que ficou para depois.
