'use client'

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faFlagCheckered, faLock, faGavel, faNewspaper,
  faSackDollar, faFileInvoiceDollar, faUmbrellaBeach, faHouse, faBuilding,
} from "@fortawesome/free-solid-svg-icons"
import type { Casa, Player, SessionPropriedade } from "@/types/game"
import { PLAYER_COLORS } from "@/types/game"
import { getGroupColorHex } from "@/utils/properties"
import PlayerAvatar from "@/components/Board/PlayerAvatar"

const TIPO_ICON: Partial<Record<Casa["tipo"], typeof faHouse>> = {
  inicio: faFlagCheckered,
  prisao_visita: faLock,
  va_para_prisao: faGavel,
  noticias: faNewspaper,
  restituicao: faSackDollar,
  imposto: faFileInvoiceDollar,
  feriado: faUmbrellaBeach,
}

// Leve tingimento por tipo de casa — só pra dar identidade visual sem
// competir com a faixa de cor do grupo das propriedades.
const TIPO_BG: Partial<Record<Casa["tipo"], string>> = {
  inicio: "bg-gradient-to-br from-emerald-950/60 to-zinc-900",
  prisao_visita: "bg-gradient-to-br from-zinc-800/60 to-zinc-900",
  va_para_prisao: "bg-gradient-to-br from-red-950/50 to-zinc-900",
  noticias: "bg-gradient-to-br from-indigo-950/50 to-zinc-900",
  restituicao: "bg-gradient-to-br from-emerald-950/50 to-zinc-900",
  imposto: "bg-gradient-to-br from-red-950/40 to-zinc-900",
  feriado: "bg-gradient-to-br from-amber-950/50 to-zinc-900",
}

type Props = {
  casa: Casa
  sessionPosse?: SessionPropriedade
  donoJogador?: Player
  destaque?: boolean
}

export default function BoardTile({ casa, sessionPosse, donoJogador, destaque }: Props) {
  const isPropriedade = casa.tipo === "propriedade" || casa.tipo === "acao"
  const cor = isPropriedade ? getGroupColorHex(sessionPosse?.propriedade?.grupo_cor) : null
  const donoCor = donoJogador ? PLAYER_COLORS.find(p => p.value === donoJogador.cor) : null
  const icon = TIPO_ICON[casa.tipo]
  const hipotecada = !!sessionPosse?.hipotecada
  const casas = sessionPosse?.casas ?? 0
  const temHotel = casas >= 5

  return (
    <div
      className={`relative w-full h-full flex flex-col overflow-hidden select-none rounded-[3px] border transition-all duration-300 ${
        isPropriedade ? "" : (TIPO_BG[casa.tipo] ?? "bg-zinc-900")
      } ${
        destaque
          ? "border-green-400 shadow-[0_0_12px_3px_rgba(74,222,128,0.55)] z-10 animate-pulse"
          : "border-zinc-800"
      }`}
      style={isPropriedade && cor ? { background: `linear-gradient(180deg, ${cor} 0%, ${cor} 42%, #050505 92%)` } : undefined}
      title={casa.nome}
    >
      {/* Dono da propriedade — avatar do jogador, com anel na cor dele.
          Tamanho fixo + overflow-hidden pra nunca deformar. Moldura
          decorativa desligada aqui — ilegível nesse tamanho e só serve
          pra sinalizar quem é o dono rapidamente. */}
      {donoJogador && (
        <div
          className={`absolute top-0.5 right-0.5 w-3.5 h-3.5 shrink-0 overflow-hidden rounded-full ring-2 ${donoCor?.ring ?? "ring-zinc-500"} shadow-[0_0_3px_rgba(0,0,0,0.7)] z-20`}
          title={`Dono: ${donoJogador.nome}`}
        >
          <PlayerAvatar player={donoJogador} size={14} showFrame={false} />
        </div>
      )}

      {/* Hipotecada — escurece e sinaliza com cadeado */}
      {hipotecada && (
        <div className="absolute inset-0 bg-zinc-950/75 flex items-center justify-center z-10">
          <FontAwesomeIcon icon={faLock} className="text-red-400 text-[10px]" />
        </div>
      )}

      {/* Casas especiais (sem cor de grupo): ícone + nome centralizados */}
      {!isPropriedade && (
        <div className="flex-1 flex flex-col items-center justify-center px-0.5 py-0.5 min-h-0 gap-0.5">
          {icon && (
            <FontAwesomeIcon icon={icon} className="text-zinc-400 text-[10px]" />
          )}
          <span className="text-[7px] leading-tight text-center text-zinc-300 font-inconsolata line-clamp-3">
            {casa.nome}
          </span>
        </div>
      )}

      {/* Propriedades/ações: degradê ocupa a casa toda, texto jogado pra
          base (sobre a parte escurecida do degradê, onde tem contraste) */}
      {isPropriedade && (
        <div className="flex-1 flex flex-col items-center justify-end px-0.5 pb-1 min-h-0 gap-0.5">
          <span className="text-[7px] leading-tight text-center text-zinc-50 font-inconsolata font-semibold line-clamp-2 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
            {casa.nome}
          </span>
          {sessionPosse?.propriedade && !sessionPosse.playerId && (
            <span className="text-[6px] text-emerald-400 font-inconsolata font-semibold">
              R$ {sessionPosse.propriedade.custo_compra}
            </span>
          )}

          {/* Casas: pips verdes (1-4) — Hotel (5) vira um selo dourado distinto */}
          {!hipotecada && casas > 0 && !temHotel && (
            <div className="flex items-center gap-[1.5px]">
              {Array.from({ length: casas }).map((_, i) => (
                <div key={i} className="w-[3px] h-[3px] rounded-[1px] bg-emerald-400 shadow-[0_0_2px_rgba(52,211,153,0.8)]" />
              ))}
            </div>
          )}
          {!hipotecada && temHotel && (
            <div
              className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_4px_rgba(245,158,11,0.8)] ring-1 ring-amber-200/50"
              title="Hotel"
            >
              <FontAwesomeIcon icon={faBuilding} className="text-zinc-900 text-[7px]" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
