"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import Loading from "@/components/Loading";
import UserAvatar from "@/components/UserAvatar";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";

import Lenis from "lenis";
import { INITIAL_BALANCE } from "@/types/game";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faUsers, faPencil, faPlus, faMinus, faLock, faDollarSign, faFlag } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import Button1 from "@/components/Button01";
import ColorDropdown from "@/components/ColorDropdown";

interface TeamForm {
  nome: string;
  cor: string;
}

export default function NewSession() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast()
  const { createSession } = useGameStore();
  const { user: authUser } = useAuthStore();

  const [reqLoading, setReqLoading] = useState(false);
  const { loadFromStorage } = useAuthStore();
  const [modo, setModo] = useState<'individual' | 'duplas'>('individual');
  const [sessionName, setSessionName] = useState("");
  const [senha, setSenha] = useState("");
  const [maxJogadores, setMaxJogadores] = useState(6);
  const [saldoInicial, setSaldoInicial] = useState(INITIAL_BALANCE);
  const [criadorTeamIndex, setCriadorTeamIndex] = useState(0);

  const [times, setTimes] = useState<TeamForm[]>([
    { nome: "Time A", cor: "red" },
    { nome: "Time B", cor: "blue" },
  ]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

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

  const handleModoChange = (newModo: 'individual' | 'duplas') => {
    setModo(newModo);
    setMaxJogadores(newModo === 'duplas' ? 8 : 6);
    if (newModo === 'individual') {
      setTimes([
        { nome: "Time A", cor: "red" },
        { nome: "Time B", cor: "blue" },
      ]);
    }
  };

  const handleTeamChange = (index: number, field: "nome" | "cor", value: string) => {
    const newTimes = [...times];
    newTimes[index] = { ...newTimes[index], [field]: value };
    setTimes(newTimes);
  };

  const handleAddTeam = () => {
    if (times.length >= 6) return;
    const colors = ["green", "yellow", "purple", "orange", "pink", "emerald", "black"];
    const newTeam: TeamForm = {
      nome: `Time ${String.fromCharCode(65 + times.length)}`,
      cor: colors[(times.length - 2) % colors.length] || "orange",
    };
    setTimes([...times, newTeam]);
  };

  const handleRemoveTeam = (index: number) => {
    if (times.length <= 2) return;
    setTimes(times.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (sessionName.trim().length < 3) {
      toastError("Nome da sessão deve ter pelo menos 3 caracteres");
      return false;
    }

    if (maxJogadores < 2) {
      toastError("Mínimo de 2 jogadores");
      return false;
    }

    if (modo === 'individual' && maxJogadores > 6) {
      toastError("Modo individual suporta no máximo 6 jogadores");
      return false;
    }

    if (modo === 'duplas' && maxJogadores > 12) {
      toastError("Modo duplas suporta no máximo 12 jogadores");
      return false;
    }

    if (modo === 'duplas') {
      for (let i = 0; i < times.length; i++) {
        if (!times[i].nome.trim()) {
          toastError(`Nome do time ${i + 1} é obrigatório`);
          return false;
        }
      }
      if (times.length < 2) {
        toastError("Modo duplas requer pelo menos 2 times");
        return false;
      }
    }

    if (saldoInicial < 1000) {
      toastError("Saldo inicial deve ser no mínimo R$ 1.000");
      return false;
    }

    return true;
  };

  const handleCreateSession = async () => {
    if (!validateForm()) return;
    if (!authUser) return;

    try {
      setReqLoading(true);

      const sessionId = await createSession(
        sessionName,
        senha || undefined,
        modo,
        maxJogadores,
        saldoInicial,
        modo === 'duplas' ? times : undefined,
        undefined,
        undefined,
        modo === 'duplas' ? criadorTeamIndex : undefined
      );
      if (sessionId) {
        toastSuccess("Sala criada com sucesso!");
        setReqLoading(false);
        router.push(`/user/game/${sessionId}`);
      } else {
        toastError("Erro ao criar sala");
      }
    } catch (error) {
      toastError("Erro ao criar sala");
      console.error("Erro ao criar sala:", error);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Link href="/user/sessions" className="mr-4">
            <button className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-green-500 transition-all cursor-pointer">
              <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5 text-zinc-400" />
            </button>
          </Link>
          <div className="w-full flex items-center">
            <div className="w-13 h-9 md:w-10 md:h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex justify-center items-center mr-4">
              <FontAwesomeIcon icon={faUsers} className="text-white text-lg lg:text-xl" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold font-jaro text-zinc-100">Nova Sala</h1>
              <p className="text-zinc-500 text-sm lg:text-base font-inconsolata">
                Configure a sala para começar uma nova partida
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold font-jaro text-zinc-100 mb-4">
              Modo de Jogo
            </h2>
            <div className="flex gap-4">
              <button
                onClick={() => handleModoChange('individual')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all cursor-pointer ${modo === 'individual'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-zinc-700 bg-zinc-950/50 hover:border-zinc-500'
                  }`}
              >
                <div className="text-lg font-semibold font-jaro text-zinc-100 mb-1">Individual</div>
                <p className="text-sm text-zinc-500 font-inconsolata">Cada jogador por si</p>
              </button>
              <button
                disabled
                className="flex-1 p-4 rounded-lg border-2 transition-all cursor-not-allowed border-zinc-800 bg-zinc-950/30 opacity-60 relative"
              >
                <div className="text-lg font-semibold font-jaro text-zinc-500 mb-1">Duplas</div>
                <p className="text-sm text-zinc-600 font-inconsolata">Jogadores em times</p>
                <span className="absolute top-2 right-2 text-xs font-inconsolata text-amber-500 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Em breve
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold font-jaro text-zinc-100 mb-2">
                <FontAwesomeIcon icon={faUsers} className="w-5 h-5 text-green-500 mr-2" />
                Seu Jogador
              </h3>
              <p className="text-zinc-500 text-sm mb-3 font-inconsolata">
                Você será o primeiro jogador da sala
              </p>
              {authUser && (
                <div className="flex items-center gap-3 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800 mb-3">
                  <UserAvatar avatarUrl={authUser.avatarUrl} avatarUpdatedAt={authUser.avatarUpdatedAt} nome={authUser.nome} size="md" />
                  <div>
                    <p className="text-zinc-100 font-inconsolata font-medium">{authUser.nome}</p>
                    <p className="text-zinc-500 text-xs font-inconsolata">Seu perfil na partida</p>
                  </div>
                </div>
              )}
              {modo === 'duplas' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-zinc-400 mb-1 font-inconsolata">Time</label>
                  <select
                    value={criadorTeamIndex}
                    onChange={(e) => setCriadorTeamIndex(Number(e.target.value))}
                    className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 font-inconsolata"
                  >
                    {times.map((t, i) => (
                      <option key={i} value={i} className="bg-zinc-950 text-zinc-100">{t.nome || `Time ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold font-jaro text-zinc-100 mb-2">
                <FontAwesomeIcon icon={faFlag} className="w-5 h-5 text-green-500 mr-2" />
                Nome da Sala
              </h3>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-zinc-600 font-inconsolata"
                placeholder="Ex: Partida da Família"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold font-jaro text-zinc-100 mb-2">
                <FontAwesomeIcon icon={faUsers} className="w-5 h-5 text-green-500 mr-2" />
                Máximo de Jogadores
              </h3>
              <p className="text-zinc-500 text-sm mb-3 font-inconsolata">
                {modo === 'duplas' ? 'Máx: 12 (6 duplas)' : 'Máx: 6'}
              </p>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setMaxJogadores(Math.max(2, maxJogadores - 1))}
                  disabled={maxJogadores <= 2}
                  className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faMinus} className="w-5 h-5 text-zinc-400" />
                </button>
                <div className="text-3xl font-bold text-green-500 w-12 text-center">
                  {maxJogadores}
                </div>
                <button
                  onClick={() => setMaxJogadores(Math.min(modo === 'duplas' ? 12 : 6, maxJogadores + 1))}
                  disabled={maxJogadores >= (modo === 'duplas' ? 12 : 6)}
                  className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPlus} className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold font-jaro text-zinc-100 mb-2">
                <FontAwesomeIcon icon={faDollarSign} className="w-5 h-5 text-green-500 mr-2" />
                Saldo Inicial
              </h3>
              <input
                type="number"
                value={saldoInicial}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  if (raw.length <= 6) setSaldoInicial(Number(raw));
                }}
                min={1000}
                step={1000}
                maxLength={6}
                className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-zinc-600 font-inconsolata"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold font-jaro text-zinc-100 mb-2">
                <FontAwesomeIcon icon={faLock} className="w-5 h-5 text-amber-500 mr-2" />
                Senha (opcional)
              </h3>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-zinc-600 font-inconsolata"
                placeholder="Deixe em branco para sala pública"
              />
            </div>
          </div>

          <div className={modo === 'duplas' ? "lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6" : "hidden"}>
            {modo === 'duplas' && (
              <>
                <h2 className="text-xl font-semibold font-jaro text-zinc-100 mb-4">
                  Configuração dos Times
                </h2>
                <p className="text-zinc-500 mb-6 font-inconsolata">
                  Crie os times da partida. Os jogadores escolherão seu time ao entrar.
                </p>

                <motion.div
                  className="space-y-4 mb-6"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {times.map((team, index) => (
                    <motion.div key={index} variants={staggerItem} layout className="p-4 border border-zinc-700 rounded-lg bg-zinc-950/50">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold font-jaro text-zinc-100">Time {index + 1}</h3>
                        {times.length > 2 && (
                          <button
                            onClick={() => handleRemoveTeam(index)}
                            className="text-red-400 hover:text-red-300 text-sm cursor-pointer"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1 font-inconsolata">Nome</label>
                          <input
                            type="text"
                            value={team.nome}
                            onChange={(e) => handleTeamChange(index, "nome", e.target.value)}
                            className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 focus:border-green-500 focus:outline-none text-sm"
                            placeholder="Nome do time"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1 font-inconsolata">Cor</label>
                          <ColorDropdown
                            value={team.cor as any}
                            onChange={(color) => handleTeamChange(index, "cor", color)}
                            availableColors={['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'emerald'] as any}
                            placeholder="Cor"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                {times.length < 6 && (
                  <button
                    onClick={handleAddTeam}
                    className="w-full py-2 rounded-lg border border-dashed border-zinc-600 text-zinc-400 hover:border-green-500 hover:text-green-500 transition-all cursor-pointer font-inconsolata"
                  >
                    + Adicionar Time
                  </button>
                )}
              </>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold font-jaro text-zinc-100 mb-4">
              Resumo
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-inconsolata">Modo:</span>
                <span className="text-lg font-semibold text-zinc-100 font-inconsolata capitalize">{modo}</span>
              </div>

              {modo === 'duplas' && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-inconsolata">Times:</span>
                  <span className="text-lg font-semibold text-zinc-100 font-inconsolata">{times.length}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-inconsolata">Máx. Jogadores:</span>
                <span className="text-lg font-semibold text-zinc-100 font-inconsolata">{maxJogadores}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-inconsolata">Saldo inicial:</span>
                <span className="text-lg font-semibold text-green-400 font-inconsolata">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(saldoInicial)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-inconsolata">Protegida:</span>
                <span className="text-lg font-semibold text-zinc-100 font-inconsolata">{senha ? "Sim" : "Não"}</span>
              </div>
            </div>

            <Button1
              size="full"
              color="green"
              handle={reqLoading ? undefined : handleCreateSession}
              className="w-full mt-6"
            >
              Criar Sala
            </Button1>
          </div>
        </div>
      </div>
      {reqLoading && <Loading label="Criando sala..." />}
    </div>
  );
}
