"use client";

import { useEffect, useRef } from "react";
import { useMusicStore } from "@/stores/musicStore";

export default function MusicProvider() {
  const { volume, isPlaying } = useMusicStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const howlRef = useRef<any>(null);

  // A música (~2 MB) só é carregada quando for tocar — antes, o Howl era
  // criado ao montar e baixava o arquivo inteiro em toda página, até no
  // /login e com a música desligada (o padrão). html5: true toca por
  // streaming, sem esperar o download completo.
  async function garantirHowl() {
    if (howlRef.current) return howlRef.current;
    // Howl só funciona no browser — importação dinâmica evita erro de SSR
    const { Howl } = await import("howler");
    howlRef.current ??= new Howl({
      src: ["/sounds/airs-of-change.mp3"],
      loop: true,
      html5: true,
      volume: useMusicStore.getState().volume,
    });
    return howlRef.current;
  }

  useEffect(() => {
    if (!isPlaying) {
      howlRef.current?.pause();
      return;
    }

    const tocar = () => {
      garantirHowl()
        .then((howl) => {
          if (useMusicStore.getState().isPlaying && !howl.playing()) howl.play();
        })
        .catch(() => {});
    };

    // Estado salvo como "tocando": o navegador bloqueia autoplay antes da
    // primeira interação, então espera um clique/tecla para carregar e tocar.
    const jaInteragiu = typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive;
    if (jaInteragiu) {
      tocar();
      return;
    }
    const aoInteragir = () => tocar();
    window.addEventListener("pointerdown", aoInteragir, { once: true });
    window.addEventListener("keydown", aoInteragir, { once: true });
    return () => {
      window.removeEventListener("pointerdown", aoInteragir);
      window.removeEventListener("keydown", aoInteragir);
    };
  }, [isPlaying]);

  useEffect(() => {
    howlRef.current?.volume(volume);
  }, [volume]);

  useEffect(() => {
    return () => {
      howlRef.current?.unload();
    };
  }, []);

  return null;
}
