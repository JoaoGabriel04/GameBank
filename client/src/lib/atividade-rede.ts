"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Contador de requisições da API em andamento (interceptors do axios em
// services/api). Alimenta a barra de progresso do topo.

let pendentes = 0;
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((f) => f());
}

export function requisicaoIniciou() {
  pendentes += 1;
  avisar();
}

export function requisicaoTerminou() {
  pendentes = Math.max(0, pendentes - 1);
  avisar();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** Quantas requisições estão em andamento agora. */
export function useRequisicoesAtivas() {
  return useSyncExternalStore(assinar, () => pendentes, () => 0);
}

/** true quando há requisição em andamento há mais de `aposMs`. */
export function useRedeLenta(aposMs = 500) {
  const ativas = useSyncExternalStore(assinar, () => pendentes, () => 0);
  const [lenta, setLenta] = useState(false);
  useEffect(() => {
    if (ativas === 0) {
      setLenta(false);
      return;
    }
    const t = setTimeout(() => setLenta(true), aposMs);
    return () => clearTimeout(t);
  }, [ativas > 0, aposMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return lenta;
}
