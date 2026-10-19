# Fase 5: seletores, `dynamic()` e layout raiz (P2.3, P2.4, P2.6)

> Referência: `docs/geral/OTIMIZACAO_SISTEMA.md`, seção 4. Fases anteriores: `fase-1.md` a `fase-4.md`.
> Re-renders: `scripts/otimizacao/contar-renders.mjs` (servidor de dev, 60 s de partida real com 4 bots, mesmo critério das React DevTools). Lighthouse: mesma metodologia da Fase 4 (mobile, 4G lento simulado, cache limpo, mediana de 3), com os dois builds medidos lado a lado.
> "Antes" é o fim da Fase 4 (`b72e7f1`, que só acrescenta o script de contagem).

## O que mudou

| Commit | Item | Mudança |
|---|---|---|
| `7e74014` | P2.3 | Os 12 componentes que assinavam o `gameStore` inteiro (`useGameStore()`) passam a selecionar só os campos que leem (`useShallow`). `BoardTile` e `PlayerAvatar` ganham `React.memo` com comparação por valor dos campos exibidos: posse e jogador chegam como objetos novos a cada broadcast, então um memo por referência não evitaria nada. |
| `34ed57e` | P2.6 | `<html lang="pt-BR">`. As fontes passam a ser expostas como variáveis CSS (`--font-jaro-next`, `--font-inconsolata-next`) em vez de duas `className` no mesmo elemento, em que uma sobrescrevia a outra. O tema do Tailwind e o `body` leem dessas variáveis, o que também ativa as fontes de fallback com métricas ajustadas do `next/font` (`"Jaro", "Jaro Fallback"`). |
| `ead484e` + o commit desta fase | P2.4 | `next/dynamic` só onde o componente monta **sob condição**: `BauAbertura` (início e loja; o chunk é pedido junto com a API de abrir o baú) e `PodiumModal` (fim da partida). Na loja, a `BauAbertura` passou a montar só com `resultado`, como já acontecia no início. |

### P2.4: o que foi testado e desfeito

`TurnoModal`, `LeilaoModal`, `NegotiationResponseModal` e `EditProfileModal` também foram para `dynamic({ ssr: false })` e depois **voltaram ao import estático**. Esses componentes ficam sempre montados e retornam `null` quando fechados, então o chunk é baixado na carga de qualquer jeito, só que depois da hidratação. No Lighthouse, a tela de jogo foi de 438 para 442 KB de JS, com TBT e LCP dentro do ruído. Pela regra do documento ("sem número depois não conta"), não entraram. Para valer a pena, eles teriam que só montar quando abertos, mas isso mexe no ciclo de vida (timers do `TurnoModal`, estado da negociação) e não compensa o risco agora.

## Re-renders (P2.3)

60 s de partida, aberta pelo bot 2. Como o ritmo da partida varia entre medições, a comparação é feita **por atualização do tabuleiro** (renders de `Board`).

| | Antes (sessão 134) | Depois (sessão 136) |
|---|---|---|
| Commits do React | 911 | 946 |
| Atualizações do tabuleiro (`Board`) | 531 | 558 |
| Renders de componente | 99.103 | **62.142** |
| Renders por atualização do tabuleiro | 187 | **111 (−40%)** |
| `BoardTile` | 21.240 (40 por atualização: as 40 casas) | **482 (0,86 por atualização)** |
| `PlayerAvatar` | 14.627 | **10** |

### O que sobra (não atacado nesta fase)

| Componente | Renders em 60 s | Leitura |
|---|---|---|
| `FontAwesomeIcon` | ~7.200 | Ícones dentro de componentes que renderizam a cada broadcast. A migração para Lucide (P2.5) é gradual, arquivo a arquivo. |
| `PresenceChild`, `motion.div`, `PopChild` e `MeasureLayout` (Framer Motion) | ~4.800 a 5.300 cada | Filhos de `AnimatePresence` montados na tela de jogo. |
| `Modal` e `ConfirmationModal` | ~1.500 | Os dois `ConfirmationModal` (sair/desistir) da página `Game`, que renderiza a cada broadcast porque lê `currentSession`. Fechados, custam pouco. Um `memo` só ajudaria com `useCallback` nos handlers inline. |

