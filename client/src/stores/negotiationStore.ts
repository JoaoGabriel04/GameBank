import { create } from "zustand";
import type { Negotiation } from "@/types/game";

interface NegotiationStore {
  pendentes: Negotiation[];
  activeNegotiation: Negotiation | null;
  setPendentes: (list: Negotiation[]) => void;
  addPendente: (n: Negotiation) => void;
  removePendente: (id: number) => void;
  setActive: (n: Negotiation | null) => void;
  clearNegotiations: () => void;
}

export const useNegotiationStore = create<NegotiationStore>((set) => ({
  pendentes: [],
  activeNegotiation: null,
  setPendentes: (list) => set({ pendentes: list }),
  addPendente: (n) => set((s) => ({ pendentes: [...s.pendentes, n] })),
  removePendente: (id) => set((s) => ({
    pendentes: s.pendentes.filter((x) => x.id !== id),
    activeNegotiation: s.activeNegotiation?.id === id ? null : s.activeNegotiation,
  })),
  setActive: (n) => set({ activeNegotiation: n }),
  clearNegotiations: () => set({ pendentes: [], activeNegotiation: null }),
}));
