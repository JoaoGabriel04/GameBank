"use client"

import { useEffect, useState } from "react"
import { useGameStore } from "@/stores/gameStore"
import { useLeilaoStore } from "@/stores/socketStore"
import { formatCurrency } from "@/utils/format"
import type { GameSession } from "@/types/game"

const LEILAO_TIMEOUT_S = 30

type Props = {
  session: GameSession
  meuPlayerId?: number
}

// Leilão Cego (Mecânica 4): modal simultâneo pra todos os jogadores ativos.
// SIGILO ABSOLUTO — nunca mostra o lance de ninguém, só quem já decidiu
// (useLeilaoStore.decididos, alimentado pelo evento leilao:jogador_decidiu,
// que nunca carrega o valor). A revelação só acontece no LeilaoResultadoModal.
//
// IMPORTANTE (refresh): nome/preço/lance mínimo vêm de `session` (via
// leilaoPropId + sessionPosses), não de useLeilaoStore.ativo — esse é só
// o "pulso" do evento leilao:iniciado e fica vazio depois de um F5 no
// meio do leilão. Sem esse fallback, recarregar a página deixaria o
// jogador sem nenhuma forma de dar o lance.
export default function LeilaoModal({ session, meuPlayerId }: Props) {
  const { darLance } = useGameStore()
  const { decididos } = useLeilaoStore()

  const [valor, setValor] = useState("")
  const [decidiu, setDecidiu] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [restante, setRestante] = useState(LEILAO_TIMEOUT_S)
  const [minimizado, setMinimizado] = useState(false)

  // Reset ao início de um novo leilão (propId muda)
  useEffect(() => {
    setValor("")
    setDecidiu(false)
    setEnviando(false)
    setErro(null)
    setMinimizado(false)
  }, [session.leilaoPropId])

  useEffect(() => {
    if (!session.emLeilao || !session.leilaoIniciadoEm) return
    const inicio = new Date(session.leilaoIniciadoEm).getTime()
    const tick = () => {
      const passado = Math.floor((Date.now() - inicio) / 1000)
      setRestante(Math.max(0, LEILAO_TIMEOUT_S - passado))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session.emLeilao, session.leilaoIniciadoEm])

  const posse = session.leilaoPropId != null
    ? session.sessionPosses?.find(sp => sp.propId === session.leilaoPropId)
    : undefined

  if (!session.emLeilao || session.leilaoPropId == null || !posse?.propriedade) return null

  const nome = posse.propriedade.nome
  const precoTabela = posse.propriedade.custo_compra
  const lanceMinimo = session.leilaoLanceMinimo ?? Math.round(precoTabela * 0.5)

  const meuJogador = session.jogadores?.find(p => p.id === meuPlayerId)
  const jogadoresAtivos = (session.jogadores ?? []).filter(p => !p.desistiu)

  // Espectador (sem SessionPlayer ativo, ou já desistiu) — só acompanha,
  // não pode dar lance nem "passar" em nome de ninguém.
  if (!meuJogador || meuJogador.desistiu) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="text-3xl mb-2">🔨</p>
          <p className="font-jaro text-lg text-zinc-100 mb-1">Leilão Cego</p>
          <p className="font-inconsolata text-sm text-zinc-400 mb-4">{nome}</p>
          <p className="font-inconsolata text-sm text-zinc-500">Aguardando os jogadores decidirem...</p>
        </div>
      </div>
    )
  }

  async function enviar(valorEnviado: number) {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      // gameStore.darLance sempre lança em caso de erro (handleError
      // re-lança depois de gravar a mensagem em useGameStore.error) —
      // nunca retorna undefined "silenciosamente", por isso o tratamento
      // de erro fica todo no catch, não num `if (!r)`.
      await darLance(session.id, valorEnviado)
      setDecidiu(true)
    } catch {
      const storeError = useGameStore.getState().error
      // Já decidiu antes (ex.: reconexão) — trata como decisão concluída,
      // não como erro bloqueante.
      if (storeError?.toLowerCase().includes("já deu seu lance")) {
        setDecidiu(true)
      } else {
        setErro(storeError || "Não foi possível registrar sua decisão.")
      }
    } finally {
      setEnviando(false)
    }
  }

  const handleDarLance = () => {
    const numero = Number(valor.replace(/\D/g, ""))
    if (!numero || numero < lanceMinimo) {
      setErro(`O lance mínimo é R$ ${lanceMinimo.toLocaleString("pt-BR")}.`)
      return
    }
    if (meuJogador && numero > meuJogador.saldo) {
      setErro("Você não tem saldo suficiente para esse lance.")
      return
    }
    enviar(numero)
  }

  const handlePassar = () => enviar(0)

  // Já decidiu (ou passou) — estado de espera, minimizável (mesmo padrão
  // da "compra pendente minimizada" já usado no Board).
  if (decidiu || minimizado) {
    if (minimizado) {
      return (
        <button
          onClick={() => setMinimizado(false)}
          className="mb-3 w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-purple-500/50 bg-purple-500/10 text-purple-300 font-inconsolata text-sm hover:bg-purple-500/20 transition-colors cursor-pointer"
        >
          <span>🔨 Leilão em andamento: {nome}</span>
          <span className="text-xs underline shrink-0">Ver</span>
        </button>
      )
    }
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="text-3xl mb-2">🔨</p>
          <p className="font-jaro text-lg text-zinc-100 mb-1">Leilão Cego</p>
          <p className="font-inconsolata text-sm text-zinc-400 mb-4">{nome}</p>
          <p className="font-inconsolata text-sm text-emerald-400 mb-4">
            Sua decisão foi registrada. Aguardando os outros jogadores...
          </p>
          <div className="space-y-1.5 mb-4">
            {jogadoresAtivos.map(p => (
              <div key={p.id} className="flex items-center justify-between font-inconsolata text-xs text-zinc-400">
                <span>{p.nome}{p.id === meuPlayerId ? " (você)" : ""}</span>
                <span>{decididos.includes(p.id) ? "✓ decidiu" : "⋯ pensando"}</span>
              </div>
            ))}
          </div>
          <p className="font-inconsolata text-[10px] text-zinc-600 mb-3">⏱ {restante}s</p>
          <button
            onClick={() => setMinimizado(true)}
            className="text-xs font-inconsolata text-zinc-500 hover:text-zinc-300 underline decoration-dotted cursor-pointer"
          >
            Ver o tabuleiro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] px-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center">
        <p className="text-3xl mb-2">🔨</p>
        <p className="font-jaro text-lg text-zinc-100 mb-1">Leilão Cego</p>
        <p className="font-inconsolata text-sm text-zinc-300 mb-3">{nome}</p>

        <div className="grid grid-cols-2 gap-2 mb-4 text-left">
          <div className="px-3 py-2 bg-zinc-800/60 rounded-lg">
            <p className="text-[10px] font-inconsolata text-zinc-500 uppercase">Preço de tabela</p>
            <p className="font-jaro text-sm text-zinc-200">R$ {formatCurrency(precoTabela)}</p>
          </div>
          <div className="px-3 py-2 bg-zinc-800/60 rounded-lg">
            <p className="text-[10px] font-inconsolata text-zinc-500 uppercase">Lance mínimo</p>
            <p className="font-jaro text-sm text-amber-400">R$ {formatCurrency(lanceMinimo)}</p>
          </div>
        </div>

        <div className="text-left mb-1">
          <label className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Seu lance</label>
          <input
            inputMode="numeric"
            value={valor}
            onChange={(e) => { setValor(e.target.value.replace(/\D/g, "")); setErro(null) }}
            placeholder={`Mínimo R$ ${lanceMinimo.toLocaleString("pt-BR")}`}
            disabled={enviando}
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2.5 px-3 text-zinc-100 font-inconsolata text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>
        <p className="font-inconsolata text-[11px] text-zinc-500 text-left mb-3">
          Seu saldo: R$ {formatCurrency(meuJogador?.saldo ?? 0)}
        </p>

        {erro && (
          <p className="font-inconsolata text-xs text-red-400 mb-3 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
            {erro}
          </p>
        )}

        <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4 text-left">
          <p className="font-inconsolata text-[11px] text-amber-300">
            ⚠️ Lance vinculante — se vencer, você é obrigado a comprar. Ninguém vê seu lance.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={handlePassar}
            disabled={enviando}
            className="py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-inconsolata text-sm rounded-xl cursor-pointer"
          >
            Passar
          </button>
          <button
            onClick={handleDarLance}
            disabled={enviando}
            className="py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-inconsolata text-sm rounded-xl cursor-pointer"
          >
            Dar lance
          </button>
        </div>

        <p className="font-inconsolata text-[10px] text-zinc-600 mb-2">⏱ {restante}s</p>
        <div className="space-y-1">
          {jogadoresAtivos.map(p => (
            <div key={p.id} className="flex items-center justify-between font-inconsolata text-[11px] text-zinc-500">
              <span>{p.nome}{p.id === meuPlayerId ? " (você)" : ""}</span>
              <span>{decididos.includes(p.id) ? "✓" : "⋯"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
