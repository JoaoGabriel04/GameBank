'use client'

import Button1 from "@/components/Button01";
import { useSessions } from "@/hooks/useApi"
import Lenis from "lenis";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInstagram, faGithub, faFacebookF, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { faPlus, faUsers, faClock } from "@fortawesome/free-solid-svg-icons"
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const menuOptions = [
  { text: "Loja", url: "/loja" },
  { text: "Recompensas", url: "/recompensas" },
  { text: "Saiba Mais", url: "/saibamais" },
  { text: "Como Jogar", url: "/comojogar" },
]

export default function Sessions() {

  const router = useRouter();
  const { sessions, isLoading } = useSessions()

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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const activeSessions = sessions ?? []

  return (
    <main className="w-full bg-black">
      <header className="w-full h-25 grid grid-cols-3 justify-between items-center px-10 z-999 bg-zinc-950/50 backdrop-blur-sm">
        <div className="">
          <Link href="/">
            <Image src={'/images/gamebank-logo.png'} alt="logo-gamebank" width={100} height={100} className="w-15" />
          </Link>
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
            size="sm"
            color="green"
            handle={() => router.push('/new-session')}
            className="z-20">Nova Sessão</Button1>
        </nav>
      </header>

      <section className="w-full min-h-[calc(100vh-200px)] py-12 px-10">
        <h1 className="text-green-500 text-4xl font-bold font-jaro text-center tracking-wide mb-4">Sessões</h1>
        <p className="text-zinc-400 text-center mb-10 font-inconsolata">Gerencie suas sessões de jogo</p>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        ) : activeSessions.length > 0 ? (
          <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeSessions.map((session) => (
              <Link key={session.id} href={`/game/${session.id}`}>
                <div className="w-full p-6 bg-zinc-900 border-2 border-zinc-800 hover:border-green-500 rounded-xl transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-jaro text-zinc-100 group-hover:text-green-400 transition-colors">{session.nome}</h2>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-inconsolata">
                      {session.jogadores.length} jogadores
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-zinc-500 text-sm mb-4 font-inconsolata">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faUsers} className="text-sm" />
                      <span className="font-inconsolata">{session.jogadores.length} players</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faClock} className="text-sm" />
                      <span className="font-inconsolata">{formatDate(session.dataInicio)}</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-zinc-800 mb-4"></div>

                  <div className="flex justify-between text-sm text-zinc-500 font-inconsolata">
                    <span className="font-inconsolata">{session.historico.length} transações</span>
                    <span className="group-hover:text-green-400 transition-colors font-inconsolata">Continuar jogando →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
              <FontAwesomeIcon icon={faUsers} className="text-4xl text-zinc-600" />
            </div>
            <h2 className="text-2xl font-jaro text-zinc-300 mb-2">Nenhuma sessão encontrada</h2>
            <p className="text-zinc-500 mb-6 font-inconsolata">Crie uma nova sessão para começar a jogar!</p>
            <Button1
              size="md"
              color="green"
              handle={() => router.push('/new-session')}
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Criar Nova Sessão
            </Button1>
          </div>
        )}
      </section>

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

          <p className="font-inconsolata text-zinc-500 text-sm">© 2026 GameBank. Todos os direitos reservados.</p>
        </div>
      </footer>
    </main>
  )
}