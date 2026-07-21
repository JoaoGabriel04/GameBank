# Implementação: GameBank 2D — Fatia 1 (Núcleo Econômico)

## Contexto

Primeira fatia jogável do GameBank 2D (ver `GAMEBANK_2D_GDD.md` e
`GAMEBANK_2D_UML.md`). Objetivo: **provar que o loop econômico central é
divertido e balanceado** — sem mapa bonito, sem tiles, sem eventos, sem
empréstimo. Placeholder visual (retângulos coloridos) é suficiente e
correto nesta fase.

**Este é um novo modo de jogo (`tipoJogo = "mapa2d"`), não uma alteração do
Modo Banca nem do Modo Tabuleiro. Nenhum dos dois pode ser afetado.**

## Escopo desta fatia — o que ENTRA

- Sessão do tipo `mapa2d` (reaproveitando `Session`/`SessionPlayer`)
- Mapa estático de 76 terrenos / 18 regiões (seed a partir de JSON)
- Início de partida: saldo R$ 1.000 + 1 terreno grátis sorteado (categoria
  "comum")
- Compra de terreno (com atomicidade garantida)
- Construção — **todos os 7 tipos**, mas **apenas nível 1** (sem upgrade)
- **1 construção por terreno**, ocupando-o inteiro (sem sistema de slots
  ainda — ver nota abaixo)
- Precificação de aluguel (jogador define; sistema mostra o recomendado)
- Fórmula do aluguel justo completa, com `mercado = 1.0` e `inflacao = 1.0`
  fixos (sem eventos ainda)
- IPTU + imposto progressivo mensal
- Fechamento de mês (avaliação de ocupação, crédito, débito, timer
  resiliente)
- Falência (período de graça de 2 meses)
- Fim de partida: 24 meses ou colapso populacional; vitério **por
  patrimônio apenas** (Reputação ainda não existe — ver nota)

## O que FICA DE FORA (fatias seguintes, propositalmente)

| Fora do escopo | Por quê | Entra em |
|---|---|---|
| Eventos econômicos | O nível de propriedade só é interessante com ciclo de mercado | Fatia 2 |
| Empréstimos (`EmprestimoMapa`) | Sistema à parte, com garantia/execução própria | Fatia 2 |
| Reputação | Precisa de histórico de comportamento acumulado | Fatia 2 |
| Níveis de propriedade (upgrade) | A "aposta estocástica" do nível alto só existe com eventos | Fatia 2 |
| Sistema de slots / construção posicional | A economia foi simulada assumindo 1 construção por terreno | Fatia 3 |
| Tiles, pixel art, Y-sorting | Placeholder visual é suficiente para provar o loop | Fatia 4 |
| Sublocação | Complexidade de negociação entre jogadores | Fatia 5 |

**Consequência temporária no critério de vitória:** sem Reputação ainda, a
vitória desta fatia é **só patrimônio líquido**, sem desempate. O desempate
por Reputação entra junto com a mecânica, na Fatia 2.

---

## ETAPA 0 — Auditoria obrigatória

```bash
# Confirmar tipoJogo existente e os campos reaproveitáveis
grep -n "tipoJogo\|rodadaAtual\|eventoAtual" server/prisma/schema.prisma

# Ver o padrão Propriedade/SessionPosses (molde para Terreno/SessionTerreno)
sed -n '/^model Propriedade/,/^}/p' server/prisma/schema.prisma
sed -n '/^model SessionPosses/,/^}/p' server/prisma/schema.prisma

# Ver withLock (usar o mesmo em toda ação disputável)
cat server/src/middleware/lock.middleware.ts

# Ver o padrão de timer resiliente já corrigido no Modo Tabuleiro
# (reaproveitar a MESMA técnica, não reinventar)
grep -n "varrerTurnosExpirados\|garantirTimerAtivo\|agendarTimeout" \
  server/src/modules/turno/services/timer.service.ts

# Ver Debt e Historico (genéricos, reaproveitar sem alteração)
sed -n '/^model Debt/,/^}/p' server/prisma/schema.prisma
sed -n '/^model Historico/,/^}/p' server/prisma/schema.prisma

# Ver como as rotas se registram (padrão a seguir)
cat server/src/api/routes/index.ts

# Ver módulo emprestimo (exemplo recente de módulo isolado, bom modelo a seguir)
ls server/src/modules/emprestimo/
```

