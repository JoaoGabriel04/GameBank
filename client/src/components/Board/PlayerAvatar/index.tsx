'use client'

import { useState } from "react"
import { resolvePreset } from "@/constants/avatars"
import type { Player } from "@/types/game"

type Props = {
  player: Player
  size?: number
  // Molduras decorativas não fazem sentido em tamanhos minúsculos (ex: chip
  // de dono de propriedade no tabuleiro) — desliga pra evitar poluição visual.
  showFrame?: boolean
}

export default function PlayerAvatar({ player, size = 24, showFrame = true }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const frameInset = Math.max(1, Math.round(size * 0.08))
  const avatarUrl = player.avatarUrl
  const isPreset = avatarUrl?.startsWith("preset:")
  const isImg = !isPreset && !!(avatarUrl?.startsWith("http://") || avatarUrl?.startsWith("https://") || avatarUrl?.startsWith("blob:") || avatarUrl?.startsWith("data:image"))
  const showImg = isImg && !imgFailed
  const preset = isPreset ? resolvePreset(avatarUrl!.replace("preset:", "")) : null
  const initial = (player.nome ?? "?").charAt(0).toUpperCase()
  const temFrame = showFrame && !!(player.frame && player.frameType)

  const src = isImg && !avatarUrl!.startsWith("blob:")
    ? `${avatarUrl!}${avatarUrl!.includes("?") ? "&" : "?"}v=${player.avatarUpdatedAt ? new Date(player.avatarUpdatedAt).getTime() : Date.now()}`
    : avatarUrl ?? undefined

  const avatarContent = (
    <div className="w-full h-full rounded-full flex items-center justify-center font-jaro text-zinc-100 overflow-hidden" style={{ fontSize: size * 0.42 }}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={player.nome}
          className="absolute inset-0 w-full h-full object-cover rounded-full"
          onError={() => setImgFailed(true)}
        />
      ) : preset ? (
        <div className={`w-full h-full rounded-full bg-gradient-to-br ${preset.gradient} flex items-center justify-center`}>
          <span className="select-none leading-none">{preset.glyph}</span>
        </div>
      ) : (
        <div className="w-full h-full rounded-full bg-zinc-700 flex items-center justify-center">
          <span className="relative z-10">{initial}</span>
        </div>
      )}
    </div>
  )

  if (!temFrame) return <div className="relative shrink-0" style={{ width: size, height: size }}>{avatarContent}</div>

  const resolvedFrameType = player.frameType ||
    (player.frame?.startsWith("https://") ? "image" : player.frame ? "gradient" : null)

  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {resolvedFrameType === "gradient" && (
        <div
          className="absolute"
          style={{
            inset: -frameInset,
            borderRadius: "50%",
            padding: frameInset,
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
      <div className="relative shrink-0" style={{ zIndex: 0, width: size, height: size }}>
        {avatarContent}
      </div>
      {resolvedFrameType === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.frame!}
          alt=""
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            inset: -frameInset,
            width: size + frameInset * 2,
            height: size + frameInset * 2,
            maxWidth: "none",
            objectFit: "contain",
            zIndex: 2,
          }}
        />
      )}
    </div>
  )
}
