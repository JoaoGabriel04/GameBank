'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import { Loader2 } from "lucide-react"
import type { RolarDadosResult, EscolhaMovimento } from "@/services/api/turno"
import ExtratoInicioModal from "../ExtratoInicioModal"
import { playSfx } from "@/utils/sfx"

const COUNTDOWN_SEGUNDOS = 10
const ESCOLHA_TIMEOUT_S = 60
const ESCOLHA_AVISO_S = 10

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

// Placeholder mostrado durante a fase "escolha" (às cegas) — mesmo
// tamanho/posição do DiceFace real, só que sem revelar o valor. Existe
// pra manter dado1Ref/dado2Ref sempre montados (nunca null), porque o
// GSAP anima esses mesmos elementos assim que a escolha é enviada.
function MysteryFace() {
  return (
    <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center">
      <span className="font-jaro text-2xl text-zinc-600">?</span>
    </div>
  )
}

type AcaoCompra = "comprando" | "recusando" | null

type TurnoModalProps = {
  aberto: boolean
  resultado: RolarDadosResult | null
  // Nome da casa onde caiu (resolvido do tabuleiro pela novaPosicao)
  nomeCasa?: string
  // Erro de compra (ex.: saldo insuficiente) — exibido dentro do modal
  erroCompra?: string | null
  // Ação de compra/recusa em andamento (feedback de loading)
  acaoEmCurso?: AcaoCompra
  // Callbacks de ação
  onComprar: () => void
  onRecusar: () => void
  onFechar: () => void
  // FIX_COMPRA_TRAVADA_LOADING: separado de onFechar para que Board
  // saiba quando o jogador minimizou deliberadamente a compra pendente.
  onDecidirDepois?: () => void
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
  // Usado para retomar direto em "acao"/"escolha" quando a ação pendente
  // já existia antes da montagem (ex.: refresh de página em meio a uma
  // decisão) — sem repetir a animação de dados de uma rolagem que já
  // aconteceu.
  faseInicial?: FaseTurno
  // Escolha de Movimento (Mecânica 3, às cegas): o jogador decide antes de
  // saber o valor. Não recebe mais opções com destino/casa — só o
  // callback pra enviar a escolha.
  onEscolherMovimento?: (escolha: EscolhaMovimento) => void
  // Revelar dados (Crédito de Visão): opcional, gasta um crédito para ver
  // os valores dos dados antes de escolher o movimento.
  onRevelarDados?: () => void
}

type FaseTurno = "rolando" | "resultado" | "escolha" | "extrato-inicio" | "desfecho" | "acao"

