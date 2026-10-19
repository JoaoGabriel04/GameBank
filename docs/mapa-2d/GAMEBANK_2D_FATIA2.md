# Implementação: GameBank 2D — Fatia 2 (Profundidade Econômica)

## Contexto

Segunda fatia do GameBank 2D (ver `GAMEBANK_2D_GDD.md`, `GAMEBANK_2D_UML.md`
e `GAMEBANK_2D_FATIA1.md`, já implementada e auditada). Adiciona as quatro
peças que ficaram de fora de propósito na Fatia 1, **porque dependem umas
das outras**: Eventos Econômicos, Níveis de Propriedade, Empréstimos
(`EmprestimoMapa`) e Reputação.

**Por que as quatro juntas:** o nível alto de uma construção só é uma
"aposta arriscada" (conforme validado por simulação no GDD) quando existe
um evento de recessão para testar essa exposição. A Reputação só faz
sentido com histórico de comportamento acumulado — que passa a existir
quando há níveis, empréstimos e eventos gerando decisões reais. Implementar
uma sem as outras deixaria peças pela metade.

**Este é o mesmo módulo `mapa2d`, sem alterar Modo Banca nem Modo
Tabuleiro.**

---

## AUDITORIA PRÉVIA — pontos de integração exatos (já localizados)

Estes são os pontos **exatos** do código da Fatia 1 que esta fatia modifica.
Não são hipóteses — foram lidos no código real antes de escrever este `.md`.

| Arquivo | O que muda |
|---|---|
| `economia.service.ts` → `calcularAluguelRecomendado()` | Os `1.0 * 1.0` hardcoded (mercado, inflação) viram parâmetros vindos do evento ativo |
| `fechamento.service.ts` → `fecharMes()` | Ganha: aplicação de juros de empréstimo, atualização de Reputação, virada de evento |
| `fechamento.service.ts` → `verificarFalencia()` | Ganha: execução da garantia do `EmprestimoMapa` **antes** de liberar terrenos |
| `mapa2d.service.ts` → `encerrarPartida()` | O `ranking.sort()` simples vira a lógica de desempate por Reputação |
| `economiaMapa2D.ts` | Ganha as constantes de eventos, níveis, empréstimo e reputação |
| `schema.prisma` | Ganha `Session.mercadoAtual`/`inflacaoAcumulada` (ou reaproveita `eventoAtual`), `EmprestimoMapa`, histórico de Reputação |

---

## ETAPA 0 — Auditoria obrigatória (confirmar antes de codar)

```bash
# Confirmar os pontos hardcoded que serão substituídos
grep -n "1.0 \* 1.0" server/src/modules/mapa2d/services/economia.service.ts

# Confirmar reputacao já existe no schema (criado na Fatia 1, não usado ainda)
grep -n "reputacao" server/prisma/schema.prisma

# Confirmar rodadaAtual/eventoAtual do Modo Tabuleiro (padrão a espelhar)
grep -n "rodadaAtual\|eventoAtual\|eventoProximo\|processarViradaDeRodada" \
  server/src/modules/turno/services/rodada.service.ts

# Ver o padrão de execução de garantia já usado no Modo Tabuleiro
# (MECANICA_EMPRESTIMOS.md) — mesma ordem de operações aqui
grep -n "executarGarantia" server/src/modules/turno/turno.service.ts

# Ver verificarFalencia atual do mapa2d (onde a garantia entra)
cat server/src/modules/mapa2d/services/fechamento.service.ts

# Ver encerrarPartida atual (onde o desempate por Reputação entra)
sed -n '46,70p' server/src/modules/mapa2d/mapa2d.service.ts
```

---

## PARTE A — Eventos Econômicos

### A.1 — Schema

`Session` já tem `rodadaAtual`, `eventoAtual`, `eventoProximo` reaproveitados
do Modo Tabuleiro como "mês atual" e "evento do mês" — **não criar campos
novos**, usar os mesmos. Confirmar que fazem parte do modelo `Session`
genérico (não peculiares ao Modo Tabuleiro) antes de prosseguir; se
estiverem, por acidente, isolados num contexto exclusivo de tabuleiro,
generalizar.

### A.2 — Catálogo (novo arquivo, distinto do Modo Tabuleiro)

