/* eslint-disable */
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Music, Volume2, VolumeX, Play, Pause, LogOut } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInstagram,
  faGithub,
  faFacebookF,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";
import { useAuthStore } from "@/stores/authStore";
import { useMusicStore } from "@/stores/musicStore";
import { userMenuOptions as menuOptions } from "@/utils/menuOptions";



const VERSION = process.env.NEXT_PUBLIC_GAME_VERSION ?? "1.0.0";

export default function ConfiguracoesPage() {
  const { loadFromStorage, logout } = useAuthStore();
  const { volume, isPlaying, setVolume, togglePlaying } = useMusicStore();
  const router = useRouter();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const volumePct = Math.round(volume * 100);

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-24">


      <main className="pt-16 lg:pt-8 px-4 max-w-lg mx-auto space-y-4">
        {/* Back link */}
        <Link
          href="/user/perfil"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-200 transition-colors font-inconsolata text-sm mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Perfil
        </Link>

        <h1 className="font-jaro text-2xl text-zinc-100">Configurações</h1>

        {/* -- Música -- */}
        <section className="bg-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-4 h-4 text-green-400" />
            <h2 className="font-jaro text-base text-zinc-100">Música</h2>
          </div>

          {/* Play / Pause */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-inconsolata text-sm text-zinc-300">Air of Change</p>
              <p className="font-inconsolata text-xs text-zinc-600 mt-0.5">Música de fundo do jogo</p>
            </div>
            <button
              onClick={togglePlaying}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isPlaying
                  ? "bg-green-500/20 border-2 border-green-500"
                  : "bg-zinc-700 border-2 border-zinc-600 hover:border-zinc-400"
              }`}
              title={isPlaying ? "Pausar" : "Reproduzir"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-green-400" />
              ) : (
                <Play className="w-4 h-4 text-zinc-300" />
              )}
            </button>
          </div>

          {/* Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400">
                {volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                <span className="font-inconsolata text-xs uppercase tracking-wide">Volume</span>
              </div>
              <span className="font-inconsolata text-sm text-zinc-300 tabular-nums w-10 text-right">
                {volumePct}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-green-500 bg-zinc-700"
            />
            <div className="flex justify-between font-inconsolata text-[10px] text-zinc-600">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </section>

        {/* -- Sobre -- */}
        <section className="bg-zinc-800 rounded-2xl p-5 space-y-5">
          <h2 className="font-jaro text-base text-zinc-100">Sobre o GameBank</h2>

          <nav>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {menuOptions.map((opt) => (
                <li key={opt.url}>
                  <Link
                    href={opt.url}
                    className="font-inconsolata text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    {opt.text}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-5">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-pink-400 transition-colors"
              title="Instagram"
            >
              <FontAwesomeIcon icon={faInstagram} className="text-lg" />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-blue-400 transition-colors"
              title="Facebook"
            >
              <FontAwesomeIcon icon={faFacebookF} className="text-lg" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-100 transition-colors"
              title="GitHub"
            >
              <FontAwesomeIcon icon={faGithub} className="text-lg" />
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-100 transition-colors"
              title="X / Twitter"
            >
              <FontAwesomeIcon icon={faXTwitter} className="text-lg" />
            </a>
          </div>

          <div className="border-t border-zinc-700 pt-4 space-y-1">
            <p className="font-inconsolata text-xs text-zinc-500">
              Versão{" "}
              <span className="text-zinc-400 font-medium">v{VERSION}</span>
            </p>
            <p className="font-inconsolata text-xs text-zinc-600">
              © {new Date().getFullYear()} GameBank. Todos os direitos reservados.
            </p>
          </div>
        </section>

        {/* -- Sair -- */}
        <section className="bg-zinc-800 rounded-2xl p-5">
          <button
            onClick={() => { logout(); router.push("/"); }}
            className="w-full flex items-center justify-between text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            <div>
              <p className="font-jaro text-base text-left">Sair da conta</p>
              <p className="font-inconsolata text-xs text-zinc-500 mt-0.5">Encerra a sessão neste dispositivo</p>
            </div>
            <LogOut className="w-5 h-5 shrink-0" />
          </button>
        </section>
      </main>


    </div>
  );
}
