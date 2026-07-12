"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { backdrop, modalBox } from "@/lib/animations";
import { useToast } from "@/components/Toast";
import { getLimiteApi, pegarEmprestimoApi, quitarEmprestimoApi, type LimiteData } from "@/services/api/emprestimos";
import { formatCurrency } from "@/utils/format";
import { LoaderCircle, Banknote, AlertTriangle } from "lucide-react";

interface EmprestimoModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number;
  onSuccess: () => void;
}

export default function EmprestimoModal({ isOpen, onClose, sessionId, onSuccess }: EmprestimoModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [data, setData] = useState<LimiteData | null>(null);
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setValor(0);
    getLimiteApi(sessionId)
      .then(setData)
      .catch(() => error("Erro ao carregar limite de crédito."))
      .finally(() => setLoading(false));
  }, [isOpen, sessionId, error]);

  const handlePegar = async () => {
    if (valor <= 0 || !data || valor > data.limite) return;
    setReqLoading(true);
    try {
      await pegarEmprestimoApi(sessionId, valor);
      success(`Empréstimo de R$ ${formatCurrency(valor)} concedido!`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao pegar empréstimo.";
      error(msg);
    } finally {
      setReqLoading(false);
    }
  };

  const handleQuitar = async () => {
    setReqLoading(true);
    try {
      const result = await quitarEmprestimoApi(sessionId);
      success(`Empréstimo quitado por R$ ${formatCurrency((result as { valorPago?: number })?.valorPago ?? 0)}!`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao quitar empréstimo.";
      error(msg);
    } finally {
      setReqLoading(false);
    }
  };

  const projecao = data?.projecao ?? [];
  const projecaoDisplay = projecao.filter((_, i) => [0, 2, 4, 6].includes(i));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
            variants={modalBox}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 rounded-t-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="text-lg font-jaro text-zinc-100">Empréstimo Bancário</h2>
            </div>

            <div className="p-6 space-y-5">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoaderCircle className="w-8 h-8 text-zinc-400 animate-spin" />
                </div>
              ) : data?.temEmprestimoAtivo && data.emprestimoAtivo ? (
                /* ── Já tem empréstimo ativo ── */
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                    <p className="text-sm font-inconsolata text-zinc-300">
                      <span className="text-zinc-500">Devido agora:</span>{" "}
                      <span className="text-amber-400 font-semibold">R$ {formatCurrency(data.emprestimoAtivo.valorDevido)}</span>
                    </p>
                    <p className="text-sm font-inconsolata text-zinc-300">
                      <span className="text-zinc-500">Valor original:</span> R$ {formatCurrency(data.emprestimoAtivo.valorOriginal)}
                    </p>
                    <p className="text-xs font-inconsolata text-zinc-500">
                      Juros de {(data.jurosPct * 100).toFixed(0)}% por rodada (compostos)
                    </p>
                  </div>

                  <button
                    onClick={handleQuitar}
                    disabled={reqLoading}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white font-jaro text-sm rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {reqLoading ? "Quitando..." : "Quitar Empréstimo"}
                  </button>
                </div>
              ) : (
                /* ── Novo empréstimo ── */
                <div className="space-y-4">
                  {/* Limite */}
                  <div className="p-4 bg-zinc-800/50 rounded-xl">
                    <p className="text-sm font-inconsolata text-zinc-400">Seu limite</p>
                    <p className="text-2xl font-jaro text-green-400">
                      R$ {formatCurrency(data?.limite ?? 0)}
                    </p>
                    <p className="text-xs font-inconsolata text-zinc-600 mt-1">
                      50% do valor das propriedades não hipotecadas
                    </p>
                  </div>

                  {/* Garantia */}
                  {data?.garantia && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-sm font-jaro text-rose-400">Garantia</span>
                      </div>
                      <p className="text-sm font-inconsolata text-zinc-200">
                        {data.garantia.nome} ({data.garantia.casas} casa(s))
                      </p>
                      <p className="text-xs font-inconsolata text-zinc-500">
                        Sua propriedade que mais rende. Se você falir, o banco toma ela.
                      </p>
                    </div>
                  )}

                  {/* Valor input */}
                  <div>
                    <label className="text-sm font-inconsolata text-zinc-400 mb-2 block">Valor do empréstimo</label>
                    <input
                      type="number"
                      min={0}
                      max={data?.limite ?? 0}
                      value={valor || ""}
                      onChange={(e) => setValor(Math.min(Number(e.target.value), data?.limite ?? 0))}
                      placeholder="R$ 0"
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 font-inconsolata text-lg outline-none focus:border-green-500/50 transition-colors"
                    />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {[1000, 5000, 10000, 25000].map((v) => (
                        <button
                          key={v}
                          onClick={() => setValor(Math.min(v, data?.limite ?? Infinity))}
                          className="px-3 py-1 text-xs font-inconsolata bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors cursor-pointer"
                        >
                          R$ {formatCurrency(v)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Projeção de juros */}
                  {projecaoDisplay.length > 0 && (
                    <div className="p-4 bg-zinc-800/50 rounded-xl space-y-2">
                      <p className="text-sm font-jaro text-amber-400">
                        📈 Projeção de juros ({(data?.jurosPct ?? 0) * 100}% por rodada):
                      </p>
                      <div className="space-y-1">
                        {projecaoDisplay.map((p) => (
                          <div key={p.rodada} className="flex justify-between text-sm font-inconsolata">
                            <span className="text-zinc-400">Rodada {p.rodada}:</span>
                            <span className="text-zinc-200">R$ {formatCurrency(p.valor)}</span>
                          </div>
                        ))}
                      </div>
                      {data && (
                        <p className="text-xs font-inconsolata text-zinc-600 mt-1">
                          Após {projecao.length} rodadas: R$ {formatCurrency(projecao[projecao.length - 1]?.valor ?? 0)} (quase dobrou)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Botão */}
                  <button
                    onClick={handlePegar}
                    disabled={reqLoading || !data || valor <= 0 || valor > data.limite}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-jaro text-sm rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {reqLoading ? "Processando..." : "Pegar Empréstimo"}
                  </button>

                  {(!data || data.limite <= 0) && (
                    <p className="text-xs font-inconsolata text-zinc-500 text-center">
                      Você precisa de propriedades livres para usar como garantia.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
