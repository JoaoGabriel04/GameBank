'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import Link from "next/link"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faCrown, faGamepad, faTrophy, faPlus, faUsers,
  faStore, faGift, faBolt, faArrowRight,
} from "@fortawesome/free-solid-svg-icons"
import { Loader2 } from "lucide-react"
import { getProfileHistoryApi } from "@/services/api/profile"

const xpForLevel = (level: number) => Math.floor(200 * Math.pow(1.04, level - 1))
const totalXpForLevels = (level: number) => {
  let total = 0
  for (let i = 1; i < level; i++) total += xpForLevel(i)
  return total
}

export default function UserDashboard() {
  const router = useRouter()
  const { token, loadFromStorage } = useAuthStore()
  const { profile, missions, loading, loadProfile, loadMissions } = useProfileStore()
  const [history, setHistory] = useState<any[] | null>(null)

  useEffect(() => { loadFromStorage() }, [loadFromStorage])
  useEffect(() => {
    if (token) { loadProfile(); loadMissions() }
  }, [token, loadProfile, loadMissions])
  useEffect(() => {
    if (token && history === null) {
      getProfileHistoryApi().then(setHistory).catch(() => setHistory([]))
    }
  }, [token, history])

  if (loading.profile || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    )
  }

  const xpCurrent = xpForLevel(profile.level)
  const xpPrevious = totalXpForLevels(profile.level)
  const xpIntoLevel = profile.xp - xpPrevious
  const xpProgress = Math.min((xpIntoLevel / xpCurrent) * 100, 100)
  const activeMissions = missions.filter((m: any) => !m.completed).slice(0, 3)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Saudação */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-jaro text-2xl text-zinc-100">
            Olá, {profile.nome.split(" ")[0]} 👋
          </h1>
          <p className="font-inconsolata text-sm text-zinc-500 mt-0.5">
            Nível {profile.level} · {profile.xp.toLocaleString("pt-BR")} XP total
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2">
          <FontAwesomeIcon icon={faCrown} className="text-amber-400 text-sm" />
          <span className="font-jaro text-lg text-amber-300">{profile.coins.toLocaleString("pt-BR")}</span>
        </div>
      </div>

      {/* Barra de XP */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="font-inconsolata text-xs text-zinc-500 uppercase tracking-widest">XP</span>
          <span className="font-inconsolata text-xs text-zinc-500">
            {xpIntoLevel.toLocaleString("pt-BR")} / {xpCurrent.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <p className="font-inconsolata text-[10px] text-zinc-600 mt-1.5 text-right">
          Próximo nível: {(xpCurrent - xpIntoLevel).toLocaleString("pt-BR")} XP restantes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: faGamepad, value: profile.totalGames, label: "Partidas",  color: "text-blue-400" },
          { icon: faCrown,   value: profile.totalWins,  label: "Vitórias",  color: "text-amber-400" },
          { icon: faTrophy,  value: profile.totalTop3,  label: "Top 3",     color: "text-orange-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-1">
            <FontAwesomeIcon icon={stat.icon} className={`text-2xl ${stat.color}`} />
            <p className="font-jaro text-2xl text-zinc-100">{stat.value}</p>
            <p className="font-inconsolata text-[11px] text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push("/user/new-session")}
          className="bg-green-600 hover:bg-green-500 text-white rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xl" />
          <div className="text-left">
            <p className="font-jaro text-base">Criar Sala</p>
            <p className="font-inconsolata text-[11px] text-green-200">Nova partida</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/user/sessions")}
          className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer border border-zinc-700"
        >
          <FontAwesomeIcon icon={faUsers} className="text-xl text-blue-400" />
          <div className="text-left">
            <p className="font-jaro text-base">Ver Salas</p>
            <p className="font-inconsolata text-[11px] text-zinc-400">Entrar em jogo</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/user/loja")}
          className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer border border-zinc-700"
        >
          <FontAwesomeIcon icon={faStore} className="text-xl text-violet-400" />
          <div className="text-left">
            <p className="font-jaro text-base">Loja</p>
            <p className="font-inconsolata text-[11px] text-zinc-400">Gastar coins</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/user/recompensas")}
          className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer border border-zinc-700"
        >
          <FontAwesomeIcon icon={faGift} className="text-xl text-pink-400" />
          <div className="text-left">
            <p className="font-jaro text-base">Recompensas</p>
            <p className="font-inconsolata text-[11px] text-zinc-400">Missões e ranking</p>
          </div>
        </button>
      </div>

      {/* Missões em andamento */}
      {activeMissions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-jaro text-base text-zinc-300 flex items-center gap-2">
              <FontAwesomeIcon icon={faBolt} className="text-yellow-400 text-sm" />
              Missões
            </h2>
            <Link href="/user/recompensas" className="text-xs font-inconsolata text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
              Ver todas <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
            </Link>
          </div>
          <div className="space-y-2">
            {activeMissions.map((m: any) => {
              const pct = Math.min((m.progress / m.target) * 100, 100)
              return (
                <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-inconsolata text-xs text-zinc-300">{m.name}</span>
                    <span className="font-inconsolata text-[10px] text-zinc-500">
                      {Math.floor(m.progress)}/{m.target}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Histórico recente */}
      {history && history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-jaro text-base text-zinc-300">Partidas Recentes</h2>
            <Link href="/user/perfil" className="text-xs font-inconsolata text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
              Ver todas <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
            </Link>
          </div>
          <div className="space-y-2">
            {history.slice(0, 3).map((r: any) => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className={`font-jaro text-xl ${
                  r.position === 1 ? "text-yellow-400" :
                  r.position === 2 ? "text-zinc-300" :
                  r.position === 3 ? "text-amber-600" : "text-zinc-600"
                }`}>#{r.position}</span>
                <div className="flex items-center gap-3 text-xs font-inconsolata">
                  <span className="text-green-400">+{r.xpEarned} XP</span>
                  <span className="text-amber-400">+{r.coinsEarned} coins</span>
                  <span className="text-zinc-600">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
