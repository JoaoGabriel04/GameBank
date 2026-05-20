"use client";

import ColorDropdown from "@/components/ColorDropdown";
import Loading from "@/components/Loading";
import { useGameStore } from "@/stores/gameStore";
import Lenis from "lenis";
import {
  INITIAL_BALANCE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  PlayerColor,
} from "@/types/game";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faUsers, faPencil, faPlus, faMinus } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import Button1 from "@/components/Button01";

interface PlayerForm {
  nome: string;
  cor: PlayerColor | null;
  saldo: number;
}

export default function NewSession() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast()
  const { createSession } = useGameStore();

  const [reqLoading, setReqLoading] = useState(false);

  const [numPlayers, setNumPlayers] = useState(2);
  const [sessionName, setSessionName] = useState("");
  const [players, setPlayers] = useState<PlayerForm[]>([
    { nome: "", cor: null, saldo: 0 },
    { nome: "", cor: null, saldo: 0 },
  ]);

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

  const handleNumPlayersChange = (newNum: number) => {
    if (newNum < MIN_PLAYERS || newNum > MAX_PLAYERS) return;

    setNumPlayers(newNum);

    if (newNum > players.length) {
      const newPlayers = [...players];
      for (let i = players.length; i < newNum; i++) {
        newPlayers.push({ nome: "", cor: null, saldo: 0 });
      }
      setPlayers(newPlayers);
    } else if (newNum < players.length) {
      setPlayers(players.slice(0, newNum));
    }
  };

  const handlePlayerChange = (
    index: number,
    field: "nome" | "cor",
    value: string | PlayerColor
  ) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...newPlayers[index], [field]: value };
    setPlayers(newPlayers);
  };

  const getAvailableColorsForPlayer = (playerIndex: number): PlayerColor[] => {
    const usedColors = players
      .filter((_, index) => index !== playerIndex)
      .map((p) => p.cor)
      .filter(Boolean) as PlayerColor[];

    const allColors: PlayerColor[] = [
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
      "black",
      "orange",
      "pink",
      "emerald",
    ];

    return allColors.filter((color) => !usedColors.includes(color));
  };

  const validateForm = (): boolean => {
    if (sessionName.trim().length < 3) {
      toastError("Nome da sessão deve ter pelo menos 3 caracteres");
      return false;
    }

    for (let i = 0; i < numPlayers; i++) {
      if (!players[i]?.nome.trim()) {
        toastError(`Nome do jogador ${i + 1} é obrigatório`);
        return false;
      }
    }

    for (let i = 0; i < numPlayers; i++) {
      if (!players[i]?.cor) {
        toastError(`Cor do jogador ${i + 1} é obrigatória`);
        return false;
      }
    }

    const names = players
      .slice(0, numPlayers)
      .map((p) => p.nome.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      toastError("Não pode haver nomes duplicados");
      return false;
    }

    const colors = players
      .slice(0, numPlayers)
      .map((p) => p.cor)
      .filter(Boolean);
    const uniqueColors = new Set(colors);
    if (colors.length !== uniqueColors.size) {
      toastError("Não pode haver cores duplicadas");
      return false;
    }

    return true;
  };

  const handleCreateSession = async () => {
    if (!validateForm()) return;

    const validPlayers = players.slice(0, numPlayers).map((p) => ({
      nome: p.nome.trim(),
      cor: p.cor!,
      saldo: 25000,
    }));

    try {
      setReqLoading(true);
      const sessionId = await createSession(sessionName, validPlayers);
      if (sessionId) {
        toastSuccess("Sessão criada com sucesso!");
        setReqLoading(false);
        router.push(`/game/${sessionId}`);
      } else {
        toastError("Erro ao criar sessão");
      }
    } catch (error) {
      toastError("Erro ao criar sessão");
      console.error("Erro ao criar sessão:", error);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Link href="/sessions" className="mr-4">
            <button className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-green-500 transition-all cursor-pointer">
              <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5 text-zinc-400" />
            </button>
          </Link>
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex justify-center items-center mr-4">
              <FontAwesomeIcon icon={faUsers} className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-jaro text-zinc-100">Nova Sessão</h1>
<p className="text-zinc-500 font-inconsolata">
              Configure os jogadores para começar uma nova partida
            </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center mb-4">
              <FontAwesomeIcon icon={faUsers} className="w-6 h-6 text-green-500 mr-2" />
              <h2 className="text-xl font-semibold font-jaro text-zinc-100">
                Número de Jogadores
              </h2>
            </div>
            <p className="text-zinc-500 mb-6 font-inconsolata">
              Escolha quantos jogadores participarão da partida
            </p>

            <div className="flex items-center justify-center space-x-4 mb-6">
              <button
                onClick={() => handleNumPlayersChange(numPlayers - 1)}
                disabled={numPlayers <= MIN_PLAYERS}
                className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faMinus} className="w-5 h-5 text-zinc-400" />
              </button>

              <div className="text-center">
                <div className="text-4xl font-bold text-green-500 mb-1">
                  {numPlayers}
                </div>
                <div className="text-sm text-zinc-500 font-inconsolata">
                  Mínimo: {MIN_PLAYERS} • Máximo: {MAX_PLAYERS}
                </div>
              </div>

              <button
                onClick={() => handleNumPlayersChange(numPlayers + 1)}
                disabled={numPlayers >= MAX_PLAYERS}
                className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faPlus} className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div>
              <h1 className="text-xl font-semibold font-jaro text-zinc-100 mb-2">
                <FontAwesomeIcon icon={faPencil} className="w-5 h-5 text-green-500 mr-2" />
                Nome da Sessão
              </h1>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-zinc-600 font-inconsolata"
                placeholder="Digite o nome da sessão"
              />
            </div>
          </div>

          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold font-jaro text-zinc-100 mb-4">
              Configuração dos Jogadores
            </h2>
            <p className="text-zinc-500 mb-6 font-inconsolata">
              Defina o nome e a cor de cada jogador
            </p>

            <div className="space-y-6">
              {Array.from({ length: numPlayers }).map((_, index) => {
                const playerColorInfo = players[index]?.cor
                  ? PLAYER_COLORS.find((c) => c.value === players[index].cor)
                  : null;

                return (
                  <div
                    key={index}
                    className="p-4 border border-zinc-700 rounded-lg bg-zinc-950/50"
                  >
                    <h3 className="font-semibold font-jaro text-zinc-100 mb-4">
                      Jogador {index + 1}
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1 font-inconsolata">
                          Nome
                        </label>
                        <input
                          type="text"
                          value={players[index]?.nome || ""}
                          onChange={(e) =>
                            handlePlayerChange(index, "nome", e.target.value)
                          }
                          className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-zinc-600 font-inconsolata"
                          placeholder="Digite o nome do jogador"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1 font-inconsolata">
                          Cor
                        </label>
                        <ColorDropdown
                          value={players[index]?.cor || null}
                          onChange={(color: PlayerColor) =>
                            handlePlayerChange(index, "cor", color)
                          }
                          availableColors={getAvailableColorsForPlayer(index)}
                          placeholder="Selecione uma cor"
                        />
                      </div>
                    </div>

                    {players[index]?.nome && playerColorInfo && (
                      <div className="mt-4 p-3 bg-zinc-800 rounded-lg">
                        <div className="flex items-center">
                          <div
                            className={`w-8 h-8 rounded-full ${playerColorInfo.bg} mr-3 flex items-center justify-center`}
                          >
                            <span className="text-white text-sm font-bold">
                              {players[index].nome.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-zinc-100 font-inconsolata">
                              {players[index].nome}
                            </p>
                            <p className="text-sm text-zinc-500 font-inconsolata">
                              Saldo inicial:{" "}
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(INITIAL_BALANCE)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold font-jaro text-zinc-100 mb-4">
              Resumo da Sessão
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-inconsolata">Jogadores:</span>
                <span className="text-lg font-semibold text-zinc-100 font-inconsolata">{numPlayers}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-inconsolata">Saldo inicial:</span>
                <span className="text-lg font-semibold text-green-400 font-inconsolata">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(INITIAL_BALANCE)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-inconsolata">Propriedades:</span>
                <span className="text-lg font-semibold text-zinc-100 font-inconsolata">28 disponíveis</span>
              </div>
            </div>

            <Button1
              size="full"
              color="green"
              handle={reqLoading ? undefined : handleCreateSession}
              className="w-full mt-6"
            >
              Iniciar Jogo
            </Button1>
          </div>
        </div>
      </div>
      {reqLoading && <Loading label="Carregando..." />}
    </div>
  );
}