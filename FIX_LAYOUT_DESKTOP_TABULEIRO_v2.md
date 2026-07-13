# Fix v2: Tabuleiro estourando a página (mobile e desktop)

## Por que a v1 não resolveu

O `FIX_LAYOUT_DESKTOP_TABULEIRO.md` anterior deu instruções em formato de
diff parcial ("trocar isso por aquilo", "ou use X, ou use Y") e dependia de
`aspect-square` calculado a partir da largura de uma coluna de grid — isso
deixou espaço pra implementação ambígua. Resultado: o tabuleiro continua
sem limite de altura, a página inteira rola através dele (ver screenshots:
faixas de miniaturas cortadas, área verde gigante, scroll infinito).

**Esta versão não usa diffs parciais.** São 2 arquivos inteiros para
substituir por completo, com uma caixa de tamanho **travado** via
`overflow-hidden` — o tabuleiro fisicamente não consegue estourar o
container, não importa o que aconteça dentro dele.

**Regra inviolável:** Modo Banca não pode ser afetado.

## Etapa 0 — Auditoria (fazer antes de tocar em qualquer arquivo)

```bash
git status
git diff HEAD -- client/src/components/Game/GameShell/index.tsx
git diff HEAD -- client/src/components/Game/BoardPanel/index.tsx
git diff HEAD -- client/src/app/user/game/\[sessionId\]/page.tsx
```

Se houver mudanças locais não commitadas relacionadas à v1 do fix, **reverta
essas três primeiro** (`git checkout -- <arquivo>` em cada um) antes de
aplicar a v2 abaixo. Não empilhar patch em cima de patch ambíguo.

**Releitura obrigatória:** antes de aplicar qualquer coisa, reler a seção
`# FASE 3 — Novo layout da tela de jogo` do `REFORMULACAO_TELA_JOGO.md`
(mockup mobile, regras do `BoardModal`, `EventoBanner`, `TurnoTimeline`) e
comparar com o estado atual de `GameShell/index.tsx`, `BoardPanel/index.tsx`
e `BoardModal/index.tsx`. Objetivo: confirmar que essa correção de tamanho
não está mascarando um desvio maior da spec original (ex: ordem das
seções, regra de "sem ações no modal maximizado", etc.). Se encontrar
qualquer divergência **além** do bug de tamanho descrito aqui, **parar e
reportar antes de aplicar a Etapa 2 em diante** — não tentar corrigir os
dois problemas no mesmo patch.

## Etapa 1 — Especificação exata do tamanho

- **Mobile (< 1024px):** caixa do tabuleiro = `50vh`, com teto de `480px`.
  Largura 100%.
- **Desktop (≥ 1024px):** caixa do tabuleiro = quadrado de
  `clamp(280px, 25vw, 420px)` (25% da largura da viewport, nunca menor que
  280px nem maior que 420px). Fica no canto superior esquerdo; o resto do
  espaço (`VisaoSection`) ocupa a direita.

## Etapa 2 — Substituir `GameShell/index.tsx` (arquivo inteiro)

```tsx
"use client";

import { useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import BoardPanel from "@/components/Game/BoardPanel";
import BoardModal from "@/components/Game/BoardModal";
import EventoBanner from "@/components/Game/EventoBanner";
import TurnoTimeline from "@/components/Game/TurnoTimeline";
import AcaoPrincipal from "@/components/Game/AcaoPrincipal";
import StatsRapidas from "@/components/Game/StatsRapidas";
import { LoaderCircle } from "lucide-react";

type Props = {
  rolando: boolean;
  onRolarDados: () => void;
};

export default function GameShell({ rolando, onRolarDados }: Props) {
  const currentSession = useGameStore((s) => s.currentSession);
  const { user: authUser } = useAuthStore();
  const [boardModalOpen, setBoardModalOpen] = useState(false);

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderCircle className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  const currentPlayer = currentSession.jogadores?.find(
    (p) => p.userId === authUser?.id
  );
  const meuPlayerId = currentPlayer?.id;
  const isTabuleiro = currentSession.tipoJogo === "tabuleiro";

  if (!isTabuleiro) {
    return (
      <div className="space-y-3">
        <StatsRapidas meuPlayerId={meuPlayerId} />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 pb-4">
        {/*
          CAIXA DO TABULEIRO — tamanho travado.
          - overflow-hidden é OBRIGATÓRIO: nada dentro pode estourar isso,
            não importa o tamanho intrínseco do board (1540x1540px).
          - shrink-0: impede que o flex-col pai espreme ou estique essa caixa.
          - Mobile: 50vh, teto 480px, largura total.
          - Desktop (lg+): quadrado clamp(280px,25vw,420px).
        */}
        <div className="relative w-full h-[50vh] max-h-[480px] overflow-hidden shrink-0 lg:h-[clamp(280px,25vw,420px)] lg:w-[clamp(280px,25vw,420px)] lg:max-h-none">
          <BoardPanel
            session={currentSession}
            meuPlayerId={meuPlayerId}
            onMaximize={() => setBoardModalOpen(true)}
          />
        </div>

        <EventoBanner
          eventoAtualCodigo={currentSession.eventoAtual}
          eventoProximoCodigo={currentSession.eventoProximo}
          rodadaAtual={currentSession.rodadaAtual}
        />

        <TurnoTimeline meuPlayerId={meuPlayerId} />

        <AcaoPrincipal
          meuPlayerId={meuPlayerId}
          rolando={rolando}
          onRolarDados={onRolarDados}
        />

        <StatsRapidas meuPlayerId={meuPlayerId} />
      </div>

      {boardModalOpen && (
        <BoardModal
          session={currentSession}
          meuPlayerId={meuPlayerId}
          isOpen={boardModalOpen}
          onClose={() => setBoardModalOpen(false)}
        />
      )}
    </>
  );
}
```