`server/src/constants/eventosMapa2D.ts` — os eventos do GDD Seção 7,
adaptados ao Mapa 2D (afetam `mercado`, `inflacao`, `custoConstrucaoMult`,
`jurosMult`; **não têm efeito regional/setorial nesta fatia** — deixar como
melhoria futura):

```typescript
export type EventoMapa2DEfeito = {
  mercadoMult?: number;         // multiplica o aluguel recomendado
  inflacaoIncremento?: number;  // soma à inflação acumulada da partida
  custoConstrucaoMult?: number;
  jurosMult?: number;
};

export type EventoMapa2DDef = {
  codigo: string;
  nome: string;
  descricao: string;
  dica: string;
  cor: "verde" | "vermelho" | "amarelo" | "azul";
  efeito: EventoMapa2DEfeito;
};

export const EVENTOS_MAPA2D: EventoMapa2DDef[] = [
  { codigo: "BOOM_IMOBILIARIO", nome: "Boom Imobiliário",
    descricao: "O mercado está aquecido.", dica: "Aluguéis sobem 35%. Bom mês para construir.",
    cor: "verde", efeito: { mercadoMult: 1.35 } },
  { codigo: "RECESSAO", nome: "Recessão",
    descricao: "A economia esfriou.", dica: "Aluguéis caem 45%. Reprecifique antes de perder ocupação.",
    cor: "vermelho", efeito: { mercadoMult: 0.55 } },
  { codigo: "INFLACAO_ALTA", nome: "Inflação Alta",
    descricao: "Os preços sobem em geral.", dica: "Inflação acumulada aumenta — custos futuros sobem.",
    cor: "vermelho", efeito: { inflacaoIncremento: 0.08 } },
  { codigo: "ESCASSEZ_MATERIAL", nome: "Escassez de Material",
    descricao: "Construir ficou mais caro.", dica: "Custo de construção +40% neste mês.",
    cor: "vermelho", efeito: { custoConstrucaoMult: 1.4 } },
  { codigo: "AQUECIMENTO_CONSTRUCAO", nome: "Aquecimento da Construção Civil",
    descricao: "Materiais em promoção.", dica: "Custo de construção -25% neste mês.",
    cor: "verde", efeito: { custoConstrucaoMult: 0.75 } },
  { codigo: "ALTA_JUROS", nome: "Alta de Juros",
    descricao: "Crédito mais caro.", dica: "Juros de empréstimo dobram neste mês.",
    cor: "vermelho", efeito: { jurosMult: 2.0 } },
  { codigo: "CORTE_JUROS", nome: "Corte de Juros",
    descricao: "Crédito mais barato.", dica: "Juros de empréstimo caem à metade. Bom mês para alavancar.",
    cor: "verde", efeito: { jurosMult: 0.5 } },
];

export const EVENTO_MAPA2D_INTERVALO_MESES = 2;

export function getEventoMapa2D(codigo?: string | null) {
  return EVENTOS_MAPA2D.find(e => e.codigo === codigo) ?? null;
}
export function sortearEventoMapa2D(excluir?: string | null) {
  const pool = EVENTOS_MAPA2D.filter(e => e.codigo !== excluir);
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### A.3 — Ciclo do evento no fechamento

Adaptar `fecharMes()` — inserir logo após virar o mês (`rodadaAtual =
novoMes`), **antes** de recalcular impostos/falência do próximo ciclo:

```typescript
// fechamento.service.ts — novo passo, mesma lógica do Modo Tabuleiro
const eventoAtivo = session.eventoProximo;
const proximaTemEvento = (novoMes + 1) % EVENTO_MAPA2D_INTERVALO_MESES === 0;
const eventoProximo = proximaTemEvento ? sortearEventoMapa2D(eventoAtivo).codigo : null;

await mapa2dRepository.updateSession(sessionId, {
  rodadaAtual: novoMes,
  eventoAtual: eventoAtivo,
  eventoProximo,
});

const def = getEventoMapa2D(eventoAtivo);
if (def?.efeito.inflacaoIncremento) {
  await mapa2dRepository.incrementarInflacaoAcumulada(sessionId, def.efeito.inflacaoIncremento);
}
```

**Novo campo necessário:** `Session.inflacaoAcumuladaMapa2D Float @default(0)`
— a inflação é cumulativa mês a mês, diferente do `mercadoMult` que vale só
para o mês corrente.

### A.4 — Aplicar no aluguel recomendado

Modificar `economia.service.ts::calcularAluguelRecomendado`, que hoje tem
`1.0 * 1.0` hardcoded:

```typescript
// ANTES (Fatia 1):
// calcularAluguelRecomendado(multiplicadorRegiao: number, tipo: TipoConstrucao): number {
//   const base = RENDA_BASE_REF * multiplicadorRegiao;
//   return Math.round(base * MULT_CONSTRUCAO[tipo] * 1.0 * 1.0);
// }

