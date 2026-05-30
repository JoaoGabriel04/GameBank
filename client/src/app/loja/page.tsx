'use client'

import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import { buyShopItemApi, equipShopItemApi } from "@/services/api/shop"
import Header from "@/components/Header"
import SiteBottomNav from "@/components/SiteBottomNav"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCoins, faCheck, faPalette, faGem, faChartLine, faBuilding, faTrophy, faCrown } from "@fortawesome/free-solid-svg-icons"
import Image from "next/image"

const typeIcon: Record<string, any> = {
  title: faCrown,
  color: faPalette,
  badge: faGem,
}

export default function LojaPage() {
  const { user, token, loadFromStorage } = useAuthStore()
  const { profile, shopItems, loading, loadShopItems, loadProfile } = useProfileStore()
  const [myItems, setMyItems] = useState<any[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { loadFromStorage() }, [loadFromStorage])
  useEffect(() => {
    if (token) {
      loadShopItems()
      loadProfile()
    }
  }, [token, loadShopItems, loadProfile])

  useEffect(() => {
    if (profile) setMyItems(profile.items)
  }, [profile])

  const handleBuy = async (itemId: number) => {
    setMessage(null)
    try {
      const res = await buyShopItemApi(itemId)
      setMessage(`Item "${res.item.name}" comprado com sucesso!`)
      loadProfile()
      loadShopItems()
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Erro ao comprar item")
    }
  }

  const handleEquip = async (itemId: number) => {
    setMessage(null)
    try {
      await equipShopItemApi(itemId)
      setMessage("Item atualizado!")
      loadProfile()
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Erro ao equipar item")
    }
  }

  if (!user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-zinc-400">
        <p>Faça login para acessar a loja.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-20">
      <Header aba="loja" />

      <main className="pt-30 px-4 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
          <h1 className="font-bold">Loja</h1>
          <div className="flex items-center gap-2 text-yellow-400">
            <FontAwesomeIcon icon={faCoins} />
            <span className="font-bold">{profile?.coins ?? 0}</span>
          </div>
        </div>

        {message && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-center">{message}</div>
        )}

        {loading.shop ? (
          <p className="text-zinc-500 text-center">Carregando...</p>
        ) : shopItems.length === 0 ? (
          <p className="text-zinc-500 text-center">Nenhum item disponível.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shopItems.map((item: any) => {
              const owned = myItems.some((i: any) => i.id === item.id)
              const equipped = myItems.some((i: any) => i.id === item.id && i.equipped)
              return (
                <div key={item.id} className={`bg-zinc-800 rounded-2xl p-4 flex flex-col items-center text-center ${equipped ? "ring-2 ring-green-500" : ""}`}>
                  <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center mb-2">
                    <FontAwesomeIcon icon={typeIcon[item.type] || faGem} className="text-green-400 text-xl" />
                  </div>
                  <h3 className="text-sm font-bold mb-1">{item.name}</h3>
                  <p className="text-xs text-zinc-400 mb-3">{item.description}</p>
                  <div className="flex items-center gap-1 text-yellow-400 text-xs mb-3">
                    <FontAwesomeIcon icon={faCoins} />
                    <span>{item.price}</span>
                  </div>
                  {equipped ? (
                    <button onClick={() => handleEquip(item.id)} className="w-full py-1.5 rounded-lg text-xs bg-green-600 text-white font-medium">
                      Equipado
                    </button>
                  ) : owned ? (
                    <button onClick={() => handleEquip(item.id)} className="w-full py-1.5 rounded-lg text-xs bg-zinc-700 text-zinc-300 hover:bg-zinc-600 font-medium transition-colors">
                      Equipar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(item.id)}
                      disabled={(profile?.coins ?? 0) < item.price}
                      className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        (profile?.coins ?? 0) >= item.price ? "bg-green-600 hover:bg-green-500 text-white" : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                      }`}
                    >
                      Comprar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      <SiteBottomNav aba="loja" />
    </div>
  )
}
