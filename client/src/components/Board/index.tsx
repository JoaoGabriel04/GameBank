'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCrosshairs } from "@fortawesome/free-solid-svg-icons"
import BoardTile from "./BoardTile"
import TurnoBanner from "./TurnoBanner"
import TurnoModal from "./TurnoModal"
import EventoEconomicoBar from "./EventoEconomicoBar"
import EventoModal from "./EventoModal"
import LeilaoModal from "./LeilaoModal"
import LeilaoResultadoModal from "./LeilaoResultadoModal"
import Pawns from "./Pawns"
import { GRID_SIZE, TILE_SIZE, BOARD_SIZE, TOTAL_CASAS, posToGrid, posToPixelCenter } from "@/utils/tabuleiro-layout"
import { ARTE_CENTRAL, FUNDO_TABULEIRO, GRUPO_IMAGENS_PRELOAD } from "@/utils/tabuleiro-images"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"
import { useEventoStore } from "@/stores/socketStore"
import { getEvento } from "@/constants/eventos"
import { playSfx, stopSfx } from "@/utils/sfx"
import type { RolarDadosResult, EscolhaMovimento } from "@/services/api/turno"
import type { OpcaoInfo } from "./TurnoModal"
import type { Casa, GameSession } from "@/types/game"

const MIN_SCALE = 0.3
const MAX_SCALE = 2.5

// Espelho client-side de calcularOpcoesMovimento (turno.service.ts) — usado
// só para reconstruir a tela de escolha após um refresh de página em meio
// à decisão (mesmo racional do fallback de compra pendente logo abaixo).
// O cálculo real e autoritativo continua sempre no backend.
function calcularOpcoesMovimentoClient(tabuleiro: Casa[], posAtual: number, dado1: number, dado2: number) {
  const montar = (passos: number, tipo: "dado1" | "dado2" | "soma") => {
    const destino = (posAtual + passos) % TOTAL_CASAS
    const casa = tabuleiro.find((c) => c.pos === destino)
    return {
      tipo,
      passos,
      destino,
      nomeCasa: casa?.nome ?? "",
      tipoCasa: casa?.tipo ?? "inicio",
      passaInicio: (posAtual + passos) >= TOTAL_CASAS,
    }
  }
  return [
    montar(dado1, "dado1" as const),
    montar(dado2, "dado2" as const),
    montar(dado1 + dado2, "soma" as const),
  ]
}

type Props = {
  tabuleiro: Casa[]
  session: GameSession
  meuPlayerId?: number
}

