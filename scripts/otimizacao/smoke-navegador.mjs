#!/usr/bin/env node
// Smoke test no navegador: abre a tela de jogo de um bot enquanto
// medir-partida.mjs joga (broadcasts chegando de verdade) e falha se houver
// exceção de JavaScript ou se os nomes das propriedades sumirem da tela —
// cobre a recomposição do catálogo estático no cliente (Fase 2, P1.4).
//
//   CREDENCIAIS_ARQ=/tmp/cred.json node scripts/otimizacao/medir-partida.mjs &
//   docker run --rm --network host -v "$PWD:/repo" -w /repo <imagem com chromium> \
//     node scripts/otimizacao/smoke-navegador.mjs /repo/cred.json
// Variáveis: BASE (default http://localhost:3000), CHROME_PATH, DURACAO_S (default 90).

import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [arq] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3000";
const DURACAO_S = Number(process.env.DURACAO_S ?? 90);
const PORTA = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(process.env.CHROME_PATH ?? "chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  `--remote-debugging-port=${PORTA}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "smoke-"))}`, "about:blank",
], { stdio: "ignore" });

function conectar(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pendentes = new Map();
  const ouvintes = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) { pendentes.get(d.id)(d.result); pendentes.delete(d.id); }
    else if (d.method) ouvintes.forEach((f) => f(d));
  };
  return new Promise((r) => {
    ws.onopen = () => r({
      enviar: (method, params = {}) => new Promise((ok) => { pendentes.set(++id, ok); ws.send(JSON.stringify({ id, method, params })); }),
      ouvir: (f) => ouvintes.push(f),
      fechar: () => ws.close(),
    });
  });
}

const avaliar = async (cdp, expressao) => (await cdp.enviar("Runtime.evaluate", { expression: expressao, returnByValue: true })).result?.value;

try {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${PORTA}/json/version`); break; } catch { await sleep(200); }
  }
  const { sessionId, credenciais } = JSON.parse(readFileSync(arq, "utf8"));
  const alvo = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?${BASE}/login`, { method: "PUT" })).json();
  const cdp = await conectar(alvo.webSocketDebuggerUrl);
  const erros = [];
  cdp.ouvir((e) => {
    if (e.method === "Runtime.exceptionThrown") erros.push(e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text);
  });
  await cdp.enviar("Runtime.enable");
  await cdp.enviar("Page.enable");
  await sleep(4000);
  const { token, user } = credenciais[0];
  await avaliar(cdp, `localStorage.setItem("jwt_token", ${JSON.stringify(token)}); localStorage.setItem("jwt_user", ${JSON.stringify(JSON.stringify(user))}); true`);
  await cdp.enviar("Page.navigate", { url: `${BASE}/user/game/${sessionId}` });
  await sleep(15000);

  const nomes = 'document.body.innerText.match(/Av\\.|Rua|Praça|Avenida/g)?.length ?? 0';
  const inicio = await avaliar(cdp, nomes);
  await sleep(DURACAO_S * 1000);
  const fim = await avaliar(cdp, nomes);
  const url = await avaliar(cdp, "location.pathname");
  cdp.fechar();

  console.log(`URL: ${url}`);
  console.log(`Nomes de propriedade na tela: ${inicio} no início, ${fim} após ${DURACAO_S}s de broadcasts`);
  console.log(`Exceções de JavaScript: ${erros.length}`);
  for (const e of erros.slice(0, 5)) console.log(`  - ${e.split("\n")[0]}`);
  process.exitCode = erros.length === 0 && fim > 0 && url.includes(`/game/${sessionId}`) ? 0 : 1;
} finally {
  chrome.kill("SIGKILL");
}
