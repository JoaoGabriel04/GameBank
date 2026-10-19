import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "./logger.js";

// Coalescência de broadcasts (OTIMIZACAO_SISTEMA.md, P1.3).
//
// Uma jogada chamava emitUpdatedSession várias vezes (mover, resolver casa,
// avançar turno), e cada chamada reconstruía a sessão inteira do banco e a
// mandava para a sala. Dentro de um escopo (o withLock mais externo), os
// emits entram numa fila em ordem; no fim do escopo — antes de soltar o
// lock e, portanto, antes da resposta HTTP — a fila é descarregada:
// snapshots CONSECUTIVOS da mesma sessão viram um só, carregado com o
// estado final. Um evento entre dois snapshots (ex.: "evento:mudou") mantém
// os dois, então a ordem que o cliente vê não muda. Fora de um escopo,
// tudo é emitido na hora, como antes.

type Item =
  | { tipo: "snapshot"; sessionId: number }
  | { tipo: "evento"; enviar: () => void };

const contexto = new AsyncLocalStorage<Item[]>();

/** Emite já ou, dentro de um escopo, enfileira na ordem. */
export function emitirOuEnfileirar(enviar: () => void) {
  const fila = contexto.getStore();
  if (fila) fila.push({ tipo: "evento", enviar });
  else enviar();
}

/** Dentro de um escopo, enfileira o snapshot e devolve true; fora, false. */
export function enfileirarSnapshot(sessionId: number): boolean {
  const fila = contexto.getStore();
  if (!fila) return false;
  const ultimo = fila[fila.length - 1];
  if (!(ultimo?.tipo === "snapshot" && ultimo.sessionId === sessionId)) {
    fila.push({ tipo: "snapshot", sessionId });
  }
  return true;
}

/**
 * Roda `fn` com uma fila de emits e a descarrega no fim (também em caso de
 * erro: o estado pode ter mudado antes da falha). Aninhado em outro escopo,
 * só repassa — quem descarrega é o mais externo.
 */
export async function comFilaDeEmits<T>(
  fn: () => Promise<T>,
  emitirSnapshot: (sessionId: number) => Promise<void>
): Promise<T> {
  if (contexto.getStore()) return fn();
  const fila: Item[] = [];
  try {
    return await contexto.run(fila, fn);
  } finally {
    for (const item of fila) {
      try {
        if (item.tipo === "snapshot") await emitirSnapshot(item.sessionId);
        else item.enviar();
      } catch (err) {
        logger.error({ err }, "falha ao descarregar emit enfileirado");
      }
    }
  }
}
