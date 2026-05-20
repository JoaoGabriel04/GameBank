"use client";

import Banco from "@/components/Banco";
import Especiais from "@/components/Especiais";
import Inicio from "@/components/Inicio";
import Propriedades from "@/components/Propriedades";
import { useGameStore } from "@/stores/gameStore";
import { useSession } from "@/hooks/useApi";
import { Menu } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import Historico from "@/components/Historico";
import Modal from "@/components/Modal";
import Link from "next/link";
import Loading from "@/components/Loading";
import Button1 from "@/components/Button01";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPowerOff } from "@fortawesome/free-solid-svg-icons";

const linksNav = ["Início", "Banco", "Propriedades", "Especiais", "Histórico"];

export default function Game() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [abaAtual, setAbaAtual] = useState("Início");
  const [endLoading, setEndLoading] = useState(false);
  const [menuModal, setMenuModal] = useState(false);

  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId ? Number(params.sessionId) : null;

  // SWR busca e mantém a sessão atualizada via API
  const { session: swrSession, isLoading } = useSession(sessionId);

  // Store Zustand — usada pelos componentes filhos
  const { currentSession, endSession } = useGameStore();

  // ─── Ponte SWR → Zustand ──────────────────────────────────────────────────
  // Sempre que o SWR trouxer uma sessão nova (incluindo no refresh),
  // sincroniza com a store para que os filhos enxerguem currentSession.
  useEffect(() => {
    if (swrSession) {
      useGameStore.setState({ currentSession: swrSession });
    }
  }, [swrSession]);

  // Restaura a aba salva no localStorage
  useEffect(() => {
    setAbaAtual(localStorage.getItem("abaAtual") || "Início");
  }, []);

  // Redireciona se não encontrar sessão após o fetch terminar
  useEffect(() => {
    if (isLoading) return;
    if (!swrSession) {
      if (endLoading) return;
      toastError("Sessão não encontrada");
      router.push("/");
    }
  }, [isLoading, swrSession, router, endLoading, toastError]);

  const handleEndGame = async () => {
    if (!currentSession) return;
    if (!window.confirm("Tem certeza que deseja finalizar este jogo? Esta ação não pode ser desfeita."))
      return;
    setEndLoading(true);
    await endSession(currentSession.id);
    toastSuccess("Jogo finalizado com sucesso!");
    setEndLoading(false);
    router.push("/");
  };

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const renderConteudo = () => {
    switch (abaAtual) {
      case "Início":       return <Inicio />;
      case "Banco":        return <Banco />;
      case "Propriedades": return <Propriedades />;
      case "Especiais":    return <Especiais />;
      case "Histórico":    return <Historico />;
      default:             return <Inicio />;
    }
  };

  if (isLoading || !currentSession) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p className="text-zinc-400">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full flex flex-col px-4 pb-6 min-h-screen bg-zinc-950">
      <header className="w-full py-2 flex flex-col items-center">
        <Link
          href={"/"}
          className="mt-4 text-4xl font-jaro font-bold bg-linear-to-r from-green-500 to-amber-400 bg-clip-text text-transparent"
        >
          GameBank
        </Link>

        <div className="w-full flex lg:flex-col justify-between items-center mt-4 lg:mt-1">
          <div className="w-full flex lg:justify-end items-center space-x-3">
            <Button1
              size="lg"
              color="red"
              handle={endLoading ? undefined : handleEndGame}
              disabled={endLoading}
              className="flex flex-row gap-2"
            >
              <FontAwesomeIcon icon={faPowerOff} className="mr-2" />
              Finalizar
            </Button1>
          </div>

          <nav className="w-full mt-10 hidden lg:flex">
            <ul className="w-full grid grid-cols-5 justify-center">
              {linksNav.map((link, index) => (
                <li
                  key={index}
                  onClick={() => {
                    localStorage.setItem("abaAtual", link);
                    setAbaAtual(link);
                  }}
                  className={`h-10 flex justify-center items-center hover:bg-green-500/20 text-lg font-inconsolata transition-colors cursor-pointer ${
                    abaAtual === link
                      ? "border-b border-green-500/50 font-bold text-green-400"
                      : "text-zinc-500"
                  }`}
                >
                  {link}
                </li>
              ))}
            </ul>
          </nav>

          <button onClick={() => setMenuModal(true)} className="lg:hidden">
            <Menu className="w-8 h-8 text-zinc-300" />
          </button>
        </div>
      </header>

      <section className="mt-8">
        <div className="w-full flex flex-col my-4 border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-jaro font-semibold text-zinc-100">
            {currentSession.nome}
          </h1>
          <p className="text-zinc-400 font-inconsolata">
            {formatDate(currentSession.dataInicio)} - Jogadores:{" "}
            {currentSession.jogadores.length}
          </p>
        </div>

        {renderConteudo()}
      </section>

      <Modal
        size="md"
        title="Menu"
        isOpen={menuModal}
        onClose={() => setMenuModal(false)}
      >
        <ul className="w-full grid grid-rows-5 justify-center">
          {linksNav.map((link, index) => (
            <li
              key={index}
              onClick={() => {
                localStorage.setItem("abaAtual", link);
                setAbaAtual(link);
                setMenuModal(false);
              }}
              className={`h-10 flex justify-center items-center hover:bg-purple-500/20 transition-colors cursor-pointer font-jaro ${
                abaAtual === link
                  ? "border-b border-purple-500 font-bold text-purple-400"
                  : "text-zinc-500"
              }`}
            >
              {link}
            </li>
          ))}
        </ul>
      </Modal>

      {endLoading && <Loading label="Finalizando..." />}
    </main>
  );
}