export default function TurnoModal({
  aberto, resultado, nomeCasa, erroCompra, acaoEmCurso,
  onComprar, onRecusar, onFechar, onDecidirDepois, onJogarNovamente, onDadosParados, onResultadoRevelado,
  faseInicial = "rolando",
  onEscolherMovimento, onRevelarDados,
}: TurnoModalProps) {
  const [fase, setFase] = useState<FaseTurno>("rolando")
  const [countdown, setCountdown] = useState(COUNTDOWN_SEGUNDOS)
  const [escolhaRestante, setEscolhaRestante] = useState(ESCOLHA_TIMEOUT_S)
  const [escolhendo, setEscolhendo] = useState(false)

  const backdropRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dado1Ref = useRef<HTMLDivElement>(null)
  const dado2Ref = useRef<HTMLDivElement>(null)
  const desfechoRef = useRef<HTMLDivElement>(null)
  const barraRef = useRef<HTMLDivElement>(null)

  // Determinar se a casa exige ação (comprar) ou é só informativa
  const exigeAcao = resultado?.aguardandoAcao && resultado?.compraDisponivel

  // ── Ao abrir com um resultado FRESCO (ainda não escolhido): entra direto
  // na fase certa. Às cegas (aguardandoEscolha), pula "rolando" — não há
  // dado nenhum pra animar ainda, a escolha vem primeiro. Senão, segue
  // faseInicial (normalmente "rolando", ou "acao"/"desfecho" ao retomar
  // uma decisão pendente após F5). Não se aplica quando `resultado` muda
  // por causa da 2ª chamada (escolherMovimento resolvido) — esse caso é
  // tratado só pelo useGSAP abaixo.
  useEffect(() => {
    if (aberto && resultado && resultado.escolha == null) {
      setFase(resultado.aguardandoEscolha ? "escolha" : faseInicial)
      setCountdown(COUNTDOWN_SEGUNDOS)
    }
  }, [aberto, resultado, faseInicial])

  // ── Sequência de fases ────────────────────────────────────────────────
  // Fluxo às cegas: escolha (sem dado nenhum à mostra) → jogador decide →
  // SÓ ENTÃO o servidor revela dado1/dado2 na resposta de
  // escolherMovimento → rolando (anima) → resultado (revela) → desfecho.
  useGSAP(() => {
    if (!aberto || !resultado) return

    // Escolha de movimento já resolvida (chegou o resultado final da 2ª
    // chamada, escolherMovimento) — é AQUI que os dados existem pela
    // primeira vez. Roda a mesma animação de giro que antes aconteciaна
    // rolagem inicial, só que agora depois da escolha.
    if (resultado.escolha != null) {
      setFase("rolando")
      setCountdown(COUNTDOWN_SEGUNDOS)

      const tl = gsap.timeline()
      if (dado1Ref.current && dado2Ref.current) {
        tl.to([dado1Ref.current, dado2Ref.current], {
          rotation: 360,
          duration: 0.3,
          repeat: 3,
          ease: "none",
        })
      }
      tl.call(() => {
        setFase("resultado")
        onDadosParados?.()
      })
      tl.to({}, { duration: 1 })
      tl.call(() => {
        onResultadoRevelado?.()
        if (resultado.passouInicio && resultado.extratoInicio) {
          setFase("extrato-inicio")
        } else if (exigeAcao) {
          setFase("acao")
        } else {
          setFase("desfecho")
        }
      })
      return
    }

    // Entrada do modal (1ª resposta ou reabertura de uma decisão pendente)
    if (backdropRef.current) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    }
    if (cardRef.current) {
      gsap.fromTo(cardRef.current,
        { opacity: 0, scale: 0.9, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.5)" }
      )
    }

    // Às cegas: para por aqui. Sem dado1/dado2 na resposta, não tem o que
    // animar — o jogador escolhe primeiro (fase "escolha" já setada pelo
    // useEffect acima).
    if (resultado.aguardandoEscolha) return

    // Resultado retomado (ex.: refresh com ação pendente) — sem animação
    // de dados, a rolagem já aconteceu antes da montagem do modal.
    if (faseInicial !== "rolando") return

    // Rolagem sem escolha envolvida (ex.: 3 duplos seguidos → prisão
    // direta — não há escolha de movimento nesse caso).
    const tl = gsap.timeline()
    if (dado1Ref.current && dado2Ref.current) {
      tl.to([dado1Ref.current, dado2Ref.current], {
        rotation: 360,
        duration: 0.3,
        repeat: 3,
        ease: "none",
      })
    }
    tl.call(() => {
      setFase("resultado")
      onDadosParados?.()
    })
    tl.to({}, { duration: 1 })
    tl.call(() => {
      onResultadoRevelado?.()
      if (resultado.passouInicio && resultado.extratoInicio) {
        setFase("extrato-inicio")
      } else if (exigeAcao) {
        setFase("acao")
      } else {
        setFase("desfecho")
      }
    })
  }, { dependencies: [aberto, resultado, faseInicial] })

  // ── Fase "escolha": countdown de 60s (mesmo timeout do servidor) + SFX
  // aos 10s restantes. O servidor aplica a soma automaticamente se o
  // tempo acabar — este timer é só visual/aviso, não fecha o modal
  // sozinho (quem fecha é a resposta de escolherMovimento ou a detecção
  // de timeout em Board via session.aguardandoEscolha).
  const escolhaAvisadoRef = useRef(false)
  useEffect(() => {
    if (fase !== "escolha") return
    setEscolhendo(false)
    escolhaAvisadoRef.current = false
    setEscolhaRestante(ESCOLHA_TIMEOUT_S)
    const inicio = Date.now()
    const interval = setInterval(() => {
      const decorrido = (Date.now() - inicio) / 1000
      const restante = Math.max(0, ESCOLHA_TIMEOUT_S - decorrido)
      setEscolhaRestante(Math.ceil(restante))
      if (restante <= ESCOLHA_AVISO_S && !escolhaAvisadoRef.current) {
        escolhaAvisadoRef.current = true
        playSfx("tempo-acabando")
      }
    }, 250)
    return () => clearInterval(interval)
  }, [fase])

  // ── Transição de entrada do desfecho/extrato (push lateral suave) ────
  useGSAP(() => {
    if ((fase === "desfecho" || fase === "acao" || fase === "extrato-inicio" || fase === "escolha") && desfechoRef.current) {
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
        // Mecânica 3: duplo só concede jogada extra se a escolha foi a
        // soma (duploValido). Resultados sem esse campo (prisão, 3
        // duplos seguidos) mantêm o comportamento antigo via fallback.
        if ((resultado?.duploValido ?? resultado?.duplo) && !resultado?.foiPreso) {
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

  // ── Sair do extrato do Início: só por ação explícita do jogador (clique
  // no overlay ou no card) — sem fechamento automático por tempo. É a
  // informação mais importante do turno (créditos, IPTU, manutenção,
  // renda passiva), então não pode passar batido por causa de um timer.
  const continuarExtrato = useCallback(() => {
    setFase(exigeAcao ? "acao" : "desfecho")
  }, [exigeAcao])

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
      className={`fixed inset-0 bg-black/70 flex items-center justify-center px-4 ${
        // Extrato do Início é a informação mais crítica do turno (créditos,
        // IPTU, manutenção, renda passiva) — fica acima de qualquer outro
        // modal (evento econômico, leilão), que também usam z-[200].
        fase === "extrato-inicio" ? "z-[220]" : "z-[200]"
      }`}
      style={{ opacity: 0 }}
      // Clicar fora fecha na fase "desfecho" (informativo) e avança no
      // extrato do Início (crítico, mas sem timeout automático — só sai
      // por ação explícita do jogador, seja no overlay ou no card).
      onClick={fase === "desfecho" ? fecharModal : fase === "extrato-inicio" ? continuarExtrato : undefined}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full text-center transition-[max-width] ${
          fase === "escolha" ? "max-w-xl" : "max-w-sm"
        }`}
        style={{ opacity: 0 }}
      >
        {/* ── Dados — placeholder "?" na fase escolha (às cegas), valor
             real nas demais. Os refs ficam SEMPRE montados aqui (nunca
             condicionalmente removidos) — o GSAP anima esses mesmos
             elementos assim que a escolha é enviada. ── */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div ref={dado1Ref}>
            {fase === "escolha" && !resultado.dado1 ? <MysteryFace /> : <DiceFace value={resultado.dado1 ?? 1} />}
          </div>
          <div ref={dado2Ref}>
            {fase === "escolha" && !resultado.dado2 ? <MysteryFace /> : <DiceFace value={resultado.dado2 ?? 1} />}
          </div>
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
              Você tirou {(resultado.dado1 ?? 0) + (resultado.dado2 ?? 0)}
            </p>
            <p className="font-inconsolata text-xs text-zinc-500 mt-1">
              ({resultado.dado1} + {resultado.dado2})
              {resultado.duplo && " — Dados iguais!"}
            </p>
          </div>
        )}

        {/* ── Fase: escolha (Mecânica 3, às cegas — dado1, dado2 ou soma,
             decidido ANTES de saber os valores) ── */}
        {fase === "escolha" && (
          <div ref={desfechoRef}>
            {resultado.dado1 != null ? (
              <>
                <p className="font-jaro text-lg text-zinc-100 mb-1">Você viu o resultado!</p>
                <p className="font-inconsolata text-xs text-zinc-500 mb-1">
                  Agora escolha o movimento com base nos valores.
                </p>
                {resultado.creditosRestantes != null && (
                  <p className="font-inconsolata text-[11px] text-cyan-400 mb-2">
                    {'👁'} Créditos restantes: {resultado.creditosRestantes}/2
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-jaro text-lg text-zinc-100 mb-1">Escolha antes de ver o resultado</p>
                <p className="font-inconsolata text-xs text-zinc-500 mb-2">
                  Assim ninguém escolhe pra onde ir — o risco é real.
                </p>
                {resultado.creditosRestantes != null && resultado.creditosRestantes > 0 ? (
                  <button
                    onClick={onRevelarDados}
                    className="mb-2 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-inconsolata text-sm cursor-pointer transition-colors"
                  >
                    {'👁'} Revelar dados (1 crédito) — restantes: {resultado.creditosRestantes}/2
                  </button>
                ) : resultado.creditosRestantes === 0 && (
                  <p className="font-inconsolata text-[11px] text-zinc-500 mb-2">
                    {'👁'} Sem créditos de visão — recarregam em 3 rodadas.
                  </p>
                )}
              </>
            )}

            {resultado.duplo && (
              <p className="font-inconsolata text-[11px] text-amber-400 mb-3">
                ⭐ Os dados vieram iguais — escolher Soma garante uma jogada extra!
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(["dado1", "dado2", "soma"] as const).map((op) => (
                <button
                  key={op}
                  disabled={escolhendo}
                  onClick={() => {
                    if (escolhendo) return
                    setEscolhendo(true)
                    onEscolherMovimento?.(op)
                  }}
                  className="flex flex-col items-center gap-1 p-4 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span className="font-jaro text-base text-zinc-100">
                    {op === "dado1" ? "Dado 1" : op === "dado2" ? "Dado 2" : "Soma"}
                  </span>
                  <span className="font-inconsolata text-[11px] text-zinc-500">
                    {op === "soma" ? "Dado 1 + Dado 2" : "Valor oculto"}
                  </span>
                </button>
              ))}
            </div>

            <p className="font-inconsolata text-[10px] text-zinc-600 mt-3">
              ⏱ {escolhaRestante}s — se o tempo acabar, a soma é aplicada automaticamente
            </p>
          </div>
        )}

        {/* ── Fase: extrato-inicio (crédito/IPTU/manutenção da passagem) ── */}
        {fase === "extrato-inicio" && resultado.extratoInicio && (
          <div
            ref={desfechoRef}
            onClick={continuarExtrato}
            className="cursor-pointer"
          >
            <ExtratoInicioModal extrato={resultado.extratoInicio} />
            <p className="font-inconsolata text-[10px] text-zinc-600 mt-3">
              Toque para continuar
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

            {/* Passou pelo Início — já detalhado na fase "extrato-inicio";
                aqui só cobre o caso raro em que não há extrato calculado. */}
            {resultado.passouInicio && !resultado.extratoInicio && (
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
                disabled={acaoEmCurso !== null}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-inconsolata text-sm rounded-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
              >
                {acaoEmCurso === "recusando" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recusando...
                  </span>
                ) : "Recusar"}
              </button>
              <button
                onClick={onComprar}
                disabled={acaoEmCurso !== null}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-inconsolata text-sm rounded-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
              >
                {acaoEmCurso === "comprando" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Comprando...
                  </span>
                ) : `Comprar por R$ ${resultado.compraDisponivel.preco?.toLocaleString("pt-BR")}`}
              </button>
            </div>

            {/* A decisão fica pendente (não conta como recusa) até o
                jogador decidir ou o tempo da rodada acabar — dá espaço pra
                ele ir vender casas/hipotecar propriedades e conseguir o
                dinheiro antes de comprar. */}
            <button
              onClick={onDecidirDepois}
              disabled={acaoEmCurso !== null}
              className="mt-3 w-full py-1.5 text-xs font-inconsolata text-zinc-500 hover:text-zinc-300 underline decoration-dotted cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Decidir depois (fecha sem recusar — venda algo pra ter mais dinheiro)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
