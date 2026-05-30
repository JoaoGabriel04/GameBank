import { create } from "zustand";
import type { Negotiation } from "@/types/game";

interface NegotiationStore {
  pendentes: Negotiation[];
  activeNegotiation: Negotiation | null;
  minhaNegociacaoPendente: Negotiation | null;
  minhaNegociacaoAberto: boolean;
  setPendentes: (list: Negotiation[]) => void;
  addPendente: (n: Negotiation) => void;
  removePendente: (id: number) => void;
  setActive: (n: Negotiation | null) => void;
  setMinhaNegociacao: (n: Negotiation | null) => void;
  setMinhaNegociacaoAberto: (v: boolean) => void;
  clearNegotiations: () => void;
}

export const useNegotiationStore = create<NegotiationStore>((set) => ({
  pendentes: [],
  activeNegotiation: null,
  minhaNegociacaoPendente: null,
  minhaNegociacaoAberto: false,
  setPendentes: (list) => set({ pendentes: list }),
  addPendente: (n) => set((s) => ({ pendentes: [...s.pendentes, n] })),
  removePendente: (id) => set((s) => ({
    pendentes: s.pendentes.filter((x) => x.id !== id),
    activeNegotiation: s.activeNegotiation?.id === id ? null : s.activeNegotiation,
  })),
  setActive: (n) => set({ activeNegotiation: n }),
  setMinhaNegociacao: (n) => set({ minhaNegociacaoPendente: n }),
  setMinhaNegociacaoAberto: (v) => set({ minhaNegociacaoAberto: v }),
  clearNegotiations: () => set({
    pendentes: [],
    activeNegotiation: null,
    minhaNegociacaoPendente: null,
    minhaNegociacaoAberto: false,
  }),
}));
