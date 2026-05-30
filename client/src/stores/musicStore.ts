import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MusicStore {
  volume: number;
  isPlaying: boolean;
  setVolume: (v: number) => void;
  setIsPlaying: (v: boolean) => void;
  togglePlaying: () => void;
}

export const useMusicStore = create<MusicStore>()(
  persist(
    (set, get) => ({
      volume: 0.4,
      isPlaying: false,
      setVolume: (volume) => set({ volume }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      togglePlaying: () => set({ isPlaying: !get().isPlaying }),
    }),
    { name: "gamebank-music" }
  )
);