// DEPOIS:
calcularAluguelRecomendado(
  multiplicadorRegiao: number,
  tipo: TipoConstrucao,
  mercadoMult: number,
  inflacaoAcumulada: number
): number {
  const base = RENDA_BASE_REF * multiplicadorRegiao;
  const fatorInflacao = 1 + inflacaoAcumulada;
  return Math.round(base * MULT_CONSTRUCAO[tipo] * mercadoMult * fatorInflacao);
}
```

Atualizar a chamada em `fechamento.service.ts` para passar
`getEventoMapa2D(session.eventoAtual)?.efeito.mercadoMult ?? 1.0` e
`session.inflacaoAcumuladaMapa2D`.

### A.5 — Custo de construção afetado pelo evento

Em `construcao.service.ts`, o custo (`SLOTS_CONSTRUCAO[tipo] *
CUSTO_POR_SLOT`) passa a multiplicar por `custoConstrucaoMult` do evento
ativo (buscar a sessão antes de cobrar).

---

## PARTE B — Níveis de Propriedade

### B.1 — Schema

```prisma
model Construcao {
  // ...campos existentes...
  nivel Int @default(1)   // já existe — remove o hardcode "nivel: 1" no create
}
```

### B.2 — Constantes (do GDD Seção 4, validadas por simulação)

```typescript
// economiaMapa2D.ts — adicionar
export const NIVEL_MAX: Record<string, number> = {
  casa: 3, sobrado: 3, comercio: 3, apartamento: 5,
  centro_comercial: 4, hotel: 5, corporativo: 5,
};
export const ALUGUEL_GANHO_POR_NIVEL = 0.55;
export const CUSTO_UPGRADE_MULT = 1.8;

