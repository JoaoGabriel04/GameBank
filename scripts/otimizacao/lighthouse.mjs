#!/usr/bin/env node
// Lighthouse mobile (perfil padrão: Moto G Power emulado + 4G lento
// simulado) nas telas principais, já autenticado (docs/geral/
// OTIMIZACAO_SISTEMA.md, Etapa 0, item 5).
//
// Roda dentro de um container descartável com Chromium (o Chromium do
// Playwright no WSL não tem as libs de sistema), com --network host para
// a origem ser http://localhost:3000 (a única aceita pelo CORS do server):
//
//   docker run --rm --network host -v "$PWD:/repo" -w /repo node:22-bookworm \
//     bash -c "apt-get update -qq && apt-get install -y -qq chromium >/dev/null \
//       && CHROME_PATH=/usr/bin/chromium node scripts/otimizacao/lighthouse.mjs /repo/partida.json"
//
// O primeiro argumento é a saída de medir-partida.mjs (usa o token do bot 1
// e o sessionId para abrir a tela de jogo). Saída: tabela markdown.

import { spawn, execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [arqPartida] = process.argv.slice(2);
const partida = JSON.parse(readFileSync(arqPartida, "utf8"));
const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "chromium";
const PORTA = 9222;
const RODADAS = Number(process.env.LH_RODADAS ?? 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const perfil = mkdtempSync(join(tmpdir(), "lh-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, "about:blank",
], { stdio: "ignore" });

async function cdp(url, comandos) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pendentes = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d); pendentes.delete(d.id); }
  };
  const enviar = (method, params = {}) => new Promise((r) => {
    pendentes.set(++id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
  for (const [m, p] of comandos) await enviar(m, p);
  ws.close();
}

async function autenticar() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${PORTA}/json/version`); break; } catch { await sleep(200); }
  }
  const alvo = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?${BASE}/login`, { method: "PUT" })).json();
  await sleep(3000);
  const { token, user } = partida.credenciais[0];
  const js = `localStorage.setItem("jwt_token", ${JSON.stringify(token)});` +
    `localStorage.setItem("jwt_user", ${JSON.stringify(JSON.stringify(user))});`;
  await cdp(alvo.webSocketDebuggerUrl, [["Runtime.evaluate", { expression: js }]]);
  await fetch(`http://127.0.0.1:${PORTA}/json/close/${alvo.id}`);
}

// --disable-storage-reset (necessário para manter o token no localStorage)
// também desliga a limpeza do cache HTTP do Lighthouse — sem isto, as
// execuções medem cache quente (JS/imagens com 0 bytes transferidos).
async function limparCache() {
  const alvo = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?about:blank`, { method: "PUT" })).json();
  await cdp(alvo.webSocketDebuggerUrl, [["Network.enable", {}], ["Network.clearBrowserCache", {}]]);
  await fetch(`http://127.0.0.1:${PORTA}/json/close/${alvo.id}`);
}

function medir(url) {
  const saida = mkdtempSync(join(tmpdir(), "lhr-"));
  execFileSync("npx", [
    "-y", "lighthouse@12.8.2", url, `--port=${PORTA}`, "--disable-storage-reset",
    "--only-categories=performance", "--output=json", `--output-path=${join(saida, "r.json")}`, "--quiet",
  ], { stdio: ["ignore", "ignore", "inherit"] });
  const r = JSON.parse(readFileSync(join(saida, readdirSync(saida)[0]), "utf8"));
  const a = r.audits;
  const reqs = a["network-requests"]?.details?.items ?? [];
  const soma = (tipo) => reqs.filter((x) => x.resourceType === tipo).reduce((s, x) => s + (x.transferSize ?? 0), 0);
  const maiores = [...reqs].sort((x, y) => (y.transferSize ?? 0) - (x.transferSize ?? 0)).slice(0, 6)
    .map((x) => `${new URL(x.url).pathname.split("/").pop() || x.url} (${x.resourceType}, ${((x.transferSize ?? 0) / 1024).toFixed(0)} KB)`);
  // Elemento de LCP (para saber o que otimizar): o snippet do nó.
  const lcpItens = a["largest-contentful-paint-element"]?.details?.items ?? [];
  const lcpNo = lcpItens.flatMap((i) => i.items ?? [i]).find((i) => i.node)?.node;
  return {
    maiores,
    lcpElemento: lcpNo ? `${lcpNo.snippet?.slice(0, 140)}` : "?",
    url: r.finalDisplayedUrl,
    score: Math.round((r.categories.performance.score ?? 0) * 100),
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    js: soma("Script"),
    img: soma("Image"),
    midia: soma("Media"),
    total: a["total-byte-weight"].numericValue,
  };
}

const mediana = (arr) => [...arr].sort((x, y) => x - y)[Math.floor(arr.length / 2)];

try {
  await autenticar();
  const paginas = [
    ["/login", "/login"],
    ["/user", "/user"],
    ["/user/loja", "/user/loja"],
    ["Tela de jogo", `/user/game/${partida.sessionId}`],
  ];
  console.log(`Lighthouse ${RODADAS}x por página (mediana), mobile padrão (Moto G Power, 4G lento simulado), cache HTTP limpo antes de cada execução.\n`);
  console.log("| Página | URL final | Score | FCP (s) | LCP (s) | TBT (ms) | CLS | JS (KB) | Imagens (KB) | Mídia (KB) | Total (KB) |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
  const maioresPorPagina = [];
  for (const [nome, caminho] of paginas) {
    const rs = [];
    for (let i = 0; i < RODADAS; i++) {
      await limparCache();
      rs.push(medir(BASE + caminho));
    }
    const m = (k) => mediana(rs.map((r) => r[k]));
    const final = new URL(rs[0].url).pathname;
    maioresPorPagina.push(`- **${nome}**: ${rs[0].maiores.join(", ")}\n  - LCP: \`${rs[0].lcpElemento}\``);
    console.log(`| ${nome} | ${final} | ${m("score")} | ${(m("fcp") / 1000).toFixed(1)} | ${(m("lcp") / 1000).toFixed(1)} | ${m("tbt").toFixed(0)} | ${m("cls").toFixed(3)} | ${(m("js") / 1024).toFixed(0)} | ${(m("img") / 1024).toFixed(0)} | ${(m("midia") / 1024).toFixed(0)} | ${(m("total") / 1024).toFixed(0)} |`);
  }
  console.log("\nMaiores recursos por página (1ª execução):\n");
  console.log(maioresPorPagina.join("\n"));
} finally {
  chrome.kill("SIGKILL");
}
