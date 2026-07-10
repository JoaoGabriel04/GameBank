'use client'

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faFlagCheckered, faLock, faGavel, faNewspaper,
  faSackDollar, faFileInvoiceDollar, faUmbrellaBeach, faHouse,
} from "@fortawesome/free-solid-svg-icons"
import type { Casa, Player, SessionPropriedade } from "@/types/game"
import { PLAYER_COLORS } from "@/types/game"
import { getGroupColorHex } from "@/utils/properties"

const TIPO_ICON: Partial<Record<Casa["tipo"], typeof faHouse>> = {
  inicio: faFlagCheckered,
  prisao_visita: faLock,
  va_para_prisao: faGavel,
  noticias: faNewspaper,
  restituicao: faSackDollar,
  imposto: faFileInvoiceDollar,
  feriado: faUmbrellaBeach,
}

type Props = {
  casa: Casa
  sessionPosse?: SessionPropriedade
  players: Player[]
}

export default function BoardTile({ casa, sessionPosse, players }: Props) {
  const isPropriedade = casa.tipo === "propriedade" || casa.tipo === "acao"
  const cor = isPropriedade ? getGroupColorHex(sessionPosse?.propriedade?.grupo_cor) : null
  const donoCor = sessionPosse?.playerId
    ? PLAYER_COLORS.find(p => p.value === players.find(pl => pl.id === sessionPosse.playerId)?.cor)
    : null
  const icon = TIPO_ICON[casa.tipo]

  return (
    <div
      className="relative w-full h-full bg-zinc-900 border border-zinc-800 flex flex-col overflow-hidden select-none"
      title={casa.nome}
    >
      {isPropriedade && (
        <div className="h-2 w-full shrink-0" style={{ backgroundColor: cor ?? undefined }} />
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-0.5 py-0.5 min-h-0">
        {icon && (
          <FontAwesomeIcon icon={icon} className="text-zinc-400 text-[10px] mb-0.5" />
        )}
        <span className="text-[7px] leading-tight text-center text-zinc-300 font-inconsolata line-clamp-3">
          {casa.nome}
        </span>
        {isPropriedade && sessionPosse?.propriedade && !sessionPosse.playerId && (
          <span className="text-[6px] text-green-500 font-inconsolata mt-0.5">
            R$ {sessionPosse.propriedade.custo_compra}
          </span>
        )}
        {isPropriedade && sessionPosse?.playerId && sessionPosse.casas > 0 && (
          <span className="text-[6px] text-amber-400 font-inconsolata mt-0.5">
            {sessionPosse.casas >= 5 ? "🏨" : "🏠".repeat(sessionPosse.casas)}
          </span>
        )}
      </div>

      {donoCor && (
        <div
          className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${donoCor.bg} ${sessionPosse?.hipotecada ? "opacity-40" : ""}`}
        />
      )}

      {players.length > 0 && (
        <div className="absolute bottom-0.5 left-0.5 flex -space-x-1">
          {players.slice(0, 4).map((p) => {
            const c = PLAYER_COLORS.find(pc => pc.value === p.cor)
            return (
              <div
                key={p.id}
                className={`w-2.5 h-2.5 rounded-full border border-zinc-950 ${c?.bg ?? "bg-zinc-500"}`}
                title={p.nome}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
