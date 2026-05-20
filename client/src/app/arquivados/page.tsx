"use client";
import Modal from "@/components/Modal";
import { useGameStore } from "@/stores/gameStore";
import {
  DollarSign,
  Gamepad2,
  GamepadIcon,
  House,
  Play,
  Users,
} from "lucide-react";
import Link from "next/link";
import { SVGProps, useEffect, useState } from "react";

export default function Home() {
  const [sessionsModal, setSessionsModal] = useState(false);

  const { getSessions, sessions } = useGameStore();

  useEffect(() => {
    // Buscar sessões do backend quando o componente monta
    const fetchSessions = async () => {
      await getSessions();
    };
    fetchSessions();
  }, [getSessions]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activeSessions = sessions ?? [];
  if (process.env.NODE_ENV === "development") {
    console.log("Sessões ativas:", activeSessions);
  }

  return (
    <main className="w-full min-h-screen flex flex-col py-4 px-4 lg:px-10 bg-indigo-100/40">
      <header className="w-full flex flex-col items-center py-4">
        <div className="w-20 h-20 p-3 bg-gradient-to-b from-[#003CFF] to-[#D600F3] rounded-full">
          <Gamepad2 className="w-full h-full text-zinc-50" />
        </div>
        <h1 className="text-4xl font-jaro font-bold mt-4 tracking-wide text-zinc-100">
          Super<span className="text-purple-400">Máquina</span>
        </h1>
        <p className="w-full lg:w-[500px] text-center mt-4 text-zinc-400 font-inconsolata">
          O jogo de tabuleiro digital que transforma suas partidas em
          experiências inesquecíveis. Gerencie propriedades, negocie com amigos
          e construa seu império imobiliário!
        </p>
      </header>

      <section className="w-full flex flex-col items-center mt-10">
        <div className="w-full lg:w-[500px] h-[300px] flex flex-col items-center justify-center gap-2 px-10 bg-zinc-800 shadow-lg rounded-lg border border-zinc-700">
          <h1 className="text-zinc-300 mt-[-24px]">Crie um novo jogo</h1>
          <Link
            href="/new-session"
            className="w-full flex items-center justify-center gap-3 py-2 bg-green-600 hover:bg-green-700 text-zinc-100 font-semibold rounded cursor-pointer transition-colors"
          >
            <Play />
            Criar Jogo
          </Link>
          <h1 className="text-zinc-300 mt-6">
            Carregue um jogo em andamento
          </h1>
          <button
            onClick={() => setSessionsModal(true)}
            className="w-full flex items-center justify-center gap-3 py-2 bg-blue-600 hover:bg-blue-700 text-zinc-100 font-semibold rounded cursor-pointer transition-colors"
          >
            <Play />
            Carregar Jogo
          </button>

          <Link href={"/tests/home"} className="mt-4 text-zinc-400 hover:text-zinc-200 hover:underline transition-all">Área de Testes</Link>
        </div>

        <h1 className="mt-10 text-xl font-semibold text-zinc-300">
          Funcionalidades
        </h1>

        <div className="w-full lg:grid grid-cols-3 justify-between mt-10 gap-6">
          <FeatureCard
            Icon={Users}
            colorClass="bg-purple-700/20"
            iconColor="text-purple-700"
            title="Multiplayer"
            description="Jogue com até 6 amigos simultaneamente, cada um com sua cor personalizada"
          />
          <FeatureCard
            Icon={DollarSign}
            colorClass="bg-green-500/20"
            iconColor="text-green-700"
            title="Gestão Financeira"
            description="Sistema completo de transações, transferências e histórico detalhado"
          />
          <FeatureCard
            Icon={House}
            colorClass="bg-orange-600/20"
            iconColor="text-orange-600"
            title="Propriedades"
            description="22 propriedades baseadas no Rio de Janeiro com sistema de casas e hotéis"
          />
        </div>
      </section>

      <footer className="w-full h-25 flex flex-col justify-center items-center mt-10 border-t border-zinc-800 text-zinc-500 text-sm text-center font-inconsolata">
        <span>SuperMáquina - Versão Digital do Clássico Jogo de Tabuleiro</span>
        <span>v1.2.6</span>
      </footer>

      <Modal
        isOpen={sessionsModal}
        onClose={() => setSessionsModal(false)}
        title="Sessões Ativas"
        size="md"
      >
        {activeSessions.length > 0 ? (
          <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
            {activeSessions.map((session) => (
              <Link key={session.id} href={`/game/${session.id}`}>
                <div className="p-4 border border-zinc-700 rounded-lg hover:border-purple-500 hover:bg-zinc-800/50 transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-100">
                        {session.nome}
                      </h3>
                      <div className="flex items-center text-sm text-zinc-400 mt-1">
                        <Users className="w-4 h-4 mr-1" />
                        {session.jogadores.length} jogadores
                        <span className="mx-2">•</span>
                        <span>{formatDate(session.dataInicio)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-zinc-400">
                        {session.historico.length} transações
                      </div>
                      <div className="text-sm text-zinc-400">
                        {session.sessionPosses && session.sessionPosses.length > 0
                          ? `${
                              session.sessionPosses.filter((p) => p.playerId)
                                .length
                            } propriedades vendidas`
                          : "0 propriedades vendidas"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="bg-zinc-800 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <GamepadIcon className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-2">
              Sem jogos em andamento
            </h3>
            <p className="text-zinc-400 mb-4">
              Crie uma nova sessão para começar a jogar com seus amigos!
            </p>
            <button
              disabled
              className="bg-zinc-700 text-zinc-500 px-6 py-2 rounded-lg cursor-not-allowed"
            >
              Nenhum Jogo Ativo
            </button>
          </div>
        )}
      </Modal>
    </main>
  );
}

// Componente reutilizável para cards de funcionalidade
interface FeatureCardProps {
  Icon: React.ComponentType<SVGProps<SVGSVGElement>>;
  colorClass: string;
  iconColor: string;
  title: string;
  description: string;
}
function FeatureCard({
  Icon,
  colorClass,
  iconColor,
  title,
  description,
}: FeatureCardProps) {
  return (
    <div className="w-full flex flex-col gap-2 items-center">
      <div
        className={`w-20 h-20 p-4 flex justify-center items-center ${colorClass} rounded-full`}
      >
        <Icon className={`w-full h-full ${iconColor}`} />
      </div>
      <h1 className="text-xl font-semibold mt-4 text-zinc-200">{title}</h1>
      <p className="w-2/3 text-center text-zinc-400">{description}</p>
    </div>
  );
}
