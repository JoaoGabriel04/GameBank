'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCrosshairs, faExpand } from "@fortawesome/free-solid-svg-icons"
import BoardTile from "./BoardTile"
import TurnoBanner from "./TurnoBanner"
import TurnoModal from "./TurnoModal"
import EventoEconomicoBar from "./EventoEconomicoBar"
import EventoModal from "./EventoModal"
import LeilaoModal from "./LeilaoModal"
import LeilaoResultadoModal from "./LeilaoResultadoModal"
import Pawns from "./Pawns"
import { GRID_SIZE, TILE_SIZE, BOARD_SIZE, posToGrid, posToPixelCenter } from "@/utils/tabuleiro-layout"
import { ARTE_CENTRAL, FUNDO_TABULEIRO, GRUPO_IMAGENS_PRELOAD } from "@/utils/tabuleiro-images"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"
import { useEventoStore } from "@/stores/socketStore"
import { getEvento } from "@/constants/eventos"
import { playSfx, stopSfx } from "@/utils/sfx"
import { withTimeout } from "@/utils/withTimeout"
import type { RolarDadosResult, EscolhaMovimento } from "@/services/api/turno"
import type { Casa, GameSession } from "@/types/game"

const MIN_SCALE = 0.3
const MAX_SCALE = 2.5
// Escala usada no modo não-interativo (compacto): zoom fixo focado no
// próprio peão, em vez do "caber o tabuleiro inteiro" do modo interativo.
const FOCO_SCALE = 1.2

type Props = {
  tabuleiro: Casa[]
  session: GameSession
  meuPlayerId?: number
  // Modo compacto (BoardPanel) x modo tela cheia (BoardModal). No modo
  // compacto o usuário não pode arrastar/dar zoom manualmente — o board só
  // acompanha, sempre focado e centralizado no próprio peão. Só na tela
  // cheia o zoom/pan manual (mouse, touch, pinch) fica disponível.
  interativo?: boolean
  // Botão de maximizar (usado pelo BoardPanel/modo compacto). Renderizado
  // ancorado na própria caixa visual do tabuleiro, não na raiz do Board —
  // essa raiz também contém o EventoEconomicoBar/TurnoBanner empilhados
  // antes dela, então um overlay posicionado na raiz flutuaria sobre esses
  // banners em vez do tabuleiro.
  onMaximize?: () => void
}

