'use client'

import Button1 from "@/components/Button01";
import { useViewportHeight } from "@/hooks/useViewportHeight"
import Lenis from "lenis";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDollarSign, faHouse, faUsers, faPlus, faGamepad,
  faBolt, faArrowRight,
  faUserPlus, faPalette, faStore, faStar, faTrophy,
} from "@fortawesome/free-solid-svg-icons"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import Footer from "@/components/Footer";
import LandingHeader from "@/components/LandingHeader";

function CardFeatures({ color, icon, title, description }: {
  color: string;
  icon: IconDefinition;
  title: string;
  description: string;
}) {
  const palette: Record<string, string> = {
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    green:  "text-green-400 bg-green-500/10 border-green-500/20",
    amber:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  const cls = palette[color] ?? palette.green;
  return (
    <div className={`flex flex-col items-center text-center gap-4 p-6 rounded-2xl border ${cls}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cls}`}>
        <FontAwesomeIcon icon={icon} className="text-xl" />
      </div>
      <h3 className="font-jaro text-lg text-zinc-100">{title}</h3>
      <p className="font-inconsolata text-sm text-zinc-400">{description}</p>
    </div>
  );
}

const tutorialSteps = [
  { num: "01", icon: faUserPlus, title: "Crie sua Conta", desc: "Cadastre-se com email ou entre com Google/Discord em segundos." },
  { num: "02", icon: faGamepad,  title: "Crie ou Entre em uma Sala", desc: "Monte sua sala com nome, senha e número de jogadores. Compartilhe o link!" },
  { num: "03", icon: faPalette,  title: "Personalize-se", desc: "Escolha sua cor e, em modo duplas, forme times com saldo compartilhado." },
  { num: "04", icon: faDollarSign, title: "Gerencie seu Dinheiro", desc: "A aba Início mostra saldo, propriedades, aluguéis, cartas e transações." },
  { num: "05", icon: faStore,    title: "Compre e Construa", desc: "Adquira propriedades na Loja e construa casas quando tiver monopólio." },
  { num: "06", icon: faStar,     title: "Cartas e Negociações", desc: "Sorteie Sorte/Revés com efeitos automáticos. Negocie com outros jogadores." },
  { num: "07", icon: faTrophy,   title: "Ranking e Vitória", desc: "Acompanhe o patrimônio de todos em tempo real. Quem será o melhor estrategista?" },
];

const stepColors = [
  "text-green-400 border-green-500/30 bg-green-500/10",
  "text-purple-400 border-purple-500/30 bg-purple-500/10",
  "text-amber-400 border-amber-500/30 bg-amber-500/10",
  "text-blue-400 border-blue-500/30 bg-blue-500/10",
  "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "text-pink-400 border-pink-500/30 bg-pink-500/10",
  "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
];

export default function Home() {

  const vh = useViewportHeight();
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  function handleNavigate(path: string) {
    if (user) {
      const map: Record<string, string> = {
        "/sessions":    "/user/sessions",
        "/new-session": "/user/new-session",
      };
      router.push(map[path] ?? path);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }

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

  return (
    <main className="w-full bg-black pb-24 lg:pb-0">

      <LandingHeader />

      <section style={{ height: vh }} className="relative w-full bg-[url('/images/ceu-cidade-vistacima.png')] bg-bottom bg-cover bg-no-repeat z-10">
        <div className="w-full h-full flex flex-col justify-center items-center gap-6">
          <div className="flex w-full justify-center items-center font-jaro text-4xl sm:text-5xl lg:text-7xl z-20 px-4">
            <h1 className="bg-linear-to-r from-[#1F9900] via-[#33FF00] to-[#00BE39] bg-clip-text text-transparent text-shadow-sm">Game</h1>
            <h1 className="bg-linear-to-r from-[#FFA600] via-[#FFDEA1] to-[#FFA600] bg-clip-text text-transparent text-shadow-sm">₿ank</h1>
          </div>
          <p className="w-[90%] sm:w-4/5 lg:w-150 font-inconsolata text-sm sm:text-base text-center text-zinc-100 text-shadow-sm tracking-wider z-20 px-4">Seu banco dentro do tabuleiro. Controle depósitos, saques e transferências entre jogadores com agilidade e transparência.</p>

          <div className="flex flex-col justify-center items-center lg:flex-row gap-4 sm:gap-6 z-20">
            <Button1
              size="md"
              color="blue"
              handle={() => handleNavigate('/new-session')}
              className="z-20"
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Criar Nova Sessão
            </Button1>
            <Button1
              size="md"
              color="green"
              handle={() => handleNavigate('/sessions')}
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

      <section className="w-full max-w-5xl mx-auto py-16 sm:py-20 px-6">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
          <div className="flex-shrink-0 w-20 h-20 lg:w-36 lg:h-36 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 flex items-center justify-center">
            <FontAwesomeIcon icon={faBolt} className="text-3xl lg:text-5xl text-green-400" />
          </div>
          <div className="text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-jaro text-zinc-100 mb-3">
              Como Funciona?
            </h2>
            <p className="text-zinc-400 font-inconsolata text-sm sm:text-base leading-relaxed max-w-2xl">
              GameBank substitui todo o dinheiro físico, cartas de propriedade e registros do Banco Imobiliário.
              Cada jogador tem saldo digital, as propriedades são compradas com um clique, aluguéis são pagos
              automaticamente e as cartas de Sorte/Revés são sorteadas na hora. Tudo sincronizado em tempo real
              entre todos os jogadores — pelo celular, tablet ou computador.
            </p>
            <a
              href="/saibamais"
              className="inline-flex items-center gap-2 mt-4 text-green-400 hover:text-green-300 font-inconsolata text-sm transition-colors"
            >
              Saiba mais <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      <section className="w-full py-8 sm:py-12 px-4">
        <h1 className="text-green-500 text-2xl sm:text-3xl font-bold font-jaro text-center tracking-wide">Funcionalidades</h1>

        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4 mt-8 sm:mt-16">
          <CardFeatures color="purple" icon={faUsers} title="Multiplayer" description="Jogue com até 6 amigos simultaneamente, cada um com sua cor personalizada." />
          <CardFeatures color="green" icon={faDollarSign} title="Gestão Financeira" description="Sistema completo de transações, transferências e histórico detalhado." />
          <CardFeatures color="amber" icon={faHouse} title="Propriedades" description="28 propriedades baseadas no tabuleiro real com sistema de casas e hotéis." />
        </div>
      </section>

      <section className="w-full py-16 sm:py-20 px-6 bg-zinc-900/20 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-jaro text-zinc-100 mb-3">
              Como Jogar
            </h2>
            <p className="text-zinc-500 font-inconsolata text-sm sm:text-base">
              Em 7 passos simples você e seus amigos estarão jogando
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tutorialSteps.map((step, i) => (
              <div
                key={i}
                className={`rounded-xl border p-5 ${stepColors[i]} transition-all duration-200 hover:scale-[1.03]`}
              >
                <div className="flex items-start gap-4">
                  <span className={`text-2xl sm:text-3xl font-jaro font-bold opacity-30 select-none ${stepColors[i].split(" ")[0]}`}>
                    {step.num}
                  </span>
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center">
                    <FontAwesomeIcon icon={step.icon} className={`w-5 h-5 ${stepColors[i].split(" ")[0]}`} />
                  </div>
                </div>
                <h3 className={`text-base font-jaro mt-3 mb-1 ${stepColors[i].split(" ")[0]}`}>
                  {step.title}
                </h3>
                <p className="text-zinc-500 font-inconsolata text-xs leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button1 size="lg" color="green" handle={() => handleNavigate('/new-session')}>
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Criar Sala e Jogar
            </Button1>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