---

## ETAPA 1 — Schema

```prisma
enum TipoJogo {
  banca
  tabuleiro
  mapa2d   // NOVO
}
// (ajustar o enum existente — não duplicar)

enum CategoriaRegiao {
  comum
  mediana
  rica
}

enum TipoConstrucao {
  casa
  sobrado
  comercio
  apartamento
  centro_comercial
  hotel
  corporativo
}

/// Referência ESTÁTICA — populada uma vez no startup, nunca por sessão.
/// Espelha o padrão de `Propriedade` (Modo Tabuleiro).
model Terreno {
  id            Int             @id @default(autoincrement())
  codigo        String          @unique   // ex: "vila-nova-01"
  regiaoNome    String                    // ex: "Vila Nova"
  categoria     CategoriaRegiao
  multiplicador Float                     // ex: 0.60
  slots         Int             @default(1)  // reservado p/ Fatia 3; hoje sempre 1 construção
  precoBase     Int                       // preço do terreno (já calculado, ver Etapa 2)

  sessionTerrenos SessionTerreno[]

  @@map("terrenos_mapa2d")
}

/// Dinâmico por sessão — espelha `SessionPosses`.
model SessionTerreno {
  id        Int     @id @default(autoincrement())
  sessionId Int
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  terrenoId Int
  terreno   Terreno @relation(fields: [terrenoId], references: [id])

  donoId Int?
  dono   SessionPlayer? @relation(fields: [donoId], references: [id])

  precoPago    Int?
  adquiridoEm  DateTime?

  construcao Construcao?

  @@unique([sessionId, terrenoId])  // REQUISITO DE SEGURANÇA — ver Etapa 4
  @@index([sessionId])
  @@index([donoId])
  @@map("session_terrenos_mapa2d")
}

model Construcao {
  id               Int      @id @default(autoincrement())
  sessionTerrenoId Int      @unique
  sessionTerreno   SessionTerreno @relation(fields: [sessionTerrenoId], references: [id], onDelete: Cascade)

  tipo          TipoConstrucao
  nivel         Int      @default(1)   // fixo em 1 nesta fatia
  aluguelPedido Int      @default(0)
  ocupado       Boolean  @default(false)
  construidoEm  DateTime @default(now())

  @@map("construcoes_mapa2d")
}
```

Adicionar em `SessionPlayer` (reaproveitado, campo novo):

```prisma
model SessionPlayer {
  // ...campos existentes...
  reputacao Float @default(3.0)  // NOVO — só usado quando tipoJogo=mapa2d,
                                   // não usado nesta fatia (preparar o campo
                                   // já evita migration extra na Fatia 2)
  sessionTerrenos SessionTerreno[]
}
```

Adicionar em `Session` — **nenhum campo novo necessário**. `rodadaAtual` já
serve como "mês atual". `eventoAtual`/`eventoProximo` ficam **não usados**
nesta fatia (permanecem `null`) — serão ativados na Fatia 2.

---

## ETAPA 2 — Dados estáticos (seed dos 76 terrenos)

Criar `server/data/mapa2d/regioes.json` com as 18 regiões e seus
multiplicadores (valores do GDD Seção 4):