/** Manutenção cresce mais rápido em regiões ricas — inquilino mais exigente. */
export function manutencaoGanhoPorNivel(multiplicadorRegiao: number): number {
  return 0.55 + 0.10 * multiplicadorRegiao;
}
```

### B.3 — Serviço de upgrade

```typescript
// construcao.service.ts
async subirNivel(sessionId: number, playerId: number, construcaoId: number) {
  const construcao = await mapa2dRepository.findConstrucaoDoJogador(construcaoId, playerId);
  if (!construcao) throw new AppError(403, "Construção não encontrada.");

  const max = NIVEL_MAX[construcao.tipo];
  if (construcao.nivel >= max) throw new AppError(400, "Esta construção já está no nível máximo.");

  const custoBase = SLOTS_CONSTRUCAO[construcao.tipo] * CUSTO_POR_SLOT;
  const custoUpgrade = Math.round(custoBase * Math.pow(CUSTO_UPGRADE_MULT, construcao.nivel));

  const session = await mapa2dRepository.findSessionAtiva(sessionId);
  const evento = getEventoMapa2D(session?.eventoAtual);
  const custoFinal = Math.round(custoUpgrade * (evento?.efeito.custoConstrucaoMult ?? 1.0));

  const player = await mapa2dRepository.findPlayer(playerId);
  if (player.saldo < custoFinal) throw new AppError(400, "Saldo insuficiente para o upgrade.");

  // Atômico: só sobe se ainda estiver no nível esperado (evita corrida de duplo-clique)
  const { prisma } = await import("../../../lib/prisma.js");
  const resultado = await prisma.construcao.updateMany({
    where: { id: construcaoId, nivel: construcao.nivel },
    data: { nivel: { increment: 1 } },
  });
  if (resultado.count === 0) throw new AppError(409, "O nível já mudou — tente novamente.");

  await mapa2dRepository.updatePlayerSaldo(playerId, -custoFinal);
  return { sucesso: true, novoNivel: construcao.nivel + 1, custo: custoFinal };
}
```

**Nota de atomicidade:** o `updateMany` com `WHERE nivel: construcao.nivel`
segue o mesmo requisito não-negociável da compra de terreno — evita dois
cliques rápidos pagando dois upgrades mas só um sendo aplicado (ou
vice-versa).

### B.4 — Aluguel e manutenção por nível

Em `fechamento.service.ts`, o cálculo de aluguel/manutenção precisa
considerar o nível (hoje assume nível 1 implicitamente via `custoConstrucao`
fixo):

```typescript
function aluguelNoNivel(baseNivel1: number, nivel: number): number {
  let v = baseNivel1;
  for (let n = 1; n < nivel; n++) v = Math.round(v * (1 + ALUGUEL_GANHO_POR_NIVEL));
  return v;
}
function manutencaoNoNivel(baseNivel1: number, nivel: number, multiplicadorRegiao: number): number {
  const ganho = manutencaoGanhoPorNivel(multiplicadorRegiao);
  let v = baseNivel1;
  for (let n = 1; n < nivel; n++) v = Math.round(v * (1 + ganho));
  return v;
}
```

O `aluguelPedido` do jogador continua sendo o valor que ele define
livremente (a UI mostra o recomendado **para o nível atual** como
referência) — os campos acima calculam o **recomendado**, não substituem a
escolha do jogador.

---

## PARTE C — Empréstimos (`EmprestimoMapa`)

### C.1 — Schema (novo modelo, distinto do `Emprestimo` do Modo Tabuleiro)

```prisma
model EmprestimoMapa {
  id             Int      @id @default(autoincrement())
  sessionId      Int
  session        Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  playerId       Int
  player         SessionPlayer @relation(fields: [playerId], references: [id], onDelete: Cascade)

  valorOriginal  Int
  valorDevido    Int
  garantiaSessionTerrenoId Int      @unique
  garantiaSessionTerreno   SessionTerreno @relation(fields: [garantiaSessionTerrenoId], references: [id])

  quitado    Boolean  @default(false)
  executado  Boolean  @default(false)
  criadoEm   DateTime @default(now())
  quitadoEm  DateTime?

  @@index([sessionId, playerId])
  @@map("emprestimos_mapa2d")
}
```

### C.2 — Constantes

```typescript
export const EMPRESTIMO_MAPA2D_LIMITE_PCT = 0.50;   // 50% do patrimônio livre
export const EMPRESTIMO_MAPA2D_JUROS_PCT = 0.10;    // 10% compostos por mês
```

### C.3 — Pegar empréstimo (garantia = construção que mais rende)

Mesma lógica já validada no Modo Tabuleiro (`MECANICA_EMPRESTIMOS.md`),
adaptada ao domínio de terrenos/construções:

```typescript
async pegarEmprestimo(sessionId: number, playerId: number, valor: number) {
  const ativo = await mapa2dRepository.findEmprestimoAtivo(sessionId, playerId);
  if (ativo) throw new AppError(400, "Você já tem um empréstimo ativo.");

  const limite = await this.calcularLimiteCredito(sessionId, playerId);
  if (valor <= 0 || valor > limite) throw new AppError(400, `Limite disponível: R$ ${limite}.`);

  const garantia = await this.escolherGarantia(sessionId, playerId);
  if (!garantia) throw new AppError(400, "Você não tem construções livres para dar como garantia.");

  const { prisma } = await import("../../../lib/prisma.js");
  await prisma.$transaction([
    prisma.sessionPlayer.update({ where: { id: playerId }, data: { saldo: { increment: valor } } }),
    prisma.emprestimoMapa.create({
      data: { sessionId, playerId, valorOriginal: valor, valorDevido: valor,
              garantiaSessionTerrenoId: garantia.sessionTerrenoId },
    }),
  ]);

  return { valor, garantia: { sessionTerrenoId: garantia.sessionTerrenoId, tipo: garantia.tipo } };
}

/** Limite = 50% do valor dos terrenos NÃO dados em garantia. */
private async calcularLimiteCredito(sessionId: number, playerId: number): Promise<number> {
  const terrenos = await mapa2dRepository.findSessionTerrenosComDono(sessionId, playerId);
  const valorLivre = terrenos
    .filter(t => !t.emprestimoGarantia)
    .reduce((soma, t) => soma + (t.precoPago ?? 0) +
        (t.construcao ? SLOTS_CONSTRUCAO[t.construcao.tipo] * CUSTO_POR_SLOT : 0), 0);
  return Math.floor(valorLivre * EMPRESTIMO_MAPA2D_LIMITE_PCT);
}

