#!/usr/bin/env node
// Medição de baseline (docs/geral/OTIMIZACAO_SISTEMA.md, Etapa 0).
//
// Joga uma partida real do Modo Tabuleiro com 4 bots pela API pública e
// pelo Socket.IO (nada de atalhos no banco), registrando:
//   - tamanho (bruto e gzip) de cada `session:updated` recebido, com a
//     quebra por campo (historico, sessionPosses, jogadores, tabuleiro...);
//   - latência de cada requisição de turno (rolar, revelar, escolher,
//     comprar), com os timestamps de início/fim para cruzar com o log de
//     queries do Postgres (ver contar-queries.mjs).
//
// Uso (com `make dev-up` rodando):
//   node scripts/otimizacao/medir-partida.mjs > /tmp/partida.json
// Variáveis: API (default http://localhost:7000/api), SOCKET_URL
// (default http://localhost:7000), RODADAS (default 50).
//
// Os bots compram tudo o que podem e o saldo inicial é alto para evitar
// leilões (que pausam o turno por até 30s) — o objetivo é medir o custo
// das jogadas e o crescimento do payload, não a economia.

import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";

const require = createRequire(new URL("../../client/package.json", import.meta.url));
const { io } = require("socket.io-client");

const API = process.env.API ?? "http://localhost:7000/api";
const SOCKET_URL = process.env.SOCKET_URL ?? "http://localhost:7000";
const ALVO = Number(process.env.RODADAS ?? 50);
const SALDO_INICIAL = 500_000;
// Limite da API: 300 req/min por IP. ~4,5 req/s deixa folga.
const INTERVALO_MIN_MS = 220;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.error("[medir]", ...a);

const amostras = [];
const eventos = [];
let estado = null;
let versao = 0;
let ultimoReq = 0;

async function req(method, path, token, body, tag) {
  const espera = ultimoReq + INTERVALO_MIN_MS - Date.now();
  if (espera > 0) await sleep(espera);
  ultimoReq = Date.now();

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const rodadaAntes = estado?.rodadaAtual ?? null;
  const inicio = Date.now();
  const t0 = performance.now();
  const res = await fetch(API + path, { method, headers, body: payload });
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  const ms = performance.now() - t0;
  const fim = Date.now();
  if (tag) amostras.push({ tag, status: res.status, ms, inicio, fim, rodadaAntes });
  return { status: res.status, data };
}

function bytes(v) {
  return v === undefined ? 0 : Buffer.byteLength(JSON.stringify(v));
}

function registrarEvento(data) {
  const json = JSON.stringify(data);
  eventos.push({
    t: Date.now(),
    rodada: data.rodadaAtual,
    bytes: Buffer.byteLength(json),
    gzip: gzipSync(json).length,
    historicoLinhas: data.historico?.length ?? 0,
    campos: {
      historico: bytes(data.historico),
      sessionPosses: bytes(data.sessionPosses),
      jogadores: bytes(data.jogadores),
      tabuleiro: bytes(data.tabuleiro),
      debts: bytes(data.debts),
    },
  });
  estado = data;
  versao++;
}

async function esperarAtualizacao(desde, timeoutMs = 2000) {
  const limite = Date.now() + timeoutMs;
  while (versao === desde && Date.now() < limite) await sleep(25);
}

async function criarBot(i, sufixo) {
  const email = `bot.otim.${sufixo}.${i}@teste.local`;
  const r = await req("POST", "/auth/register", null, { email, senha: "senha123" });
  if (r.status !== 201) throw new Error(`register ${i}: ${r.status} ${JSON.stringify(r.data)}`);
  const token = r.data.token;
  const fd = new FormData();
  fd.append("nome", `Bot ${i}`);
  fd.append("avatarPreset", "preset-01");
  const p = await req("POST", "/auth/profile", token, fd);
  if (p.status >= 400) throw new Error(`profile ${i}: ${p.status} ${JSON.stringify(p.data)}`);
  return { i, token, userId: r.data.user.id, user: { ...r.data.user, ...(p.data?.user ?? {}), profileComplete: true } };
}

