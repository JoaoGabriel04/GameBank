# Implementação: Imagens do Tabuleiro — GameBank Modo Tabuleiro

## Contexto

O tabuleiro do Modo Tabuleiro hoje usa apenas cores sólidas e ícones
FontAwesome. Esta tarefa adiciona imagens semi-realistas:
- **9 imagens de grupo** — uma por grupo de cor, compartilhada por todas
  as propriedades daquele grupo
- **7 imagens de casas especiais** — Início, Prisão, Detenção, Notícias,
  Receita Federal, Imposto, Feriado
- **1 arte central** — miolo do tabuleiro
- **1 fundo** — atrás do tabuleiro

Todas 1:1 (quadradas), prontas para `object-fit: cover`.

---

## ETAPA 0 — Auditoria e colocação dos assets

### Colocar as imagens no projeto
As imagens estão organizadas em duas pastas. Copiar para o cliente:

```
client/public/images/tabuleiro/
├── grupos/
│   ├── verde-claro.png    (nível 1 — mais barato)
│   ├── roxo.png           (nível 2)
│   ├── verde-escuro.png   (nível 3)
│   ├── azul.png           (nível 4)
│   ├── vermelho.png       (nível 5)
│   ├── amarelo.png        (nível 6)
│   ├── laranja.png        (nível 7)
│   ├── rosa.png           (nível 8 — mais caro)
│   └── preto.png          (ações)
└── casas/
    ├── inicio.png
    ├── prisao.png
    ├── detencao.png       (Vá para a Detenção)
    ├── noticias.png
    ├── receita-federal.png
    ├── imposto.png        (Restituição IR — reaproveita ou separa)
    ├── feriado.png
    ├── arte-central.png
    └── fundo-tabuleiro.png
```

### Auditoria
```bash
# Confirmar estrutura do BoardTile e como usa cor/ícone hoje
cat client/src/components/Board/BoardTile/index.tsx

# Ver os nomes EXATOS dos grupos (não inventar)
grep -rn "grupo_cor" server/data/propriedades.json | head
# Grupos: Verde-Claro, Roxo, Verde-Escuro, Azul, Vermelho, Amarelo,
#         Laranja, Rosa, Preto

# Ver como o tipo de casa é definido
grep -n "tipo" server/data/tabuleiro.json | head
```

---

## ETAPA 1 — Mapa de imagens (constantes)

Criar `client/src/utils/tabuleiro-images.ts`:

```typescript
import type { Casa } from "@/types/game"

// Mapa grupo de cor → imagem. Chaves EXATAS do propriedades.json.
const GRUPO_IMAGEM: Record<string, string> = {
  "Verde-Claro":  "/images/tabuleiro/grupos/verde-claro.png",
  "Roxo":         "/images/tabuleiro/grupos/roxo.png",
  "Verde-Escuro": "/images/tabuleiro/grupos/verde-escuro.png",
  "Azul":         "/images/tabuleiro/grupos/azul.png",
  "Vermelho":     "/images/tabuleiro/grupos/vermelho.png",
  "Amarelo":      "/images/tabuleiro/grupos/amarelo.png",
  "Laranja":      "/images/tabuleiro/grupos/laranja.png",
  "Rosa":         "/images/tabuleiro/grupos/rosa.png",
  "Preto":        "/images/tabuleiro/grupos/preto.png",
}

// Mapa tipo de casa especial → imagem
const CASA_IMAGEM: Partial<Record<Casa["tipo"], string>> = {
  inicio:         "/images/tabuleiro/casas/inicio.png",
  prisao_visita:  "/images/tabuleiro/casas/prisao.png",
  va_para_prisao: "/images/tabuleiro/casas/detencao.png",
  noticias:       "/images/tabuleiro/casas/noticias.png",
  imposto:        "/images/tabuleiro/casas/receita-federal.png",
  restituicao:    "/images/tabuleiro/casas/imposto.png",
  feriado:        "/images/tabuleiro/casas/feriado.png",
}

export function getGrupoImagem(grupoCor?: string | null): string | null {
  if (!grupoCor) return null
  return GRUPO_IMAGEM[grupoCor] ?? null
}

export function getCasaImagem(tipo: Casa["tipo"]): string | null {
  return CASA_IMAGEM[tipo] ?? null
}

export const ARTE_CENTRAL = "/images/tabuleiro/casas/arte-central.png"
export const FUNDO_TABULEIRO = "/images/tabuleiro/casas/fundo-tabuleiro.png"
```

