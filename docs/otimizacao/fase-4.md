# Fase 4: imagens, áudio e carregamento preguiçoso (P2.1 e P2.2)

> Referência: `docs/geral/OTIMIZACAO_SISTEMA.md`, seção 4. Baseline em `docs/otimizacao/baseline.md`.
> Lighthouse mobile (Moto G Power, 4G lento simulado), build de produção, cache limpo, mediana de 3 execuções.

## O que mudou

| Commit | Item | Mudança |
|---|---|---|
| `906a654` | P2.1 | **Imagens:** 17 PNGs de 0,8 a 1,9 MB viraram WebP no tamanho de uso (`scripts/otimizacao/converter-imagens.cjs`), de 23,9 MB para 0,88 MB. Os pacotes da loja ficaram em 512 px (25 a 61 KB), os cofres em 640 px (69 a 93 KB, renomeados em kebab-case), o fundo hexagonal das páginas `/user` (opacidade de 4%) em 35 KB e o hero da landing em 119 KB. **Áudio:** a música só é carregada quando vai tocar, depois da primeira interação, e toca por streaming (`html5`); antes era baixada em toda página, com a música desligada. `tempo-acabando.mp3`: de 60 s a 256 kbps para 12 s a 96 kbps com fade-out (de 1.876 para 141 KB); só os primeiros ~10 s eram ouvidos. Música: de 128 para 96 kbps (de 2.658 para 1.993 KB). |
| `bbbad5b` | P2.2 | `loading="lazy"` + `decoding="async"` em 36 `<img>` de listas (loja, cofre, cards de baú, avatares e badges do ranking, admin). Ficam de fora as imagens exibidas de imediato (abertura de baú, pódio, tabuleiro, ícones). |
| `20614b5` | P2.1 (complemento) | O Lighthouse da tela de jogo apontou o tabuleiro: os grupos `amarelo`, `preto` e `rosa` estavam em 1254 px (235 a 269 KB) contra 512 px dos outros seis, e foram para 512 px (55 a 64 KB). A `arte-central` foi recomprimida (de 207 para 137 KB). O pré-carregamento dos efeitos sonoros da tela de jogo passou a rodar quando a página fica ociosa (`requestIdleCallback`), para não disputar banda com o tabuleiro. |

Os caminhos trocados não aparecem no servidor nem no banco (conferido antes da troca).

## Antes e depois (os dois builds medidos lado a lado, nas mesmas condições)

| Página | Total antes | Total depois | Imagens antes | Imagens depois | LCP antes | LCP depois | TBT antes | TBT depois | Score antes | Score depois |
|---|---|---|---|---|---|---|---|---|---|---|
| `/login` | 3.045 KB | **377 KB** | 0 | 0 | 4,4 s | **3,4 s** | 1.536 ms | **329 ms** | 59 | **84** |
| `/user` | 5.073 KB | **530 KB** | 1.967 KB | **91 KB** | 2,0 s | 2,0 s | 2.087 ms | **1.357 ms** | 70 | **73** |
| `/user/loja` | 26.637 KB | **1.324 KB** | 23.537 KB | **893 KB** | 104,2 s | **7,2 s** | 5.002 ms | 4.690 ms | 17 | 19 |
| Tela de jogo | 6.812 KB | **1.776 KB** | 1.492 KB | **848 KB** | 35,2 s | **6,6 s** | 2.917 ms | **1.403 ms** | 44 | **50** |

"Antes" é o build do commit `6513a7e` (baseline), gerado e medido de novo **logo antes** do build atual, na mesma sessão.

**Por que remedir o baseline:** a primeira medição desta fase mostrou TBT **maior** que o `baseline.md` em todas as páginas, inclusive no `/login`, que esta fase quase não toca. Medindo os dois builds em sequência, o do baseline também ficou mais lento do que no dia do baseline (o TBT do `/login` foi de 181 para 1.536 ms). Ou seja, a máquina estava mais carregada, e o build atual é melhor em todas as métricas. O TBT simulado do Lighthouse depende da CPU do host, então **só a comparação lado a lado vale**.

## Metas da seção 4

| Meta | Antes | Depois | Situação |
|---|---|---|---|
| Imagens da primeira carga < 1,5 MB | Loja 23,5 MB; jogo 1,5 MB + 2,7 MB de música | Loja 0,9 MB; jogo 0,85 MB; música só ao tocar | **Atingida** |
| Imagem de UI < 150 KB, fundos < 300 KB | Até 2,5 MB | A maior agora é a `arte-central`, com 137 KB | **Atingida** |
| LCP mobile da tela de jogo < 3 s | 35,2 s | **6,6 s** | **Não atingida** (−81%) |

## O que ainda segura o LCP

| Página | Elemento de LCP | Leitura |
|---|---|---|
| Tela de jogo | O contêiner do tabuleiro com `fundo-tabuleiro.webp` (73 KB) | O tabuleiro só aparece depois do JS da página, do `load-session` e das imagens das casas. No 4G simulado, o caminho crítico agora é JS + dados, não bytes de imagem. Daqui em diante, o ganho vem da **Fase 5** (`dynamic()` para o código condicional, seletores no store) e de priorizar o fundo (`preload`/`fetchpriority`). |
| `/user/loja` | `div` com `background-image` de um banner do **Cloudinary** | Os banners são enviados pelo admin e servidos no tamanho original. Próximo passo: pedir ao Cloudinary a versão já otimizada na URL (`f_auto,q_auto,w_…`). |
| `/login` | O título em texto (`font-jaro`) | O LCP depende da fonte web: a troca para `next/font/local` fica na **Fase 6**. |

**CLS da loja (0,665) sem mudança:** confirmado que **não vem das imagens**, porque todos os contêineres têm tamanho fixo em CSS. O mais provável é a lista renderizar depois do fetch, empurrando o conteúdo. Fica para a Fase 5, com um esqueleto de carregamento do mesmo tamanho dos cards.

## Ficou para a Fase 6 (higiene)

- **Imagens sem nenhuma referência**, que somam ~5 MB: `Arte Central.png`, `Imagem de fundo Tabuleiro.png` e `coin.png`. O tabuleiro usa as versões `.webp`.
- **Arquivos `:Zone.Identifier` versionados:** 3 em `client/public/images/tabuleiro/grupos/`.