## Lighthouse (builds de produção lado a lado)

| Página | Score antes | Score depois | LCP antes | LCP depois | TBT antes | TBT depois | JS antes | JS depois |
|---|---|---|---|---|---|---|---|---|
| `/login` | 93 | 94 | 3,2 s | 3,1 s | 50 ms | 56 ms | 299 KB | 299 KB |
| `/user` | 90 | 90 | 2,0 s | 2,0 s | 343 ms | 388 ms | 344 KB | **340 KB** |
| `/user/loja` | 66 | 65 | 4,9 s | 6,3 s | 624 ms | 478 ms | 338 KB | **334 KB** |
| Tela de jogo | 66 | 66 | 5,7 s | 5,7 s | 459 ms | 488 ms | 438 KB | 442 KB¹ |

¹ Medido com os quatro modais em `dynamic()`, já desfeitos. Sem eles, a tela de jogo deve voltar ao bundle de antes, menos o `PodiumModal`. Isso não foi remedido.

**Leitura:**
- **Carga inicial:** nada muda além do ruído. O LCP da loja oscila entre execuções porque o elemento de LCP é um parágrafo de texto que depende da lista carregar. A P2.3 não aparece no Lighthouse porque melhora a partida **em andamento** (re-renders por broadcast), não a primeira carga; o número dela está na seção anterior.
- **CLS da loja:** 0 nos dois builds. O 0,665 do baseline já tinha sumido no fim da Fase 4 e não foi mais reproduzido, então o esqueleto de carregamento previsto não é necessário.
- **Meta "LCP mobile da tela de jogo < 3 s":** continua **não atingida** (5,7 s). O LCP é o contêiner do tabuleiro com `fundo-tabuleiro.webp`, que só aparece depois do JS, do `load-session` e do socket. Sobram duas alavancas: pedir o fundo mais cedo (`<link rel="preload">` na rota do jogo) e renderizar a moldura do tabuleiro antes de os dados chegarem.

## Achado durante a medição: o `AuthGuard` desloga com 429

Na primeira rodada do Lighthouse, todas as páginas do segundo build redirecionaram para `/login`. A causa:
- O limiter de `/api/auth` (20 requisições a cada 15 min por IP, `server/src/index.ts`) também cobre o `GET /auth/me`, que o `AuthGuard` chama a cada carga de página protegida.
- Quando o limite estoura, o `AuthGuard` trata qualquer resposta `!res.ok` como token inválido e **desloga** (`client/src/components/AuthGuard/index.tsx`).

Em produção, quem der mais de ~20 F5 ou entradas diretas em 15 min, ou vários usuários atrás do mesmo IP (NAT de escola, de evento ou de operadora), **é deslogado**. A correção é deslogar só com 401 ou tirar o `/auth/me` do limiter de login. Isso fica para decidir fora desta fase. Para medir, o servidor de dev foi reiniciado antes de cada build (o limiter é em memória).

## Verificação

- `make validate` verde (109 testes) e `tsc --noEmit` do cliente sem erros depois da reversão parcial.
- CSS compilado conferido: `.font-jaro{font-family:var(--font-jaro-next),sans-serif}` e `--font-jaro-next:"Jaro","Jaro Fallback"`.
- Tela de jogo, `/user` e loja carregadas no Chromium com o build novo, sem erros HTTP nem no console (script de rastreio descartável).

## Observação de método

- **Rate limit do `/api/auth`:** cada build medido no Lighthouse gasta ~9 chamadas de `/auth/me`, e cada partida de bots gasta mais 8. Para medir dois builds em sequência, reinicie o servidor de dev entre eles ou espere 15 min.
- **`pgrep -f` em loops de espera:** ele encontra o próprio comando do loop. Para esperar, use o nome do container ou o arquivo de saída.
