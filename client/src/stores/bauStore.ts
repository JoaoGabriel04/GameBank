import { create } from "zustand"
import { getBausAdquiridosApi, abrirBauAdquiridoApi } from "@/services/api/baus"
import { apiErrMsg } from "@/lib/api-error"

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

  loadAdquiridos: () => Promise<void>
  abrirAdquirido: (id: number) => Promise<any>
  clearError: () => void
}

export const useBauStore = create<BauStore>((set, get) => ({
  adquiridos: [],
  loading: false,
  error: null,

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
    const result = await abrirBauAdquiridoApi(id)
    set((state) => ({
      adquiridos: state.adquiridos.filter((b) => b.id !== id),
    }))
    return result
  },

  clearError: () => set({ error: null }),
}))
