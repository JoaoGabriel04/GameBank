# Fix: Layout desktop da tela de jogo (tabuleiro esticado)

## Contexto

`REFORMULACAO_TELA_JOGO.md` (Fase 3) definiu o layout desktop assim:

> Tabuleiro em ~1/4 (canto superior esquerdo), painéis à direita ocupando o
> resto. Mesmas seções, dispostas lado a lado em vez de empilhadas.

Isso **nunca foi implementado**. Tanto `GameShell` quanto o bloco da aba
"Visão" em `page.tsx` usam só `flex flex-col` (empilhado), sem nenhum
breakpoint `lg:`. Resultado no desktop: o `BoardPanel` (altura fixa
`min(45vh, 400px)`, largura 100%) estica horizontalmente até a largura da
tela inteira, distorcendo o tabuleiro — só as bordas superior/inferior
(casas 20-30 e 0-10) ficam visíveis como faixas finas, o resto vira uma
área vazia mostrando só o fundo verde.

**Regra inviolável:** o Modo Banca não pode ser afetado.

## Etapa 0 — Auditoria

```bash
# Confirmar que não existe nenhum lg: no fluxo do board/visão
grep -n "lg:" client/src/components/Game/GameShell/index.tsx
grep -n "lg:" client/src/app/user/game/\[sessionId\]/page.tsx | grep -i "visão\|GameShell\|VisaoSection" -A2 -B2

# Confirmar altura fixa do BoardPanel (causa da distorção)
grep -n "45vh\|400px" client/src/components/Game/BoardPanel/index.tsx

# Confirmar que VisaoSection é irmã do GameShell (não filha) — o split
# desktop precisa envolver os dois juntos
sed -n '628,650p' client/src/app/user/game/\[sessionId\]/page.tsx
```

Confirme os três pontos acima batem com o código atual antes de prosseguir.
Se algo já foi corrigido/mudou, pare e avise — não aplique o fix às cegas.

## Etapa 1 — Grid desktop em `page.tsx`

No bloco da aba "Visão" (case `"Visão"` e o `default`, ambos idênticos),
trocar o `<div className="space-y-4">` por um wrapper responsivo:

```tsx
case "Visão":
  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[minmax(340px,400px)_1fr] lg:gap-4 lg:items-start">
      <GameShell rolando={rolando} onRolarDados={handleRolarDados} />
      <VisaoSection currentPlayer={currentPlayer} isOwner={isOwner} onNavigate={(tab) => { localStorage.setItem("abaAtual", tab); setAbaAtual(tab); }} />
    </div>
  );
```

Aplicar a mesma troca no bloco `default` (linhas ~643-648, idêntico ao
`case "Visão"`).

**Não duplicar o JSX** — se preferir, extrair para uma constante/função
local dentro do componente da página, já que os dois blocos são cópias
exatas.

## Etapa 2 — `GameShell` não pode esticar o board no grid

Dentro da coluna esquerda do grid, o `BoardPanel` deve virar um quadrado
compacto, não uma faixa de altura fixa com largura 100%. Ajustar
`GameShell/index.tsx`:

```tsx
// Modo Tabuleiro
return (
  <>
    <div className="flex flex-col gap-3 pb-4">
      {/* Board compacto — 45vh/400px no mobile, quadrado no desktop */}
      <div className="lg:aspect-square lg:max-h-[400px]">
        <BoardPanel
          session={currentSession}
          meuPlayerId={meuPlayerId}
          onMaximize={() => setBoardModalOpen(true)}
        />
      </div>

      <EventoBanner ... />
      <TurnoTimeline ... />
      <AcaoPrincipal ... />
      <StatsRapidas ... />
    </div>
    {boardModalOpen && <BoardModal ... />}
  </>
);
```

`BoardPanel/index.tsx` usa `style={{ height: "min(45vh, 400px)" }}` fixo —
isso precisa virar `h-full` quando o pai já define a altura/aspect-ratio
(o wrapper acima, no caso desktop) e manter o fallback mobile:

