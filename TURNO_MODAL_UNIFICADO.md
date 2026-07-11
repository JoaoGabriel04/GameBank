# Modal Unificado de Turno — GameBank Modo Tabuleiro

## Contexto

Hoje o Modo Tabuleiro usa modais separados em cascata: `DadosRoll` mostra
os dados rolando e, se cair em propriedade sem dono, `CompraCasaModal` abre
por cima. Quando a casa não exige ação (própria propriedade, imposto, revés,
prisão), nada é mostrado após os dados.

Esta refatoração unifica tudo em **um único modal que evolui por fases**:
rola os dados → transiciona para mostrar onde caiu e o que aconteceu →
oferece ação (se necessário) ou fecha sozinho após countdown.

**Não altera a lógica de backend** — o `RolarDadosResult` já retorna tudo
que o modal precisa. É uma refatoração de frontend.

---

## ETAPA 0 — Auditoria

```bash
# Ver os componentes atuais
cat client/src/components/Board/DadosRoll/index.tsx
cat client/src/components/Board/CompraCasaModal/index.tsx
wc -l client/src/components/Board/DadosRoll/index.tsx client/src/components/Board/CompraCasaModal/index.tsx

# Ver o tipo de retorno (já tem tudo que precisamos)
grep -A20 "interface RolarDadosResult" client/src/services/api/turno.ts

# Ver onde os modais são usados hoje
grep -rn "DadosRoll\|CompraCasaModal" client/src --include="*.tsx" | grep -v node_modules

# Ver como rolarDados é chamado e o que dispara os modais
grep -nB2 -A15 "rolarDados" client/src/components/Board/index.tsx
```

---

## ETAPA 1 — O que o RolarDadosResult já entrega

O backend já retorna tudo que o modal precisa (não mexer no backend):

```typescript
interface RolarDadosResult {
  dado1: number
  dado2: number
  duplo: boolean              // tirou dados iguais → joga de novo
  foiPreso: boolean           // foi mandado para a prisão
  novaPosicao?: number        // casa onde parou
  passouInicio?: boolean      // passou/parou no Início (+2000)
  turnoAtualPlayerId?: number | null
  avancou?: boolean
  aguardandoAcao?: boolean     // true = precisa decidir (comprar)
  compraDisponivel?: CompraDisponivel  // dados da propriedade p/ comprar
  mensagem?: string           // texto descritivo do que aconteceu
  escapouPrisao?: boolean
  aindaPreso?: boolean
  pagouMulta?: boolean
  tentativasPrisao?: number
  falido?: boolean
}
```

O campo `mensagem` e `compraDisponivel` são a base do que o modal mostra
na fase de resultado.

---

## ETAPA 2 — Criar o componente TurnoModal unificado

Criar `client/src/components/Board/TurnoModal/index.tsx` substituindo
`DadosRoll` e `CompraCasaModal`. Usar **GSAP** (padrão do projeto), não
Framer Motion.

### Fases do modal

```typescript
type FaseTurno =
  | "rolando"      // dados girando
  | "resultado"   // dados parados + "Você tirou X"
  | "desfecho"    // onde caiu + o que aconteceu
  | "acao"        // exige decisão: comprar propriedade
```

### Estrutura e lógica

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import type { RolarDadosResult } from "@/services/api/turno"

const COUNTDOWN_SEGUNDOS = 10

type TurnoModalProps = {
  aberto: boolean
  resultado: RolarDadosResult | null
  // Nome da casa onde caiu (resolvido do tabuleiro pela novaPosicao)
  nomeCasa?: string
  // Callbacks de ação
  onComprar: () => void
  onRecusar: () => void
  onFechar: () => void
  // Se duplo, o modal avisa e ao fechar prepara nova rolagem
  onJogarNovamente?: () => void
}

type FaseTurno = "rolando" | "resultado" | "desfecho" | "acao"

