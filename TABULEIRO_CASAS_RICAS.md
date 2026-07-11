# Implementação: Casas Ricas do Tabuleiro (Caminho A) — GameBank

## Contexto

Redesenhar as casas do tabuleiro para o estilo "card premium": imagem de
fundo do grupo, faixa colorida no topo com o nome, e preço destacado na
base — como um mini-pôster de cada propriedade.

Para isso, as casas passam de 76px para **140px** (Caminho A). O tabuleiro
fica maior que a tela e o jogador navega por **zoom/pan** (mecânica que já
existe e funciona). O zoom inicial mostra o tabuleiro inteiro; ao aproximar,
os cards ganham toda a riqueza visual.

**Pré-requisito:** as imagens de grupo já devem estar integradas
(TABULEIRO_IMAGENS.md). Este `.md` assume que elas existem em
`client/public/images/tabuleiro/`.

---

## ETAPA 0 — Auditoria

```bash
# Ver o layout atual (TILE_SIZE, grid)
cat client/src/utils/tabuleiro-layout.ts

# Ver o BoardTile atual
cat client/src/components/Board/BoardTile/index.tsx

# Ver a mecânica de zoom/pan (não quebrar)
grep -n "fitScale\|MIN_SCALE\|MAX_SCALE\|TILE_SIZE\|BOARD_SIZE\|centerOn" \
  client/src/components/Board/index.tsx

# Confirmar mapa de imagens
cat client/src/utils/tabuleiro-images.ts
```

---

## ETAPA 1 — Aumentar o tamanho da casa

Em `client/src/utils/tabuleiro-layout.ts`:

```typescript
// De 76 para 140 — casas maiores comportam o card rico legível
export const TILE_SIZE = 140  // era 76
```

Nada mais muda aqui — `BOARD_SIZE`, `posToGrid` e `posToPixelCenter` se
recalculam automaticamente a partir do TILE_SIZE.

---

## ETAPA 2 — Ajustar zoom no Board

O tabuleiro agora é maior (1540px vs 836px). A mecânica de zoom já lida
com isso, mas ajustar os limites para a nova escala:

Em `client/src/components/Board/index.tsx`:

```typescript
// Permitir zoom out suficiente para ver o tabuleiro todo, e zoom in
// suficiente para ler os cards de perto
const MIN_SCALE = 0.3  // era 0.5 — precisa ver mais longe agora
const MAX_SCALE = 2.5  // era 3 — cards já são grandes, menos zoom in necessário
```

O `useEffect` de fit inicial já calcula `fitScale` dinamicamente com base
no `BOARD_SIZE`, então ele se ajusta sozinho ao novo tamanho. **Não alterar
a lógica de fit** — apenas os limites acima.

**Opcional — zoom inicial mais próximo:** se quiser que o jogo comece já
com um zoom que mostra os cards com alguma legibilidade (em vez do tabuleiro
inteiro minúsculo), ajustar o fator no fit inicial:

```typescript
// No useEffect de montagem, o 0.95 controla o "encaixe". Manter em 0.95
// mostra tudo. Se quiser começar centralizado no peão do jogador com zoom
// médio, trocar por centerOn(meuPlayer.posicao, 1) após o fit.
```

---

## ETAPA 3 — Redesenhar o BoardTile (card rico)

Substituir o conteúdo visual do `BoardTile` pelo layout de card. As camadas,
de baixo para cima:

1. Imagem de fundo do grupo (`object-cover`, casa toda)
2. Overlay escuro sutil na base (contraste)
3. Faixa superior com gradiente da cor do grupo + nome
4. Faixa inferior com o preço
5. Elementos de estado (dono, casas/hotel, hipoteca)

