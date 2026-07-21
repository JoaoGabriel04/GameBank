"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/utils/format";
import { apiErrMsg } from "@/lib/api-error";
import {
  getEstadoMapa2DApi,
  comprarTerrenoMapa2DApi,
  construirMapa2DApi,
  precificarMapa2DApi,
  type EstadoMapa2D,
  type SessionTerrenoMapa2D,
  type TipoConstrucaoMapa2D,
} from "@/services/api/mapa2d";

const CATEGORIA_COR: Record<string, string> = {
  comum: "bg-green-900/40 border-green-700 hover:border-green-500",
  mediana: "bg-blue-900/40 border-blue-700 hover:border-blue-500",
  rica: "bg-amber-900/40 border-amber-600 hover:border-amber-400",
};

const TIPOS_CONSTRUCAO: { tipo: TipoConstrucaoMapa2D; label: string }[] = [
  { tipo: "casa", label: "Casa" },
  { tipo: "sobrado", label: "Sobrado" },
  { tipo: "comercio", label: "Comércio" },
  { tipo: "apartamento", label: "Apartamento" },
  { tipo: "centro_comercial", label: "Centro Comercial" },
  { tipo: "hotel", label: "Hotel" },
  { tipo: "corporativo", label: "Prédio Corporativo" },
];