## Etapa 3 — Substituir `BoardPanel/index.tsx` (arquivo inteiro)

O `BoardPanel` não define mais seu próprio tamanho — ele só preenche 100%
da caixa que o `GameShell` já travou (`absolute inset-0`, sem `style`
inline nenhum):

```tsx
"use client";

import Board from "@/components/Board";
import type { GameSession } from "@/types/game";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpand } from "@fortawesome/free-solid-svg-icons";

type Props = {
  session: GameSession;
  meuPlayerId?: number;
  onMaximize: () => void;
};

export default function BoardPanel({ session, meuPlayerId, onMaximize }: Props) {
  if (!session.tabuleiro) return null;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1 min-h-0">
        <Board
          tabuleiro={session.tabuleiro}
          session={session}
          meuPlayerId={meuPlayerId}
        />
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <button
            onClick={onMaximize}
            title="Maximizar tabuleiro"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer backdrop-blur-sm"
          >
            <FontAwesomeIcon icon={faExpand} className="text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Por que `absolute inset-0` e não `h-full`:** `h-full` depende de toda a
cadeia de pais ter altura explícita (`height: 100%` só funciona se o pai
tiver altura definida, senão vira `auto` e volta a estourar). `absolute
inset-0` dentro do container `relative` do `GameShell` preenche exatamente
os 4 lados do pai, sem depender de nenhuma cadeia de `h-full`/`flex-1`
funcionando corretamente em todos os níveis. É a forma que **não pode
falhar** mesmo se algum componente no meio da árvore tiver um bug de
`min-h-0` esquecido.

## Etapa 4 — `page.tsx`: coluna do tabuleiro à esquerda, `VisaoSection` à direita (desktop)

No bloco da aba "Visão" (existem dois iguais: `case "Visão"` e o
`default`), usar:

```tsx
<div className="space-y-4 lg:space-y-0 lg:flex lg:items-start lg:gap-4">
  <div className="lg:shrink-0">
    <GameShell rolando={rolando} onRolarDados={handleRolarDados} />
  </div>
  <div className="lg:flex-1 lg:min-w-0">
    <VisaoSection currentPlayer={currentPlayer} isOwner={isOwner} onNavigate={(tab) => { localStorage.setItem("abaAtual", tab); setAbaAtual(tab); }} />
  </div>
</div>
```

Troquei o `lg:grid` da v1 por `lg:flex` + `lg:shrink-0` na coluna do
`GameShell` — mais simples e sem depender de `minmax()` de grid pra caber
a caixa quadrada do board. Aplicar a mesma estrutura nos dois blocos
idênticos (`case "Visão"` e `default`).

## Etapa 5 — Verificar que `Board/index.tsx` não sobrepõe overflow

Confirmar que a div raiz do `Board` (procurar por
`bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden` dentro de
`Board/index.tsx`) mantém `overflow-hidden` — **não remover essa classe**.
Ela é a segunda camada de proteção (o board internamente usa
`transform: scale()`, que sem `overflow-hidden` no ancestral também vaza
visualmente).

## Testes manuais (fazer nos dois: mobile E desktop, sem pular nenhum)

- [ ] Mobile: caixa do tabuleiro tem no máximo ~480px de altura, fixa —
      rolar a página não faz o tabuleiro "crescer" ou vazar
- [ ] Mobile: o resto da tela (evento, timeline, ação, stats, Visão) fica
      visível abaixo do tabuleiro, sem barra estranha nem espaço vazio
- [ ] Desktop: caixa do tabuleiro é um quadrado no canto superior esquerdo,
      claramente menor que 1/2 da tela (na faixa de 280-420px)
- [ ] Desktop: `VisaoSection` ocupa o espaço à direita do tabuleiro, lado a
      lado (não embaixo)
- [ ] Redimensionar a janela do navegador ao vivo (sem F5): a caixa reflui
      corretamente entre os dois modos
- [ ] Zoom/pan dentro da caixa pequena continuam funcionando
- [ ] Botão "Maximizar" (ícone expandir) abre o `BoardModal` em tela cheia
      normalmente
- [ ] Nenhum scroll vertical "fantasma" da página inteira causado pelo
      board (o scroll deve vir só do conteúdo normal da aba, não do board)
- [ ] Modo Banca inalterado
- [ ] `make validate` passa

## Se AINDA estourar depois disso

Se mesmo com `overflow-hidden` em 3 camadas (`GameShell` wrapper →
`BoardPanel` → `Board` root) o tabuleiro continuar vazando, o problema não
é mais CSS de tamanho — é algo forçando `overflow: visible` via CSS global
ou uma lib de terceiros (ex: alguma regra do Tailwind sendo purgada,
`!important` em algum lugar). Nesse caso, rodar:

```bash
grep -rn "overflow-visible\|overflow: visible" client/src --include="*.tsx" --include="*.css" | grep -v node_modules
```

e reportar o que aparecer, sem tentar mais ajustes de tamanho às cegas.