```tsx
'use client'

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLock } from "@fortawesome/free-solid-svg-icons"
import type { Casa, Player, SessionPropriedade } from "@/types/game"
import { PLAYER_COLORS } from "@/types/game"
import { getGroupColorHex } from "@/utils/properties"
import { getGrupoImagem, getCasaImagem } from "@/utils/tabuleiro-images"
import PlayerAvatar from "@/components/Board/PlayerAvatar"

type Props = {
  casa: Casa
  sessionPosse?: SessionPropriedade
  donoJogador?: Player
  destaque?: boolean
}

export default function BoardTile({ casa, sessionPosse, donoJogador, destaque }: Props) {
  const isPropriedade = casa.tipo === "propriedade" || casa.tipo === "acao"
  const cor = isPropriedade ? getGroupColorHex(sessionPosse?.propriedade?.grupo_cor) : null
  const donoCor = donoJogador ? PLAYER_COLORS.find(p => p.value === donoJogador.cor) : null
  const hipotecada = !!sessionPosse?.hipotecada
  const casas = sessionPosse?.casas ?? 0
  const temHotel = casas >= 5

  const imagemGrupo = isPropriedade
    ? getGrupoImagem(sessionPosse?.propriedade?.grupo_cor)
    : null
  const imagemCasa = !isPropriedade ? getCasaImagem(casa.tipo) : null
  const imagemFundo = imagemGrupo ?? imagemCasa

  const preco = sessionPosse?.propriedade?.custo_compra
  const semDono = isPropriedade && !sessionPosse?.playerId

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none
                  rounded-lg border-2 transition-all duration-300 ${
        destaque
          ? "border-green-400 shadow-[0_0_20px_5px_rgba(74,222,128,0.6)] z-10"
          : "border-black/40"
      }`}
      title={casa.nome}
    >
      {/* CAMADA 1: Imagem de fundo */}
      {imagemFundo && (
        <img
          src={imagemFundo}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}

      {/* CAMADA 2: Vinheta escura para dar profundidade e contraste */}
      <div className="absolute inset-0 bg-gradient-to-b
                      from-black/10 via-transparent to-black/50" />

      {/* CAMADA 3: Faixa superior com nome (gradiente da cor do grupo) */}
      <div
        className="absolute top-0 left-0 right-0 px-1.5 py-1.5
                   flex items-center justify-center"
        style={{
          background: isPropriedade && cor
            ? `linear-gradient(180deg, ${cor} 0%, ${cor}dd 70%, ${cor}00 100%)`
            : "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
        }}
      >
        <span className="font-jaro text-white text-center leading-tight
                         text-[11px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]
                         line-clamp-2">
          {casa.nome}
        </span>
      </div>

      {/* CAMADA 4: Preço na base (só propriedade sem dono) */}
      {semDono && preco != null && (
        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1.5
                        flex items-center justify-center gap-1
                        bg-gradient-to-t from-black/80 to-transparent">
          <span className="font-jaro text-white text-[13px]
                           drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
            R$ {preco.toLocaleString("pt-BR")}
          </span>
        </div>
      )}

      {/* Dono da propriedade — avatar no canto */}
      {donoJogador && (
        <div
          className={`absolute top-1 right-1 w-6 h-6 shrink-0 overflow-hidden
                      rounded-full ring-2 ${donoCor?.ring ?? "ring-zinc-500"}
                      shadow-[0_0_4px_rgba(0,0,0,0.8)] z-20`}
          title={`Dono: ${donoJogador.nome}`}
        >
          <PlayerAvatar player={donoJogador} size={24} showFrame={false} />
        </div>
      )}

      {/* Casas e hotel — na base, acima do preço */}
      {isPropriedade && !hipotecada && casas > 0 && (
        <div className="absolute bottom-8 left-0 right-0 flex items-center
                        justify-center gap-1 z-10">
          {temHotel ? (
            <div className="flex items-center justify-center w-6 h-6 rounded-md
                            bg-gradient-to-br from-amber-300 to-amber-600
                            shadow-[0_0_6px_rgba(245,158,11,0.9)]
                            ring-1 ring-amber-200/60"
                 title="Hotel">
              <span className="text-[10px]">🏨</span>
            </div>
          ) : (
            Array.from({ length: casas }).map((_, i) => (
              <div key={i}
                className="w-2 h-2 rounded-[2px] bg-emerald-400
                           shadow-[0_0_4px_rgba(52,211,153,0.9)]
                           ring-1 ring-emerald-200/50" />
            ))
          )}
        </div>
      )}

      {/* Hipotecada — escurece tudo e mostra cadeado */}
      {hipotecada && (
        <div className="absolute inset-0 bg-zinc-950/80 flex items-center
                        justify-center z-30">
          <div className="flex flex-col items-center gap-1">
            <FontAwesomeIcon icon={faLock} className="text-red-400 text-lg" />
            <span className="font-inconsolata text-red-300 text-[9px]">
              Hipotecada
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## ETAPA 4 — Ajustar os peões (Pawns) para a nova escala

Com casas maiores, os peões devem crescer proporcionalmente. Verificar
`client/src/components/Board/Pawns/index.tsx`:

```bash
grep -n "size\|TILE_SIZE\|width\|height\|w-\|h-" \
  client/src/components/Board/Pawns/index.tsx | head
```

Se os peões usam tamanho fixo, escalar para ~28-32px (antes provavelmente
~16-20px) para ficarem proporcionais às casas de 140px. Se já derivam de
TILE_SIZE, ajustam sozinhos.

---

## ETAPA 5 — Legibilidade em cada nível de zoom

Como o card é rico, garantir que:
- **Zoom mínimo (0.3):** tabuleiro inteiro visível, cards viram miniaturas
  (nome pode ficar ilegível, tudo bem — é visão geral)
- **Zoom médio (1.0):** cards legíveis, nome e preço claros
- **Zoom máximo (2.5):** card em detalhe, imagem nítida

O botão "centralizar no meu peão" (já existe) deve levar a um zoom
confortável (~1.2) para o jogador ver sua região com clareza:

```typescript
// No botão de centralizar, passar scale confortável:
onClick={() => centerOn(mine?.posicao ?? 0, 1.2)}
```

---

## ETAPA 6 — Performance com imagens maiores

Casas de 140px em telas 2x pedem imagens de pelo menos 280px. As imagens
atuais (1024px) são suficientes, mas pesadas. Recomendado:
- Converter para WebP (reduz ~70%)
- OU servir em 512px (suficiente para 140px @2x com folga)

```bash
# Se houver ferramenta de otimização no projeto, aplicar.
# Senão, as imagens 1024px funcionam, só pesam mais no carregamento inicial.
# O preload (de TABULEIRO_IMAGENS.md) mitiga o flash.
```

---

## ETAPA 7 — Testes manuais

- [ ] Casas agora são 140px, cards ricos e legíveis com zoom
- [ ] Nome na faixa superior com gradiente da cor do grupo
- [ ] Preço grande e legível na base (propriedades sem dono)
- [ ] Imagem do grupo nítida em cada casa
- [ ] Casas especiais mostram suas imagens próprias
- [ ] Zoom inicial mostra o tabuleiro inteiro
- [ ] Zoom in aproxima e revela os cards em detalhe
- [ ] Pan (arrastar) navega pelo tabuleiro
- [ ] Botão "centralizar" leva ao peão com zoom confortável (1.2)
- [ ] Peões proporcionais ao novo tamanho das casas
- [ ] Dono, casas/hotel e hipoteca visíveis e bem posicionados
- [ ] Destaque da casa atual (glow verde) visível
- [ ] Funciona em mobile (pinch to zoom, drag)
- [ ] Modo Banca não é afetado
- [ ] `make validate` passa

---

## Definição de "pronto"

1. `TILE_SIZE` = 140 em tabuleiro-layout.ts
2. `MIN_SCALE`/`MAX_SCALE` ajustados no Board
3. `BoardTile` redesenhado como card rico (faixa + nome + preço + imagem)
4. Peões proporcionais à nova escala
5. Botão centralizar com zoom confortável
6. Legível em todos os níveis de zoom
7. Todos os testes manuais passando

---

## Nota sobre a experiência resultante

Com o Caminho A, o jogador **nunca vê o tabuleiro inteiro em detalhe** — no
zoom out ele tem a visão geral (posições, quem está onde), e no zoom in ele
lê os cards ricos da sua região. É exatamente como jogos de tabuleiro mobile
modernos funcionam (ex: apps de Banco Imobiliário/Monopoly). O card que você
desenhou brilha no zoom médio/alto, que é onde o jogador passa a maior parte
do tempo agindo.
