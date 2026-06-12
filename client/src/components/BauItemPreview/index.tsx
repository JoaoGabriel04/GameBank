'use client'

import { RARIDADES } from "@/constants/raridade"

type ItemResultado = {
  id: number
  name: string
  type: string
  value?: string | null
  imageUrl?: string | null
  raridade: string
  fragmentosGanhos: number
  fragmentosAtuais: number
  fragmentosTotal?: number | null
  itemCompleto: boolean
}

type BauItemPreviewProps = {
  item: ItemResultado
  size?: number
}

export default function BauItemPreview({ item, size = 200 }: BauItemPreviewProps) {
  const cor = RARIDADES[item.raridade]?.cor ?? "#a1a1aa"

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        position: "relative",
        border: `2px solid ${cor}66`,
        boxShadow: `0 0 30px ${cor}44, 0 0 60px ${cor}22`,
        background: "#09090b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        animation: "bau-circle-pulse 2s ease-in-out infinite",
        "--rarity-color": cor,
        "--rarity-color-dim": `${cor}44`,
      } as React.CSSProperties}
    >
      {item.type === "badge" && item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.name}
          style={{ width: "65%", height: "65%", objectFit: "contain" }}
        />
      )}

      {item.type === "banner" && (
        <div style={{
          position: "absolute", inset: 0,
          background: item.value?.startsWith("https://")
            ? `url(${item.value}) center/cover`
            : item.value ?? "#27272a",
        }} />
      )}

      {item.type === "frame" && (
        <>
          <div style={{
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: "50%",
            background: "#27272a",
          }} />
          {(() => {
            const src = item.value?.startsWith("https://")
              ? item.value
              : item.imageUrl?.startsWith("https://")
              ? item.imageUrl
              : null
            if (src) {
              return (
                <img
                  src={src}
                  style={{
                    position: "absolute",
                    inset: "-10%",
                    width: "120%",
                    height: "120%",
                    objectFit: "contain",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )
            }
            if (item.value) {
              return (
                <div style={{
                  position: "absolute", inset: -3,
                  borderRadius: "50%", padding: 3,
                  background: item.value,
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  zIndex: 2,
                }} />
              )
            }
            return null
          })()}
        </>
      )}

      {item.type === "title" && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: size * 0.25 }}>👑</span>
          <span style={{
            fontFamily: "var(--font-jaro)",
            fontSize: size * 0.09,
            color: cor,
            textAlign: "center",
            padding: "2px 12px",
            border: `1px solid ${cor}44`,
            borderRadius: 20,
            background: `${cor}11`,
          }}>
            {item.name}
          </span>
        </div>
      )}
    </div>
  )
}