export default function Board({ tabuleiro, session, meuPlayerId }: Props) {
  const { rolarDados, escolherMovimento, comprarCasaAtual, recusarCompra, setHoldSessionUpdates, getAluguel } = useGameStore()
  const { success: toastSuccess, error: toastError } = useToast()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 })
  const pinchState = useRef<{ pinching: boolean; startDist: number; startScale: number; centerX: number; centerY: number }>({ pinching: false, startDist: 0, startScale: 1, centerX: 0, centerY: 0 })

  // ── Modal unificado de turno (rolar dados → resultado → desfecho/ação) ──
  const [rolando, setRolando] = useState(false)
  const [resultado, setResultado] = useState<RolarDadosResult | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [erroCompra, setErroCompra] = useState<string | null>(null)
  const [eventoModalCodigo, setEventoModalCodigo] = useState<string | null>(null)
  const decidindoRef = useRef(false)
  // Marca se o resultado atual já teve sua animação de revelação mostrada
  // uma vez — reabrir uma decisão de compra minimizada (botão "decidir
  // depois" / banner) não deve repetir a animação de dados do zero.
  const resultadoJaReveladoRef = useRef(false)
  // Cache do resultado sintetizado pelo fallback (ver abaixo) — evita
  // recriar o objeto a cada render enquanto a mesma compra fica pendente.
  const fallbackResultadoRef = useRef<{ propId: number; sessionPossesId: number; resultado: RolarDadosResult } | null>(null)
  // Cache do resultado sintetizado para a fase "escolha" (Mecânica 3) —
  // mesmo racional do cache acima, evita recriar o objeto a cada render.
  const fallbackEscolhaRef = useRef<{ dado1: number; dado2: number; resultado: RolarDadosResult } | null>(null)

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

  // Ao montar: ajusta escala para caber o tabuleiro inteiro na viewport, centralizado
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const fitScale = clampScale(Math.min(rect.width / BOARD_SIZE, rect.height / BOARD_SIZE) * 0.95)
    setTransformClamped({
      scale: fitScale,
      x: (rect.width - BOARD_SIZE * fitScale) / 2,
      y: (rect.height - BOARD_SIZE * fitScale) / 2,
    })
  }, [setTransformClamped])

  const handleWheel = (e: React.WheelEvent) => {
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
    if (e.touches.length === 2) {
      dragState.current.dragging = false
      pinchState.current = { pinching: true, startDist: dist(e.touches), startScale: transformRef.current.scale, centerX: 0, centerY: 0 }
    } else if (e.touches.length === 1) {
      pinchState.current.pinching = false
      dragState.current = { dragging: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
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
  if (!resultado && minhaVez && session.aguardandoEscolha && jogadorDaVez && session.ultimoDado1 && session.ultimoDado2) {
    const cache = fallbackEscolhaRef.current
    if (cache && cache.dado1 === session.ultimoDado1 && cache.dado2 === session.ultimoDado2) {
      resultadoModal = cache.resultado
    } else {
      const opcoesFallback = calcularOpcoesMovimentoClient(
        tabuleiro, jogadorDaVez.posicao ?? 0, session.ultimoDado1, session.ultimoDado2
      )
      resultadoModal = {
        dado1: session.ultimoDado1,
        dado2: session.ultimoDado2,
        duplo: session.ultimoDado1 === session.ultimoDado2,
        foiPreso: false,
        aguardandoEscolha: true,
        opcoes: opcoesFallback,
      }
      fallbackEscolhaRef.current = { dado1: session.ultimoDado1, dado2: session.ultimoDado2, resultado: resultadoModal }
    }
    modalAbertoFinal = true
    faseInicialModal = "escolha"
  } else {
    fallbackEscolhaRef.current = null
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
        modalAbertoFinal = true
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

  const handleRolarDados = useCallback(async () => {
    if (rolando) return
    setRolando(true)
    resultadoJaReveladoRef.current = false
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
      setTimeout(() => setHoldSessionUpdates(false), 4000)
    } catch (err: any) {
      setHoldSessionUpdates(false)
      toastError(err?.response?.data?.message || "Erro ao rolar dados")
    } finally {
      setRolando(false)
    }
  }, [rolando, rolarDados, session.id, toastError, setHoldSessionUpdates])

  // BUG 2 (TABULEIRO_FIXES): chamado pelo TurnoModal no instante em que o
  // resultado dos dados vira visível — só então libera o peão pra mover.
  const handleResultadoRevelado = useCallback(() => {
    setHoldSessionUpdates(false)
    resultadoJaReveladoRef.current = true
  }, [setHoldSessionUpdates])

  // Chamado pelo TurnoModal quando os dados param de girar e mostram o
  // número — momento certo pro SFX de dados, não no clique do botão.
  const handleDadosParados = useCallback(() => {
    playSfx("rolando-dados")
  }, [])

  // Mecânica 3 (Escolha de Movimento): enriquece as 3 opções vindas do
  // backend (só destino/tipo/passos) com a situação real da casa — livre,
  // de quem é, preço ou aluguel (já refletindo evento econômico ativo via
  // getAluguel) — sem isso a escolha vira chute.
  const opcoesEscolha: OpcaoInfo[] = useMemo(() => {
    const opcoes = resultadoModal?.opcoes
    if (!opcoes) return []
    return opcoes.map((op) => {
      const casaDef = tabuleiro.find((c) => c.pos === op.destino)
      let statusLabel = casaDef?.nome ?? op.nomeCasa
      let statusTone: OpcaoInfo["statusTone"] = "neutro"
      let valor: number | undefined

      if (op.tipoCasa === "propriedade" || op.tipoCasa === "acao") {
        const posse = casaDef?.propId != null
          ? session.sessionPosses?.find((sp) => sp.propId === casaDef.propId)
          : undefined
        if (posse && !posse.playerId) {
          statusLabel = "🟢 Livre"
          statusTone = "verde"
          valor = posse.propriedade?.custo_compra
        } else if (posse?.playerId === meuPlayerId) {
          statusLabel = "🔵 Sua propriedade"
        } else if (posse?.hipotecada) {
          statusLabel = "⚪ Hipotecada — sem aluguel"
        } else if (posse?.playerId) {
          const dono = session.jogadores?.find((j) => j.id === posse.playerId)
          valor = posse.propriedade ? getAluguel(posse.propriedade, posse.casas ?? 0) : undefined
          statusLabel = `🔴 De ${dono?.nome ?? "outro jogador"}`
          statusTone = "vermelho"
        }
      } else if (op.tipoCasa === "imposto") {
        statusLabel = "💸 Imposto"
        statusTone = "vermelho"
      } else if (op.tipoCasa === "restituicao") {
        statusLabel = "💰 Restituição"
        statusTone = "verde"
      } else if (op.tipoCasa === "noticias") {
        statusLabel = "❓ Sorte/Revés"
      } else if (op.tipoCasa === "feriado") {
        statusLabel = "🏖️ Feriado — perde a vez"
        statusTone = "vermelho"
      } else if (op.tipoCasa === "va_para_prisao") {
        statusLabel = "🚔 Vai para a prisão"
        statusTone = "vermelho"
      } else if (op.tipoCasa === "prisao_visita") {
        statusLabel = "👀 Só visitando"
      } else if (op.tipoCasa === "inicio") {
        statusLabel = "🏁 Início"
      }

      return { ...op, statusLabel, statusTone, valor }
    })
  }, [resultadoModal?.opcoes, tabuleiro, session.sessionPosses, session.jogadores, meuPlayerId, getAluguel])

  const handleEscolherMovimento = useCallback(async (escolha: EscolhaMovimento) => {
    setHoldSessionUpdates(true)
    try {
      const r = await escolherMovimento(session.id, escolha)
      if (!r) {
        setHoldSessionUpdates(false)
        return
      }
      if (r.foiPreso || /prisão/i.test(r.mensagem ?? "")) {
        playSfx("foi-preso")
      } else if (/aluguel/i.test(r.mensagem ?? "")) {
        playSfx("pagou-aluguel")
      }
      // Não há suspense a proteger aqui (o jogador acabou de clicar
      // deliberadamente) — libera o hold já junto com o resultado, no
      // mesmo commit, pra não deixar o peão "pulando" fora de sincronia
      // com a transição de fase do modal.
      setResultado(r)
      setHoldSessionUpdates(false)
    } catch (err: any) {
      setHoldSessionUpdates(false)
      toastError(err?.response?.data?.message || "Erro ao mover")
    }
  }, [session.id, escolherMovimento, toastError, setHoldSessionUpdates])

  // Detecta quando o servidor resolveu a escolha de movimento por timeout
  // (o jogador não clicou a tempo) — session.aguardandoEscolha vira false
  // sem que tenhamos processado uma resposta local de escolherMovimento.
  useEffect(() => {
    if (resultado?.aguardandoEscolha && !session.aguardandoEscolha) {
      setHoldSessionUpdates(false)
      setModalAberto(false)
      setResultado(null)
      toastError("Tempo esgotado — movimento padrão aplicado (soma)")
    }
  }, [session.aguardandoEscolha])

  const handleComprar = useCallback(async () => {
    if (decidindoRef.current || !resultadoModal?.compraDisponivel) return
    decidindoRef.current = true
    const nome = resultadoModal.compraDisponivel.nome
    setErroCompra(null)
    try {
      const ok = await comprarCasaAtual(session.id)
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
    } finally {
      decidindoRef.current = false
    }
  }, [resultadoModal, comprarCasaAtual, session.id, toastSuccess, toastError])

  const handleRecusar = useCallback(async () => {
    if (decidindoRef.current || !resultadoModal?.compraDisponivel) return
    decidindoRef.current = true
    setErroCompra(null)
    const nome = resultadoModal.compraDisponivel.nome
    try {
      const ok = await recusarCompra(session.id)
      setModalAberto(false)
      if (ok) toastSuccess(`Você recusou a compra de ${nome}.`)
      else toastError("Não foi possível concluir a ação.")
    } finally {
      decidindoRef.current = false
    }
  }, [resultadoModal, recusarCompra, session.id, toastSuccess, toastError])

  const handleFecharModal = useCallback(() => {
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
    <div className="flex flex-col flex-1 min-h-0 select-none">
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
      ) : session.turnoAtualPlayerId != null && (
        <TurnoBanner session={session} meuPlayerId={meuPlayerId} rolando={rolando} onRolarDados={handleRolarDados} />
      )}
      <LeilaoModal session={session} meuPlayerId={meuPlayerId} />
      <LeilaoResultadoModal session={session} meuPlayerId={meuPlayerId} />
      <TurnoModal
        aberto={modalAbertoFinal}
        resultado={resultadoModal}
        nomeCasa={nomeCasaModal}
        erroCompra={erroCompra}
        faseInicial={faseInicialModal}
        onComprar={handleComprar}
        onRecusar={handleRecusar}
        onFechar={handleFecharModal}
        onJogarNovamente={handleJogarNovamente}
        onDadosParados={handleDadosParados}
        onResultadoRevelado={handleResultadoRevelado}
        opcoes={opcoesEscolha}
        onEscolherMovimento={handleEscolherMovimento}
      />
      {/* Compra pendente minimizada — o jogador fechou pra ir vender algo
          e conseguir dinheiro. Fica visível até ele decidir ou o tempo
          da rodada acabar (o backend recusa automaticamente no timeout). */}
      {minhaVez && session.aguardandoAcao && !modalAbertoFinal && resultadoModal?.compraDisponivel && (
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
        className="relative w-full flex-1 min-h-0 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden touch-none"
        style={{
          backgroundImage: `url(${FUNDO_TABULEIRO})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
      <div
        ref={viewportRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
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

      {meuPlayerId != null && (
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
      </div>
    </div>
  )
}