/** Garantia = a construção que mais rende (aluguel no nível atual). */
private async escolherGarantia(sessionId: number, playerId: number) {
  const terrenos = await mapa2dRepository.findSessionTerrenosComDono(sessionId, playerId);
  let melhor: { sessionTerrenoId: number; tipo: string; renda: number } | null = null;
  for (const t of terrenos) {
    if (!t.construcao) continue;
    const renda = aluguelNoNivel(RENDA_BASE_REF * t.terreno.multiplicador * MULT_CONSTRUCAO[t.construcao.tipo], t.construcao.nivel);
    if (!melhor || renda > melhor.renda) melhor = { sessionTerrenoId: t.id, tipo: t.construcao.tipo, renda };
  }
  return melhor;
}
```

### C.4 — Juros compostos no fechamento

Em `fecharMes()`, antes da checagem de falência de cada jogador:

```typescript
const emprestimo = await mapa2dRepository.findEmprestimoAtivo(sessionId, p.id);
if (emprestimo) {
  const evento = getEventoMapa2D(session.eventoAtual);
  const jurosPct = EMPRESTIMO_MAPA2D_JUROS_PCT * (evento?.efeito.jurosMult ?? 1.0);
  const novoDevido = Math.round(emprestimo.valorDevido * (1 + jurosPct));
  await mapa2dRepository.atualizarEmprestimoDevido(emprestimo.id, novoDevido);
}
```

### C.5 — Execução da garantia (ordem crítica na falência)

Modificar `verificarFalencia()` em `fechamento.service.ts` — a garantia
**precisa ser executada antes** de `liberarTerrenosDoJogador` (que hoje
libera **todos** os terrenos do jogador, inclusive o dado em garantia):

```typescript
// DENTRO de verificarFalencia, no bloco "rodadas > MESES_GRACA_FALENCIA":

const emprestimo = await mapa2dRepository.findEmprestimoAtivo(sessionId, playerId);
if (emprestimo) {
  // Marca a garantia como executada ANTES de liberar terrenos —
  // registra explicitamente que o banco tomou o ativo (mesma lógica
  // do Modo Tabuleiro em MECANICA_EMPRESTIMOS.md).
  await mapa2dRepository.marcarEmprestimoExecutado(emprestimo.id);
  await mapa2dRepository.criarHistorico(sessionId, "MAPA2D_GARANTIA_EXECUTADA",
    `Garantia executada: construção do empréstimo não pago tomada pelo banco.`);
}

await mapa2dRepository.liberarTerrenosDoJogador(sessionId, playerId);
await mapa2dRepository.removerConstrucoesDoJogador(sessionId, playerId);
await mapa2dRepository.marcarFalido(playerId);
```

### C.6 — Travas de segurança (não-negociáveis, mesma lição do Modo Tabuleiro)

- **Não pode dar upgrade** na construção em garantia sem reavaliar o limite
  (o valor de garantia muda; simplificação aceitável: permitir upgrade, o
  limite de crédito é recalculado a cada novo empréstimo, não retroativo)
- **Não pode vender/demolir** a construção dada em garantia (`construcao.service`
  deve checar `garantiaSessionTerrenoId` antes de qualquer remoção, se
  "vender construção" existir nesta fatia — se não existir ainda, adiar a
  trava para quando a função existir, mas **documentar a dívida técnica**)
- **Apenas 1 empréstimo ativo por jogador**

---

## PARTE D — Reputação

### D.1 — Já existe no schema (criado na Fatia 1, não usado ainda)

```prisma
// SessionPlayer.reputacao Float @default(3.0) — já existe, ativar o uso agora
```

### D.2 — Constantes

```typescript
export const REPUTACAO_MIN = 0.0;
export const REPUTACAO_MAX = 5.0;
export const REPUTACAO_LIMIAR_VITORIA = 4.0;

