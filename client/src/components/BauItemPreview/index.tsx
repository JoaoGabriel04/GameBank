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

  const insetValue = Math.max(3, Math.round(size * 0.09))

  const ringStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `2px solid ${cor}66`,
    boxShadow: `0 0 30px ${cor}44, 0 0 60px ${cor}22`,
    "--rarity-color": cor,
    "--rarity-color-dim": `${cor}44`,
  } as React.CSSProperties

  // Frame: avatar placeholder + overlay (mesmo padrão do UserAvatar)
  if (item.type === "frame") {
    const src = item.value?.startsWith("http")
      ? item.value
      : item.imageUrl?.startsWith("http")
      ? item.imageUrl
      : null

    return (
      <div style={{
        ...ringStyle,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "clip",
      }}>
        {/* avatar placeholder (central, menor) */}
        <div style={{
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: "50%",
          background: "#27272a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.27,
          color: "#71717a",
          userSelect: "none",
          zIndex: 0,
        }}>
          👤
        </div>

        {/* frame overlay — anel sobre o avatar */}
        {src ? (
          <img
            src={src}
            alt=""
            style={{
              position: "absolute",
              inset: -insetValue,
              width: `calc(100% + ${insetValue * 2}px)`,
              height: `calc(100% + ${insetValue * 2}px)`,
              maxWidth: "none",
              objectFit: "contain",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        ) : item.value ? (
          <div style={{
            position: "absolute",
            inset: -insetValue,
            borderRadius: "50%",
            padding: insetValue,
            backgroundImage: item.value,
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            zIndex: 2,
          }} />
        ) : null}
      </div>
    )
  }

  // Demais tipos: círculo com overflow:hidden
  return (
    <div style={{
      ...ringStyle,
      background: "#09090b",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative",
    }}>
      {item.type === "badge" && item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name}
          style={{ width: "65%", height: "65%", objectFit: "contain" }}
        />
      )}

      {item.type === "banner" && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: item.value?.startsWith("http")
            ? `url(${item.value})`
            : item.value || undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: item.value ? undefined : "#27272a",
        }} />
      )}

      {item.type === "title" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: size * 0.25 }}>👑</span>
          <span style={{
            fontFamily: "var(--font-jaro)",
            fontSize: size * 0.05,
            color: cor,
            textAlign: "center",
            padding: "1px 10px",
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
