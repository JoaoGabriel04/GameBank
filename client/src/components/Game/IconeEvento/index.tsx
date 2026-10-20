import {
  ChartColumnIncreasing, CloudRain, Coins, Construction, Gift, Hammer, Landmark,
  Percent, Sparkles, TrendingDown, TrendingUp, type LucideIcon,
} from "lucide-react"

// Ícone de cada evento econômico. Os dados (constants/eventos.ts, espelho
// do servidor) trazem um emoji em `icone`; a interface não usa emojis, então
// a exibição mapeia o código para um ícone.
const ICONES: Record<string, LucideIcon> = {
  CRISE_IMOBILIARIA: TrendingDown,
  BOOM_IMOBILIARIO: TrendingUp,
  IPTU_EXTRAORDINARIO: Landmark,
  ISENCAO_FISCAL: Gift,
  ESCASSEZ_MATERIAL: Construction,
  AQUECIMENTO_MERCADO: Hammer,
  INFLACAO: Percent,
  RECESSAO: CloudRain,
  DIVIDENDOS: ChartColumnIncreasing,
  INJECAO_LIQUIDEZ: Coins,
}

/** Cor de destaque (hex) de cada cor de evento. */
export const COR_EVENTO_HEX: Record<string, string> = {
  verde: "#34d399",
  vermelho: "#f87171",
  amarelo: "#fbbf24",
  azul: "#38bdf8",
}

export default function IconeEvento({ codigo, size = 16, className }: { codigo?: string | null; size?: number; className?: string }) {
  const Icone = (codigo && ICONES[codigo]) || Sparkles
  return <Icone size={size} className={className} aria-hidden />
}