---

## ETAPA 2 — Atualizar BoardTile (imagem de fundo da casa)

A imagem entra como **camada de fundo** da casa, com a faixa de cor do
grupo e o texto por cima (com contraste garantido via gradiente escuro).

Modificar `client/src/components/Board/BoardTile/index.tsx`:

```tsx
import { getGrupoImagem, getCasaImagem } from "@/utils/tabuleiro-images"

// Dentro do componente, determinar a imagem:
const imagemGrupo = isPropriedade
  ? getGrupoImagem(sessionPosse?.propriedade?.grupo_cor)
  : null
const imagemCasa = !isPropriedade ? getCasaImagem(casa.tipo) : null
const imagemFundo = imagemGrupo ?? imagemCasa
```

Estrutura visual em camadas (de baixo para cima):
1. Imagem de fundo (`object-cover`, ocupa a casa toda)
2. Gradiente escuro na base (para o texto ter contraste)
3. Faixa de cor do grupo no topo (fina, identifica o grupo)
4. Texto (nome, preço) na base
5. Elementos de estado (dono, casas, hipoteca) por cima

```tsx
return (
  <div
    className={`relative w-full h-full flex flex-col overflow-hidden
                select-none rounded-[3px] border transition-all duration-300
                ${destaque
                  ? "border-green-400 shadow-[0_0_12px_3px_rgba(74,222,128,0.55)] z-10 animate-pulse"
                  : "border-zinc-800"}`}
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

    {/* CAMADA 2: Gradiente escuro para contraste do texto */}
    <div className="absolute inset-0 bg-gradient-to-t
                    from-black/90 via-black/30 to-transparent" />

    {/* CAMADA 3: Faixa de cor do grupo no topo (só propriedades) */}
    {isPropriedade && cor && (
      <div
        className="absolute top-0 left-0 right-0 h-1.5 z-10"
        style={{ background: cor }}
      />
    )}

    {/* CAMADA 4+: dono, hipoteca, texto, casas — manter lógica existente,
        apenas garantir z-index acima das camadas 1-2 (z-10 ou z-20) */}

    {/* Dono */}
    {donoJogador && (
      <div className={`absolute top-0.5 right-0.5 w-3.5 h-3.5 shrink-0
                      overflow-hidden rounded-full ring-2 ${donoCor?.ring ?? "ring-zinc-500"}
                      shadow-[0_0_3px_rgba(0,0,0,0.7)] z-20`}>
        <PlayerAvatar player={donoJogador} size={14} showFrame={false} />
      </div>
    )}

    {/* Hipotecada */}
    {hipotecada && (
      <div className="absolute inset-0 bg-zinc-950/75 flex items-center
                      justify-center z-20">
        <FontAwesomeIcon icon={faLock} className="text-red-400 text-[10px]" />
      </div>
    )}

    {/* Nome + preço — agora sobre a imagem, na base */}
    <div className="relative z-10 flex-1 flex flex-col items-center
                    justify-end px-0.5 pb-1 min-h-0 gap-0.5">
      <span className="text-[7px] leading-tight text-center text-zinc-50
                       font-inconsolata font-semibold line-clamp-2
                       drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
        {casa.nome}
      </span>
      {isPropriedade && sessionPosse?.propriedade && !sessionPosse.playerId && (
        <span className="text-[6px] text-emerald-300 font-inconsolata
                         font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
          R$ {sessionPosse.propriedade.custo_compra}
        </span>
      )}

      {/* Casas/hotel — manter lógica existente, garantir z-10 */}
    </div>
  </div>
)
```

**Remover** o antigo `TIPO_BG` (gradientes de tint) e os `TIPO_ICON`
FontAwesome das casas especiais — agora a imagem substitui ambos.
Manter o `faLock` da hipoteca e o `faBuilding`/pips das casas.

---

## ETAPA 3 — Arte central e fundo no Board

Modificar `client/src/components/Board/index.tsx`:

```tsx
import { ARTE_CENTRAL, FUNDO_TABULEIRO } from "@/utils/tabuleiro-images"

// FUNDO atrás do tabuleiro — no container externo (o que tem o pan/zoom):
<div
  className="relative w-full h-full overflow-hidden"
  style={{
    backgroundImage: `url(${FUNDO_TABULEIRO})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  }}
