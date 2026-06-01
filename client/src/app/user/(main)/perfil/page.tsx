'use client'

import { useEffect, useState } from "react"
import { Pencil, Settings, Gamepad2, Crown, Trophy, Star, Clock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import Header from "@/components/Header"
import SiteBottomNav from "@/components/SiteBottomNav"
import UserAvatar from "@/components/UserAvatar"
import EditProfileModal from "@/components/EditProfileModal"
import UserBanner from "@/components/UserBanner"
import { getProfileHistoryApi } from "@/services/api/profile"

const xpForLevel = (level: number) => Math.floor(200 * Math.pow(1.04, level - 1))
const totalXpForLevels = (level: number) => {
  let total = 0
  for (let i = 1; i < level; i++) total += xpForLevel(i)
  return total
}

const TYPE_GRADIENT: Record<string, string> = {
  title: "from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-300",
  badge: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-300",
  color: "from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-300",
}

const MISSION_ICON: Record<string, string> = {
  properties_bought: "🏢",
  houses_built: "🏠",
  rent_earned: "💰",
  games_played: "🎮",
  wins: "👑",
  top3: "🏆",
}

export default function PerfilPage() {
  const router = useRouter()
  const { user, token, loadFromStorage } = useAuthStore()
  const { profile, loading, loadProfile } = useProfileStore()
  const [history, setHistory] = useState<any[] | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => { loadFromStorage() }, [loadFromStorage])

  useEffect(() => {
    if (token && !profile) loadProfile()
  }, [token, profile, loadProfile])
  useEffect(() => {
    if (token && history === null) {
      getProfileHistoryApi().then(setHistory).catch(() => setHistory([]))
    }
  }, [token, history])

  if (!user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <p>Faça login para ver seu perfil.</p>
      </div>
    )
  }

  if (loading.profile || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <p>Carregando...</p>
      </div>
    )
  }

  const xpCurrent = xpForLevel(profile.level)
  const xpPrevious = totalXpForLevels(profile.level)
  const xpIntoLevel = profile.xp - xpPrevious
  const xpProgress = Math.min((xpIntoLevel / xpCurrent) * 100, 100)
  const equippedItems = profile.items.filter((i: any) => i.equipped)

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      <Header aba="perfil" />

      {/* Glow decorativo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

      
      <main className="pt-30 px-4 max-w-lg mx-auto space-y-4">
        <div className="bg-zinc-800 rounded-2xl">
          <div className="overflow-hidden rounded-t-2xl">
            <UserBanner banner={profile.banner} className="h-20 w-full" />
          </div>
          <div className="px-4 pb-4 flex items-center gap-4 -mt-6">
          <UserAvatar
            avatarUrl={profile.avatarUrl}
            avatarUpdatedAt={profile.avatarUpdatedAt}
            nome={profile.nome}
            size="lg"
            ring
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{profile.nome}</h1>
            {profile.title && <p className="text-sm text-green-400">{profile.title}</p>}
            <p className="text-xs text-zinc-400">Nível {profile.level}</p>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                title="Editar perfil"
                >
                <Pencil className="w-4 h-4" />
              </button>
              <Link
                href="/user/configuracoes"
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
                title="Configurações"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
            <p className="text-sm text-yellow-400 font-bold">{profile.coins} coins</p>
            <p className="text-xs text-zinc-500">ID #{profile.id}</p>
          </div>
          </div>
        </div>

        <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} />

        <div className="bg-zinc-800 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-inconsolata text-zinc-400">Nível {profile.level}</span>
            <span className="text-xs font-inconsolata text-zinc-500">{xpIntoLevel.toLocaleString()} / {xpCurrent.toLocaleString()} XP</span>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="text-[10px] font-inconsolata text-zinc-600 text-right mt-1">XP total: {profile.xp.toLocaleString()}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Gamepad2 className="w-6 h-6 text-green-400" />, value: profile.totalGames, label: "Partidas" },
            { icon: <Crown className="w-6 h-6 text-yellow-400" />, value: profile.totalWins, label: "Vitórias" },
            { icon: <Trophy className="w-6 h-6 text-amber-500" />, value: profile.totalTop3, label: "Top 3" },
          ].map(({ icon, value, label }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
              <div className="flex justify-center mb-1">{icon}</div>
              <p className="font-jaro text-2xl text-white">{value}</p>
              <p className="text-xs font-inconsolata text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Itens equipados */}
        {equippedItems.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h2 className="font-jaro text-base text-white mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" /> Itens Equipados
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {equippedItems.map((item: any) => (
                <div
                  key={item.id}
                  className={`rounded-xl border bg-gradient-to-br px-3 py-2 ${TYPE_GRADIENT[item.type] ?? "from-zinc-800/50 border-zinc-700 text-zinc-300"}`}
                >
                  <p className="text-xs font-inconsolata font-semibold truncate">{item.name}</p>
                  <p className="text-[10px] font-inconsolata opacity-60 capitalize">{item.type}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missões */}
        {profile.missions.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h2 className="font-jaro text-base text-white mb-3">Missões</h2>
            <div className="space-y-3">
              {profile.missions.slice(0, 4).map((m: any) => {
                const pct = Math.min((m.progress / m.target) * 100, 100)
                return (
                  <div key={m.id} className={`rounded-xl border p-3 ${m.completed ? "border-green-500/30 bg-green-500/5" : "border-zinc-800 bg-zinc-800/30"}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-lg leading-none">{MISSION_ICON[m.metric] ?? "⭐"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-inconsolata font-semibold ${m.completed ? "text-green-400" : "text-zinc-200"}`}>{m.name}</p>
                          <div className="flex gap-2 shrink-0 ml-2">
                            <span className="text-[10px] font-inconsolata text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">+{m.coinReward}</span>
                            <span className="text-[10px] font-inconsolata text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">+{m.xpReward} XP</span>
                          </div>
                        </div>
                        <p className="text-xs font-inconsolata text-zinc-500">{m.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${m.completed ? "bg-green-500" : "bg-gradient-to-r from-blue-500 to-blue-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-inconsolata text-zinc-500 shrink-0">{Math.floor(m.progress)}/{m.target}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Histórico */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <h2 className="font-jaro text-base text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" /> Histórico de Partidas
          </h2>
          {!history ? (
            <p className="text-xs font-inconsolata text-zinc-500 text-center py-4">Carregando...</p>
          ) : history.length === 0 ? (
            <p className="text-xs font-inconsolata text-zinc-500 text-center py-4">Nenhuma partida disputada ainda.</p>
          ) : (
            <div className="space-y-2">
              {history.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between bg-zinc-800/50 border border-zinc-800 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`font-jaro text-lg w-6 text-center ${r.position === 1 ? "text-yellow-400" : r.position === 2 ? "text-zinc-300" : r.position === 3 ? "text-amber-600" : "text-zinc-500"}`}>
                      #{r.position}
                    </span>
                    <span className="text-xs font-inconsolata text-zinc-400">R$ {r.patrimony.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-inconsolata text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">+{r.xpEarned} XP</span>
                    <span className="text-[10px] font-inconsolata text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">+{r.coinsEarned}</span>
                    <span className="text-[10px] font-inconsolata text-zinc-600">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteBottomNav aba="perfil" />
    </div>
  )
}
