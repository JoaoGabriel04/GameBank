"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { curvaCss, distancia, duracaoMs } from "@/lib/motion";
import { useMotionPrefs } from "@/lib/motion/prefs";
import { direcaoEntre, type Direcao } from "./rotas";
import BarraProgresso from "@/components/BarraProgresso";
import { useRedeLenta, useRequisicoesAtivas } from "@/lib/atividade-rede";

// Transição entre as páginas da área logada (layout (main)). Adaptado da
// transição "suave" do SkillHub (components/motion/page-transition.tsx),
// com uma diferença importante: aqui a navegação NÃO espera a saída. O
// push sai junto com a animação de saída (150 ms); se a página nova chegar
// antes, a saída é interrompida e a entrada começa na hora.
//
// O App Router troca os filhos assim que a rota muda, então a saída não pode
// ser feita com AnimatePresence (ela animaria a página nova saindo). Ela
// roda no clique, sobre o conteúdo atual; a entrada roda quando o pathname
// muda (useLayoutEffect, antes de pintar, para a página nova não piscar).
//
// Rede de segurança: se a rota não mudar em LIMITE_MS (clique num link que
// não navegou, navegação cancelada), o conteúdo volta a aparecer.

const LIMITE_MS = 1500;
// Teto para considerar a navegação em curso (barra e pílula do menu).
const NAVEGACAO_MAX_MS = 10_000;
// Logo após a troca de rota, a página nova costuma buscar dados: qualquer
// requisição nessa janela mantém a barra, sem apagar e reacender.
const POS_NAVEGACAO_MS = 800;

// Quadros por direção. Irmãs: sem deslocamento, só uma escala sutil.
function quadrosSaida(dir: Direcao, comMovimento: boolean): Keyframe[] {
  const fim = !comMovimento ? "none" : dir === 0 ? "scale(0.99)" : `translateX(${-dir * (distancia.sm / 2)}px)`;
  return [{ opacity: 1, transform: "none" }, { opacity: 0, transform: fim }];
}
function quadrosEntrada(dir: Direcao, comMovimento: boolean): Keyframe[] {
  const inicio = !comMovimento ? "none" : dir === 0 ? "scale(0.99)" : `translateX(${dir * distancia.sm}px)`;
  return [{ opacity: 0, transform: inicio }, { opacity: 1, transform: "none" }];
}

// Web Animations API direta, não o animate() do Framer: cancel() tira o
// efeito na hora sem deixar estilo inline, e nada sobra no fim. Um
// transform que sobrasse no wrapper (mesmo translateX(0)) viraria bloco de
// contenção para os position:fixed de dentro (modais e sheets das páginas).
function animar(el: HTMLElement, quadros: Keyframe[], duracao: number, easing: string, fill: FillMode) {
  const anim = el.animate(quadros, { duration: duracao, easing, fill });
  // Resolve o tempo já: o primeiro quadro vale neste mesmo frame, sem piscar.
  anim.currentTime = 0;
  return anim;
}

type Ctx = {
  /** Navega com a transição (para botões; links já são interceptados). */
  navegar: (href: string) => void;
  /** Destino de uma navegação em curso (os menus marcam o item já no clique). */
  destino: string | null;
};

const TransicaoCtx = createContext<Ctx | null>(null);
const TransicaoConteudoCtx = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