```json
[
  { "nome": "Vila Nova", "categoria": "comum", "multiplicador": 0.60, "terrenos": 5 },
  { "nome": "Trizidela", "categoria": "comum", "multiplicador": 0.70, "terrenos": 4 },
  { "nome": "Formosa", "categoria": "comum", "multiplicador": 0.65, "terrenos": 5 },
  { "nome": "Boa Vista", "categoria": "comum", "multiplicador": 0.55, "terrenos": 4 },
  { "nome": "Santa Cruz", "categoria": "comum", "multiplicador": 0.72, "terrenos": 5 },
  { "nome": "Vila Operária", "categoria": "comum", "multiplicador": 0.68, "terrenos": 5 },
  { "nome": "Mascherano", "categoria": "mediana", "multiplicador": 1.30, "terrenos": 5 },
  { "nome": "Duque de Caxias", "categoria": "mediana", "multiplicador": 1.50, "terrenos": 4 },
  { "nome": "Vila Esperança", "categoria": "mediana", "multiplicador": 1.10, "terrenos": 4 },
  { "nome": "Paulo Feto", "categoria": "mediana", "multiplicador": 1.40, "terrenos": 4 },
  { "nome": "Jardim das Flores", "categoria": "mediana", "multiplicador": 1.20, "terrenos": 5 },
  { "nome": "Vila Progresso", "categoria": "mediana", "multiplicador": 1.15, "terrenos": 4 },
  { "nome": "Nova Aliança", "categoria": "mediana", "multiplicador": 1.45, "terrenos": 4 },
  { "nome": "Alphaville", "categoria": "rica", "multiplicador": 3.50, "terrenos": 3 },
  { "nome": "Lagoa de Pedra", "categoria": "rica", "multiplicador": 2.80, "terrenos": 4 },
  { "nome": "Três Poderes", "categoria": "rica", "multiplicador": 3.20, "terrenos": 4 },
  { "nome": "Jardins Altos", "categoria": "rica", "multiplicador": 3.70, "terrenos": 3 },
  { "nome": "Riviera", "categoria": "rica", "multiplicador": 3.00, "terrenos": 4 }
]
```

Script de seed (`server/prisma/seeds/mapa2d.seed.ts`), gerando os 76
terrenos a partir das regiões (preço = `300 × multiplicador`, arredondado
para múltiplo de 5 — fórmula validada no GDD):

```typescript
import regioes from "../../data/mapa2d/regioes.json";

export async function seedMapa2D(prisma: PrismaClient) {
  for (const regiao of regioes) {
    for (let i = 1; i <= regiao.terrenos; i++) {
      const codigo = `${slugify(regiao.nome)}-${String(i).padStart(2, "0")}`;
      const precoBase = Math.round((300 * regiao.multiplicador) / 5) * 5;

      await prisma.terreno.upsert({
        where: { codigo },
        update: {},
        create: {
          codigo,
          regiaoNome: regiao.nome,
          categoria: regiao.categoria,
          multiplicador: regiao.multiplicador,
          slots: 1,
          precoBase,
        },
      });
    }
  }
}
```

Rodar o seed no startup (mesmo padrão do seed de `propriedades.json`, se
houver um mecanismo existente — verificar em `server/src/index.ts`).

---

## ETAPA 3 — Constantes econômicas

Criar `server/src/constants/economiaMapa2D.ts` (arquivo **separado** de
`economia.ts` do Modo Tabuleiro — domínios diferentes):

```typescript
export const SALDO_INICIAL_MAPA2D = 1000;
export const CUSTO_POR_SLOT = 120;
export const RENDA_BASE_REF = 50;       // aluguel de referência região "Popular equivalente"
export const MANUTENCAO_PCT_N1 = 0.12;

export const MULT_CONSTRUCAO: Record<string, number> = {
  casa: 1.0, sobrado: 1.6, comercio: 1.8, apartamento: 2.5,
  centro_comercial: 3.2, hotel: 3.0, corporativo: 4.0,
};
export const SLOTS_CONSTRUCAO: Record<string, number> = {
  casa: 1, sobrado: 2, comercio: 2, apartamento: 3,
  centro_comercial: 4, hotel: 4, corporativo: 6,
};

// Imposto progressivo (faixas validadas no GDD)
export const FAIXAS_IMPOSTO = [
  { min: 0,      max: 1_500,        aliquota: 0.010 },
  { min: 1_500,  max: 5_000,        aliquota: 0.020 },
  { min: 5_000,  max: 15_000,       aliquota: 0.035 },
  { min: 15_000, max: Infinity,     aliquota: 0.055 },
];
export const IPTU_PCT = 0.03;

export const MESES_TOTAIS = 24;
export const RODADA_DURACAO_MS = 5 * 60 * 1000;   // 5 minutos

// Curva de ocupação (validada por simulação)
export const OCUPACAO_LIMIAR_INFERIOR = 0.9;  // abaixo disso, ocupação = 100%
export function sensibilidadeRegiao(categoria: "comum"|"mediana"|"rica") {
  return { comum: 0.15, mediana: 0.30, rica: 0.50 }[categoria];
}
```

