'use client'

import { useState } from "react";
import Button1 from "@/components/Button01";
import { useSessions } from "@/hooks/useApi"
import Modal from "@/components/Modal";
import { sessionsApi } from "@/services/api/sessions";
import { setRoomToken } from "@/stores/roomTokenStore";
import Lenis from "lenis";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faUsers, faClock, faLock, faUsersGear, faGamepad } from "@fortawesome/free-solid-svg-icons"
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Footer from "@/components/Footer";

import type { GameSession } from "@/types/game";

import { useAuthStore } from "@/stores/authStore";
import UserAvatar from "@/components/UserAvatar";

export default function Sessions() {
  const router = useRouter();
  const { sessions, isLoading, mutate } = useSessions()
  const { user: authUser } = useAuthStore();
  const [joinModal, setJoinModal] = useState<{ open: boolean; session: GameSession | null }>({ open: false, session: null });
  const [password, setPassword] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>(undefined);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);

  useEffect(() => {
    if (authUser?.isAdmin) { router.replace("/admin/sessoes"); return; }
    if (!authUser) return;
    sessionsApi.getMyActive()
      .then(res => {
        const s = res.data?.session;
        if (s && s.id) {
          router.replace(`/game/${s.id}`);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingActive(false));
  }, [authUser, router]);

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

  function handleClickSession(session: GameSession) {
    setJoinError("");
    setPassword("");
    setSelectedTeamId(undefined);
    setJoinAsSpectator(false);
    setJoinModal({ open: true, session });
  }

  async function handleJoin() {
    const session = joinModal.session;
    if (!session) return;
    if (!authUser) return;

    setJoinLoading(true);
    setJoinError("");

    try {
      const res = await sessionsApi.join(session.id, {
        senha: password || undefined,
        nome: authUser.nome,
        teamId: selectedTeamId,
        spectator: joinAsSpectator || undefined,
      });
      const roomToken = res.data?.roomToken;
      if (roomToken) {
        setRoomToken(roomToken);
      }
      setJoinModal({ open: false, session: null });
      mutate();
      router.push(`/game/${session.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao entrar na sala";
      setJoinError(msg);
    } finally {
      setJoinLoading(false);
    }
  }

  const activeSessions = sessions ?? []

  return (

    <main className="w-full bg-black pb-24 lg:pb-0">
      
      

      <section className="w-full min-h-[calc(100vh-200px)] py-16 lg:py-20 px-10">
        <div className="flex flex-col items-center mb-10">
          <h1 className="text-green-500 text-4xl font-bold font-jaro text-center tracking-wide mb-4">Salas</h1>
          <p className="text-zinc-400 text-center mb-6 font-inconsolata">Entre em uma sala ou crie uma nova partida</p>
          <Button1
            size="md"
            color="green"
            handle={() => router.push('/user/new-session')}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Criar Sala
          </Button1>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        ) : activeSessions.length > 0 ? (
          <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleClickSession(session)}
                className="w-full p-6 bg-zinc-900 border-2 border-zinc-800 hover:border-green-500 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-jaro text-zinc-100 group-hover:text-green-400 transition-colors flex items-center gap-2">
                    {session.protegida && <FontAwesomeIcon icon={faLock} className="w-4 h-4 text-amber-500" />}
                    {session.nome}
                  </h2>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-inconsolata">
                      {session.jogadores.length}/{session.maxJogadores || "?"}
                    </span>
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-inconsolata capitalize">
                      {session.modo}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-zinc-500 text-sm mb-4 font-inconsolata">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faUsers} className="text-sm" />
                    <span className="font-inconsolata">{session.jogadores.length} jogadores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faClock} className="text-sm" />
                    <span className="font-inconsolata">{formatDate(session.dataInicio)}</span>
                  </div>
                </div>

                <div className="w-full h-px bg-zinc-800 mb-4"></div>

                <div className="flex justify-between text-sm text-zinc-500 font-inconsolata">
                  <span>
                    {session.modo === 'duplas' ? `${session.times?.length || 0} times` : `${session.historico.length} transações`}
                  </span>
                  <span className="group-hover:text-green-400 transition-colors font-inconsolata">
                    Entrar →
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
              <FontAwesomeIcon icon={faUsers} className="text-4xl text-zinc-600" />
            </div>
            <h2 className="text-2xl font-jaro text-zinc-300 mb-2">Nenhuma sala encontrada</h2>
            <p className="text-zinc-500 font-inconsolata">Crie uma nova sala para começar a jogar!</p>
          </div>
        )}
      </section>

      <Modal
        isOpen={joinModal.open}
        onClose={() => setJoinModal({ open: false, session: null })}
        title={`Entrar em "${joinModal.session?.nome || ""}"`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {joinError && (
            <p className="text-red-400 text-sm font-inconsolata bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {joinError}
            </p>
          )}

          {authUser && (
            <div className="flex items-center gap-3 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800">
              <UserAvatar avatarUrl={authUser.avatarUrl} avatarUpdatedAt={authUser.avatarUpdatedAt} nome={authUser.nome} size="md" />
              <div>
                <p className="text-zinc-100 font-inconsolata font-medium">{authUser.nome}</p>
                <p className="text-zinc-500 text-xs font-inconsolata">Entrar com este perfil</p>
              </div>
            </div>
          )}

          {joinModal.session?.protegida && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 font-inconsolata">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha da sala"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-4 py-3 text-zinc-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-zinc-600 font-inconsolata"
              />
            </div>
          )}

          {joinModal.session?.modo === 'duplas' && joinModal.session?.times && joinModal.session.times.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 font-inconsolata">Time</label>
              <select
                value={selectedTeamId ?? ''}
                onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-4 py-3 text-zinc-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 font-inconsolata"
              >
                <option value="" className="bg-zinc-950 text-zinc-500">Selecione um time</option>
                {joinModal.session.times.map((team) => {
                  const count = joinModal.session!.jogadores.filter(j => j.teamId === team.id).length;
                  return (
                    <option key={team.id} value={team.id} className="bg-zinc-950 text-zinc-100">
                      {team.nome} ({count} jogador{count !== 1 ? 'es' : ''})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={joinAsSpectator}
              onChange={(e) => setJoinAsSpectator(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500 cursor-pointer"
            />
            <span className="text-sm font-inconsolata text-zinc-400">Entrar como espectador</span>
          </label>

          <div className="flex gap-3 mt-2">
            <Button1
              size="md"
              color="green"
              handle={joinLoading ? undefined : handleJoin}
            >
              {joinLoading ? "Entrando..." : "Entrar"}
            </Button1>
            <Button1
              size="md"
              color="red"
              handle={() => setJoinModal({ open: false, session: null })}
            >
              Cancelar
            </Button1>
          </div>
        </div>
      </Modal>

      <Footer />
    </main>

  )
}
