'use client'

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import PortalBody from "@/components/PortalBody"
import { useMotionPrefs } from "@/lib/motion/prefs"
import { formatCurrency } from "@/utils/format"
import type { Player } from "@/types/game"

// Aluguel visível: quando um jogador perde exatamente o que outro ganha na
// mesma atualização, moedas voam em arco do peão de quem pagou até o de
// quem recebeu (~1 s) e o valor sobe no destino. Se quem pagou acabou de
// andar, as moedas esperam o peão chegar. Só no nível "completo"; os peões
// precisam estar na tela (aba Visão).

type Props = { players: Player[] }

const MAX_MOEDAS = 7

// O Board também aparece no BoardModal (tela cheia): só a primeira
// instância montada anima, senão as moedas voariam duas vezes.
let dono: symbol | null = null

function centroDoPeao(id: number) {
  const el = document.querySelector<HTMLElement>(`[data-peao="${id}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export default function FluxoMoedas({ players }: Props) {
  const camadaRef = useRef<HTMLDivElement>(null)
  const anteriorRef = useRef<Map<number, { saldo: number; posicao: number }> | null>(null)
  const { nivel } = useMotionPrefs()
  const euRef = useRef(Symbol("fluxo"))

  useEffect(() => {
    const eu = euRef.current
    if (!dono) dono = eu
    return () => { if (dono === eu) dono = null }
  }, [])

  const chave = players.map((p) => `${p.id}:${p.saldo}:${p.posicao}`).join(",")

  useEffect(() => {
    const atual = new Map(players.map((p) => [p.id, { saldo: p.saldo, posicao: p.posicao ?? 0 }]))
    const anterior = anteriorRef.current
    anteriorRef.current = atual
    if (!anterior || nivel !== "completo" || document.hidden || dono !== euRef.current) return

    const deltas = players
      .map((p) => ({ p, delta: p.saldo - (anterior.get(p.id)?.saldo ?? p.saldo) }))
      .filter((d) => d.delta !== 0)
    const pagadores = deltas.filter((d) => d.delta < 0)
    const recebedores = deltas.filter((d) => d.delta > 0)

    for (const pag of pagadores) {
      const rec = recebedores.find((r) => r.delta === -pag.delta)
      if (!rec) continue
      const andou = anterior.get(pag.p.id)?.posicao !== (pag.p.posicao ?? 0)
      // Espera o peão andar (~130 ms por casa, teto de 900 ms) antes de pagar.
      const atraso = andou ? 1.05 : 0.1
      gsap.delayedCall(atraso, () => voar(pag.p.id, rec.p.id, rec.delta))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, nivel])

  const voar = (de: number, para: number, valor: number) => {
    const camada = camadaRef.current
    const a = centroDoPeao(de)
    const b = centroDoPeao(para)
    if (!camada || !a || !b) return
    const n = Math.min(MAX_MOEDAS, 3 + Math.floor(Math.log10(Math.max(10, valor))))
    const dx = b.x - a.x
    const dy = b.y - a.y
    const altura = Math.min(140, 50 + Math.hypot(dx, dy) * 0.35)

    for (let i = 0; i < n; i++) {
      const m = document.createElement("div")
      m.style.cssText = "position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7c2,#fbbf24 45%,#b45309 100%);box-shadow:0 0 6px rgba(251,191,36,0.8);"
      m.dataset.moeda = ""
      m.style.left = `${a.x}px`
      m.style.top = `${a.y}px`
      camada.appendChild(m)
      const d = 0.75
      const espalho = (Math.random() - 0.5) * 24
      const tl = gsap.timeline({ delay: i * 0.06, onComplete: () => m.remove() })
      tl.fromTo(m, { x: 0, scale: 0.4, opacity: 0 }, { x: dx + espalho, duration: d, ease: "power1.inOut" }, 0)
      tl.to(m, { scale: 1, opacity: 1, duration: 0.12 }, 0)
      // Arco: sobe e desce até o destino.
      tl.to(m, { keyframes: [{ y: Math.min(0, dy) - altura, duration: d * 0.45, ease: "power2.out" }, { y: dy, duration: d * 0.55, ease: "power2.in" }] }, 0)
      tl.to(m, { scale: 0.3, opacity: 0, duration: 0.12 }, d - 0.08)
      setTimeout(() => m.remove(), 2500)
    }

    // O valor sobe no destino quando as moedas chegam.
    gsap.delayedCall(0.75 + (n - 1) * 0.06, () => {
      const t = document.createElement("div")
      t.textContent = `+R$ ${formatCurrency(valor)}`
      t.style.cssText = `position:absolute;left:${b.x}px;top:${b.y - 30}px;transform:translateX(-50%);font-family:var(--font-jaro);font-size:15px;color:#4ade80;text-shadow:0 1px 3px #000;white-space:nowrap;`
      camada.appendChild(t)
      const an = t.animate([{ opacity: 0, translate: "0 6px" }, { opacity: 1, translate: "0 0", offset: 0.2 }, { opacity: 0, translate: "0 -24px" }], { duration: 1200, easing: "ease-out" })
      an.onfinish = () => t.remove()
      setTimeout(() => t.remove(), 2000)
    })
  }

  return (
    <PortalBody>
      <div ref={camadaRef} aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 150 }} />
    </PortalBody>
  )
}