export default function Board({ tabuleiro, session, meuPlayerId, interativo = true, onMaximize }: Props) {
  const { rolarDados, escolherMovimento, comprarCasaAtual, recusarCompra, revelarDados, setHoldSessionUpdates } = useGameStore()
  const { success: toastSuccess, error: toastError } = useToast()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 })
  const pinchState = useRef<{ pinching: boolean; startDist: number; startScale: number; centerX: number; centerY: number }>({ pinching: false, startDist: 0, startScale: 1, centerX: 0, centerY: 0 })
  // Posição atual do próprio peão — usada pelo modo não-interativo (foco
  // automático). Ref (não state) porque é lida de dentro do callback do
  // ResizeObserver, criado uma única vez; sem ref, o observer ficaria preso
  // ao valor da posição no momento em que foi criado (closure velha).
  const minhaPosicaoRef = useRef(0)

  // ── Modal unificado de turno (rolar dados → resultado → desfecho/ação) ──
  const [rolando, setRolando] = useState(false)
  const [resultado, setResultado] = useState<RolarDadosResult | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [erroCompra, setErroCompra] = useState<string | null>(null)
  const [eventoModalCodigo, setEventoModalCodigo] = useState<string | null>(null)
  type AcaoCompra = "comprando" | "recusando" | null
  const [acaoEmCurso, setAcaoEmCurso] = useState<AcaoCompra>(null)
  // Marca se o jogador minimizou a compra deliberadamente ("Decidir depois").
  // Sem isso, o fallback que reconstroi a compra pendente a partir do socket
  // não consegue distinguir "minimizei de propósito" de "nunca chegou a abrir".
  const minimizouManualmenteRef = useRef(false)
  // Marca se o resultado atual já teve sua animação de revelação mostrada
  // uma vez — reabrir uma decisão de compra minimizada (botão "decidir
  // depois" / banner) não deve repetir a animação de dados do zero.
  const resultadoJaReveladoRef = useRef(false)
  // Cache do resultado sintetizado pelo fallback (ver abaixo) — evita
  // recriar o objeto a cada render enquanto a mesma compra fica pendente.
  const fallbackResultadoRef = useRef<{ propId: number; sessionPossesId: number; resultado: RolarDadosResult } | null>(null)
  // BUG "Tempo esgotado" falso: marcamos quando o jogador clica em uma
  // escolha de movimento, para o efeito de timeout não exibir o toast.
  const escolhaFeitaRef = useRef(false)
  // Resultado sintetizado para a fase "escolha" às cegas (Mecânica 3) —
  // nada varia entre renders (não há dado1/dado2/opcoes pra reconstruir)
  // EXCETO creditosRestantes, que precisa ser recalculado a partir do
  // jogador/sessão atuais (ver uso abaixo) — sem isso o botão "Revelar
  // dados" some sempre que o Board remonta em meio à escolha (troca
  // compacto/maximizado, refresh, reconexão de socket), mesmo que o
  // jogador ainda tenha créditos no servidor.
  const fallbackEscolhaRef = useRef<RolarDadosResult>({ duplo: false, foiPreso: false, aguardandoEscolha: true })
  // FIX_TURNO_TRAVADO_CONTADOR (BUG A.2/A.3): timer de liberação de
  // segurança do hold — precisa ser cancelável (duplo dentro de 4s não
  // pode deixar o timer da rolagem anterior liberar o hold da nova) e
  // limpo no unmount (troca de aba no meio da rolagem).
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  const clampPosition = useCallback((t: typeof transform) => {
    const vp = viewportRef.current
    if (!vp) return t
    const rect = vp.getBoundingClientRect()
    const bw = BOARD_SIZE * t.scale
    const bh = BOARD_SIZE * t.scale
    const margin = Math.min(rect.width, rect.height) * 0.15
    const minX = Math.min(0, margin - bw)
    const maxX = Math.max(0, rect.width - margin)
    const minY = Math.min(0, margin - bh)
    const maxY = Math.max(0, rect.height - margin)
    if (minX > maxX) return { ...t, x: (rect.width - bw) / 2, y: (rect.height - bh) / 2 }
    return {
      ...t,
      x: Math.min(maxX, Math.max(minX, t.x)),
      y: Math.min(maxY, Math.max(minY, t.y)),
    }
  }, [])

  // Wrapper que aplica clampPosition após cada atualização
  const setTransformClamped = useCallback((updater: typeof transform | ((prev: typeof transform) => typeof transform)) => {
    setTransform(prev => clampPosition(typeof updater === "function" ? updater(prev) : updater))
  }, [clampPosition])

  const centerOn = useCallback((pos: number, scale?: number) => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const { x, y } = posToPixelCenter(pos)
    const s = scale ?? transform.scale
    setTransformClamped({
      scale: s,
      x: rect.width / 2 - x * s,
      y: rect.height / 2 - y * s,
    })
  }, [setTransformClamped, transform.scale])

  // Preload das imagens de grupo — evita flash ao renderizar o tabuleiro,
  // já que as mesmas 9 imagens se repetem em várias casas.
  useEffect(() => {
    GRUPO_IMAGENS_PRELOAD.forEach(src => { const img = new Image(); img.src = src })
  }, [])

  // Evento econômico ativado (virada de rodada) — abre o modal para todos
  // os jogadores uma única vez por transição, via o "pulso" evento:mudou
  // (currentSession.eventoAtual sozinho não bastaria: ele permanece igual
  // por toda a rodada, então um efeito ligado a ele só dispararia na borda
  // de entrada se comparássemos com o valor anterior — o pulso já resolve
  // isso sem precisar desse cuidado extra).
  useEffect(() => {
    const unsub = useEventoStore.subscribe((state) => {
      if (state.ultimoEvento?.eventoAtual) {
        setEventoModalCodigo(state.ultimoEvento.eventoAtual)
      }
    })
    return unsub
  }, [])

  // Ajusta a escala para caber o tabuleiro inteiro na viewport, centralizado.
  // Só usado no modo interativo (tela cheia) — no modo compacto o board não
  // mostra o tabuleiro inteiro, mostra um zoom focado (ver applyFoco).
  const applyFitScale = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const fitScale = clampScale(Math.min(rect.width / BOARD_SIZE, rect.height / BOARD_SIZE) * 0.95)
    setTransformClamped({
      scale: fitScale,
      x: (rect.width - BOARD_SIZE * fitScale) / 2,
      y: (rect.height - BOARD_SIZE * fitScale) / 2,
    })
  }, [setTransformClamped])

  // Centraliza num zoom fixo sobre o próprio peão. Modo compacto (não
  // interativo): sem isso o jogador ficaria olhando pro tabuleiro inteiro
  // minúsculo, sem poder dar zoom manual pra ver onde está.
  const applyFoco = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const scale = clampScale(FOCO_SCALE)
    const { x, y } = posToPixelCenter(minhaPosicaoRef.current)
    setTransformClamped({
      scale,
      x: rect.width / 2 - x * scale,
      y: rect.height / 2 - y * scale,
    })
  }, [setTransformClamped])

  // Recalcula sempre que o CONTAINER mudar de tamanho — não só no mount.
  // Sem isso, quando o Board vive dentro de um painel cuja altura final só
  // se estabelece depois do primeiro paint (ex.: BoardPanel dentro do
  // layout de painéis), a escala é calculada cedo demais e nunca mais é
  // recalculada, deixando o tabuleiro minúsculo/deslocado. O zoom/pan
  // manual do usuário não aciona isso — o ResizeObserver só dispara quando
  // o tamanho do próprio viewport muda, não quando o `transform` muda.
  // Qual função rodar depende do modo: interativo cabe o board inteiro,
  // compacto foca no próprio peão.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const recalc = interativo ? applyFitScale : applyFoco
    recalc()
    const ro = new ResizeObserver(() => recalc())
    ro.observe(vp)
    return () => ro.disconnect()
  }, [interativo, applyFitScale, applyFoco])

  const handleWheel = (e: React.WheelEvent) => {
    if (!interativo) return
    e.preventDefault()
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setTransformClamped(t => {
      const newScale = clampScale(t.scale + delta)
      const nx = mouseX - (mouseX - t.x) * (newScale / t.scale)
      const ny = mouseY - (mouseY - t.y) * (newScale / t.scale)
      return { scale: newScale, x: nx, y: ny }
    })
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interativo) return
    if (e.pointerType === "touch") return
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return
    const dx = e.clientX - dragState.current.lastX
    const dy = e.clientY - dragState.current.lastY
    dragState.current.lastX = e.clientX
    dragState.current.lastY = e.clientY
    setTransformClamped(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }

  const handlePointerUp = () => {
    dragState.current.dragging = false
  }

  const dist = (touches: React.TouchList) => {
    const [a, b] = [touches[0], touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const center = (touches: React.TouchList, rect: DOMRect) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
  })

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!interativo) return
    if (e.touches.length === 2) {
      dragState.current.dragging = false
      pinchState.current = { pinching: true, startDist: dist(e.touches), startScale: transformRef.current.scale, centerX: 0, centerY: 0 }
    } else if (e.touches.length === 1) {
      pinchState.current.pinching = false
      dragState.current = { dragging: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!interativo) return
    e.preventDefault()
    if (e.touches.length === 2 && pinchState.current.pinching) {
      const ratio = dist(e.touches) / pinchState.current.startDist
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      const { x: cx, y: cy } = center(e.touches, rect)
      const newScale = clampScale(pinchState.current.startScale * ratio)
      setTransformClamped(t => {
        const nx = cx - (cx - t.x) * (newScale / t.scale)
        const ny = cy - (cy - t.y) * (newScale / t.scale)
        return { scale: newScale, x: nx, y: ny }
      })
    } else if (e.touches.length === 1 && dragState.current.dragging) {
      const dx = e.touches[0].clientX - dragState.current.lastX
      const dy = e.touches[0].clientY - dragState.current.lastY
      dragState.current.lastX = e.touches[0].clientX
      dragState.current.lastY = e.touches[0].clientY
      setTransformClamped(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }
  }

  const handleTouchEnd = () => {
    pinchState.current.pinching = false
    dragState.current.dragging = false
  }

  const jogadoresAtivos = (session.jogadores ?? []).filter(p => !p.desistiu)

  // Posição atual do próprio peão — mantém a ref viva pra o ResizeObserver
  // (criado uma única vez) sempre focar no lugar certo, mesmo depois do
  // peão se mover.
  const minhaPosicao = jogadoresAtivos.find(p => p.id === meuPlayerId)?.posicao ?? 0
  minhaPosicaoRef.current = minhaPosicao

  // Modo compacto: sempre que o próprio peão mudar de posição, recentraliza
  // automaticamente — o usuário não tem controle manual aqui, então isso é
  // o único jeito de o board acompanhar o peão.
  useEffect(() => {
    if (interativo) return
    applyFoco()
  }, [interativo, minhaPosicao, applyFoco])

  // Derivado do estado da sessão (não da resposta transitória de rolar-dados)
  // pra sobreviver a um refresh de página enquanto a decisão está pendente.
  const jogadorDaVez = jogadoresAtivos.find(p => p.id === session.turnoAtualPlayerId)
  const minhaVez = !!meuPlayerId && jogadorDaVez?.id === meuPlayerId

  // Fallback: se a sessão indica ação pendente mas não há resultado local
  // (ex.: refresh de página, ou reabrir uma decisão minimizada — "decidir
  // depois" — em meio a uma decisão), sintetiza um resultado mínimo já na
  // fase "acao" — sem repetir a animação de dados de uma rolagem que já
  // aconteceu antes desta montagem.
  //
  // IMPORTANTE: o objeto sintetizado é cacheado em um ref e só recriado
  // quando a propriedade pendente realmente muda. Sem isso, cada re-render
  // do Board (ex.: um "session:updated" qualquer chegando via socket)
  // criaria um objeto NOVO, e o TurnoModal reiniciaria a animação de
  // entrada do zero a cada vez — deixando os botões praticamente
  // inutilizáveis (GSAP nunca termina de assentar o card em opacity:1).
  //
  // Calculado ANTES de handleComprar/handleRecusar (e não no fim da
  // função) porque essas duas funções precisam ler resultadoModal, não o
  // estado local `resultado` puro — no cenário de fallback, `resultado`
  // é null (é exatamente por isso que caímos no fallback), então checar
  // `resultado?.compraDisponivel` ali faria os botões não fazerem nada.
  let resultadoModal = resultado
  let modalAbertoFinal = modalAberto
  let faseInicialModal: "rolando" | "acao" | "escolha" = "rolando"
  // Mesmo racional do fallback de compra pendente abaixo, mas para a
  // Mecânica 3: refresh de página em meio à escolha de movimento não pode
  // deixar o jogador sem a tela de escolha (o botão "Rolar dados" fica
  // bloqueado pelo backend enquanto aguardandoEscolha for true).
  //
  // Às cegas: o servidor não manda mais dado1/dado2/opcoes enquanto
  // aguardandoEscolha for true (nem na resposta de rolar-dados, nem aqui
  // em session.ultimoDado1/2 — ver session.service.ts) — não tem nada
  // pra reconstruir além do próprio estado "aguardando escolha". O objeto
  // sintetizado é sempre o mesmo (fallbackEscolhaRef.current, criado uma
  // única vez), pra manter a MESMA referência entre renders — senão cada
  // "session:updated" recriaria o objeto e o TurnoModal replicaria a
  // animação de entrada do zero.
  if (!resultado && minhaVez && session.aguardandoEscolha && jogadorDaVez) {
    // Mesma matemática de recarga que o servidor aplica em
    // dados.service.ts/turno.service.ts antes de calcular creditosRestantes
    // — sem isso o fallback mostraria sempre "0 créditos" mesmo já tendo
    // recarregado.
    const creditoVisao = jogadorDaVez.creditoVisao ?? 0
    const creditoRecargaEm = jogadorDaVez.creditoRecargaEm ?? 0
    const rodadaAtual = session.rodadaAtual ?? 0
    const creditosRestantes = creditoRecargaEm > 0 && rodadaAtual >= creditoRecargaEm ? 2 : creditoVisao
    if (fallbackEscolhaRef.current.creditosRestantes !== creditosRestantes) {
      fallbackEscolhaRef.current = { ...fallbackEscolhaRef.current, creditosRestantes }
    }
    resultadoModal = fallbackEscolhaRef.current
    modalAbertoFinal = true
    faseInicialModal = "escolha"
  }
  if (!resultado && minhaVez && session.aguardandoAcao && jogadorDaVez) {
    const casaAtual = tabuleiro.find(c => c.pos === (jogadorDaVez.posicao ?? 0))
    if (casaAtual && (casaAtual.tipo === "propriedade" || casaAtual.tipo === "acao") && casaAtual.propId != null) {
      const posse = session.sessionPosses?.find(sp => sp.propId === casaAtual.propId)
      if (posse && !posse.playerId && posse.propriedade) {
        const cache = fallbackResultadoRef.current
        if (cache && cache.propId === casaAtual.propId && cache.sessionPossesId === posse.id) {
          resultadoModal = cache.resultado
        } else {
          resultadoModal = {
            dado1: session.ultimoDado1 ?? 1,
            dado2: session.ultimoDado2 ?? 1,
            duplo: false,
            foiPreso: false,
            novaPosicao: casaAtual.pos,
            aguardandoAcao: true,
            compraDisponivel: {
              propId: casaAtual.propId,
              sessionPossesId: posse.id,
              nome: posse.propriedade.nome,
              preco: posse.propriedade.custo_compra,
            },
          }
          fallbackResultadoRef.current = { propId: casaAtual.propId, sessionPossesId: posse.id, resultado: resultadoModal }
        }
        // BUG 3 (FIX_COMPRA_TRAVADA_LOADING): antes usava `modalAberto` —
        // falso no primeiro mount, então o modal nunca abria quando a
        // resposta chegava só pelo socket. Agora distingue: se o jogador
        // minimizou deliberadamente ("Decidir depois"), respeita; senão
        // abre o modal (o resultado nunca foi exibido ainda).
        modalAbertoFinal = modalAberto || !minimizouManualmenteRef.current
        faseInicialModal = "acao"
      }
    }
  } else {
    fallbackResultadoRef.current = null
  }
  // Reabrindo uma decisão minimizada sem ter trocado de aba (resultado
  // local real, não o sintetizado acima): pula direto pra "acao", sem
  // repetir a animação de dados que já rodou uma vez.
  //
  // CRÍTICO: só se aplica quando o resultado atual REALMENTE tem uma
  // compra pendente. Sem o `resultado.compraDisponivel` aqui, isso disparava
  // em QUALQUER re-render após a revelação (ex.: o próprio evento de
  // sessão liberado pelo buffer do BUG 2), forçando faseInicial="acao" de
  // volta pra rolagens sem ação nenhuma — a fase virava "acao" mas o bloco
  // de JSX de "acao" exige compraDisponivel, e o de "desfecho" exige
  // fase==="desfecho": nenhum dos dois renderiza nada, modal trava em branco.
  if (resultado && resultado.compraDisponivel && resultadoJaReveladoRef.current) {
    faseInicialModal = "acao"
  }

  // FIX_TURNO_TRAVADO_CONTADOR (BUG A.2): rearma o timeout de segurança,
  // cancelando qualquer um pendente antes — sem isso, tirar duplo e rolar
  // de novo dentro de 4s deixa o timer da rolagem ANTERIOR liberar o hold
  // da rolagem NOVA, vazando o peão antes do modal revelar.
  const armarLiberacaoDeSeguranca = useCallback(() => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
    holdTimeoutRef.current = setTimeout(() => {
      setHoldSessionUpdates(false)
      holdTimeoutRef.current = null
    }, 4000)
  }, [setHoldSessionUpdates])

  const handleRolarDados = useCallback(async () => {
    if (rolando) return
    setRolando(true)
    resultadoJaReveladoRef.current = false
    minimizouManualmenteRef.current = false
    escolhaFeitaRef.current = false
    stopSfx("tempo-acabando")
    // SFX de dados toca só quando a animação de rolagem termina (ver
    // handleDadosParados) — não no clique, faz mais sentido acompanhando
    // o número aparecendo.
    // BUG 2 (TABULEIRO_FIXES): retém atualizações de sessão (peão, turno)
    // até o TurnoModal revelar o resultado — evita que o peão se mova ou
    // a vez mude na tela antes do jogador ver os dados. Liberado via
    // handleResultadoRevelado (fluxo normal) ou aqui mesmo nos caminhos
    // que não chegam a abrir o modal.
    setHoldSessionUpdates(true)
    try {
      const r = await rolarDados(session.id)
      if (!r) {
        setHoldSessionUpdates(false)
        return
      }
      if (r.falido) {
        setHoldSessionUpdates(false)
        toastError(r.mensagem ?? "Você faliu por não quitar suas dívidas a tempo.")
        return
      }
      // foiPreso cobre os 3 duplos seguidos; "Vá para a Detenção" não seta
      // esse campo (o jogador só é redirecionado dentro de resolverCasa),
      // então também detectamos pela mensagem do backend.
      if (r.foiPreso || /prisão/i.test(r.mensagem ?? "")) {
        playSfx("foi-preso")
      } else if (/aluguel/i.test(r.mensagem ?? "")) {
        playSfx("pagou-aluguel")
      }
      setResultado(r)
      setModalAberto(true)
      // Rede de segurança: se o TurnoModal desmontar no meio da animação
      // (ex.: jogador troca de aba) o GSAP é revertido e onResultadoRevelado
      // nunca dispara — sem isso o buffer ficaria preso até a próxima
      // rolagem. 4s dá folga de sobra pra sequência normal (~2.2s).
      armarLiberacaoDeSeguranca()
    } catch (err: any) {
      setHoldSessionUpdates(false)
      toastError(err?.response?.data?.message || "Erro ao rolar dados")
    } finally {
      setRolando(false)
    }
  }, [rolando, rolarDados, session.id, toastError, setHoldSessionUpdates, armarLiberacaoDeSeguranca])

  // BUG 2 (TABULEIRO_FIXES): chamado pelo TurnoModal no instante em que o
  // resultado dos dados vira visível — só então libera o peão pra mover.
  const handleResultadoRevelado = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    setHoldSessionUpdates(false)
    resultadoJaReveladoRef.current = true
  }, [setHoldSessionUpdates])

  // Chamado pelo TurnoModal quando os dados param de girar e mostram o
  // número — momento certo pro SFX de dados, não no clique do botão.
  const handleDadosParados = useCallback(() => {
    playSfx("rolando-dados")
  }, [])


  const handleEscolherMovimento = useCallback(async (escolha: EscolhaMovimento) => {
    escolhaFeitaRef.current = true
    setHoldSessionUpdates(true)
    try {
      const r = await escolherMovimento(session.id, escolha)
      if (!r) return
      if (r.foiPreso || /prisão/i.test(r.mensagem ?? "")) {
        playSfx("foi-preso")
      } else if (/aluguel/i.test(r.mensagem ?? "")) {
        playSfx("pagou-aluguel")
      }
      setResultado(r)
    } catch (err: any) {
      toastError(err?.response?.data?.message || "Erro ao mover")
      // Se escolherMovimento falhar (ex.: perdeu a corrida pro timeout de
      // 60s do servidor, que já pode ter resolvido esta MESMA escolha
      // pendente com "soma" e avançado o turno — ver turno.service.ts),
      // `resultado` continua com aguardandoEscolha=true e o modal fica
      // travado na tela de escolha pra sempre, já que escolhaFeitaRef
      // (setado true no início desta função) desarma o efeito de
      // recuperação por timeout abaixo. Resetar aqui deixa esse efeito
      // fechar o modal sozinho assim que o socket confirmar que não há
      // mais nada pendente, sem precisar de F5.
      escolhaFeitaRef.current = false
    } finally {
      // FIX_TURNO_TRAVADO_CONTADOR (BUG A.1): antes só liberava dentro do
      // try/catch — se a promise nunca resolvesse nem rejeitasse (servidor
      // hibernando no free tier), o hold ficava preso pra sempre. `finally`
      // libera em QUALQUER desfecho. Não há suspense a proteger aqui (o
      // jogador acabou de clicar deliberadamente), então liberar já junto
      // com o resultado não deixa o peão "pulando" fora de sincronia com
      // a transição de fase do modal.
      setHoldSessionUpdates(false)
    }
  }, [session.id, escolherMovimento, toastError, setHoldSessionUpdates])

  // Sem guarda + feedback visual, um duplo-clique (ou o usuário reclicando
  // por achar que não funcionou, já que a resposta demora) disparava a
  // requisição mais de uma vez e gastava 2 créditos numa única revelação.
  const [revelandoDados, setRevelandoDados] = useState(false)
  const handleRevelarDados = useCallback(async () => {
    if (revelandoDados) return
    setRevelandoDados(true)
    try {
      const r = await revelarDados(session.id)
      if (!r) return
      // Atualiza o resultado local com os dados revelados e créditos
      // restantes. `resultado` (state real) é null sempre que a tela de
      // escolha está sendo mostrada pelo fallback (F5, reconexão de
      // socket, alternar compacto/maximizado) — nesse caso, `prev ??
      // fallbackEscolhaRef.current` usa o objeto sintetizado como base
      // em vez de descartar a resposta do servidor. Sem isso, o crédito
      // era consumido no banco mas a revelação nunca aparecia na tela
      // (o `prev` era sempre null, então a atualização virava um no-op),
      // e o jogador achava que o botão "não funcionava".
      setResultado(prev => {
        const base = prev ?? fallbackEscolhaRef.current
        return { ...base, dado1: r.dado1, dado2: r.dado2, creditosRestantes: r.creditosRestantes }
      })
      // A partir daqui `resultado` deixa de ser null, então o próximo
      // render já não passa pelo ramo de fallback que força
      // modalAbertoFinal=true — sem isto explícito, o modal fecharia
      // sozinho no instante em que os dados fossem revelados.
      setModalAberto(true)
    } finally {
      setRevelandoDados(false)
    }
  }, [session.id, revelarDados, revelandoDados])

  // FIX_TURNO_TRAVADO_CONTADOR (BUG A.3): cleanup no unmount — se o
  // jogador trocar de aba/navegar para fora durante uma rolagem, o
  // componente desmonta sem passar pelos handlers acima. Sem isso o hold
  // fica preso (nenhum componente mais vivo pra liberá-lo).
  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
      setHoldSessionUpdates(false)
    }
  }, [setHoldSessionUpdates])

  // Detecta quando o servidor resolveu a escolha de movimento por timeout
  // (o jogador não clicou a tempo) — session.aguardandoEscolha vira false
  // sem que tenhamos processado uma resposta local de escolherMovimento.
  // BUG: se o jogador clicou em uma opção, escolhaFeitaRef fica true —
  // não fecha o modal nem limpa o resultado (quem faz isso é a resposta
  // de escolherMovimento). Só no timeout real (ref false) que o modal
  // fecha e o resultado é descartado.
  useEffect(() => {
    if (resultado?.aguardandoEscolha && !session.aguardandoEscolha) {
      if (!escolhaFeitaRef.current) {
        setHoldSessionUpdates(false)
        setModalAberto(false)
        setResultado(null)
        toastError("Tempo esgotado — movimento padrão aplicado (soma)")
      }
      escolhaFeitaRef.current = false
    }
  }, [session.aguardandoEscolha])

  // BUG 3 (FIX_COMPRA_TRAVADA_LOADING): quando o jogador cai em uma
  // propriedade nova, é uma decisão nova — o "minimizei antes" não persiste.
  useEffect(() => {
    minimizouManualmenteRef.current = false
  }, [resultadoModal?.compraDisponivel?.propId])

  // BUG (clicar Comprar "não faz nada"): `resultado` só é limpo por ações
  // explícitas (handleJogarNovamente, timeout da escolha acima) — comprar
  // e recusar fecham o modal (setModalAberto(false)) mas NUNCA limpavam
  // `resultado`, que continuava com o `compraDisponivel` antigo. Se por
  // qualquer motivo (timeout no servidor virando leilão, corrida entre o
  // clique e o socket) o cliente visse `session.aguardandoAcao` ainda true
  // por um instante, a UI reexibia a compra já resolvida — e o clique em
  // "Decidir agora" reabria o MESMO resultado obsoleto, sem efeito. Mesmo
  // racional do efeito de timeout da escolha acima: assim que o servidor
  // confirma que não há mais nada pendente, o estado local é descartado.
  useEffect(() => {
    if (resultado?.aguardandoAcao && !session.aguardandoAcao) {
      setModalAberto(false)
      setResultado(null)
    }
  }, [session.aguardandoAcao])

  const handleComprar = useCallback(async () => {
    if (acaoEmCurso || !resultadoModal?.compraDisponivel) return
    const nome = resultadoModal.compraDisponivel.nome
    setAcaoEmCurso("comprando")
    setErroCompra(null)
    try {
      const ok = await withTimeout(comprarCasaAtual(session.id), 15000)
      if (ok) {
        setModalAberto(false)
        setErroCompra(null)
        playSfx("comprou-propriedade")
        toastSuccess(`Você comprou ${nome}!`)
      } else {
        const storeError = useGameStore.getState().error
        if (storeError?.toLowerCase().includes("saldo")) {
          setErroCompra("Saldo insuficiente! Vá até a aba Início para vender casas ou hipotecar imóveis e conseguir mais dinheiro. Depois volte aqui e tente novamente.")
        } else {
          setErroCompra(storeError || "Não foi possível concluir a compra.")
        }
      }
    } catch (err: any) {
      if (err?.message === "TIMEOUT") {
        setErroCompra("O servidor está demorando a responder. Tente novamente.")
      } else {
        setErroCompra("Erro ao comprar. Tente novamente.")
      }
    } finally {
      setAcaoEmCurso(null)
    }
  }, [acaoEmCurso, resultadoModal, comprarCasaAtual, session.id, toastSuccess, toastError])

  const handleRecusar = useCallback(async () => {
    if (acaoEmCurso || !resultadoModal?.compraDisponivel) return
    const nome = resultadoModal.compraDisponivel.nome
    setAcaoEmCurso("recusando")
    setErroCompra(null)
    try {
      const ok = await withTimeout(recusarCompra(session.id), 15000)
      setModalAberto(false)
      if (ok) toastSuccess(`Você recusou a compra de ${nome}.`)
      else toastError("Não foi possível concluir a ação.")
    } catch (err: any) {
      if (err?.message === "TIMEOUT") {
        setErroCompra("O servidor está demorando a responder. Tente novamente.")
      } else {
        toastError("Erro ao recusar. Tente novamente.")
      }
    } finally {
      setAcaoEmCurso(null)
    }
  }, [acaoEmCurso, resultadoModal, recusarCompra, session.id, toastSuccess, toastError])

  const handleFecharModal = useCallback(() => {
    setModalAberto(false)
  }, [])

  const handleDecidirDepois = useCallback(() => {
    minimizouManualmenteRef.current = true
    setModalAberto(false)
  }, [])

  const handleJogarNovamente = useCallback(() => {
    // Duplo: turno permanece com o mesmo jogador (backend não avança a
    // vez) — só limpar o resultado pra próxima rolagem partir "limpa".
    setResultado(null)
  }, [])

  const nomeCasaModal = resultadoModal?.novaPosicao != null
    ? tabuleiro.find(c => c.pos === resultadoModal!.novaPosicao)?.nome
    : undefined

  return (
    <div className="absolute inset-0 flex flex-col select-none">
      <EventoEconomicoBar
        eventoProximoCodigo={session.eventoProximo}
        eventoAtualCodigo={session.eventoAtual}
        onClickBadge={() => setEventoModalCodigo(session.eventoAtual ?? null)}
      />
      <EventoModal
        isOpen={!!eventoModalCodigo}
        evento={getEvento(eventoModalCodigo)}
        onClose={() => setEventoModalCodigo(null)}
      />
      {session.emLeilao ? (
        // Leilão pausa o turno — todos veem isto no lugar do banner normal,
        // o modal de leilão (abaixo) é quem realmente conduz a decisão.
        <div className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-300 font-inconsolata text-sm">
          🔨 Leilão em andamento — o turno retoma assim que todos decidirem
        </div>
      ) : !interativo && session.turnoAtualPlayerId != null && (
        // TurnoModal (abaixo) só existe na instância !interativo — deixar
        // este botão ativo na instância interativa (BoardModal maximizado)
        // dispara handleRolarDados/setModalAberto num Board que nunca
        // renderiza o modal, deixando o jogador sem feedback visual até
        // um F5 remontar só a instância correta.
        <TurnoBanner session={session} meuPlayerId={meuPlayerId} rolando={rolando} onRolarDados={handleRolarDados} />
      )}
      <LeilaoModal session={session} meuPlayerId={meuPlayerId} />
      <LeilaoResultadoModal session={session} meuPlayerId={meuPlayerId} />
      {!interativo && (
        <TurnoModal
          aberto={modalAbertoFinal}
          resultado={resultadoModal}
          nomeCasa={nomeCasaModal}
          erroCompra={erroCompra}
          acaoEmCurso={acaoEmCurso}
          faseInicial={faseInicialModal}
          onComprar={handleComprar}
          onRecusar={handleRecusar}
          onFechar={handleFecharModal}
          onDecidirDepois={handleDecidirDepois}
          onJogarNovamente={handleJogarNovamente}
          onDadosParados={handleDadosParados}
          onResultadoRevelado={handleResultadoRevelado}
          onEscolherMovimento={handleEscolherMovimento}
          onRevelarDados={handleRevelarDados}
          revelandoDados={revelandoDados}
          tabuleiro={tabuleiro}
          posicaoAtual={jogadorDaVez?.posicao ?? 0}
          session={session}
          meuPlayerId={meuPlayerId}
        />
      )}
      {/* Compra pendente minimizada — o jogador fechou pra ir vender algo
          e conseguir dinheiro. Fica visível até ele decidir ou o tempo
          da rodada acabar (o backend recusa automaticamente no timeout). */}
      {!interativo && minhaVez && session.aguardandoAcao && !modalAbertoFinal && resultadoModal?.compraDisponivel && (
        <button
          onClick={() => setModalAberto(true)}
          className="mb-3 w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-300 font-inconsolata text-sm hover:bg-amber-500/20 transition-colors cursor-pointer"
        >
          <span>
            💰 Compra pendente: {resultadoModal.compraDisponivel.nome} — R$ {resultadoModal.compraDisponivel.preco.toLocaleString("pt-BR")}
          </span>
          <span className="text-xs underline shrink-0">Decidir agora</span>
        </button>
      )}
      <div
        className={`relative w-full flex-1 min-h-0 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden${interativo ? " touch-none" : ""}`}
        style={{
          backgroundImage: `url(${FUNDO_TABULEIRO})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
      <div
        ref={viewportRef}
        className={`w-full h-full${interativo ? " cursor-grab active:cursor-grabbing" : ""}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: BOARD_SIZE,
            height: BOARD_SIZE,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <div
            className="grid absolute inset-0"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`,
            }}
          >
            <div
              className="pointer-events-none overflow-hidden rounded-lg"
              style={{ gridRow: "2 / 11", gridColumn: "2 / 11" }}
            >
              <img
                src={ARTE_CENTRAL}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover opacity-90"
                draggable={false}
              />
            </div>
            {tabuleiro.map((casa) => {
              const { row, col } = posToGrid(casa.pos)
              const sessionPosse = casa.propId != null
                ? session.sessionPosses?.find(sp => sp.propId === casa.propId)
                : undefined
              const donoJogador = sessionPosse?.playerId
                ? jogadoresAtivos.find(p => p.id === sessionPosse.playerId)
                : undefined
              return (
                <div key={casa.pos} style={{ gridRow: row, gridColumn: col }}>
                  <BoardTile
                    casa={casa}
                    sessionPosse={sessionPosse}
                    donoJogador={donoJogador}
                    destaque={casa.pos === (jogadorDaVez?.posicao ?? -1)}
                  />
                </div>
              )
            })}
          </div>
          <Pawns players={jogadoresAtivos} />
        </div>
      </div>

      {interativo && meuPlayerId != null && (
        <button
          onClick={() => {
            const mine = jogadoresAtivos.find(p => p.id === meuPlayerId)
            centerOn(mine?.posicao ?? 0, 1.2)
          }}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-zinc-900/90 border border-zinc-700 hover:border-green-500 flex items-center justify-center text-zinc-300 hover:text-green-400 transition-colors cursor-pointer"
          title="Centralizar no meu peão"
        >
          <FontAwesomeIcon icon={faCrosshairs} />
        </button>
      )}
      {onMaximize && (
        <button
          onClick={onMaximize}
          title="Maximizar tabuleiro"
          className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer backdrop-blur-sm"
        >
          <FontAwesomeIcon icon={faExpand} className="text-xs" />
        </button>
      )}
      </div>
    </div>
  )
}
