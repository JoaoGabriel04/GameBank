import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SfxStore {
  volume: number;
  muted: boolean;
  setVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
  toggleMuted: () => void;
}

export const useSfxStore = create<SfxStore>()(
  persist(
    (set, get) => ({
      volume: 0.6,
      muted: false,
      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      toggleMuted: () => set({ muted: !get().muted }),
    }),
    { name: "gamebank-sfx" }
  )
);
