'use client'

import { useEffect, useState } from "react"
import { Pencil, Settings } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import SiteBottomNav from "@/components/SiteBottomNav"
import UserAvatar from "@/components/UserAvatar"
import EditProfileModal from "@/components/EditProfileModal"
import UserBanner from "@/components/UserBanner"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faStar, faTrophy, faGamepad, faCrown, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons"
import { getProfileHistoryApi } from "@/services/api/profile"

const xpForLevel = (level: number) => Math.floor(200 * Math.pow(1.04, level - 1))

const totalXpForLevels = (level: number) => {
  let total = 0
  for (let i = 1; i < level; i++) total += xpForLevel(i)
  return total
}

export default function PerfilPage() {
  const { user, token, loadFromStorage } = useAuthStore()
  const { profile, loading, loadProfile } = useProfileStore()
  const router = useRouter()
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
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        <p>Faça login para ver seu perfil.</p>
      </div>
    )
  }

  if (loading.profile || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        <p>Carregando...</p>
      </div>
    )
  }

  const xpCurrent = xpForLevel(profile.level)
  const xpPrevious = totalXpForLevels(profile.level)
  const xpIntoLevel = profile.xp - xpPrevious
  const xpProgress = Math.min((xpIntoLevel / xpCurrent) * 100, 100)

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-20">
      <Header aba="perfil" />

      <main className="pt-30 px-4 max-w-lg mx-auto space-y-4">
        <div className="bg-zinc-800 rounded-2xl overflow-hidden">
          <UserBanner banner={profile.banner} className="h-20 w-full" />
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
                href="/configuracoes"
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
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>XP Total: {profile.xp}</span>
            <span>Próximo nível: {xpCurrent} XP</span>
          </div>
          <div className="w-full h-3 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${xpProgress}%` }} />
          </div>
          <p className="text-xs text-zinc-500 text-center mt-1">{xpIntoLevel} / {xpCurrent} XP</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-800 rounded-2xl p-3 text-center">
            <FontAwesomeIcon icon={faGamepad} className="text-green-400 text-xl mb-1" />
            <p className="text-lg font-bold">{profile.totalGames}</p>
            <p className="text-xs text-zinc-400">Partidas</p>
          </div>
          <div className="bg-zinc-800 rounded-2xl p-3 text-center">
            <FontAwesomeIcon icon={faCrown} className="text-yellow-400 text-xl mb-1" />
            <p className="text-lg font-bold">{profile.totalWins}</p>
            <p className="text-xs text-zinc-400">Vitórias</p>
          </div>
          <div className="bg-zinc-800 rounded-2xl p-3 text-center">
            <FontAwesomeIcon icon={faTrophy} className="text-amber-500 text-xl mb-1" />
            <p className="text-lg font-bold">{profile.totalTop3}</p>
            <p className="text-xs text-zinc-400">Top 3</p>
          </div>
        </div>

        {profile.items.filter((i: any) => i.equipped).length > 0 && (
          <div className="bg-zinc-800 rounded-2xl p-4">
            <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faStar} className="text-yellow-400" />
              Itens Equipados
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.items.filter((i: any) => i.equipped).map((item: any) => (
                <span key={item.id} className="bg-zinc-700 px-3 py-1 rounded-full text-xs">{item.name}</span>
              ))}
            </div>
          </div>
        )}

        {profile.missions.length > 0 && (
          <div className="bg-zinc-800 rounded-2xl p-4">
            <h2 className="text-sm font-bold mb-3">Missões</h2>
            <div className="space-y-2">
              {profile.missions.slice(0, 4).map((m: any) => {
                const pct = Math.min((m.progress / m.target) * 100, 100)
                return (
                  <div key={m.id}>
                    <div className="flex justify-between text-xs">
                      <span className={m.completed ? "text-green-400" : "text-zinc-300"}>{m.name}</span>
                      <span className="text-zinc-500">{Math.floor(m.progress)}/{m.target}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-700 rounded-full mt-0.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${m.completed ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {history && history.length > 0 && (
          <div className="bg-zinc-800 rounded-2xl p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faClockRotateLeft} className="text-zinc-400" />
              Histórico de Partidas
            </h2>
            <div className="space-y-2">
              {history.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between bg-zinc-700/50 rounded-xl px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${r.position === 1 ? "text-yellow-400" : r.position === 2 ? "text-zinc-300" : r.position === 3 ? "text-amber-600" : "text-zinc-500"}`}>
                      #{r.position}
                    </span>
                    <span className="text-zinc-400">R$ {r.patrimony.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-400">+{r.xpEarned} XP</span>
                    <span className="text-yellow-400">+{r.coinsEarned} coins</span>
                    <span className="text-zinc-600">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {history && history.length === 0 && (
          <div className="bg-zinc-800 rounded-2xl p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faClockRotateLeft} className="text-zinc-400" />
              Histórico de Partidas
            </h2>
            <p className="text-xs text-zinc-500">Nenhuma partida disputada ainda.</p>
          </div>
        )}
      </main>

      <SiteBottomNav aba="perfil" />
    </div>
  )
}