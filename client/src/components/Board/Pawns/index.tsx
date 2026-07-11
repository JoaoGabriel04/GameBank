'use client'

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { TOTAL_CASAS, posToPixelCenter } from "@/utils/tabuleiro-layout"
import { resolvePreset } from "@/constants/avatars"
import type { Player } from "@/types/game"

const PASSO_DURACAO_S = 0.15
const MAX_CASAS_ANIMADAS = 12
const AVATAR_SIZE = 24
const FRAME_INSET = 2

type Props = {
  players: Player[]
}

function PlayerAvatar({ player }: { player: Player }) {
  const [imgFailed, setImgFailed] = useState(false)
  const avatarUrl = player.avatarUrl
  const isPreset = avatarUrl?.startsWith("preset:")
  const isImg = !isPreset && !!(avatarUrl?.startsWith("http://") || avatarUrl?.startsWith("https://") || avatarUrl?.startsWith("blob:") || avatarUrl?.startsWith("data:image"))
  const showImg = isImg && !imgFailed
  const preset = isPreset ? resolvePreset(avatarUrl!.replace("preset:", "")) : null
  const initial = (player.nome ?? "?").charAt(0).toUpperCase()
  const temFrame = !!(player.frame && player.frameType)

  const src = isImg && !avatarUrl!.startsWith("blob:")
    ? `${avatarUrl!}${avatarUrl!.includes("?") ? "&" : "?"}v=${player.avatarUpdatedAt ? new Date(player.avatarUpdatedAt).getTime() : Date.now()}`
    : avatarUrl ?? undefined

  const avatarContent = (
    <div className="w-full h-full rounded-full flex items-center justify-center text-[10px] font-jaro text-zinc-100 overflow-hidden">
      {showImg ? (
        <img
          src={src}
          alt={player.nome}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : preset ? (
        <div className={`w-full h-full rounded-full bg-gradient-to-br ${preset.gradient} flex items-center justify-center`}>
          <span className="select-none leading-none text-xs">{preset.glyph}</span>
        </div>
      ) : (
        <div className="w-full h-full rounded-full bg-zinc-700 flex items-center justify-center">
          <span className="relative z-10">{initial}</span>
        </div>
      )}
    </div>
  )

  if (!temFrame) return <div className="shrink-0" style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}>{avatarContent}</div>

  const resolvedFrameType = player.frameType ||
    (player.frame?.startsWith("https://") ? "image" : player.frame ? "gradient" : null)

  return (
    <div
      className="relative shrink-0 inline-flex items-center justify-center"
      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
    >
      {resolvedFrameType === "gradient" && (
        <div
          className="absolute"
          style={{
            inset: -FRAME_INSET,
            borderRadius: "50%",
            padding: FRAME_INSET,
            backgroundImage: player.frame!,
            backgroundSize: player.frameAnimated ? "300% 300%" : "100% 100%",
            backgroundPosition: "0% 50%",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            zIndex: 2,
          }}
        />
      )}
      <div className="relative shrink-0" style={{ zIndex: 0, width: AVATAR_SIZE, height: AVATAR_SIZE }}>
        {avatarContent}
      </div>
      {resolvedFrameType === "image" && (
        <img
          src={player.frame!}
          alt=""
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            inset: -FRAME_INSET,
            width: AVATAR_SIZE + FRAME_INSET * 2,
            height: AVATAR_SIZE + FRAME_INSET * 2,
            maxWidth: "none",
            objectFit: "contain",
            zIndex: 2,
          }}
        />
      )}
    </div>
  )
}

function tileCenterPx(pos: number) {
  const { x, y } = posToPixelCenter(pos)
  return { x: x - AVATAR_SIZE / 2, y: y - AVATAR_SIZE / 2 }
}

export default function Pawns({ players }: Props) {
  const elRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const ultimaPos = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const elementos = elRefs.current
    for (const player of players) {
      const el = elementos.get(player.id)
      if (!el) continue

      const novaPos = player.posicao ?? 0
      const anterior = ultimaPos.current.get(player.id)

      if (anterior == null) {
        const { x, y } = tileCenterPx(novaPos)
        el.style.left = `${x}px`
        el.style.top = `${y}px`
        ultimaPos.current.set(player.id, novaPos)
        continue
      }

      if (anterior === novaPos) continue

      gsap.killTweensOf(el)

      const passos = (novaPos - anterior + TOTAL_CASAS) % TOTAL_CASAS
      if (passos === 0 || passos > MAX_CASAS_ANIMADAS) {
        const { x, y } = tileCenterPx(novaPos)
        gsap.to(el, { left: x, top: y, duration: 0.3, ease: "power2.out" })
      } else {
        const tl = gsap.timeline()
        for (let i = 1; i <= passos; i++) {
          const { x, y } = tileCenterPx((anterior + i) % TOTAL_CASAS)
          tl.to(el, { left: x, top: y, duration: PASSO_DURACAO_S, ease: "power1.inOut" })
        }
      }

      ultimaPos.current.set(player.id, novaPos)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map(p => `${p.id}:${p.posicao}`).join(",")])

  return (
    <>
      {players.map((player, idx) => {
        const offset = (idx % 4) * 7 - 10
        return (
          <div
            key={player.id}
            ref={(el) => { if (el) elRefs.current.set(player.id, el) }}
            className="absolute"
            style={{ left: 0, top: 0, width: AVATAR_SIZE, height: AVATAR_SIZE, zIndex: 10 }}
          >
            <div style={{ marginLeft: offset, marginTop: offset }}>
              <PlayerAvatar player={player} />
            </div>
          </div>
        )
      })}
    </>
  )
}