---

## ETAPA 4 — Módulo `mapa2d` (novo)

Estrutura seguindo o padrão do projeto:

```
server/src/modules/mapa2d/
├── mapa2d.repository.ts
├── mapa2d.service.ts
├── mapa2d.controller.ts
└── services/
    ├── terreno.service.ts
    ├── construcao.service.ts
    ├── economia.service.ts
    └── fechamento.service.ts
```

### 4.1 — Compra de terreno (atomicidade obrigatória)

```typescript
// terreno.service.ts
async comprarTerreno(sessionId: number, playerId: number, terrenoId: number) {
  const player = await mapa2dRepository.findPlayer(playerId);
  const terreno = await mapa2dRepository.findTerreno(terrenoId);
  if (!player || !terreno) throw new AppError(404, "Não encontrado.");

  const sessionTerreno = await mapa2dRepository.findSessionTerreno(sessionId, terrenoId);
  const preco = sessionTerreno?.precoPago ?? terreno.precoBase;
  if (player.saldo < preco) throw new AppError(400, "Saldo insuficiente.");

  // ATÔMICO — updateMany com WHERE condicional. NUNCA "ler depois escrever".
  const resultado = await prisma.sessionTerreno.updateMany({
    where: { sessionId, terrenoId, donoId: null },
    data: { donoId: playerId, precoPago: terreno.precoBase, adquiridoEm: new Date() },
  });

  if (resultado.count === 0) {
    throw new AppError(409, "Este terreno já foi comprado.");
  }

  await prisma.sessionPlayer.update({
    where: { id: playerId },
    data: { saldo: { decrement: terreno.precoBase } },
  });

  await mapa2dRepository.criarHistorico(sessionId, "COMPRA_TERRENO",
    `${player.nome} comprou ${terreno.codigo} por R$ ${terreno.precoBase}`);

  emitToRoom(sessionId, "terreno:comprado", { terrenoId, donoId: playerId });
  return { sucesso: true };
}
```

**Todo `SessionTerreno` de uma sessão nova nasce com `donoId: null`** (criado
em lote ao iniciar a partida, espelhando os 76 terrenos estáticos). O
"terreno grátis" do início é uma exceção: atribuído diretamente no setup da
sessão, fora do fluxo de compra concorrente.

### 4.2 — Construir (1 por terreno, nível 1 fixo)

```typescript
async construir(sessionId: number, playerId: number, sessionTerrenoId: number, tipo: TipoConstrucao) {
  const st = await mapa2dRepository.findSessionTerreno(sessionId, sessionTerrenoId);
  if (!st || st.donoId !== playerId) throw new AppError(403, "Você não é dono deste terreno.");
  if (st.construcao) throw new AppError(400, "Este terreno já tem uma construção.");

  const custo = SLOTS_CONSTRUCAO[tipo] * CUSTO_POR_SLOT;
  const player = await mapa2dRepository.findPlayer(playerId);
  if (player.saldo < custo) throw new AppError(400, "Saldo insuficiente.");

  // Atômico: cria a Construcao só se ainda não existir (constraint @unique em sessionTerrenoId)
  await prisma.construcao.create({
    data: { sessionTerrenoId, tipo, nivel: 1, aluguelPedido: 0, ocupado: false },
  });
  // Se a constraint disparar erro de duplicidade (corrida rara), capturar e
  // converter em AppError(409, "Construção já iniciada neste terreno.")

  await prisma.sessionPlayer.update({
    where: { id: playerId }, data: { saldo: { decrement: custo } },
  });

  return { sucesso: true, custo };
}
```

### 4.3 — Precificar aluguel

