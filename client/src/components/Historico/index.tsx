"use client";

import { useGameStore } from "@/stores/gameStore";
import { useMemo, useState } from "react";
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
  const { currentSession } = useGameStore();
  const [termoPesquisa, setTermoPesquisa] = useState("");

  // Lê o histórico diretamente da sessão e memoriza a ordenação
  const historicoFiltradoEOrdenado = useMemo(() => {
    if (!currentSession?.historico) return [];

    const historico = [...currentSession.historico];

    const filtrado = historico.filter((transacao) => {
      const termo = termoPesquisa.toLowerCase();
      return (
        transacao.detalhes.toLowerCase().includes(termo) ||
        transacao.tipo.toLowerCase().includes(termo) ||
        String(transacao.id).includes(termo)
      );
    });

    // Cria uma cópia e ordena de forma decrescente para mostrar os mais recentes primeiro
    return filtrado.sort((a, b) => b.id - a.id);
  }, [currentSession?.historico, termoPesquisa]);

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
      ) : (
        <p className="text-center text-zinc-500 mt-4">
          Nenhuma transação encontrada para a sua pesquisa.
        </p>
      )}
    </main>
  );
}
