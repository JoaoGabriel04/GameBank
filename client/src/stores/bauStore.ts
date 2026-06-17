import { create } from "zustand"
import { getBausAdquiridosApi, abrirBauAdquiridoApi } from "@/services/api/baus"
import { apiErrMsg } from "@/lib/api-error"
import type { BauResultado } from "@/components/BauAbertura"

export interface BauAdquirido {
  id: number
  userId: number
  bauId: number
  sessionId: number | null
  position: number | null
  status: "BLOQUEADO" | "PRONTO"
  unlockAt: string
  openedAt: string | null
  createdAt: string
  bau: { id: number; tipo: string; nome: string }
}

interface BauStore {
  adquiridos: BauAdquirido[]
  loading: boolean
  error: string | null
  abrindoId: number | null
  ultimoResultado: BauResultado | null

  loadAdquiridos: () => Promise<void>
  abrirAdquirido: (id: number) => Promise<BauResultado>
  limparUltimoResultado: () => void
  clearError: () => void
}

export const useBauStore = create<BauStore>((set, get) => ({
  adquiridos: [],
  loading: false,
  error: null,
  abrindoId: null,
  ultimoResultado: (() => {
    try {
      const saved = typeof window !== "undefined" && sessionStorage.getItem("bau_ultimo_resultado")
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })(),

  loadAdquiridos: async () => {
    set({ loading: true, error: null })
    try {
      const adquiridos = await getBausAdquiridosApi()
      set({ adquiridos, loading: false })
    } catch (err) {
      set({ error: apiErrMsg(err, "Erro ao carregar baús adquiridos"), loading: false })
    }
  },

  abrirAdquirido: async (id: number) => {
    set({ abrindoId: id, error: null })
    try {
      const result = await abrirBauAdquiridoApi(id)
      set((state) => ({
        adquiridos: state.adquiridos.filter((b) => b.id !== id),
        abrindoId: null,
        ultimoResultado: result,
      }))
      try {
        sessionStorage.setItem("bau_ultimo_resultado", JSON.stringify(result))
      } catch {}
      return result
    } catch (err) {
      set({ abrindoId: null })
      throw err
    }
  },

  limparUltimoResultado: () => {
    try { sessionStorage.removeItem("bau_ultimo_resultado") } catch {}
    set({ ultimoResultado: null })
  },

  clearError: () => set({ error: null }),
}))