export const REPUTACAO_GANHO_PRECO_JUSTO = 0.05;      // por mês, se aluguelPedido <= recomendado
export const REPUTACAO_PERDA_PRECO_ABUSIVO = 0.10;    // por mês, se acima da tolerância da região
export const REPUTACAO_PERDA_VACANCIA_NEGLIGENTE = 0.05; // por mês, se vago por preço não competitivo
export const REPUTACAO_PERDA_ATRASO = 0.15;           // por mês em Devendo
export const REPUTACAO_PERDA_FALENCIA = 1.0;          // penalidade única, no momento da falência
```

### D.3 — Cálculo no fechamento

```typescript
// fechamento.service.ts — novo passo, por jogador, a cada mês
async atualizarReputacao(sessionId: number, playerId: number, contexto: {
  temConstrucaoPrecoJusto: boolean;
  temConstrucaoPrecoAbusivo: boolean;
  vagaPorNegligencia: boolean;
  estaDevendo: boolean;
}) {
  const player = await mapa2dRepository.findPlayer(playerId);
  let rep = player.reputacao;

  if (contexto.temConstrucaoPrecoJusto) rep += REPUTACAO_GANHO_PRECO_JUSTO;
  if (contexto.temConstrucaoPrecoAbusivo) rep -= REPUTACAO_PERDA_PRECO_ABUSIVO;
  if (contexto.vagaPorNegligencia) rep -= REPUTACAO_PERDA_VACANCIA_NEGLIGENTE;
  if (contexto.estaDevendo) rep -= REPUTACAO_PERDA_ATRASO;

  rep = Math.max(REPUTACAO_MIN, Math.min(REPUTACAO_MAX, rep));
  await mapa2dRepository.updatePlayerReputacao(playerId, rep);
}
```

Chamar isso dentro do loop de construções do `fecharMes()`, agregando por
jogador se ele tiver múltiplas construções (usar OU lógico: se qualquer
construção dele está com preço abusivo, conta a perda uma vez por mês, não
uma vez por construção — evita punição desproporcional a quem tem mais
imóveis).

Na falência (`verificarFalencia`, bloco de execução):
```typescript
await mapa2dRepository.updatePlayerReputacao(playerId,
  Math.max(REPUTACAO_MIN, player.reputacao - REPUTACAO_PERDA_FALENCIA));
