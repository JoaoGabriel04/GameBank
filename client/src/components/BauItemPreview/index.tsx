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

  const ringStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `2px solid ${cor}66`,
    boxShadow: `0 0 30px ${cor}44, 0 0 60px ${cor}22`,
    "--rarity-color": cor,
    "--rarity-color-dim": `${cor}44`,
  } as React.CSSProperties

  // Frame: igual ao modelo da loja/cofre (Opção 1)
  if (item.type === "frame") {
    const src = item.value?.startsWith("http")
      ? item.value
      : item.imageUrl?.startsWith("http")
      ? item.imageUrl
      : null

    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <div style={{
          width: size, height: size,
          borderRadius: "50%",
          background: "#3f3f46",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.4,
          color: "#71717a",
        }}>
          👤
        </div>
        {src ? (
          <img
            src={src}
            alt=""
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: "136%", height: "136%",
              maxWidth: "none",
              transform: "translate(-50%, -50%)",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
        ) : item.value ? (
          <div style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            padding: 3,
            backgroundImage: item.value,
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
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