function useCountdown(fecharMesEm: string | null) {
  const [restanteMs, setRestanteMs] = useState(0);
  useEffect(() => {
    if (!fecharMesEm) return;
    const alvo = new Date(fecharMesEm).getTime();
    const tick = () => setRestanteMs(Math.max(0, alvo - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fecharMesEm]);
  const totalSegundos = Math.floor(restanteMs / 1000);
  const min = Math.floor(totalSegundos / 60);
  const seg = totalSegundos % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

interface Props {
  sessionId: number;
}

export default function Mapa2DShell({ sessionId }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [estado, setEstado] = useState<EstadoMapa2D | null>(null);
  const [selecionado, setSelecionado] = useState<SessionTerrenoMapa2D | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [aluguelInput, setAluguelInput] = useState("");

  const carregar = useCallback(async () => {
    try {
      const data = await getEstadoMapa2DApi(sessionId);
      setEstado(data);
      if (selecionado) {
        const atualizado = data.terrenos.find((t) => t.id === selecionado.id);
        setSelecionado(atualizado ?? null);
      }
    } catch (err) {
      toastError(apiErrMsg(err, "Erro ao carregar o mapa"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 5000);
    return () => clearInterval(id);
  }, [carregar]);

  const timer = useCountdown(estado?.fecharMesEm ?? null);
  const eu = estado?.jogadores.find((j) => j.id === estado.voceEId);

  const handleComprar = async (terrenoId: number) => {
    setActionLoading(true);
    try {
      await comprarTerrenoMapa2DApi(sessionId, terrenoId);
      toastSuccess("Terreno comprado!");
      await carregar();
    } catch (err) {
      toastError(apiErrMsg(err, "Erro ao comprar terreno"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConstruir = async (sessionTerrenoId: number, tipo: TipoConstrucaoMapa2D) => {
    setActionLoading(true);
    try {
      await construirMapa2DApi(sessionId, sessionTerrenoId, tipo);
      toastSuccess("Construção iniciada!");
      await carregar();
    } catch (err) {
      toastError(apiErrMsg(err, "Erro ao construir"));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrecificar = async (construcaoId: number) => {
    const valor = Number(aluguelInput);
    if (!Number.isFinite(valor) || valor < 0) {
      toastError("Valor de aluguel inválido.");
      return;
    }
    setActionLoading(true);
    try {
      await precificarMapa2DApi(sessionId, construcaoId, Math.round(valor));
      toastSuccess("Aluguel atualizado!");
      setAluguelInput("");
      await carregar();
    } catch (err) {
      toastError(apiErrMsg(err, "Erro ao precificar"));
    } finally {
      setActionLoading(false);
    }
  };

  if (!estado) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* HUD superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-4 font-inconsolata text-sm">
          <span className="text-zinc-400">Saldo: <span className="text-green-400 font-bold">R$ {formatCurrency(eu?.saldo ?? 0)}</span></span>
          <span className="text-zinc-400">Mês: <span className="text-zinc-100 font-bold">{estado.mesAtual}/24</span></span>
        </div>
        <div className="font-jaro text-amber-400 text-lg tabular-nums">⏱ {timer}</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Grid de terrenos (placeholder — sem tiles, Fatia 4) */}
        <div className="flex-1 grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-1.5">
          {estado.terrenos.map((st) => {
            const dono = estado.jogadores.find((j) => j.id === st.donoId);
            const isMine = st.donoId === estado.voceEId;
            return (
              <button
                key={st.id}
                onClick={() => setSelecionado(st)}
                title={`${st.terreno.regiaoNome} — ${st.terreno.codigo}`}
                className={`aspect-square rounded border text-[9px] font-inconsolata p-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${CATEGORIA_COR[st.terreno.categoria]} ${
                  selecionado?.id === st.id ? "ring-2 ring-white" : ""
                } ${isMine ? "ring-2 ring-green-400" : ""}`}
              >
                <span className="text-zinc-300 truncate w-full text-center">{st.terreno.codigo.split("-")[0]}</span>
                {st.construcao && <span className="text-[8px]">🏠</span>}
                {dono && <span className="text-[7px] text-zinc-400 truncate w-full text-center">{dono.nome}</span>}
              </button>
            );
          })}
        </div>

        {/* Painel lateral */}
        <div className="w-full lg:w-80 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          {!selecionado ? (
            <p className="text-zinc-500 font-inconsolata text-sm text-center py-8">
              Clique em um terreno para ver detalhes.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="font-jaro text-zinc-100 text-lg">{selecionado.terreno.regiaoNome}</h3>
                <p className="text-zinc-500 font-inconsolata text-xs">{selecionado.terreno.codigo} · {selecionado.terreno.categoria}</p>
              </div>

              {selecionado.donoId == null ? (
                <div className="space-y-2">
                  <p className="font-inconsolata text-sm text-zinc-300">Preço: R$ {formatCurrency(selecionado.terreno.precoBase)}</p>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleComprar(selecionado.terrenoId)}
                    className="w-full py-2 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-jaro text-sm cursor-pointer"
                  >
                    Comprar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-inconsolata text-sm text-zinc-300">
                    Dono: {estado.jogadores.find((j) => j.id === selecionado.donoId)?.nome ?? "?"}
                  </p>

                  {!selecionado.construcao ? (
                    selecionado.donoId === estado.voceEId ? (
                      <div className="space-y-1.5">
                        <p className="font-inconsolata text-xs text-zinc-500">Construir:</p>
                        {TIPOS_CONSTRUCAO.map(({ tipo, label }) => (
                          <button
                            key={tipo}
                            disabled={actionLoading}
                            onClick={() => handleConstruir(selecionado.id, tipo)}
                            className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-inconsolata text-xs cursor-pointer text-left px-3"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 font-inconsolata text-xs">Terreno vazio.</p>
                    )
                  ) : (
                    <div className="space-y-2">
                      <p className="font-inconsolata text-sm text-zinc-300 capitalize">
                        {selecionado.construcao.tipo.replace("_", " ")} — nível {selecionado.construcao.nivel}
                      </p>
                      <p className={`font-inconsolata text-xs ${selecionado.construcao.ocupado ? "text-green-400" : "text-red-400"}`}>
                        {selecionado.construcao.ocupado ? "Ocupado" : "Vazio"} · Aluguel: R$ {formatCurrency(selecionado.construcao.aluguelPedido)}
                      </p>

                      {selecionado.donoId === estado.voceEId && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            value={aluguelInput}
                            onChange={(e) => setAluguelInput(e.target.value)}
                            placeholder="Novo aluguel"
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-inconsolata text-zinc-100"
                          />
                          <button
                            disabled={actionLoading}
                            onClick={() => handlePrecificar(selecionado.construcao!.id)}
                            className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-jaro text-xs cursor-pointer"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
