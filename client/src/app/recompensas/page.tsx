'use client'

import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import Header from "@/components/Header"
import SiteBottomNav from "@/components/SiteBottomNav"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTrophy, faMedal, faCoins, faXmark } from "@fortawesome/free-solid-svg-icons"
import UserAvatar from "@/components/UserAvatar"
import UserBanner from "@/components/UserBanner"

export default function RecompensasPage() {
  const { token, loadFromStorage } = useAuthStore()
  const { missions, ranking, loading, loadMissions, loadRanking } = useProfileStore()
  const [tab, setTab] = useState<"missoes" | "ranking">("missoes")
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)

  useEffect(() => { loadFromStorage() }, [loadFromStorage])
  useEffect(() => {
    if (token) {
      loadMissions()
      loadRanking()
    }
  }, [token, loadMissions, loadRanking])

  const rankIcon = (pos: number) => {
    if (pos === 1) return <FontAwesomeIcon icon={faTrophy} className="text-yellow-400" />
    if (pos === 2) return <FontAwesomeIcon icon={faMedal} className="text-zinc-300" />
    if (pos === 3) return <FontAwesomeIcon icon={faMedal} className="text-amber-600" />
    return <span className="text-xs text-zinc-500 w-5 text-center">{pos}</span>
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-20">
      <Header aba="recompensas" />

      <main className="pt-30 px-4 max-w-lg mx-auto space-y-4">
        <div className="flex bg-zinc-800 rounded-xl p-1">
          <button onClick={() => setTab("missoes")} className={`flex-1 py-2 text-sm rounded-lg transition-colors ${tab === "missoes" ? "bg-green-600 text-white" : "text-zinc-400"}`}>
            Missões
          </button>
          <button onClick={() => setTab("ranking")} className={`flex-1 py-2 text-sm rounded-lg transition-colors ${tab === "ranking" ? "bg-green-600 text-white" : "text-zinc-400"}`}>
            Ranking Global
          </button>
        </div>

        {tab === "missoes" && (
          <>
            {loading.missions ? (
              <p className="text-zinc-500 text-center">Carregando missões...</p>
            ) : missions.length === 0 ? (
              <p className="text-zinc-500 text-center">Nenhuma missão disponível.</p>
            ) : (
              <div className="space-y-3">
                {missions.map((m: any) => {
                  const pct = Math.min((m.progress / m.target) * 100, 100)
                  return (
                    <div key={m.id} className={`bg-zinc-800 rounded-2xl p-4 ${m.completed ? "ring-1 ring-green-500/50" : ""}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-bold text-sm ${m.completed ? "text-green-400" : "text-white"}`}>{m.name}</h3>
                          <p className="text-xs text-zinc-400">{m.description}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs text-yellow-400">{m.coinReward} coins</p>
                          <p className="text-xs text-green-400">{m.xpReward} XP</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>Progresso</span>
                        <span>{Math.floor(m.progress)}/{m.target}</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${m.completed ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === "ranking" && (
          <>
            {loading.ranking ? (
              <p className="text-zinc-500 text-center">Carregando ranking...</p>
            ) : ranking.length === 0 ? (
              <p className="text-zinc-500 text-center">Nenhum jogador no ranking ainda.</p>
            ) : (
              <div className="space-y-2">
                {ranking.map((player: any) => (
                  <div
                    key={player.id}
                    onClick={() => setSelectedPlayer(player)}
                    className="bg-zinc-800 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-750 transition-colors"
                  >
                    <div className="w-8 flex justify-center">{rankIcon(player.position)}</div>
                    <UserAvatar avatarUrl={player.avatarUrl} avatarUpdatedAt={player.avatarUpdatedAt} nome={player.nome} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{player.nome}</p>
                      <p className="text-xs text-zinc-500">Nível {player.level}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-green-400">{player.xp} XP</p>
                      <p className="text-xs text-zinc-500">{player.totalGames} partidas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {selectedPlayer && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedPlayer(null)}>
          <div className="bg-zinc-800 rounded-2xl max-w-sm w-full space-y-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <UserBanner banner={selectedPlayer.banner} className="h-20 w-full" />
            <div className="px-6 pb-6 -mt-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <UserAvatar avatarUrl={selectedPlayer.avatarUrl} avatarUpdatedAt={selectedPlayer.avatarUpdatedAt} nome={selectedPlayer.nome} size="lg" ring />
                <div>
                  <h3 className="font-bold">{selectedPlayer.nome}</h3>
                  <p className="text-xs text-zinc-400">Nível {selectedPlayer.level}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPlayer(null)} className="text-zinc-500 hover:text-white">
                <FontAwesomeIcon icon={faXmark} className="text-xl" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-green-400">{selectedPlayer.xp}</p>
                <p className="text-xs text-zinc-500">XP</p>
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-400">{selectedPlayer.totalWins}</p>
                <p className="text-xs text-zinc-500">Vitórias</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-500">{selectedPlayer.totalGames}</p>
                <p className="text-xs text-zinc-500">Partidas</p>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      <SiteBottomNav aba="recompensas" />
    </div>
  )
}
