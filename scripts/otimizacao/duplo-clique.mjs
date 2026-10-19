#!/usr/bin/env node
// Fase 1 (docs/geral/OTIMIZACAO_SISTEMA.md, P0.2): simula duplo clique em
// cada ação de turno — duas requisições idênticas disparadas ao mesmo tempo
// — e conta os status HTTP da segunda. Com o lock antigo (423 imediato), a
// segunda recebe "Recurso ocupado"; com espera + retry, ela espera a
// primeira e recebe a resposta de negócio (ex.: 400 "não há escolha
// pendente") ou o mesmo resultado idempotente (revelar).
//
// Uso (com `make dev-up` rodando): node scripts/otimizacao/duplo-clique.mjs
// Variáveis: API, SOCKET_URL, JOGADAS (default 40).

import { createRequire } from "node:module";

const require = createRequire(new URL("../../client/package.json", import.meta.url));
const { io } = require("socket.io-client");

const API = process.env.API ?? "http://localhost:7000/api";
const SOCKET_URL = process.env.SOCKET_URL ?? "http://localhost:7000";
const JOGADAS = Number(process.env.JOGADAS ?? 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: JSON.stringify(body ?? {}) });
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  return { status: res.status, data };
}

async function criarBot(i, sufixo) {
  const email = `bot.otim.${sufixo}.${i}@teste.local`;
  const r = await req("POST", "/auth/register", null, { email, senha: "senha123" });
  if (r.status !== 201) throw new Error(`register ${i}: ${r.status} ${JSON.stringify(r.data)}`);
  const fd = new FormData();
  fd.append("nome", `Bot ${i}`);
  fd.append("avatarPreset", "preset-01");
  const p = await fetch(`${API}/auth/profile`, { method: "POST", headers: { Authorization: `Bearer ${r.data.token}` }, body: fd });
  if (p.status >= 400) throw new Error(`profile ${i}: ${p.status}`);
  return { token: r.data.token, userId: r.data.user.id };
}

const contagem = {};
function contar(acao, primeira, segunda) {
  const chave = `${acao}: 1ª ${primeira.status} / 2ª ${segunda.status}` +
    (segunda.status >= 400 ? ` (${segunda.data?.message ?? ""})` : "");
  contagem[chave] = (contagem[chave] ?? 0) + 1;
}

async function duplo(acao, path, token, body) {
  const [a, b] = await Promise.all([req("POST", path, token, body), req("POST", path, token, body)]);
  // Ordena por chegada lógica: a que deu certo conta como "1ª".
  const [primeira, segunda] = a.status < b.status ? [a, b] : [b, a];
  contar(acao, primeira, segunda);
  return primeira;
}

async function main() {
  const sufixo = `dc${Date.now()}`;
  const bots = [];
  for (let i = 1; i <= 3; i++) bots.push(await criarBot(i, sufixo));

  const criada = await req("POST", "/sessions/new-session", bots[0].token, {
    nome: `Baseline ${sufixo}`, modo: "individual", maxJogadores: 3, saldoInicial: 500_000, tipoJogo: "tabuleiro",
  });
  const sessionId = criada.data.id;
  for (const b of bots.slice(1)) await req("POST", `/sessions/${sessionId}/join`, b.token, {});

  let estado = null;
  const s = io(`${SOCKET_URL}/game`, { auth: { token: bots[0].token }, transports: ["websocket"] });
  s.on("connect", () => s.emit("session:join", { sessionId }));
  s.on("session:updated", (d) => { estado = d; });
  await sleep(1000);
  await req("POST", `/sessions/${sessionId}/start`, bots[0].token, {});
  await sleep(500);
  const porPlayerId = new Map(estado.jogadores.map((j) => [j.id, bots.find((b) => b.userId === j.userId)]));

  const base = `/turno/${sessionId}`;
  for (let n = 0; n < JOGADAS; n++) {
    await sleep(300);
    const st = estado;
    const bot = porPlayerId.get(st.turnoAtualPlayerId);
    if (st.emLeilao || !bot) { await sleep(1000); continue; }
    if (st.aguardandoAcao) {
      await duplo("comprar", `${base}/comprar-casa-atual`, bot.token);
    } else if (st.aguardandoEscolha) {
      const eu = st.jogadores.find((j) => j.id === st.turnoAtualPlayerId);
      if ((eu?.creditoVisao ?? 0) > 0 && !st.dadosRevelados) await duplo("revelar", `${base}/revelar-dados`, bot.token);
      await duplo("escolher", `${base}/escolher-movimento`, bot.token, { escolha: "soma" });
    } else {
      await duplo("rolar", `${base}/rolar-dados`, bot.token);
    }
  }
  s.close();
  // Encerra a sala de teste para o timer de 60s não seguir jogando por ela.
  await req("DELETE", `/sessions/delete/${sessionId}`, bots[0].token);

  console.log(`Duplo clique (2 requisições simultâneas), ${JOGADAS} jogadas, sessão ${sessionId}:\n`);
  console.log("| Ação e status (1ª / 2ª) | Vezes |");
  console.log("|---|---|");
  for (const [k, v] of Object.entries(contagem).sort()) console.log(`| ${k} | ${v} |`);
  const falsos = Object.entries(contagem).filter(([k]) => k.includes("2ª 423")).reduce((a, [, v]) => a + v, 0);
  console.log(`\n423 na segunda requisição: ${falsos}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
