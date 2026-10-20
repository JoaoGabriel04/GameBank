"use client"

// Contagem regressiva em anel: o arco se esvazia segundo a segundo
// (transição de 1 s no stroke-dashoffset) e fica vermelho no fim. O número
// fica no centro. No nível "desligado", o CSS global não interfere: a
// transição é informação, não enfeite, mas é curta e linear.

type Props = {
  restante: number
  total: number
  size?: number
  /** A partir de quantos segundos o anel fica vermelho. */
  urgenteEm?: number
}

export default function AnelContagem({ restante, total, size = 56, urgenteEm = 5 }: Props) {
  const traco = 4
  const r = (size - traco) / 2
  const circ = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, restante / total))
  const urgente = restante > 0 && restante <= urgenteEm
  const cor = urgente ? "#f87171" : "#a78bfa"

  return (
    <div
      role="timer"
      aria-label={`${restante} segundos restantes`}
      className={urgente ? "gb-urgente" : undefined}
      style={{ position: "relative", width: size, height: size, display: "inline-block" }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={traco} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor} strokeWidth={traco} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span
        aria-hidden
        style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-jaro)", fontSize: size * 0.32, color: urgente ? "#f87171" : "#e4e4e7",
        }}
      >
        {restante}
      </span>
    </div>
  )
}