```typescript
async precificar(sessionId: number, playerId: number, construcaoId: number, aluguelPedido: number) {
  const construcao = await mapa2dRepository.findConstrucaoDoJogador(construcaoId, playerId);
  if (!construcao) throw new AppError(403, "Construção não encontrada.");
  if (aluguelPedido < 0) throw new AppError(400, "Valor inválido.");

  await prisma.construcao.update({ where: { id: construcaoId }, data: { aluguelPedido } });
  return { sucesso: true };
}

/** Aluguel recomendado — para exibir na UI antes do jogador decidir. */
async getAluguelRecomendado(sessionTerrenoId: number, tipo: TipoConstrucao) {
  const st = await mapa2dRepository.findSessionTerrenoComTerreno(sessionTerrenoId);
  const base = RENDA_BASE_REF * st.terreno.multiplicador;
  // mercado e inflação fixos em 1.0 nesta fatia (sem eventos ainda)
  return Math.round(base * MULT_CONSTRUCAO[tipo] * 1.0 * 1.0);
}
```

### 4.4 — Fechamento de mês

```typescript
// fechamento.service.ts
async fecharMes(sessionId: number) {
  return withLock(`mapa2d:${sessionId}`, async () => {
    const session = await mapa2dRepository.findSessionAtiva(sessionId);
    if (!session) return null;

    const construcoes = await mapa2dRepository.findConstrucoesComDono(sessionId);

    for (const c of construcoes) {
      const recomendado = await this.getAluguelRecomendado(c.sessionTerrenoId, c.tipo);
      const ocupa = this.calcularOcupacao(c.aluguelPedido, recomendado, c.sessionTerreno.terreno.categoria);
      const manutencao = Math.round(recomendado * MANUTENCAO_PCT_N1);

      if (ocupa) {
        await this.creditar(c.sessionTerreno.donoId, c.aluguelPedido - manutencao);
        await prisma.construcao.update({ where: { id: c.id }, data: { ocupado: true } });
      } else {
        await this.debitar(c.sessionTerreno.donoId, manutencao);
        await prisma.construcao.update({ where: { id: c.id }, data: { ocupado: false } });
      }
    }

    // IPTU + imposto progressivo, por jogador
    const players = await mapa2dRepository.findPlayersAtivos(sessionId);
    for (const p of players) {
      await this.cobrarImpostos(sessionId, p);
      await this.verificarFalencia(sessionId, p);
    }

    const novoMes = session.rodadaAtual + 1;
    await mapa2dRepository.updateSession(sessionId, { rodadaAtual: novoMes });

    if (novoMes > MESES_TOTAIS || (await this.colapsoPopulacional(sessionId))) {
      return this.encerrarPartida(sessionId);
    }

    // Reagendar — MESMO PADRÃO RESILIENTE do Modo Tabuleiro (timestamp + varredura)
    await mapa2dTimerService.agendarFechamento(sessionId);

    emitToRoom(sessionId, "mes:fechado", { mesAtual: novoMes });
  });
}

private calcularOcupacao(pedido: number, justo: number, categoria: string): boolean {
  const sens = sensibilidadeRegiao(categoria as any);
  const razao = pedido / justo;
  let prob: number;
  if (razao <= OCUPACAO_LIMIAR_INFERIOR) prob = 1.0;
  else if (razao >= 1 + sens) prob = 0.05;
  else prob = Math.max(0.05, 1 - (razao - 0.9) / ((1 + sens) - 0.9) * 0.95);
  return Math.random() < prob;
}
```

**CRÍTICO — timer resiliente.** O fechamento de mês **não pode** usar
`setTimeout` solto em memória. Seguir **exatamente** o padrão já corrigido
no Modo Tabuleiro (`FIX_TURNO_TRAVADO_CONTADOR.md`): timestamp gravado no
banco (`fecharMesEm` — novo campo em `Session` ou tabela própria) +
varredura periódica que detecta e recupera fechamentos perdidos por
hibernação do servidor. **Não reimplementar do zero** — adaptar o
`timer.service.ts` existente.

