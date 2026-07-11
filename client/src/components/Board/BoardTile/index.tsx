'use client'

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLock } from "@fortawesome/free-solid-svg-icons"
import type { Casa, Player, SessionPropriedade } from "@/types/game"
import { PLAYER_COLORS } from "@/types/game"
import { getGroupColorHex } from "@/utils/properties"
import { getGrupoImagem, getCasaImagem } from "@/utils/tabuleiro-images"
import PlayerAvatar from "@/components/Board/PlayerAvatar"

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
  const hipotecada = !!sessionPosse?.hipotecada
  const casas = sessionPosse?.casas ?? 0
  const temHotel = casas >= 5

  const imagemGrupo = isPropriedade
    ? getGrupoImagem(sessionPosse?.propriedade?.grupo_cor)
    : null
  const imagemCasa = !isPropriedade ? getCasaImagem(casa.tipo) : null
  const imagemFundo = imagemGrupo ?? imagemCasa

  const preco = sessionPosse?.propriedade?.custo_compra
  const semDono = isPropriedade && !sessionPosse?.playerId

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none rounded-lg border-2 transition-all duration-300 ${
        destaque
          ? "border-green-400 shadow-[0_0_20px_5px_rgba(74,222,128,0.6)] z-10"
          : "border-black/40"
      }`}
      title={casa.nome}
    >
      {/* CAMADA 1: Imagem de fundo */}
      {imagemFundo && (
        <img
          src={imagemFundo}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}

      {/* CAMADA 2: Vinheta escura para dar profundidade e contraste */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />

      {/* CAMADA 3: Faixa superior com nome (gradiente da cor do grupo) */}
      <div
        className="absolute top-0 left-0 right-0 px-1.5 py-1.5 flex items-center justify-center"
        style={{
          background: isPropriedade && cor
            ? `linear-gradient(180deg, ${cor} 0%, ${cor}dd 70%, ${cor}00 100%)`
            : "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
        }}
      >
        <span className="font-jaro text-white text-center leading-tight text-[11px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] line-clamp-2">
          {casa.nome}
        </span>
      </div>

      {/* CAMADA 4: Preço na base (só propriedade sem dono) */}
      {semDono && preco != null && (
        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1.5 flex items-center justify-center gap-1 bg-gradient-to-t from-black/80 to-transparent">
          <span className="font-jaro text-white text-[13px] drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
            R$ {preco.toLocaleString("pt-BR")}
          </span>
        </div>
      )}

      {/* Dono da propriedade — avatar no canto */}
      {donoJogador && (
        <div
          className={`absolute top-1 right-1 w-6 h-6 shrink-0 overflow-hidden rounded-full ring-2 ${donoCor?.ring ?? "ring-zinc-500"} shadow-[0_0_4px_rgba(0,0,0,0.8)] z-20`}
          title={`Dono: ${donoJogador.nome}`}
        >
          <PlayerAvatar player={donoJogador} size={24} showFrame={false} />
        </div>
      )}

      {/* Casas e hotel — na base, acima do preço. Nota: casa.tipo === "propriedade",
          não isPropriedade — ações ("acao") nunca têm casas/hotel. */}
      {casa.tipo === "propriedade" && !hipotecada && casas > 0 && (
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-1 z-10">
          {temHotel ? (
            <div
              className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_6px_rgba(245,158,11,0.9)] ring-1 ring-amber-200/60"
              title="Hotel"
            >
              <span className="text-[10px]">🏨</span>
            </div>
          ) : (
            Array.from({ length: casas }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-[2px] bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)] ring-1 ring-emerald-200/50"
              />
            ))
          )}
        </div>
      )}

      {/* Hipotecada — escurece tudo e mostra cadeado */}
      {hipotecada && (
        <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center z-30">
          <div className="flex flex-col items-center gap-1">
            <FontAwesomeIcon icon={faLock} className="text-red-400 text-lg" />
            <span className="font-inconsolata text-red-300 text-[9px]">
              Hipotecada
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
