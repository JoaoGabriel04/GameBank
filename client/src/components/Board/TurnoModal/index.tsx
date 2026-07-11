'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import type { RolarDadosResult } from "@/services/api/turno"

const COUNTDOWN_SEGUNDOS = 10

const DICE_DOTS: Record<number, number[][]> = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
}

function DiceFace({ value }: { value: number }) {
  const dots = DICE_DOTS[value] ?? []
  return (
    <div className="w-16 h-16 bg-white rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center p-2.5">
      <div className="w-full h-full grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }).map((_, i) => {
          const row = Math.floor(i / 3)
          const col = i % 3
          const hasDot = dots.some(([r, c]) => r === row && c === col)
          return (
            <div key={i} className="flex items-center justify-center">
              {hasDot && <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type TurnoModalProps = {
  aberto: boolean
  resultado: RolarDadosResult | null
  // Nome da casa onde caiu (resolvido do tabuleiro pela novaPosicao)
  nomeCasa?: string
  // Erro de compra (ex.: saldo insuficiente) — exibido dentro do modal
  erroCompra?: string | null
  // Callbacks de ação
  onComprar: () => void
  onRecusar: () => void
  onFechar: () => void
  // Se duplo, o modal avisa e ao fechar prepara nova rolagem
  onJogarNovamente?: () => void
  // Chamado no exato momento em que os dados param de girar e mostram o
  // número — ponto certo pra tocar o SFX de dados (não no clique).
  onDadosParados?: () => void
  // BUG 2 (TABULEIRO_FIXES): chamado no exato momento em que a fase sai de
  // "resultado" para "desfecho"/"acao" — o ponto correto pra liberar
  // atualizações de sessão retidas (ex.: o peão só deve se mover depois
  // que o jogador já viu o número dos dados).
  onResultadoRevelado?: () => void
  // Fase em que o modal deve abrir. Default "rolando" (animação completa).
  // Usado para retomar direto em "acao" quando a ação pendente já existia
  // antes da montagem (ex.: refresh de página em meio a uma decisão) — sem
  // repetir a animação de dados de uma rolagem que já aconteceu.
  faseInicial?: FaseTurno
}

type FaseTurno = "rolando" | "resultado" | "desfecho" | "acao"

export default function TurnoModal({
  aberto, resultado, nomeCasa, erroCompra,
  onComprar, onRecusar, onFechar, onJogarNovamente, onDadosParados, onResultadoRevelado,
  faseInicial = "rolando",
}: TurnoModalProps) {
  const [fase, setFase] = useState<FaseTurno>("rolando")
  const [countdown, setCountdown] = useState(COUNTDOWN_SEGUNDOS)

  const backdropRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dado1Ref = useRef<HTMLDivElement>(null)
  const dado2Ref = useRef<HTMLDivElement>(null)
  const desfechoRef = useRef<HTMLDivElement>(null)
  const barraRef = useRef<HTMLDivElement>(null)

  // Determinar se a casa exige ação (comprar) ou é só informativa
  const exigeAcao = resultado?.aguardandoAcao && resultado?.compraDisponivel

  // ── Ao abrir: iniciar na fase inicial (normalmente "rolando") ────────
  useEffect(() => {
    if (aberto && resultado) {
      setFase(faseInicial)
      setCountdown(COUNTDOWN_SEGUNDOS)
    }
  }, [aberto, resultado, faseInicial])

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

    // Resultado retomado (ex.: refresh com ação pendente) — sem animação
    // de dados, a rolagem já aconteceu antes da montagem do modal.
    if (faseInicial !== "rolando") return

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
    // Após girar, mostrar resultado — SFX dos dados toca aqui, junto com
    // o número aparecendo, não no clique (faz mais sentido: som de "parou").
    tl.call(() => {
      setFase("resultado")
      onDadosParados?.()
    })
    // Depois de 1s no resultado, ir para o desfecho
    tl.to({}, { duration: 1 })
    tl.call(() => {
      if (exigeAcao) {
        setFase("acao")
      } else {
        setFase("desfecho")
      }
      // Libera atualizações de sessão retidas (peão pode mover agora —
      // o jogador já viu o resultado dos dados).
      onResultadoRevelado?.()
    })
  }, { dependencies: [aberto, resultado, faseInicial] })

  // ── Transição de entrada do desfecho (push lateral suave) ────────────
  useGSAP(() => {
    if ((fase === "desfecho" || fase === "acao") && desfechoRef.current) {
      gsap.fromTo(desfechoRef.current,
        { x: 40, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, ease: "power3.out" }
      )
    }
  }, { dependencies: [fase] })

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
  }, [fase, fecharModal])

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
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center"
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

            {/* Ainda preso (não conseguiu tirar duplo) */}
            {resultado.aindaPreso && (
              <p className="font-inconsolata text-sm text-amber-400 mb-1">
                🔒 Você continua preso.
              </p>
            )}

            {/* Escapou da prisão */}
            {resultado.escapouPrisao && (
              <p className="font-inconsolata text-sm text-emerald-400 mb-1">
                🔓 {resultado.pagouMulta ? "Você pagou a multa e saiu da prisão." : "Você tirou duplo e saiu da prisão!"}
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
            <p className="font-inconsolata text-sm text-amber-400 mb-3">
              Comprar por R$ {resultado.compraDisponivel.preco?.toLocaleString("pt-BR")}?
            </p>

            {erroCompra && (
              <p className="font-inconsolata text-xs text-red-400 mb-3 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                {erroCompra}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onRecusar}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-inconsolata text-sm rounded-xl cursor-pointer"
              >
                Recusar
              </button>
              <button
                onClick={onComprar}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-inconsolata text-sm rounded-xl cursor-pointer"
              >
                Comprar
              </button>
            </div>

            {/* A decisão fica pendente (não conta como recusa) até o
                jogador decidir ou o tempo da rodada acabar — dá espaço pra
                ele ir vender casas/hipotecar propriedades e conseguir o
                dinheiro antes de comprar. */}
            <button
              onClick={onFechar}
              className="mt-3 w-full py-1.5 text-xs font-inconsolata text-zinc-500 hover:text-zinc-300 underline decoration-dotted cursor-pointer"
            >
              Decidir depois (fecha sem recusar — venda algo pra ter mais dinheiro)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