```

### D.4 — Efeito na ocupação

Modificar `calcularOcupacao()` em `economia.service.ts` para receber a
Reputação do dono e ajustar a sensibilidade:

```typescript
calcularOcupacao(
  aluguelPedido: number, recomendado: number,
  categoria: "comum" | "mediana" | "rica", reputacaoDono: number
): boolean {
  if (recomendado <= 0) return false;
  const sensBase = sensibilidadeRegiao(categoria);
  // Reputação 3.0 = neutro (sem ajuste). Cada ponto acima/abaixo ajusta ~10%.
  const ajusteReputacao = (reputacaoDono - 3.0) * 0.10;
  const sens = Math.max(0.05, sensBase + ajusteReputacao);
  // ...resto do cálculo idêntico, usando `sens` ajustado...
}
```

**[A DEFINIR — a simular antes de fixar]** O coeficiente `0.10` é uma
proposta inicial. Rodar simulação (mesmo método usado no aluguel/imposto)
para validar que o efeito é perceptível mas não domina a decisão de preço.

### D.5 — Desempate na vitória

Modificar `encerrarPartida()` em `mapa2d.service.ts`:

```typescript
async encerrarPartida(sessionId: number) {
  // ...ranking por patrimônio já existente...
  ranking.sort((a, b) => b.patrimonio - a.patrimonio);

  if (ranking.length >= 2) {
    const [primeiro, segundo] = ranking;
    const limiar = primeiro.patrimonio * LIMIAR_DESEMPATE_REPUTACAO_PCT; // ~12%, constante nova

    if (primeiro.patrimonio - segundo.patrimonio < limiar) {
      const repPrimeiro = await mapa2dRepository.findPlayer(primeiro.playerId).then(p => p.reputacao);
      const repSegundo = await mapa2dRepository.findPlayer(segundo.playerId).then(p => p.reputacao);

      const primeiroQualifica = repPrimeiro >= REPUTACAO_LIMIAR_VITORIA;
      const segundoQualifica = repSegundo >= REPUTACAO_LIMIAR_VITORIA;

      if (segundoQualifica && !primeiroQualifica) {
        [ranking[0], ranking[1]] = [ranking[1], ranking[0]]; // 2º assume 1º lugar
      } else if (primeiroQualifica && segundoQualifica && repSegundo > repPrimeiro) {
        [ranking[0], ranking[1]] = [ranking[1], ranking[0]];
      }
      // Se nenhum qualifica, ou só o 1º qualifica: mantém a ordem por patrimônio
    }
  }
  // ...resto do encerramento (Historico, emitToRoom) usando `ranking` já ajustado...
}
```

**[A DEFINIR]** `LIMIAR_DESEMPATE_REPUTACAO_PCT` — proposto 0.12 no GDD,
pendente de simulação de partida completa (24 meses) para validar.

---

## ETAPA — Rotas novas

```typescript
router.post("/:sessionId/construcao/:construcaoId/subir-nivel", authenticate, roomAuth, mapa2dController.subirNivel);
router.post("/:sessionId/emprestimo/pegar", authenticate, roomAuth, mapa2dController.pegarEmprestimo);
router.post("/:sessionId/emprestimo/quitar", authenticate, roomAuth, mapa2dController.quitarEmprestimo);
```

---

## Testes obrigatórios

### Eventos
- [ ] Evento é anunciado 1 mês antes (`eventoProximo`) e ativa no mês seguinte
- [ ] `mercadoMult` altera o aluguel recomendado corretamente
- [ ] `inflacaoAcumuladaMapa2D` é cumulativa entre meses
- [ ] `custoConstrucaoMult` afeta construir E subir de nível
- [ ] `jurosMult` afeta os juros do empréstimo no mês do evento

### Níveis
- [ ] Upgrade é **atômico** (`updateMany WHERE nivel: atual` — testar concorrência de duplo clique)
- [ ] Não é possível subir acima do `NIVEL_MAX` do tipo
- [ ] Manutenção cresce mais rápido em região rica que em região comum
- [ ] Simulação de recessão sem reprecificar: nível 5 perde proporcionalmente mais que nível 1 (validar o comportamento já simulado no GDD)

### Empréstimo
- [ ] Limite = 50% do patrimônio livre (excluindo o já dado em garantia)
- [ ] Garantia = a construção de maior renda atual
- [ ] Apenas 1 empréstimo ativo por jogador
- [ ] Juros compostos aplicados corretamente por mês
- [ ] **Falência executa a garantia ANTES de liberar terrenos** (testar que a construção em garantia é marcada `executado: true`, não simplesmente devolvida junto com o resto)

### Reputação
- [ ] Começa em 3.0
- [ ] Sobe com preço justo sustentado, desce com preço abusivo
- [ ] Desce ao entrar em "Devendo"
- [ ] Cai com penalidade forte na falência
- [ ] Nunca sai do intervalo [0.0, 5.0]
- [ ] Afeta a curva de ocupação (mais reputação = mais tolerância de preço)

### Vitória com desempate
- [ ] Diferença de patrimônio grande → Reputação não interfere
- [ ] Diferença pequena, só um com Reputação ≥ 4.0 → esse vence mesmo com patrimônio menor
- [ ] Diferença pequena, ambos ≥ 4.0 → vence o de maior Reputação
- [ ] Diferença pequena, nenhum ≥ 4.0 → mantém critério de patrimônio

### Não quebrou a Fatia 1
- [ ] Compra de terreno continua atômica (reteste de concorrência)
- [ ] Fechamento de mês continua resiliente (reteste de timer)
- [ ] Falência sem empréstimo continua funcionando (jogador sem `EmprestimoMapa`)
- [ ] Modo Banca e Modo Tabuleiro intactos
- [ ] `make validate` passa

---

## Definição de "pronto"

1. Eventos econômicos ciclando (anúncio → ativação), afetando aluguel,
   construção e juros
2. Níveis de propriedade com upgrade atômico e curva validada
3. `EmprestimoMapa` com garantia, juros compostos e execução ordenada
   corretamente na falência
4. Reputação calculada mensalmente, afetando ocupação e o critério de vitória
5. Todos os testes passando, nada quebrado na Fatia 1
6. `make validate` passa

---

## Nota de calibragem

Dois coeficientes ficam marcados **[A DEFINIR]** mesmo após esta
implementação — não são bugs, são pontos que só se calibram com partidas
reais ou simulação dedicada:

- O ajuste de Reputação na sensibilidade de ocupação (`0.10` proposto)
- O limiar percentual de desempate na vitória (`0.12` proposto)

Recomendo rodar 3-5 partidas completas (ou uma simulação de 24 meses, como
fizemos para os outros números) antes de considerar esses dois definitivos.
