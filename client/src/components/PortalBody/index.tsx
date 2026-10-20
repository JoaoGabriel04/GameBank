"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Renderiza no document.body. Overlays fixos (modais) precisam disso: um
// ancestral com transform (transição de página, troca de seção animada)
// vira o bloco de contenção do position:fixed, e o modal passa a se
// posicionar por ele, não pela tela. No body também ficam fora de qualquer
// stacking context dos pais (ver o comentário no TurnoModal).
export default function PortalBody({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