```tsx
// BoardPanel/index.tsx
<div className="flex flex-col h-full lg:h-full" style={{ height: "min(45vh, 400px)" }}>
```

Mais simples e correto: mover a altura para o **chamador** em vez de
fixá-la dentro do `BoardPanel`. Trocar o `style` inline por `h-full` puro
no `BoardPanel`, e deixar quem o usa (`GameShell`) decidir a altura via
classe do wrapper:

```tsx
// BoardPanel/index.tsx — remover style inline, usar h-full
<div className="flex flex-col h-full">
  ...
</div>
```

```tsx
// GameShell/index.tsx — wrapper decide a altura
<div className="lg:aspect-square lg:max-h-[400px]" style={{ height: "min(45vh, 400px)" }}>
  <BoardPanel ... />
</div>
```

No mobile o `style` inline continua valendo (classes `lg:` não anulam o
`style`, então isso quebraria — usar `h-[45vh] max-h-[400px] lg:h-full
lg:aspect-square lg:max-h-[400px]` via Tailwind puro, sem `style` inline,
para o `lg:` conseguir sobrescrever corretamente).

## Etapa 3 — Recalcular o fit-scale ao redimensionar

Mesmo com o container correto, o `Board/index.tsx` só calcula a escala de
encaixe **uma vez, no mount** (linhas 147-157), sem `ResizeObserver`. Ao
trocar de aba e voltar para "Visão", ou ao redimensionar a janela
(inclusive a transição de mobile→desktop), o board pode ficar com a escala
antiga. Adicionar um `ResizeObserver` no `viewportRef` que refaz o
`fitScale` quando as dimensões do container mudam:

```tsx
useEffect(() => {
  const vp = viewportRef.current
  if (!vp) return
  const applyFit = () => {
    const rect = vp.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const fitScale = clampScale(Math.min(rect.width / BOARD_SIZE, rect.height / BOARD_SIZE) * 0.95)
    setTransformClamped({
      scale: fitScale,
      x: (rect.width - BOARD_SIZE * fitScale) / 2,
      y: (rect.height - BOARD_SIZE * fitScale) / 2,
    })
  }
  applyFit()
  const ro = new ResizeObserver(applyFit)
  ro.observe(vp)
  return () => ro.disconnect()
}, [setTransformClamped])
```

Isso substitui o `useEffect` atual de mount (linhas 147-157) — remover o
antigo para não haver dois efeitos competindo.

**Aviso crítico:** o `ResizeObserver` vai disparar toda vez que o usuário
der zoom/pan também? Não — zoom/pan mudam `transform` via CSS
(`translate`/`scale`), não o tamanho do `viewportRef` (`width`/`height`
do elemento continuam iguais). Só dispara em resize real do container.
Ainda assim, teste arrastando a janela do navegador para redimensionar e
confirme que não há flicker/loop.

## Testes manuais

- [ ] Desktop (≥1024px): tabuleiro fica um quadrado compacto no canto
      superior esquerdo (~340-400px), painéis (evento, timeline, ação,
      stats, visão) à direita, lado a lado
- [ ] Mobile (<1024px): comportamento inalterado — tabuleiro ~45vh no
      topo, tudo empilhado, nav inferior
- [ ] Redimensionar a janela do navegador (mobile↔desktop) sem dar F5 —
      o tabuleiro reajusta a escala corretamente, sem cortes
- [ ] Trocar de aba (Imóveis → Visão) e voltar — board renderiza correto
      na volta, sem escala antiga
- [ ] Zoom/pan dentro do board compacto continuam funcionando nos dois
      layouts
- [ ] Botão "Maximizar" abre o `BoardModal` em tela cheia normalmente nos
      dois layouts
- [ ] Modo Banca 100% inalterado (não usa `GameShell` em modo tabuleiro,
      mas confirme que a aba Visão em Modo Banca também não quebrou)
- [ ] `make validate` passa