>
  {/* ...conteúdo com zoom/pan... */}
</div>

// ARTE CENTRAL — no miolo do grid (área 9x9 interna, entre pos que formam
// a borda). Ocupa da linha 2 à 10 e coluna 2 à 10 do grid 11x11:
<div
  className="pointer-events-none overflow-hidden rounded-lg"
  style={{
    gridRow: "2 / 11",
    gridColumn: "2 / 11",
  }}
>
  <img
    src={ARTE_CENTRAL}
    alt=""
    aria-hidden="true"
    className="w-full h-full object-cover opacity-90"
    draggable={false}
  />
</div>
```

**Importante:** a arte central vai DENTRO do grid, como um item que ocupa
o miolo (gridRow/gridColumn 2 a 11). Renderizar ANTES das casas para ficar
atrás dos elementos de UI que possam sobrepor (dados, etc.), mas as casas
da borda não são afetadas pois ocupam linhas/colunas 1 e 11.

---

## ETAPA 4 — Performance (preload e otimização)

As 9 imagens de grupo se repetem em várias casas. Garantir carregamento
eficiente:

```tsx
// No topo da página de jogo (Board), pré-carregar as imagens de grupo
// para evitar flash ao renderizar o tabuleiro:
import { useEffect } from "react"

useEffect(() => {
  const imagens = [
    "/images/tabuleiro/grupos/verde-claro.png",
    "/images/tabuleiro/grupos/roxo.png",
    "/images/tabuleiro/grupos/verde-escuro.png",
    "/images/tabuleiro/grupos/azul.png",
    "/images/tabuleiro/grupos/vermelho.png",
    "/images/tabuleiro/grupos/amarelo.png",
    "/images/tabuleiro/grupos/laranja.png",
    "/images/tabuleiro/grupos/rosa.png",
    "/images/tabuleiro/grupos/preto.png",
  ]
  imagens.forEach(src => { const img = new Image(); img.src = src })
}, [])
```

**Considerar otimização de tamanho:** as imagens são 1024×1024 (~1-2MB cada).
Para o tabuleiro, cada casa renderiza a 76px. Considerar:
- Comprimir os PNGs (usar tinypng ou similar) OU
- Converter para WebP (reduz ~70% do tamanho sem perda visível) OU
- Gerar versões menores (256×256 já é suficiente para 76px em telas 2x)

```bash
# Sugestão: converter para WebP no build (se o projeto suportar)
# ou comprimir os PNGs antes de commitar
```

---

## ETAPA 5 — Testes manuais

- [ ] Cada propriedade mostra a imagem do seu grupo de cor
- [ ] Propriedades do mesmo grupo compartilham a mesma imagem
- [ ] Casas especiais mostram suas imagens (Início, Prisão, etc.)
- [ ] Faixa de cor do grupo aparece no topo de cada propriedade
- [ ] Nome e preço legíveis sobre a imagem (contraste do gradiente)
- [ ] Avatar do dono aparece sobre a imagem sem ser cortado
- [ ] Hipoteca escurece a casa corretamente
- [ ] Casas e hotéis (pips/selo) visíveis sobre a imagem
- [ ] Arte central aparece no miolo sem cobrir as casas da borda
- [ ] Fundo aparece atrás do tabuleiro
- [ ] Destaque (casa atual) ainda visível com a imagem
- [ ] Zoom/pan continua funcionando
- [ ] Sem flash de imagem faltando ao carregar (preload funciona)
- [ ] Legível em mobile (360px viewport)
- [ ] `make validate` passa

---

## Definição de "pronto"

1. 18 imagens em `client/public/images/tabuleiro/`
2. `tabuleiro-images.ts` com os mapas de grupo e casa
3. `BoardTile` renderizando imagem de fundo + faixa + texto com contraste
4. `Board` com arte central no miolo e fundo atrás
5. Preload das imagens de grupo
6. Imagens otimizadas (WebP ou comprimidas) para performance
7. Todos os testes manuais passando

---

## Nota sobre os assets entregues

As imagens seguem a progressão de riqueza definida:
Verde-Claro (mais simples) → Roxo → Verde-Escuro → Azul → Vermelho →
Amarelo → Laranja → Rosa (mais luxuoso). Preto é o tema financeiro
(ações). Todas 1:1, estilo semi-realista coeso, prontas para object-cover.
