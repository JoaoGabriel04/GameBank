'use client'

import Button1 from "@/components/Button01";
import { useViewportHeight } from "@/hooks/useViewportHeight"
import { Howl } from "howler";
import Lenis from "lenis";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInstagram, faGithub, faFacebookF, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { faDollarSign, faHouse, faUsers, faPlus, faGamepad } from "@fortawesome/free-solid-svg-icons"
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CardFeatures from "./tests/home/_components/cardFeatures";
import MusicPlayer from "./tests/home/_components/musicPlayer";

const menuOptions = [
  { text: "Loja", url: "/loja" },
  { text: "Recompensas", url: "/recompensas" },
  { text: "Saiba Mais", url: "/saibamais" },
  { text: "Como Jogar", url: "/comojogar" },
]

export default function Home() {

  const vh = useViewportHeight();
  const router = useRouter();

  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)

  const musicRef = useRef(
    new Howl({
      src: ["/sounds/airs-of-change.mp3"],
      loop: true,
      volume: 0.5
    })
  )

  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume(volume)
    }
  }, [volume])

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  function toggleMusic() {
    const music = musicRef.current

    if (music.playing()) {
      music.pause()
      setPlaying(false)
    } else {
      music.play()
      setPlaying(true)
    }
  }

  return (
    <main className="w-full bg-black">
      <header className="absolute w-full h-25 top-0 left-0 grid grid-cols-3 justify-between items-center px-10 z-999">
        <div className="">
          <Image src={'/images/gamebank-logo.png'} alt="logo-gamebank" width={100} height={100} className="w-15" />
        </div>
        <nav className="w-full flex justify-center items-center">
          <ul className="w-full flex justify-center items-center gap-10">
            {menuOptions.map((option, index) => (
              <li key={index} className="font-jaro text-zinc-100 hover:scale-120 transition-all duration-100 cursor-pointer"><Link href={option.url}>{option.text}</Link></li>
            ))}
          </ul>
        </nav>
        <nav className="flex justify-end items-center gap-4">
          <Button1
            size="lg"
            color="green"
            handle={() => router.push('/sessions')}
            className="z-20">Jogar</Button1>
        </nav>
      </header>

      <section style={{ height: vh }} className="relative w-full bg-[url('/images/ceu-cidade-vistacima.png')] bg-bottom bg-cover bg-no-repeat z-10">
        <div className="w-full h-full flex flex-col justify-center items-center gap-6">
          <div className="flex w-full justify-center items-center font-jaro text-6xl z-20">
            <h1 className="bg-linear-to-r from-[#1F9900] via-[#33FF00] to-[#00BE39] bg-clip-text text-transparent text-shadow-sm">Game</h1>
            <h1 className="bg-linear-to-r from-[#FFA600] via-[#FFDEA1] to-[#FFA600] bg-clip-text text-transparent text-shadow-sm">₿ank</h1>
          </div>
          <p className="w-4/5 lg:w-150 font-inconsolata text-sm text-center text-zinc-100 text-shadow-sm tracking-wider z-20">Seu banco dentro do tabuleiro. Controle depósitos, saques e transferências entre jogadores com agilidade e transparência.</p>
          
          <div className="flex gap-6 z-20">
            <Button1
              size="md"
              color="blue"
              handle={() => router.push('/sessions')}
              className="z-20"
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Criar Nova Sessão
            </Button1>
            <Button1
              size="md"
              color="green"
              handle={() => router.push('/sessions')}
              className="z-20"
            >
              <FontAwesomeIcon icon={faGamepad} className="mr-2" />
              Ver Sessões
            </Button1>
          </div>
        </div>

        <div className="w-full h-full absolute top-0 left-0 bg-black/30 backdrop-blur-[3px] z-1"></div>
        <div className="absolute w-full h-20 bottom-0 left-0 z-2 bg-linear-to-b from-zinc-900/0 to-black"></div>
      </section>

      <section className="w-full min-h-100 py-4">

        <h1 className="text-green-500 text-3xl font-bold font-jaro text-center tracking-wide">Funcionalidades</h1>

        <div className="w-full grid grid-cols-3 mt-16">
          <CardFeatures color="purple" icon={faUsers} title="Multiplayer" description="Jogue com até 6 amigos simultaneamente, cada um com sua cor personalizada." />
          <CardFeatures color="green" icon={faDollarSign} title="Gestão Financeira" description="Sistema completo de transações, transferências e histórico detalhado." />
          <CardFeatures color="amber" icon={faHouse} title="Propriedades" description="26 propriedades baseadas no tabuleiro real com sistema de casas e hotéis." />
        </div>

      </section>

      <MusicPlayer 
        isPlaying={playing} 
        onToggle={toggleMusic}
        volume={volume}
        onVolumeChange={setVolume}
      />

      <footer className="w-full bg-zinc-950 py-8 px-10">
        <div className="w-full flex flex-col items-center gap-6">
          <nav>
            <ul className="flex justify-center items-center gap-8">
              {menuOptions.map((option, index) => (
                <li key={index} className="font-inconsolata text-zinc-400 hover:text-zinc-100 hover:scale-105 transition-all duration-100 cursor-pointer">
                  <Link href={option.url}>{option.text}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex justify-center items-center gap-6">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors">
              <FontAwesomeIcon icon={faInstagram} className="text-xl" />
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-blue-500 transition-colors">
              <FontAwesomeIcon icon={faFacebookF} className="text-xl" />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
              <FontAwesomeIcon icon={faGithub} className="text-xl" />
            </a>
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
              <FontAwesomeIcon icon={faXTwitter} className="text-xl" />
            </a>
          </div>

          <p className="font-inconsolata text-zinc-500 text-sm - v1.3.0">© 2026 GameBank. Todos os direitos reservados.</p>
        </div>
      </footer>
    </main>
  )
}