async function main() {
  const sufixo = Date.now();
  const bots = [];
  for (let i = 1; i <= 4; i++) bots.push(await criarBot(i, sufixo));
  log("bots criados");

  const criada = await req("POST", "/sessions/new-session", bots[0].token, {
    nome: `Baseline ${sufixo}`, modo: "individual", maxJogadores: 4,
    saldoInicial: SALDO_INICIAL, tipoJogo: "tabuleiro",
  });
  if (criada.status !== 201) throw new Error(`new-session: ${criada.status} ${JSON.stringify(criada.data)}`);
  const sessionId = criada.data.id;
  for (const b of bots.slice(1)) {
    const j = await req("POST", `/sessions/${sessionId}/join`, b.token, {});
    if (j.status !== 200) throw new Error(`join: ${j.status} ${JSON.stringify(j.data)}`);
  }

  // Um socket por bot (como no app); só o primeiro registra os eventos —
  // todos recebem o mesmo broadcast.
  const sockets = bots.map((b, idx) => {
    const s = io(`${SOCKET_URL}/game`, { auth: { token: b.token }, transports: ["websocket"] });
    s.on("connect", () => s.emit("session:join", { sessionId }));
    if (idx === 0) s.on("session:updated", registrarEvento);
    return s;
  });
  await sleep(1500);

  const inicio = await req("POST", `/sessions/${sessionId}/start`, bots[0].token, {});
  if (inicio.status !== 200) throw new Error(`start: ${inicio.status} ${JSON.stringify(inicio.data)}`);
  await sleep(500);

  const porPlayerId = new Map();
  for (const j of estado.jogadores) {
    const bot = bots.find((b) => b.userId === j.userId);
    if (bot) porPlayerId.set(j.id, bot);
  }
  log(`sessão ${sessionId} iniciada`);

  const inicioJogo = Date.now();
  let erros = 0;
  while (true) {
    const s = estado;
    if (s.rodadaAtual > ALVO) break;
    if (Date.now() - inicioJogo > 30 * 60_000) { log("tempo máximo atingido"); break; }
    if (s.emLeilao) { await sleep(1000); continue; }

    const bot = porPlayerId.get(s.turnoAtualPlayerId);
    if (!bot) { await sleep(200); continue; }
    const base = `/turno/${sessionId}`;
    const antes = versao;
    let r;
    if (s.aguardandoAcao) {
      r = await req("POST", `${base}/comprar-casa-atual`, bot.token, {}, "comprar");
      if (r.status >= 400) r = await req("POST", `${base}/recusar-compra`, bot.token, {}, "recusar");
    } else if (s.aguardandoEscolha) {
      const eu = s.jogadores.find((j) => j.id === s.turnoAtualPlayerId);
      const temCredito = (eu?.creditoVisao ?? 0) > 0
        || ((eu?.creditoRecargaEm ?? 0) > 0 && s.rodadaAtual >= eu.creditoRecargaEm);
      if (temCredito && !s.dadosRevelados) {
        await req("POST", `${base}/revelar-dados`, bot.token, {}, "revelar");
        await esperarAtualizacao(antes);
      }
      const escolha = ["dado1", "dado2", "soma"][Math.floor(Math.random() * 3)];
      r = await req("POST", `${base}/escolher-movimento`, bot.token, { escolha }, "escolher");
    } else {
      r = await req("POST", `${base}/rolar-dados`, bot.token, {}, "rolar");
    }
    if (r.status >= 400) {
      erros++;
      log(`HTTP ${r.status}: ${r.data?.message}`);
      if (erros > 50) throw new Error("erros demais");
      await sleep(500);
    }
    await esperarAtualizacao(antes);
    // Assenta broadcasts em sequência da mesma jogada.
    await sleep(80);
    if (versao % 50 === 0) log(`rodada ${estado.rodadaAtual}`);
  }

  for (const s of sockets) s.close();
  // Tokens dos bots: permitem abrir a partida no navegador (Lighthouse)
  // sem gastar o limite de login (20 req / 15 min por IP).
  const credenciais = bots.map(({ token, user }) => ({ token, user }));
  console.log(JSON.stringify({ sessionId, sufixo, alvo: ALVO, credenciais, amostras, eventos }, null, 0));
  log(`fim: ${amostras.length} requisições, ${eventos.length} broadcasts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