### 4.5 — Falência (sem empréstimo ainda nesta fatia)

```typescript
async verificarFalencia(sessionId: number, player: SessionPlayer) {
  const patrimonio = await this.calcularPatrimonio(sessionId, player.id);
  const divida = await prisma.debt.findFirst({ where: { sessionId, playerId: player.id, pago: false } });

  if (!divida) return;

  if (patrimonio >= divida.valor) return; // consegue cobrir, sem problema

  const rodadas = (player.rodadasDevendo ?? 0) + 1;
  if (rodadas < 3) {
    await prisma.sessionPlayer.update({ where: { id: player.id }, data: { rodadasDevendo: rodadas } });
    return;
  }

  // 3º mês devendo: falência. SEM execução de garantia nesta fatia
  // (EmprestimoMapa não existe ainda — entra na Fatia 2).
  await prisma.sessionTerreno.updateMany({
    where: { sessionId, donoId: player.id },
    data: { donoId: null, precoPago: null, adquiridoEm: null },
  });
  await prisma.construcao.deleteMany({
    where: { sessionTerreno: { sessionId, donoId: player.id } },
  });
  await prisma.sessionPlayer.update({
    where: { id: player.id },
    data: { desistiu: true, motivoDesistencia: "FALENCIA", saldo: 0 },
  });
}
```

---

## ETAPA 5 — Início de partida

```typescript
async iniciarPartida(sessionId: number) {
  const players = await mapa2dRepository.findPlayers(sessionId);
  const terrenosComuns = await prisma.terreno.findMany({ where: { categoria: "comum" } });

  // Criar SessionTerreno para TODOS os 76 terrenos (todos sem dono)
  const todosOsTerrenos = await prisma.terreno.findMany();
  await prisma.sessionTerreno.createMany({
    data: todosOsTerrenos.map(t => ({ sessionId, terrenoId: t.id })),
  });

  // Sortear 1 terreno comum por jogador (sem repetir) e atribuir grátis
  const sorteados = shuffle(terrenosComuns).slice(0, players.length);
  for (let i = 0; i < players.length; i++) {
    await prisma.sessionTerreno.updateMany({
      where: { sessionId, terrenoId: sorteados[i].id },
      data: { donoId: players[i].id, precoPago: 0, adquiridoEm: new Date() },
    });
    await prisma.sessionPlayer.update({
      where: { id: players[i].id },
      data: { saldo: SALDO_INICIAL_MAPA2D },
    });
  }

  await mapa2dRepository.updateSession(sessionId, { rodadaAtual: 1, status: "Em Andamento" });
  await mapa2dTimerService.agendarFechamento(sessionId);
}
```

---

## ETAPA 6 — Fim de partida (vitória por patrimônio, sem Reputação ainda)

```typescript
async encerrarPartida(sessionId: number) {
  const players = await mapa2dRepository.findPlayersAtivos(sessionId);
  const comPatrimonio = await Promise.all(
    players.map(async p => ({ player: p, patrimonio: await this.calcularPatrimonio(sessionId, p.id) }))
  );
  comPatrimonio.sort((a, b) => b.patrimonio - a.patrimonio);

  // NOTA: sem desempate por Reputação nesta fatia — critério simples,
  // Reputação entra na Fatia 2 (ver GDD Seção 3).
  await mapa2dRepository.updateSession(sessionId, { status: "Finalizada" });
  emitToRoom(sessionId, "partida:encerrada", { ranking: comPatrimonio });
}
```

---

## ETAPA 7 — Rotas

```typescript
// server/src/api/routes/mapa2d.route.ts
router.post("/:sessionId/terreno/:terrenoId/comprar", authenticate, roomAuth, mapa2dController.comprarTerreno);
router.post("/:sessionId/terreno/:sessionTerrenoId/construir", authenticate, roomAuth, mapa2dController.construir);
router.post("/:sessionId/construcao/:construcaoId/precificar", authenticate, roomAuth, mapa2dController.precificar);
router.get("/:sessionId/estado", authenticate, roomAuth, mapa2dController.getEstado);
```

