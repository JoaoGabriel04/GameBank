'use client'

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { efeitoRaridade, melhorRaridade } from "@/lib/motion"
import { useMotionPrefs } from "@/lib/motion/prefs"
import { preloadSonsBau } from "@/utils/sfx"
import Antecipacao from "./Antecipacao"
import CartaItem, { type CartaHandle } from "./CartaItem"
import Estouro from "./Estouro"
import Moedas from "./Moedas"
import Resumo from "./Resumo"
import { BAU_IMAGENS, type BauResultado } from "./tipos"

export type { BauResultado, ItemResultado } from "./tipos"

// Abertura de baú (docs/animacoes/BOOST_ANIMACOES_GAMEBANK.md, Fase 2).
// Orquestra as fases; cada uma é um componente com a própria timeline:
//   luz     Antecipacao (o baú treme, a luz vaza) → Estouro (camada por
//           cima; no pico do clarão a fase troca por baixo da luz)
//   coins   Moedas (contagem com tique)
//   itens   CartaItem, uma carta por item (flip 3D por raridade)
//   resumo  tudo o que veio
// A recompensa já foi concedida pelo servidor: aqui é só apresentação.

type Fase = "luz" | "coins" | "itens" | "resumo"

type BauAberturaProps = {
  resultado: BauResultado | null
  onClose: () => void
}

export default function BauAbertura({ resultado, onClose }: BauAberturaProps) {
  const [fase, setFase]       = useState<Fase>("luz")
  const [itemIdx, setItemIdx] = useState(0)
  const [estourando, setEstourando] = useState(false)
  const cenaRef  = useRef<HTMLDivElement>(null)
  const cartaRef = useRef<CartaHandle>(null)
  const saindoRef = useRef(false)

  const { nivel } = useMotionPrefs()
  const melhor = melhorRaridade(resultado?.itens.map(i => i.raridade) ?? [])
  const efeitoMelhor = efeitoRaridade(melhor, nivel)
  const imagemBau = BAU_IMAGENS[resultado?.tipoBau ?? ""] ?? "/images/cofrinho.webp"

  // Reset ao receber novo resultado
  useEffect(() => {
    if (!resultado) return
    setFase("luz")
    setItemIdx(0)
    setEstourando(false)
  }, [resultado])

  useEffect(() => { preloadSonsBau() }, [])

  const avancar = useCallback(() => {
    if (!resultado) return

    if (fase === "luz") {
      // Toque na antecipação adianta o estouro; durante o estouro, nada.
      if (!estourando) setEstourando(true)
      return
    }

    if (fase === "coins") {
      // Sem itens (usuário já tem tudo) — pular direto para resumo
      setFase(resultado.itens.length === 0 ? "resumo" : "itens")
      return
    }

    if (fase === "itens") {
      // O toque primeiro termina a carta em curso; com ela revelada, avança.
      if (cartaRef.current?.tocar()) return
      if (saindoRef.current) return
      saindoRef.current = true
      const proximo = itemIdx + 1
      const seguir = () => {
        saindoRef.current = false
        if (proximo >= resultado.itens.length) setFase("resumo")
        else setItemIdx(proximo)
      }
      if (cartaRef.current) cartaRef.current.sair(seguir)
      else seguir()
      return
    }

    // Resumo: só os botões agem (Resumo.tsx).
  }, [fase, itemIdx, resultado, estourando])

  if (!resultado) return null

  const item = resultado.itens[itemIdx]
  // Vários baús de uma vez: antecipação e estouro, depois direto o resumo.
  const multi = !!resultado.batches

  return createPortal(
    <div
      onClick={avancar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        cursor: "pointer",
        userSelect: "none",
        background: "#09090b",
        overflow: "hidden",
      }}
    >
      {/* Cena: tudo o que treme no impacto. O estouro fica por cima dela. */}
      <div ref={cenaRef} style={{ position: "absolute", inset: 0 }}>
        {fase === "luz" && (
          <Antecipacao imagem={imagemBau} efeito={efeitoMelhor} nivel={nivel} onPronto={() => setEstourando(true)} />
        )}

        {fase === "coins" && (
          <Moedas coins={resultado.coinsGanhos} xpBonus={resultado.xpBonus} nivel={nivel} />
        )}

        {fase === "itens" && item && (
          <CartaItem
            key={`${item.id}-${itemIdx}`}
            ref={cartaRef}
            item={item}
            imagemBau={imagemBau}
            restantes={resultado.itens.length - itemIdx - 1}
            nivel={nivel}
          />
        )}

        {fase === "resumo" && (
          <Resumo
            titulo={multi ? "Baús abertos!" : "Resumo do baú"}
            subtitulo={multi ? `${resultado.quantidade} × ${resultado.tipoBau}` : undefined}
            coins={(multi ? resultado.totalCoinsGanhos : resultado.coinsGanhos) ?? 0}
            xp={multi ? resultado.totalXpBonus : resultado.xpBonus}
            itens={resultado.itens}
            nivel={nivel}
            onFechar={onClose}
          />
        )}
      </div>

      {estourando && (
        <Estouro
          efeito={efeitoMelhor}
          nivel={nivel}
          duplo={melhor === "LENDARIO"}
          alvoTremor={cenaRef}
          onPico={() => setFase(f => (f === "luz" ? (multi ? "resumo" : "coins") : f))}
          onFim={() => setEstourando(false)}
        />
      )}
    </div>,
    document.body
  )
}