function pathnameDe(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export function TransicaoPaginaProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { nivel } = useMotionPrefs();
  const nivelRef = useRef(nivel);
  nivelRef.current = nivel;

  const conteudoRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const limiteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navegacaoMaxRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [posNavegacao, setPosNavegacao] = useState(false);
  const primeiraRef = useRef(true);
  const anteriorRef = useRef(pathname);
  const [destino, setDestino] = useState<string | null>(null);
  const redeLenta = useRedeLenta();
  const requisicoesAtivas = useRequisicoesAtivas();

  // Traz o conteúdo atual de volta. A navegação pode seguir em curso (rede
  // lenta): destino e barra continuam até a rota mudar ou NAVEGACAO_MAX_MS.
  const reaparecer = useCallback(() => {
    const el = conteudoRef.current;
    const saida = animRef.current;
    if (!el || !saida) return;
    const opacidade = getComputedStyle(el).opacity;
    saida.cancel();
    animRef.current = animar(el, [{ opacity: opacidade }, { opacity: 1 }], duracaoMs.fast, curvaCss.easeOut, "backwards");
  }, []);

  const iniciarSaida = useCallback(
    (href: string) => {
      const alvo = pathnameDe(href);
      if (!alvo || alvo === window.location.pathname) return;
      setDestino(alvo);

      const el = conteudoRef.current;
      if (el && nivelRef.current !== "desligado") {
        animRef.current?.cancel();
        animRef.current = animar(
          el,
          quadrosSaida(direcaoEntre(window.location.pathname, alvo), nivelRef.current === "completo"),
          duracaoMs.saida,
          curvaCss.easeIn,
          "forwards"
        );
      }
      if (limiteRef.current) clearTimeout(limiteRef.current);
      limiteRef.current = setTimeout(reaparecer, LIMITE_MS);
      if (navegacaoMaxRef.current) clearTimeout(navegacaoMaxRef.current);
      navegacaoMaxRef.current = setTimeout(() => setDestino(null), NAVEGACAO_MAX_MS);
    },
    [reaparecer]
  );

  const navegar = useCallback(
    (href: string) => {
      iniciarSaida(href);
      router.push(href);
    },
    [iniciarSaida, router]
  );

  // Links internos (<Link> do Next ou <a>): a saída começa no clique e o
  // próprio Link faz o push. Captura, porque o Link chama preventDefault.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      if (a.getAttribute("href")?.startsWith("#")) return;
      iniciarSaida(a.href);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [iniciarSaida]);

  // Página nova montou: entrada.
  useLayoutEffect(() => {
    const de = anteriorRef.current;
    anteriorRef.current = pathname;
    if (primeiraRef.current) {
      primeiraRef.current = false;
      return;
    }
    if (limiteRef.current) clearTimeout(limiteRef.current);
    if (navegacaoMaxRef.current) clearTimeout(navegacaoMaxRef.current);
    setDestino(null);
    setPosNavegacao(true);

    const el = conteudoRef.current;
    animRef.current?.cancel();
    animRef.current = null;
    const n = nivelRef.current;
    if (!el || n === "desligado") return;
    // Calculada da rota anterior: cobre também o voltar do navegador.
    animRef.current = animar(
      el,
      quadrosEntrada(direcaoEntre(de, pathname), n === "completo"),
      n === "completo" ? duracaoMs.base : duracaoMs.fast,
      curvaCss.easeOut,
      "backwards"
    );
  }, [pathname]);

  useEffect(() => {
    if (!posNavegacao) return;
    const t = setTimeout(() => setPosNavegacao(false), POS_NAVEGACAO_MS);
    return () => clearTimeout(t);
  }, [posNavegacao]);

  useEffect(
    () => () => {
      animRef.current?.cancel();
      if (limiteRef.current) clearTimeout(limiteRef.current);
      if (navegacaoMaxRef.current) clearTimeout(navegacaoMaxRef.current);
    },
    []
  );

  return (
    <TransicaoCtx.Provider value={{ navegar, destino }}>
      <BarraProgresso ativa={destino !== null || redeLenta || (posNavegacao && requisicoesAtivas > 0)} />
      {/* O conteúdo da página fica num wrapper animável; menus ficam fora. */}
      <TransicaoConteudoCtx.Provider value={conteudoRef}>{children}</TransicaoConteudoCtx.Provider>
    </TransicaoCtx.Provider>
  );
}

/** Envolve só o conteúdo da página (não os menus): é ele que entra e sai. */
export function ConteudoDaPagina({ children }: { children: ReactNode }) {
  const ref = useContext(TransicaoConteudoCtx);
  return <div ref={ref} data-conteudo-pagina="">{children}</div>;
}

export function useTransicaoPagina() {
  const ctx = useContext(TransicaoCtx);
  if (!ctx) throw new Error("useTransicaoPagina precisa do TransicaoPaginaProvider");
  return ctx;
}

/** Rota que os menus marcam como ativa: o destino durante a transição, senão a atual. */
export function useNavPathname() {
  const { destino } = useTransicaoPagina();
  const pathname = usePathname();
  return destino ?? pathname;
}
