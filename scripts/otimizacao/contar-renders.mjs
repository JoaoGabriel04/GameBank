#!/usr/bin/env node
// Fase 5 (P2.3): conta re-renders por componente na tela de jogo enquanto
// medir-partida.mjs joga, sem tocar no código do app. Instala um stub do
// __REACT_DEVTOOLS_GLOBAL_HOOK__ antes de a página carregar: a cada commit,
// percorre a árvore e conta os componentes que renderizaram de fato (flag
// PerformedWork, como as React DevTools — bailouts e memo não contam).
// Usar contra o servidor de DEV (nomes de componente não minificados).
//
//   CREDENCIAIS_ARQ=/repo/cred.json node scripts/otimizacao/medir-partida.mjs &
//   docker run --rm --network host -v "$PWD:/repo" -w /repo <imagem com chromium> \
//     node scripts/otimizacao/contar-renders.mjs /repo/cred.json
// Variáveis: BASE (default http://localhost:3000), CHROME_PATH, DURACAO_S (60).
// Abre a partida com o bot 2: o socket do bot 1 é o que o driver usa para
// ler o estado, e o servidor derruba sockets repetidos do mesmo usuário.

import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [arq] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3000";
const DURACAO_S = Number(process.env.DURACAO_S ?? 60);
const PORTA = 9224;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STUB = `(() => {
  const contagem = {};
  let commits = 0;
  const nome = (t) => t && (t.displayName || t.name);
  function visitar(raiz) {
    const pilha = [raiz];
    while (pilha.length) {
      const f = pilha.pop();
      if (!f) continue;
      const n = typeof f.type === "function" ? nome(f.type)
        : f.type && typeof f.type === "object" ? nome(f.type.type || f.type.render) : null;
      // Mesmo critério das React DevTools: renderizou neste commit se tem a
      // flag PerformedWork (1). Subárvore reaproveitada por bailout
      // (child === alternate.child) não foi tocada — não desce nela.
      if (n && (f.flags & 1) === 1) contagem[n] = (contagem[n] || 0) + 1;
      if (f.sibling) pilha.push(f.sibling);
      const reaproveitada = f.alternate && f.child === f.alternate.child;
      if (f.child && !reaproveitada) pilha.push(f.child);
    }
  }
  window.__renders = contagem;
  window.__commits = () => commits;
  window.__zerarRenders = () => { for (const k in contagem) delete contagem[k]; commits = 0; };
  const renderers = new Map();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, isDisabled: false, renderers,
    inject(r) { const id = renderers.size + 1; renderers.set(id, r); return id; },
    onCommitFiberRoot(_id, root) { commits++; try { visitar(root.current); } catch {} },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, onScheduleFiberRoot() {},
    checkDCE() {},
  };
})();`;

const chrome = spawn(process.env.CHROME_PATH ?? "chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  `--remote-debugging-port=${PORTA}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "renders-"))}`, "about:blank",
], { stdio: "ignore" });

function conectar(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pendentes = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d.result); pendentes.delete(d.id); }
  };
  return new Promise((r) => {
    ws.onopen = () => r({
      enviar: (method, params = {}) => new Promise((ok) => { pendentes.set(++id, ok); ws.send(JSON.stringify({ id, method, params })); }),
      fechar: () => ws.close(),
    });
  });
}
const avaliar = async (cdp, expr) => (await cdp.enviar("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.value;

try {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${PORTA}/json/version`); break; } catch { await sleep(200); }
  }
  const { sessionId, credenciais } = JSON.parse(readFileSync(arq, "utf8"));
  const alvo = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?${BASE}/login`, { method: "PUT" })).json();
  const cdp = await conectar(alvo.webSocketDebuggerUrl);
  await cdp.enviar("Page.enable");
  await cdp.enviar("Runtime.enable");
  await cdp.enviar("Page.addScriptToEvaluateOnNewDocument", { source: STUB });
  await sleep(4000);
  const { token, user } = credenciais[1];
  await avaliar(cdp, `localStorage.setItem("jwt_token", ${JSON.stringify(token)}); localStorage.setItem("jwt_user", ${JSON.stringify(JSON.stringify(user))}); true`);
  await cdp.enviar("Page.navigate", { url: `${BASE}/user/game/${sessionId}` });
  await sleep(20000); // carga inicial (dev compila sob demanda)
  await avaliar(cdp, "window.__zerarRenders(); true");
  await sleep(DURACAO_S * 1000);
  const renders = await avaliar(cdp, "JSON.stringify(window.__renders)");
  const commits = await avaliar(cdp, "window.__commits()");
  cdp.fechar();

  const lista = Object.entries(JSON.parse(renders)).sort((a, b) => b[1] - a[1]);
  const total = lista.reduce((s, [, n]) => s + n, 0);
  console.log(`Re-renders em ${DURACAO_S}s de partida (bot 2, sessão ${sessionId}): ${commits} commits, ${total} renders de componente.\n`);
  console.log("| Componente | Renders |");
  console.log("|---|---|");
  for (const [n, c] of lista.slice(0, Number(process.env.TOP ?? 25))) console.log(`| ${n} | ${c} |`);
} finally {
  chrome.kill("SIGKILL");
}