Registrar em `server/src/api/routes/index.ts`, seguindo o padrão dos
módulos existentes.

---

## ETAPA 8 — Frontend (placeholder, sem tiles ainda)

- Grid simples de 76 células (React, `<div>` coloridos por categoria —
  verde=comum, azul=mediana, dourado=rica)
- Clique numa célula abre um painel lateral: comprar / construir / precificar
- HUD superior: saldo, patrimônio, mês atual, timer de 5 min
- **Nenhum tile, nenhuma imagem, nenhuma animação** — isso é Fatia 4

---

## ETAPA 9 — Testes (SEM rota `/testes`)

Seguir o padrão já estabelecido no projeto — Jest + banco isolado
`gamebank_test`, **nunca** uma rota HTTP exposta:

```
server/src/modules/mapa2d/__tests__/
├── terreno.service.test.ts
├── construcao.service.test.ts
└── fechamento.service.test.ts
```

### Testes obrigatórios

**Atomicidade (o requisito não-negociável):**
- [ ] Duas requisições simultâneas de compra do mesmo terreno → só uma
      sucede, a outra recebe 409 imediatamente
- [ ] Teste de concorrência real: disparar N requisições em paralelo
      (`Promise.all`) contra o mesmo terreno, confirmar que exatamente 1
      teve sucesso

**Economia:**
- [ ] Saldo inicial é R$ 1.000 + terreno grátis (categoria comum)
- [ ] Comprar terreno debita o preço correto (`precoBase` da região)
- [ ] Construir debita `slots × 120`
- [ ] Aluguel recomendado bate com a fórmula (base × mult região × mult tipo)
- [ ] Ocupação: preço ≤ 90% do justo → sempre ocupa; acima da sensibilidade
      da região → quase nunca ocupa
- [ ] IPTU e imposto progressivo debitados corretamente no fechamento
- [ ] Acumular terrenos vazios leva à falência em poucos meses (validar o
      anti-exploit já simulado no GDD)

**Falência:**
- [ ] 2 meses de graça, 3º mês devendo = falência
- [ ] Falência devolve terrenos ao banco (`donoId: null`) e remove construções
- [ ] Falência marca `desistiu: true`, `motivoDesistencia: "FALENCIA"`

**Fim de partida:**
- [ ] 24 meses completos encerra a partida
- [ ] Colapso populacional (metade ou menos ativos) encerra antes
- [ ] Vencedor = maior patrimônio (sem Reputação nesta fatia)

**Resiliência do timer:**
- [ ] Fechamento de mês sobrevive a um "restart" simulado do processo
      (timer perdido → varredura recupera)

**Não quebrou nada:**
- [ ] Modo Banca funciona normalmente
- [ ] Modo Tabuleiro funciona normalmente
- [ ] `make validate` passa

---

## Definição de "pronto"

1. Schema com `Terreno`, `SessionTerreno` (com `@@unique`), `Construcao`
2. Seed dos 76 terrenos rodando no startup
3. Compra de terreno atômica, testada sob concorrência real
4. Construção (7 tipos, nível 1, 1 por terreno)
5. Aluguel com fórmula validada (mercado/inflação fixos em 1.0)
6. IPTU + imposto progressivo aplicados no fechamento
7. Fechamento de mês com timer resiliente (mesmo padrão do Modo Tabuleiro)
8. Falência com período de graça de 2 meses
9. Fim de partida por tempo ou colapso, vitória por patrimônio
10. Grid placeholder funcional (sem tiles)
11. Testes em `__tests__/`, sem rota `/testes`
12. Modo Banca e Modo Tabuleiro intactos
13. `make validate` passa

---

## Nota final

Esta fatia é deliberadamente mais restrita que a economia completa já
simulada no GDD. O objetivo não é entregar tudo de uma vez — é ter um loop
**jogável e testável** o quanto antes, para validar com partidas reais se a
economia (payback, anti-exploit, curva de ocupação) se comporta como as
simulações previram. Eventos, empréstimos, níveis e Reputação chegam na
Fatia 2, já com o núcleo provado.
