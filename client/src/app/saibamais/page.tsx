/* eslint-disable */
'use client'

import LandingHeader from "@/components/LandingHeader";
import Footer from "@/components/Footer";
import Button1 from "@/components/Button01";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faBuilding,
  faBolt,
  faMobileScreen,
  faChartLine,
  faHandshake,
  faGamepad,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useEffect } from "react";

const features = [
  {
    icon: faBuilding,
    title: "Propriedades Digitais",
    desc: "Compre, venda e gerencie 28 propriedades com preços, aluguéis e hipotecas 100% digitais. Nunca mais perca uma nota de dinheiro.",
    color: "green",
  },
  {
    icon: faUsers,
    title: "Multiplayer em Tempo Real",
    desc: "Jogue com até 6 amigos (ou 6 duplas) simultaneamente. Tudo sincronizado via WebSocket — saldo, propriedades e transações.",
    color: "purple",
  },
  {
    icon: faBolt,
    title: "Automático e Instantâneo",
    desc: "Cartas de Sorte/Reves são sorteadas e aplicadas automaticamente. Aluguéis são transferidos na hora. Sem contas manuais.",
    color: "amber",
  },
  {
    icon: faChartLine,
    title: "Ranking em Tempo Real",
    desc: "Acompanhe o patrimônio de todos os jogadores: saldo + valor das propriedades + casas construídas. Veja quem está na frente.",
    color: "blue",
  },
  {
    icon: faHandshake,
    title: "Negociação Entre Jogadores",
    desc: "Troque propriedades e dinheiro com outros jogadores de forma segura. Propostas com timeout de 60 segundos para resposta.",
    color: "pink",
  },
  {
    icon: faMobileScreen,
    title: "Jogue de Qualquer Lugar",
    desc: "Acesse pelo navegador do celular, tablet ou computador. Design responsivo pensado para jogar no sofá com os amigos.",
    color: "emerald",
  },
];

const colorMap: Record<string, { text: string; bg: string; border: string; iconBg: string }> = {
  green:   { text: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30",   iconBg: "bg-green-500/20" },
  purple:  { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30",  iconBg: "bg-purple-500/20" },
  amber:   { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   iconBg: "bg-amber-500/20" },
  blue:    { text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    iconBg: "bg-blue-500/20" },
  pink:    { text: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30",    iconBg: "bg-pink-500/20" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", iconBg: "bg-emerald-500/20" },
};

export default function SaibaMais() {
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  function handleNavigate(path: string) {
    if (user) {
      router.push(path);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }

  return (
    <main className="w-full bg-black pb-24 lg:pb-0">
      <LandingHeader />

      <section className="relative w-full pt-32 pb-16 sm:pt-40 sm:pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.08)_0%,_transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-jaro font-bold mb-6">
            <span className="bg-linear-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Saiba Mais
            </span>
          </h1>
          <p className="text-zinc-400 font-inconsolata text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            O GameBank é o gerenciador financeiro digital definitivo para suas partidas de 
            Banco Imobiliário. Diga adeus ao dinheiro de papel e às contas na ponta do lápis.
          </p>
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto px-6 pb-8">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 sm:p-10">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-20 h-20 lg:w-32 lg:h-32 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
              <FontAwesomeIcon icon={faBolt} className="text-3xl lg:text-5xl text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-jaro text-zinc-100 mb-3">O que é o GameBank?</h2>
              <p className="text-zinc-400 font-inconsolata leading-relaxed text-sm sm:text-base">
                GameBank é uma plataforma web que substitui todo o dinheiro físico, cartas de propriedade,
                contratos e registros do Banco Imobiliário. Cada jogador tem um saldo digital, as propriedades
                são compradas com um clique, os aluguéis são pagos automaticamente e as cartas de Sorte/Reves
                são sorteadas e aplicadas na hora. Tudo em tempo real, sincronizado entre todos os jogadores.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-jaro text-zinc-100 text-center mb-12">
          Por que usar o{" "}
          <span className="bg-linear-to-r from-green-400 to-amber-400 bg-clip-text text-transparent">GameBank</span>?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const c = colorMap[f.color];
            return (
              <div
                key={i}
                className={`rounded-xl border ${c.border} ${c.bg} p-6 flex flex-col items-start gap-4 transition-all duration-200 hover:scale-[1.02]`}
              >
                <div className={`w-12 h-12 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                  <FontAwesomeIcon icon={f.icon} className={`text-xl ${c.text}`} />
                </div>
                <h3 className={`text-lg font-jaro ${c.text}`}>{f.title}</h3>
                <p className="text-zinc-400 font-inconsolata text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="w-full bg-zinc-900/30 border-t border-zinc-800 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-jaro text-zinc-100 mb-4">Pronto para jogar?</h2>
          <p className="text-zinc-400 font-inconsolata mb-8">
            Crie sua conta, monte uma sala com os amigos e descubra uma nova forma de jogar Banco Imobiliário.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button1 size="lg" color="green" handle={() => handleNavigate("/sessions")}>
              <FontAwesomeIcon icon={faGamepad} className="mr-2" />
              Ver Salas Disponíveis
            </Button1>
            <Button1 size="lg" color="blue" handle={() => handleNavigate("/new-session")}>
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Criar Nova Sala
            </Button1>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
