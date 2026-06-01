'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"


import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCrown, faXmark } from "@fortawesome/free-solid-svg-icons"
import UserAvatar from "@/components/UserAvatar"
import UserBanner from "@/components/UserBanner"

const MISSION_ICON: Record<string, string> = {
  properties_bought: "🏢",
  houses_built: "🏠",
  rent_earned: "💰",
  games_played: "🎮",
  wins: "👑",
  top3: "🏆",
}

const MEDAL: Record<number, { emoji: string; border: string; glow: string; size: string }> = {
  1: { emoji: "🥇", border: "border-yellow-400/60", glow: "shadow-yellow-500/20 shadow-lg", size: "scale-110" },
  2: { emoji: "🥈", border: "border-zinc-300/40", glow: "shadow-zinc-300/10 shadow-md", size: "scale-100" },
  3: { emoji: "🥉", border: "border-amber-600/50", glow: "shadow-amber-600/15 shadow-md", size: "scale-100" },
}

export default function RecompensasPage() {
  const router = useRouter()
  const { user, token, loadFromStorage } = useAuthStore()
  const { missions, ranking, loading, loadMissions, loadRanking } = useProfileStore()
  const [tab, setTab] = useState<"missoes" | "ranking">("missoes")
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)

  useEffect(() => { loadFromStorage() }, [loadFromStorage])
  useEffect(() => { if (user?.isAdmin) router.replace("/admin/recompensas") }, [user, router])
  useEffect(() => {
    if (token) {
      loadMissions()
      loadRanking()
    }
  }, [token, loadMissions, loadRanking])

  const top3 = ranking.slice(0, 3)
  const rest = ranking.slice(3)

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      

      {/* Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-yellow-500/5 blur-3xl rounded-full pointer-events-none" />

      <main className="pt-28 px-4 max-w-lg mx-auto space-y-4 relative">

        {/* Tabs em pills */}
        <div className="flex gap-2">
          {(["missoes", "ranking"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-full text-sm font-inconsolata transition-colors cursor-pointer border ${
                tab === t
                  ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {t === "missoes" ? "Missões" : "Ranking Global"}
            </button>
          ))}
        </div>

        {/* ── Missões ── */}
        {tab === "missoes" && (
          <>
            {loading.missions ? (
              <p className="text-zinc-500 font-inconsolata text-center py-20">Carregando missões...</p>
            ) : missions.length === 0 ? (
              <p className="text-zinc-500 font-inconsolata text-center py-20">Nenhuma missão disponível.</p>
            ) : (
              <div className="space-y-3">
                {missions.map((m: any) => {
                  const pct = Math.min((m.progress / m.target) * 100, 100)
                  return (
                    <div
                      key={m.id}
                      className={`rounded-2xl border p-4 ${m.completed ? "border-green-500/30 bg-green-500/5" : "border-zinc-800 bg-zinc-900"}`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl leading-none shrink-0">{MISSION_ICON[m.metric] ?? "⭐"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-inconsolata font-semibold ${m.completed ? "text-green-400" : "text-zinc-100"}`}>
                              {m.name}
                            </p>
                            <div className="flex gap-1.5 shrink-0">
                              <span className="text-[10px] font-inconsolata text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">
                                +{m.coinReward} coins
                              </span>
                              <span className="text-[10px] font-inconsolata text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                                +{m.xpReward} XP
                              </span>
                            </div>
                          </div>
                          <p className="text-xs font-inconsolata text-zinc-500 mt-0.5">{m.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${m.completed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-blue-500 to-blue-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-inconsolata text-zinc-500 shrink-0 tabular-nums">
                          {Math.floor(m.progress)}/{m.target}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Ranking ── */}
        {tab === "ranking" && (
          <>
            {loading.ranking ? (
              <p className="text-zinc-500 font-inconsolata text-center py-20">Carregando ranking...</p>
            ) : ranking.length === 0 ? (
              <p className="text-zinc-500 font-inconsolata text-center py-20">Nenhum jogador no ranking ainda.</p>
            ) : (
              <div className="space-y-4">
                {/* Top 3 pódio */}
                {top3.length > 0 && (
                  <div className="flex items-end justify-center gap-3 py-2">
                    {/* #2 */}
                    {top3[1] && (
                      <button
                        onClick={() => setSelectedPlayer(top3[1])}
                        className={`flex-1 max-w-[130px] flex flex-col items-center gap-2 bg-zinc-900 border rounded-2xl p-3 cursor-pointer transition-all hover:scale-105 ${MEDAL[2].border} ${MEDAL[2].glow}`}
                      >
                        <span className="text-xl">{MEDAL[2].emoji}</span>
                        <UserAvatar avatarUrl={top3[1].avatarUrl} avatarUpdatedAt={top3[1].avatarUpdatedAt} nome={top3[1].nome} size="sm" />
                        <div className="text-center">
                          <p className="text-xs font-inconsolata text-zinc-200 font-semibold truncate max-w-[100px]">{top3[1].nome}</p>
                          <p className="text-[10px] font-inconsolata text-zinc-500">Lv.{top3[1].level}</p>
                          <p className="text-[10px] font-inconsolata text-green-400">{top3[1].xp.toLocaleString()} XP</p>
                        </div>
                      </button>
                    )}
                    {/* #1 */}
                    <button
                      onClick={() => setSelectedPlayer(top3[0])}
                      className={`flex-1 max-w-[140px] flex flex-col items-center gap-2 bg-zinc-900 border rounded-2xl p-4 cursor-pointer transition-all hover:scale-105 ${MEDAL[1].border} ${MEDAL[1].glow} ${MEDAL[1].size}`}
                    >
                      <span className="text-2xl">{MEDAL[1].emoji}</span>
                      <UserAvatar avatarUrl={top3[0].avatarUrl} avatarUpdatedAt={top3[0].avatarUpdatedAt} nome={top3[0].nome} size="md" ring />
                      <div className="text-center">
                        <p className="text-sm font-inconsolata text-white font-bold truncate max-w-[110px]">{top3[0].nome}</p>
                        <p className="text-[10px] font-inconsolata text-zinc-400">Lv.{top3[0].level}</p>
                        <p className="text-xs font-inconsolata text-green-400 font-semibold">{top3[0].xp.toLocaleString()} XP</p>
                      </div>
                    </button>
                    {/* #3 */}
                    {top3[2] && (
                      <button
                        onClick={() => setSelectedPlayer(top3[2])}
                        className={`flex-1 max-w-[130px] flex flex-col items-center gap-2 bg-zinc-900 border rounded-2xl p-3 cursor-pointer transition-all hover:scale-105 ${MEDAL[3].border} ${MEDAL[3].glow}`}
                      >
                        <span className="text-xl">{MEDAL[3].emoji}</span>
                        <UserAvatar avatarUrl={top3[2].avatarUrl} avatarUpdatedAt={top3[2].avatarUpdatedAt} nome={top3[2].nome} size="sm" />
                        <div className="text-center">
                          <p className="text-xs font-inconsolata text-zinc-200 font-semibold truncate max-w-[100px]">{top3[2].nome}</p>
                          <p className="text-[10px] font-inconsolata text-zinc-500">Lv.{top3[2].level}</p>
                          <p className="text-[10px] font-inconsolata text-green-400">{top3[2].xp.toLocaleString()} XP</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}

                {/* #4+ lista */}
                {rest.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
                    {rest.map((player: any) => (
                      <button
                        key={player.id}
                        onClick={() => setSelectedPlayer(player)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors cursor-pointer text-left"
                      >
                        <span className="w-6 text-xs font-inconsolata text-zinc-500 text-center shrink-0">#{player.position}</span>
                        <UserAvatar avatarUrl={player.avatarUrl} avatarUpdatedAt={player.avatarUpdatedAt} nome={player.nome} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-inconsolata text-zinc-200 truncate">{player.nome}</p>
                          <p className="text-xs font-inconsolata text-zinc-500">Lv.{player.level} · {player.totalGames} partidas</p>
                        </div>
                        <p className="text-xs font-inconsolata text-green-400 shrink-0">{player.xp.toLocaleString()} XP</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal de jogador */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedPlayer(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-20">
              <UserBanner banner={selectedPlayer.banner} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900/80" />
            </div>
            <div className="px-5 pb-5 -mt-8 space-y-4">
              <div className="flex items-end justify-between">
                <div className="flex items-end gap-3">
                  <UserAvatar avatarUrl={selectedPlayer.avatarUrl} avatarUpdatedAt={selectedPlayer.avatarUpdatedAt} nome={selectedPlayer.nome} size="lg" ring />
                  <div>
                    <h3 className="font-jaro text-lg text-white">{selectedPlayer.nome}</h3>
                    <p className="text-xs font-inconsolata text-zinc-400">Nível {selectedPlayer.level}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="text-zinc-400 hover:text-white cursor-pointer pb-2">
                  <FontAwesomeIcon icon={faXmark} className="text-xl" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "XP", value: selectedPlayer.xp.toLocaleString(), color: "text-green-400" },
                  { label: "Vitórias", value: selectedPlayer.totalWins, color: "text-yellow-400" },
                  { label: "Partidas", value: selectedPlayer.totalGames, color: "text-zinc-200" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-zinc-800/50 border border-zinc-800 rounded-xl py-3">
                    <p className={`font-jaro text-xl ${color}`}>{value}</p>
                    <p className="text-[10px] font-inconsolata text-zinc-500">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs font-inconsolata text-zinc-500">
                <span>#{selectedPlayer.position}º no ranking</span>
                <span>{selectedPlayer.totalWins} vitórias · {selectedPlayer.totalTop3} top 3</span>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  )
}
