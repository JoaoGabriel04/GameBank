"use client";

import { useEffect, useRef } from "react";
import { useMusicStore } from "@/stores/musicStore";

export default function MusicProvider() {
  const { volume, isPlaying } = useMusicStore();
  const howlRef = useRef<any>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    // Howl só funciona no browser — importação dinâmica evita erro de SSR
    import("howler").then(({ Howl }) => {
      howlRef.current = new Howl({
        src: ["/sounds/airs-of-change.mp3"],
        loop: true,
        volume: useMusicStore.getState().volume,
      });
      readyRef.current = true;

      // Restaura o estado salvo
      if (useMusicStore.getState().isPlaying) {
        howlRef.current.play();
      }
    });

    return () => {
      howlRef.current?.unload();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readyRef.current) return;
    howlRef.current?.volume(volume);
  }, [volume]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (isPlaying) {
      if (!howlRef.current?.playing()) howlRef.current?.play();
    } else {
      howlRef.current?.pause();
    }
  }, [isPlaying]);

  return null;
}
