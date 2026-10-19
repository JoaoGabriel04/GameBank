"use client";

import { useGameStore } from "@/stores/gameStore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listarHistoricoApi } from "@/services/api/historico";
import type { Transacao } from "@/types/game";
import { withTimeout } from "@/utils/withTimeout";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export default function Historico() {
  const currentSession = useGameStore((s) => s.currentSession);
  const sessionId = currentSession?.id;
  const [termoPesquisa, setTermoPesquisa] = useState("");
  // Páginas buscadas sob demanda: o payload da sessão só traz as últimas
  // entradas (as mais novas continuam chegando ao vivo por ele).
  const [carregados, setCarregados] = useState<Transacao[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (antesDe?: number) => {
    if (!sessionId) return;
    setCarregando(true);
    setErro(null);
    try {
      const pagina = await withTimeout(listarHistoricoApi(sessionId, antesDe), 15000);
      setCarregados((prev) => (antesDe ? [...prev, ...pagina.itens] : pagina.itens));
      setCursor(pagina.proximoCursor);
      setTemMais(pagina.proximoCursor != null);
    } catch {
      setErro("Não foi possível carregar o histórico — tente de novo.");
    } finally {
      setCarregando(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setCarregados([]);
    setCursor(null);
    setTemMais(false);
    carregar();
  }, [carregar]);

  const historicoFiltradoEOrdenado = useMemo(() => {
    const porId = new Map<number, Transacao>();
    for (const t of carregados) porId.set(t.id, t);
    for (const t of currentSession?.historico ?? []) porId.set(t.id, t);

    const termo = termoPesquisa.toLowerCase();
    const filtrado = [...porId.values()].filter((transacao) =>
      transacao.detalhes.toLowerCase().includes(termo) ||
      transacao.tipo.toLowerCase().includes(termo) ||
      String(transacao.id).includes(termo)
    );

    // Mais recentes primeiro
    return filtrado.sort((a, b) => b.id - a.id);
  }, [carregados, currentSession?.historico, termoPesquisa]);

  return (
    <main>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Pesquisar no histórico por ID, tipo ou detalhes..."
          value={termoPesquisa}
          onChange={(e) => setTermoPesquisa(e.target.value)}
          className="w-full p-2 border border-zinc-700 bg-zinc-800 text-zinc-100 rounded-md placeholder:text-zinc-500"
        />
      </div>
      {historicoFiltradoEOrdenado.length > 0 ? (
        <Table>
          <TableCaption>Histórico de Transações</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Detalhes</TableHead>
              <TableHead className="text-right">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historicoFiltradoEOrdenado.map((transacao) => (
              <TableRow key={transacao.id}>
                <TableCell className="font-medium">{transacao.id}</TableCell>
                <TableCell>{transacao.tipo}</TableCell>
                <TableCell>{transacao.detalhes}</TableCell>
                <TableCell className="text-right">{new Date(transacao.data).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : !carregando && (
        <p className="text-center text-zinc-500 mt-4">
          Nenhuma transação encontrada para a sua pesquisa.
        </p>
      )}

      {erro && (
        <p className="text-center text-red-400 text-sm mt-4">{erro}</p>
      )}
      {(temMais || erro) && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => carregar(cursor ?? undefined)}
            disabled={carregando}
            className="px-4 py-2 rounded-md border border-zinc-700 bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {carregando ? "Carregando..." : erro ? "Tentar de novo" : "Carregar mais antigos"}
          </button>
        </div>
      )}
      {carregando && !temMais && !erro && (
        <p className="text-center text-zinc-500 text-sm mt-4">Carregando histórico...</p>
      )}
    </main>
  );
}
