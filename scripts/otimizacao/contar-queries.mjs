#!/usr/bin/env node
// Cruza o log de statements do Postgres com as janelas de requisição
// gravadas por medir-partida.mjs e resume: payload por rodada, latência
// (p50/p95) e queries por jogada (total + as mais frequentes).
//
// Pré-requisito (temporário, desfazer ao fim):
//   docker exec sgp-db-dev psql -U postgres \
//     -c "ALTER SYSTEM SET log_statement = 'all'" \
//     -c "ALTER SYSTEM SET log_line_prefix = '%m [%p] %d '" \
//     -c "SELECT pg_reload_conf()"
// Depois da partida:
//   docker logs --since <inicio> sgp-db-dev > /tmp/pg.log 2>&1
//   node scripts/otimizacao/contar-queries.mjs /tmp/partida.json /tmp/pg.log
// Para desfazer: ALTER SYSTEM RESET log_statement; ALTER SYSTEM RESET
// log_line_prefix; SELECT pg_reload_conf();

import { readFileSync } from "node:fs";

const [arqPartida, arqLog, banco = "supermaquina"] = process.argv.slice(2);
const partida = JSON.parse(readFileSync(arqPartida, "utf8"));

// ── Log do Postgres ─────────────────────────────────────────────────────
const RE = /^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}) UTC \[\d+\] (\S+) LOG:  (?:execute [^:]*|statement): (.*)$/;
const statements = [];
for (const linha of readFileSync(arqLog, "utf8").split("\n")) {
  const m = RE.exec(linha);
  if (!m || m[2] !== banco) continue;
  statements.push({ t: Date.parse(m[1].replace(" ", "T") + "Z"), sql: m[3] });
}

function rotulo(sql) {
  const s = sql.trim();
  const tx = /^(BEGIN|COMMIT|ROLLBACK)/i.exec(s);
  if (tx) return tx[1].toUpperCase();
  const tabela = (re) => re.exec(s)?.[1] ?? "?";
  if (/^SELECT/i.test(s)) return `SELECT ${tabela(/FROM "public"\."(\w+)"/)}`;
  if (/^INSERT/i.test(s)) return `INSERT ${tabela(/INTO "public"\."(\w+)"/)}`;
  if (/^UPDATE/i.test(s)) return `UPDATE ${tabela(/UPDATE "public"\."(\w+)"/)}`;
  if (/^DELETE/i.test(s)) return `DELETE ${tabela(/FROM "public"\."(\w+)"/)}`;
  return s.slice(0, 40);
}

// ── Helpers ─────────────────────────────────────────────────────────────
const pct = (arr, p) => {
  if (arr.length === 0) return null;
  const o = [...arr].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.ceil((p / 100) * o.length) - 1)];
};
const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const kb = (b) => (b / 1024).toFixed(1);

// ── Requisições: queries e latência ─────────────────────────────────────
const amostras = partida.amostras.filter((a) => a.status < 400);
// Virada de rodada: a requisição depois da qual a rodada mudou.
partida.amostras.forEach((a, i) => {
  const prox = partida.amostras[i + 1];
  a.virada = prox != null && prox.rodadaAntes != null && a.rodadaAntes != null && prox.rodadaAntes > a.rodadaAntes;
});
for (const a of amostras) {
  a.qs = statements.filter((s) => s.t >= a.inicio - 2 && s.t <= a.fim + 2);
}
const grupos = {};
for (const a of amostras) {
  const chave = a.virada ? `${a.tag} (virada de rodada)` : a.tag;
  (grupos[chave] ??= []).push(a);
}

console.log("## Latência e queries por requisição\n");
console.log("| Requisição | n | p50 (ms) | p95 (ms) | máx (ms) | queries (mediana) | queries (máx) | broadcasts/req |");
console.log("|---|---|---|---|---|---|---|---|");
for (const [k, v] of Object.entries(grupos).sort()) {
  const ms = v.map((a) => a.ms);
  const q = v.map((a) => a.qs.length);
  const bc = v.map((a) => partida.eventos.filter((e) => e.t >= a.inicio && e.t <= a.fim + 50).length);
  console.log(`| ${k} | ${v.length} | ${pct(ms, 50).toFixed(0)} | ${pct(ms, 95).toFixed(0)} | ${Math.max(...ms).toFixed(0)} | ${pct(q, 50)} | ${Math.max(...q)} | ${media(bc).toFixed(1)} |`);
}

console.log("\n## Queries mais frequentes por tipo de jogada (média por requisição)\n");
for (const [k, v] of Object.entries(grupos).sort()) {
  const cont = {};
  for (const a of v) for (const s of a.qs) cont[rotulo(s.sql)] = (cont[rotulo(s.sql)] ?? 0) + 1;
  const top = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([r, n]) => `${r} ×${(n / v.length).toFixed(1)}`).join(", ");
  console.log(`- **${k}**: ${top}`);
}

const todos = {};
for (const a of amostras) for (const s of a.qs) todos[rotulo(s.sql)] = (todos[rotulo(s.sql)] ?? 0) + 1;
console.log("\n## Top 5 geral (todas as jogadas)\n");
console.log("| Statement | Total | Por requisição |");
console.log("|---|---|---|");
for (const [r, n] of Object.entries(todos).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  console.log(`| ${r} | ${n} | ${(n / amostras.length).toFixed(1)} |`);
}

// Ruído de fundo (fora das janelas): cleanup de negociações, timers...
const dentro = new Set(amostras.flatMap((a) => a.qs));
const fora = statements.filter((s) => !dentro.has(s));
const dur = (Math.max(...statements.map((s) => s.t)) - Math.min(...statements.map((s) => s.t))) / 1000;
const foraCont = {};
for (const s of fora) foraCont[rotulo(s.sql)] = (foraCont[rotulo(s.sql)] ?? 0) + 1;
console.log(`\nRuído fora das janelas: ${fora.length} statements em ${dur.toFixed(0)}s — ` +
  Object.entries(foraCont).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, n]) => `${r} ×${n}`).join(", "));

// ── Payload por rodada ──────────────────────────────────────────────────
console.log("\n## Payload de session:updated por rodada\n");
console.log("| Rodada | broadcasts | bruto mediano (KB) | bruto máx (KB) | gzip máx (KB) | historico (linhas / KB) | sessionPosses (KB) | jogadores (KB) | tabuleiro (KB) |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const r of [1, 10, 20, 30, 40, 50]) {
  const ev = partida.eventos.filter((e) => e.rodada === r);
  if (ev.length === 0) continue;
  const ult = ev[ev.length - 1];
  console.log(`| ${r} | ${ev.length} | ${kb(pct(ev.map((e) => e.bytes), 50))} | ${kb(Math.max(...ev.map((e) => e.bytes)))} | ${kb(Math.max(...ev.map((e) => e.gzip)))} | ${ult.historicoLinhas} / ${kb(ult.campos.historico)} | ${kb(ult.campos.sessionPosses)} | ${kb(ult.campos.jogadores)} | ${kb(ult.campos.tabuleiro)} |`);
}
const totalBytes = partida.eventos.reduce((a, e) => a + e.bytes, 0);
console.log(`\nTotal: ${partida.eventos.length} broadcasts, ${(totalBytes / 1024 / 1024).toFixed(2)} MB por cliente na partida (×4 clientes).`);