export default function TurnoModal({
  aberto, resultado, nomeCasa,
  onComprar, onRecusar, onFechar, onJogarNovamente,
}: TurnoModalProps) {
  const [fase, setFase] = useState<FaseTurno>("rolando")
  const [countdown, setCountdown] = useState(COUNTDOWN_SEGUNDOS)

  const backdropRef = useRef<HTMLDivElement>(null)
  const cardRef     = useRef<HTMLDivElement>(null)
  const dado1Ref    = useRef<HTMLDivElement>(null)
  const dado2Ref    = useRef<HTMLDivElement>(null)
  const desfechoRef = useRef<HTMLDivElement>(null)
  const barraRef    = useRef<HTMLDivElement>(null)

  // Determinar se a casa exige ação (comprar) ou é só informativa
  const exigeAcao = resultado?.aguardandoAcao && resultado?.compraDisponivel

  // ── Ao abrir: iniciar na fase "rolando" ──────────────────────────────
  useEffect(() => {
    if (aberto && resultado) {
      setFase("rolando")
      setCountdown(COUNTDOWN_SEGUNDOS)
    }
  }, [aberto, resultado])

  // ── Sequência de fases (rolando → resultado → desfecho) ──────────────
  useGSAP(() => {
    if (!aberto || !resultado) return

    // Entrada do modal
    if (backdropRef.current) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    }
    if (cardRef.current) {
      gsap.fromTo(cardRef.current,
        { opacity: 0, scale: 0.9, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.5)" }
      )
    }

    // Animação dos dados girando (fase rolando, ~1.2s)
    const tl = gsap.timeline()
    if (dado1Ref.current && dado2Ref.current) {
      tl.to([dado1Ref.current, dado2Ref.current], {
        rotation: 360,
        duration: 0.3,
        repeat: 3,
        ease: "none",
      })
    }
    // Após girar, mostrar resultado
    tl.call(() => setFase("resultado"))
    // Depois de 1s no resultado, ir para o desfecho
    tl.to({}, { duration: 1 })
    tl.call(() => {
      if (exigeAcao) {
        setFase("acao")
      } else {
        setFase("desfecho")
      }
    })
  }, { dependencies: [aberto, resultado] })

  // ── Transição de entrada do desfecho (push lateral suave) ────────────
  useGSAP(() => {
    if ((fase === "desfecho" || fase === "acao") && desfechoRef.current) {
      gsap.fromTo(desfechoRef.current,
        { x: 40, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, ease: "power3.out" }
      )
    }
  }, { dependencies: [fase] })

  // ── Countdown na fase "desfecho" (só informativos) ───────────────────
  useEffect(() => {
    if (fase !== "desfecho") return

    // Animar a barra diminuindo
    if (barraRef.current) {
      gsap.fromTo(barraRef.current,
        { width: "100%" },
        { width: "0%", duration: COUNTDOWN_SEGUNDOS, ease: "none" }
      )
    }

    // Countdown numérico
    const inicio = Date.now()
    const interval = setInterval(() => {
      const decorrido = (Date.now() - inicio) / 1000
      const restante = Math.max(0, COUNTDOWN_SEGUNDOS - decorrido)
      setCountdown(Math.ceil(restante))
      if (restante <= 0) {
        clearInterval(interval)
        fecharModal()
      }
    }, 100)

    return () => clearInterval(interval)
  }, [fase])

  // ── Fechar com animação, depois decidir se joga de novo ──────────────
  const fecharModal = useCallback(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        onFechar()
        // Se tirou duplo e não foi preso, prepara nova rolagem
        if (resultado?.duplo && !resultado?.foiPreso) {
          onJogarNovamente?.()
        }
      }
    })
    if (cardRef.current) {
      tl.to(cardRef.current, { opacity: 0, scale: 0.9, y: 8, duration: 0.2 }, 0)
    }
    if (backdropRef.current) {
      tl.to(backdropRef.current, { opacity: 0, duration: 0.2 }, 0)
    }
  }, [resultado, onFechar, onJogarNovamente])

  if (!aberto || !resultado) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] px-4"
      style={{ opacity: 0 }}
      // Só permite fechar clicando fora se NÃO exige ação e NÃO está rolando
      onClick={fase === "desfecho" ? fecharModal : undefined}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6
                   max-w-sm w-full text-center"
        style={{ opacity: 0 }}
      >
        {/* ── Dados (sempre visíveis no topo) ── */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div ref={dado1Ref}><DiceFace value={resultado.dado1} /></div>
          <div ref={dado2Ref}><DiceFace value={resultado.dado2} /></div>
        </div>

        {/* ── Fase: rolando ── */}
        {fase === "rolando" && (
          <p className="font-inconsolata text-sm text-zinc-500">
            Rolando os dados...
          </p>
        )}

        {/* ── Fase: resultado ── */}
        {fase === "resultado" && (
          <div>
            <p className="font-jaro text-2xl text-zinc-100">
              Você tirou {resultado.dado1 + resultado.dado2}
            </p>
            <p className="font-inconsolata text-xs text-zinc-500 mt-1">
              ({resultado.dado1} + {resultado.dado2})
              {resultado.duplo && " — Dados iguais!"}
            </p>
          </div>
        )}

        {/* ── Fase: desfecho (informativo, com countdown) ── */}
        {fase === "desfecho" && (
          <div ref={desfechoRef}>
            {/* Nome da casa onde caiu */}
            {nomeCasa && (
              <p className="font-jaro text-lg text-zinc-100 mb-1">{nomeCasa}</p>
            )}

            {/* Mensagem do que aconteceu (vem do backend) */}
            {resultado.mensagem && (
              <p className="font-inconsolata text-sm text-zinc-300 mb-2">
                {resultado.mensagem}
              </p>
            )}

            {/* Passou pelo Início */}
            {resultado.passouInicio && (
              <p className="font-inconsolata text-sm text-emerald-400 mb-1">
                +R$ 2.000 por passar pelo Início
              </p>
            )}

            {/* Foi preso */}
            {resultado.foiPreso && (
              <p className="font-inconsolata text-sm text-red-400 mb-1">
                🔒 Você foi preso!
              </p>
            )}

            {/* Duplo — joga de novo */}
            {resultado.duplo && !resultado.foiPreso && (
              <p className="font-inconsolata text-sm text-amber-400 mt-2">
                🎲 Você ganhou mais uma jogada!
              </p>
            )}

            {/* Barra de countdown */}
            <div className="mt-4 bg-zinc-800 rounded-full h-1 overflow-hidden">
              <div
                ref={barraRef}
                className="h-full bg-zinc-500 rounded-full"
                style={{ width: "100%" }}
              />
            </div>
            <p className="font-inconsolata text-[10px] text-zinc-600 mt-1">
              Fechando em {countdown}s
            </p>
          </div>
        )}

        {/* ── Fase: ação (comprar propriedade — SEM countdown) ── */}
        {fase === "acao" && resultado.compraDisponivel && (
          <div ref={desfechoRef}>
            {nomeCasa && (
              <p className="font-jaro text-lg text-zinc-100 mb-1">{nomeCasa}</p>
            )}
            <p className="font-inconsolata text-sm text-zinc-300 mb-1">
              Propriedade sem dono!
            </p>
            <p className="font-inconsolata text-sm text-amber-400 mb-4">
              Comprar por R$ {resultado.compraDisponivel.custo?.toLocaleString("pt-BR")}?
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onRecusar}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200
                           font-inconsolata text-sm rounded-xl cursor-pointer"
              >
                Recusar
              </button>
              <button
                onClick={onComprar}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white
                           font-inconsolata text-sm rounded-xl cursor-pointer"
              >
                Comprar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Regras críticas de comportamento

1. **Fase "acao" (comprar) NÃO tem countdown** — fica aberta até o jogador
   clicar Comprar ou Recusar. Não fecha sozinha.
2. **Fase "desfecho" (informativo) tem countdown de 10s** com barra
   diminuindo. Fecha sozinha ou ao clicar fora.
3. **Ao fechar com duplo** (não preso), chama `onJogarNovamente` para
   preparar nova rolagem.
4. **Clicar fora só fecha na fase "desfecho"** — nunca durante rolando,
   resultado ou ação.

---

## ETAPA 3 — Resolver nome da casa no frontend

O modal recebe `nomeCasa` derivado da `novaPosicao`. Usar o `tabuleiro.json`
já carregado no cliente:

```typescript
import { TABULEIRO } from "@/utils/tabuleiro-data"  // ou onde estiver

const nomeCasa = resultado?.novaPosicao != null
  ? TABULEIRO[resultado.novaPosicao]?.nome
  : undefined
```

---

## ETAPA 4 — Integrar no Board e remover modais antigos

```bash
# Ver onde DadosRoll e CompraCasaModal são renderizados
grep -n "DadosRoll\|CompraCasaModal" client/src/components/Board/index.tsx
```

No `Board/index.tsx`:
1. Substituir `<DadosRoll />` e `<CompraCasaModal />` por `<TurnoModal />`
2. Conectar os callbacks:
   - `onComprar` → `comprarCasaAtual(sessionId)` (já existe no gameStore)
   - `onRecusar` → `recusarCompra(sessionId)` (já existe)
   - `onFechar` → limpar o resultado local
   - `onJogarNovamente` → habilitar o botão de rolar de novo
3. Manter o estado do `resultado` de `rolarDados` para passar ao modal

Após validar que o TurnoModal funciona:
- Deletar `client/src/components/Board/DadosRoll/`
- Deletar `client/src/components/Board/CompraCasaModal/`
- Remover imports órfãos

---

## ETAPA 5 — Testes manuais

- [ ] Rolar dados: modal abre na fase "rolando" com dados girando
- [ ] Após girar: mostra "Você tirou X (a+b)"
- [ ] Cai em propriedade sem dono: transiciona para fase "acao" com botões
- [ ] Fase "acao" NÃO fecha sozinha — espera decisão
- [ ] Comprar/Recusar funcionam e fecham o modal
- [ ] Cai na própria propriedade: fase "desfecho" com countdown de 10s
- [ ] Cai em imposto/receita: mostra mensagem + countdown
- [ ] Vai preso: mostra "Você foi preso!" + countdown
- [ ] Passou pelo Início: mostra "+R$2.000"
- [ ] Dados duplos: mostra "Você ganhou mais uma jogada!"
- [ ] Ao fechar com duplo: prepara nova rolagem automaticamente
- [ ] Barra de countdown diminui suavemente ao longo dos 10s
- [ ] Clicar fora fecha só na fase "desfecho", nunca em "acao"
- [ ] Transição de push lateral no desfecho não fica estranha
- [ ] DadosRoll e CompraCasaModal removidos, sem imports órfãos
- [ ] Zero Framer Motion no novo componente (só GSAP)
- [ ] `make validate` passa

---

## Definição de "pronto"

1. `TurnoModal` unificado com 4 fases (rolando → resultado → desfecho/acao)
2. Countdown de 10s com barra só nos informativos
3. Fase de compra sem timer, espera decisão
4. Duplo prepara nova rolagem ao fechar
5. Modais antigos removidos
6. Tudo em GSAP
7. Todos os testes manuais passando
