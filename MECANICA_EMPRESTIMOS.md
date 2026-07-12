# Implementação: Empréstimos com Garantia — GameBank

## Contexto

Quinta e última das mecânicas econômicas (ver MECANICAS_ECONOMICAS.md).
O jogador pode pegar empréstimo do banco, mas com **garantia real** e
**juros compostos** que crescem rápido.

**Objetivo:** adicionar alavancagem como decisão estratégica. Arriscar para
comprar aquele terreno decisivo — mas se não gerar renda rápido, os juros
te comem e você perde seu melhor ativo.

**IMPORTANTE — exclusivo do Modo Tabuleiro.** O Modo Banca não é afetado.

---

## Parâmetros (definidos pelo dono do projeto)

| Item | Valor |
|------|-------|
| **Limite de crédito** | 50% do valor das propriedades **não hipotecadas** |
| **Juros** | 10% por rodada, **compostos** |
| **Garantia** | A propriedade que **mais rende** para o jogador |
| **Quitação** | A qualquer momento, valor + juros acumulados |
| **Execução** | Na falência (3 rodadas devendo), o banco toma a garantia |

---

## DESCOBERTA DA AUDITORIA — Integração com o que já existe

### Tabela `Debt` já existe
```prisma
model Debt {
  id, sessionId, playerId, valor, descricao, pago, createdAt, paidAt
}
```
É a tabela central de dívidas. **O empréstimo NÃO deve criar uma tabela
paralela de dívida** — mas precisa de estado próprio (juros, garantia), então
terá tabela própria que **gera** uma `Debt` quando vira inadimplência.

### `verificarFalencia` já existe
Roda a cada turno do jogador. Se há `Debt` não paga, incrementa
`rodadasDevendo`. Em 3 rodadas → falência: propriedades voltam ao banco,
saldo zera, jogador sai.

**Ponto de integração crítico:** a execução da garantia deve acontecer
**ANTES** da falência limpar as propriedades — senão não há o que executar.

### Desistência já bloqueia com dívida
`desistirSession` (linha ~491) já impede desistir com dívidas pendentes.
Empréstimo ativo deve entrar nessa mesma trava.

---

## ETAPA 0 — Auditoria obrigatória

```bash
# 1. Ver a tabela Debt (dívida central)
sed -n '/^model Debt/,/^}/p' server/prisma/schema.prisma

# 2. Ver verificarFalencia (ponto de integração da garantia)
sed -n '/private async verificarFalencia/,/^  }$/p' server/src/modules/turno/turno.service.ts

# 3. Ver a trava de desistência com dívida
grep -n "dívidas pendentes\|dividas pendentes" server/src/modules/session/session.service.ts

# 4. Ver o cálculo de aluguel (usado para achar a prop que mais rende)
grep -n "calcularAluguel" server/src/modules/turno/turno.service.ts

# 5. Confirmar que a Mecânica 1 existe (renda passiva entra no cálculo)
cat server/src/constants/economia.ts

# 6. Ver cobrarComFallbackDivida (gera Debt — reutilizar)
sed -n '/private async cobrarComFallbackDivida/,/^  }$/p' server/src/modules/turno/turno.service.ts
```

---

## ETAPA 1 — Schema

```prisma
model Emprestimo {
  id              Int      @id @default(autoincrement())
  sessionId       Int
  playerId        Int

  valorOriginal   Int      // quanto foi emprestado
  valorDevido     Int      // valor + juros acumulados (atualiza a cada rodada)
  garantiaPropId  Int      // propriedade dada em garantia

  quitado         Boolean  @default(false)
  executado       Boolean  @default(false)  // garantia foi tomada
  criadoEm        DateTime @default(now())
  quitadoEm       DateTime?

  session   Session       @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  player    SessionPlayer @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@index([sessionId, playerId])
  @@index([playerId, quitado])
}
```

**Regra:** um jogador pode ter **apenas 1 empréstimo ativo por vez**
(simplifica a garantia e evita empilhamento de juros). Validar isso no service.

---

## ETAPA 2 — Constantes

Adicionar em `server/src/constants/economia.ts`:

```typescript
/** Limite de crédito: % do valor das propriedades não hipotecadas. */
export const EMPRESTIMO_LIMITE_PCT = 0.50;

/** Juros compostos por rodada. */
export const EMPRESTIMO_JUROS_PCT = 0.10;
```

---

## ETAPA 3 — Cálculo do limite de crédito

```typescript
/**
 * Limite = 50% do valor das propriedades NÃO hipotecadas.
 * Valor da propriedade = custo_compra + (casas × custo_casa).
 * Ações (grupo Preto) CONTAM (são patrimônio real).
 */
async calcularLimiteCredito(sessionId: number, playerId: number): Promise<number> {
  const posses = await propriedadeRepository.findSessionPossesByPlayer(sessionId, playerId);

  let valorTotal = 0;
  for (const posse of posses) {
    if (!posse.propriedade) continue;
    if (posse.hipotecada) continue;   // hipotecada não conta

    valorTotal += posse.propriedade.custo_compra;
    valorTotal += (posse.casas ?? 0) * posse.propriedade.custo_casa;
  }

  return Math.floor(valorTotal * EMPRESTIMO_LIMITE_PCT);
}
```

---

## ETAPA 4 — Escolha da garantia (a propriedade que mais rende)

**Regra do dono do projeto:** a garantia é a propriedade que **mais rende
atualmente** para o jogador — a que mais dói perder.

```typescript
/**
 * Renda atual de uma propriedade = aluguel atual + renda passiva.
 * Retorna a propriedade de MAIOR renda (não hipotecada).
 */
private async escolherGarantia(sessionId: number, playerId: number) {
  const posses = await propriedadeRepository.findSessionPossesByPlayer(sessionId, playerId);

  let melhor: { posse: any; renda: number } | null = null;

  for (const posse of posses) {
    const prop = posse.propriedade;
    if (!prop || posse.hipotecada) continue;

    const casas = posse.casas ?? 0;

    // Aluguel atual (considerando casas)
    let aluguel: number;
    if (prop.tipo === "ação") {
      // Ação rende 500 × dados. Usar média dos dados (7) como referência.
      aluguel = 500 * 7;
    } else {
      aluguel = this.calcularAluguel(prop, casas);
    }

    // Renda passiva (Mecânica 1) — se implementada
    const rendaPassiva = Math.round(aluguel * RENDA_PASSIVA_PCT);

    const rendaTotal = aluguel + rendaPassiva;

    if (!melhor || rendaTotal > melhor.renda) {
      melhor = { posse, renda: rendaTotal };
    }
  }

  return melhor?.posse ?? null;
}
```

**Se o jogador não tem nenhuma propriedade livre** → não pode pegar
empréstimo (sem garantia).

---

## ETAPA 5 — Pegar empréstimo

```typescript
async pegarEmprestimo(sessionId: number, playerId: number, valor: number) {
  return withLock(`emprestimo:${sessionId}:${playerId}`, async () => {
    const session = await this.validarESessaoAtiva(sessionId);

    // 1. Já tem empréstimo ativo? (só 1 por vez)
    const ativo = await emprestimoRepository.findAtivo(sessionId, playerId);
    if (ativo) {
      throw new AppError(400, "Você já tem um empréstimo ativo. Quite-o antes de pegar outro.");
    }

    // 2. Validar limite
    const limite = await this.calcularLimiteCredito(sessionId, playerId);
    if (limite <= 0) {
      throw new AppError(400, "Você não tem propriedades livres para dar como garantia.");
    }
    if (valor <= 0) throw new AppError(400, "Valor inválido.");
    if (valor > limite) {
      throw new AppError(400, `Seu limite de crédito é R$ ${limite.toLocaleString("pt-BR")}.`);
    }

    // 3. Definir a garantia (a propriedade que mais rende)
    const garantia = await this.escolherGarantia(sessionId, playerId);
    if (!garantia) {
      throw new AppError(400, "Você não tem propriedades livres para dar como garantia.");
    }

    // 4. Creditar o valor e registrar o empréstimo
    const { prisma } = await import("../../lib/prisma.js");
    await prisma.$transaction(async (tx) => {
      await tx.sessionPlayer.update({
        where: { id: playerId },
        data: { saldo: { increment: valor } },
      });

      await tx.emprestimo.create({
        data: {
          sessionId, playerId,
          valorOriginal: valor,
          valorDevido: valor,          // juros começam a contar na próxima rodada
          garantiaPropId: garantia.propriedade.id,
        },
      });
    });

    await turnoRepository.criarHistorico({
      sessionId,
      tipo: "EMPRESTIMO",
      detalhes: `Empréstimo de R$ ${valor} — garantia: ${garantia.propriedade.nome}`,
    });

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return {
      valor,
      garantia: {
        propId: garantia.propriedade.id,
        nome: garantia.propriedade.nome,
      },
      jurosPct: EMPRESTIMO_JUROS_PCT,
    };
  });
}
```

---

## ETAPA 6 — Juros compostos por rodada

Os juros incidem **a cada rodada do jogador**. O ponto natural é o mesmo
onde `verificarFalencia` roda — no início do turno do jogador.

```typescript
/**
 * Aplica juros compostos ao empréstimo ativo do jogador.
 * Chamado no início de cada turno dele.
 */
private async aplicarJurosEmprestimo(sessionId: number, playerId: number) {
  const emp = await emprestimoRepository.findAtivo(sessionId, playerId);
  if (!emp) return null;

  // Modificador de evento econômico (Mecânica 2), se houver
  const mods = await this.getModificadores(sessionId);
  const jurosPct = EMPRESTIMO_JUROS_PCT * (mods.jurosMult ?? 1);

  const novoDevido = Math.round(emp.valorDevido * (1 + jurosPct));

  await emprestimoRepository.atualizarDevido(emp.id, novoDevido);

  emitToRoom(sessionId, "emprestimo:juros", {
    playerId,
    valorAnterior: emp.valorDevido,
    valorAtual: novoDevido,
    jurosPct,
  });

  return { valorDevido: novoDevido };
}
```

**Chamar em `rolarDados`**, junto com `verificarFalencia`:

```typescript
// No início de rolarDados, ANTES de verificarFalencia:
await this.aplicarJurosEmprestimo(sessionId, playerId);

const falencia = await this.verificarFalencia(sessionId, session, player);
if (falencia) return falencia;
```

### Eventos econômicos e juros

Se a Mecânica 2 estiver implementada, adicionar ao `EventoEfeito`:

```typescript
// server/src/constants/eventos.ts
export type EventoEfeito = {
  // ...campos existentes...
  jurosMult?: number;   // multiplicador dos juros de empréstimo
};

// Adicionar 2 eventos novos ao catálogo:
{
  codigo: "ALTA_JUROS",
  nome: "Alta de Juros",
  descricao: "O banco central subiu a taxa básica.",
  dica: "Juros de empréstimo dobram nesta rodada. Quite dívidas antes.",
  icone: "📊", cor: "vermelho",
  efeito: { jurosMult: 2 },      // 10% → 20%
},
{
  codigo: "CORTE_JUROS",
  nome: "Corte de Juros",
  descricao: "O banco central reduziu a taxa básica.",
  dica: "Juros caem pela metade. Bom momento para pegar empréstimo.",
  icone: "📉", cor: "verde",
  efeito: { jurosMult: 0.5 },    // 10% → 5%
},
```

---

## ETAPA 7 — Quitar empréstimo

```typescript
async quitarEmprestimo(sessionId: number, playerId: number) {
  return withLock(`emprestimo:${sessionId}:${playerId}`, async () => {
    const emp = await emprestimoRepository.findAtivo(sessionId, playerId);
    if (!emp) throw new AppError(400, "Você não tem empréstimo ativo.");

    const player = await turnoRepository.findPlayerParaJogada(playerId);
    if (!player) throw new AppError(404, "Jogador não encontrado.");

    if (player.saldo < emp.valorDevido) {
      throw new AppError(
        400,
        `Saldo insuficiente. Você precisa de R$ ${emp.valorDevido.toLocaleString("pt-BR")}.`
      );
    }

    const { prisma } = await import("../../lib/prisma.js");
    await prisma.$transaction(async (tx) => {
      await tx.sessionPlayer.update({
        where: { id: playerId },
        data: { saldo: { decrement: emp.valorDevido } },
      });
      await tx.emprestimo.update({
        where: { id: emp.id },
        data: { quitado: true, quitadoEm: new Date() },
      });
    });

    await turnoRepository.criarHistorico({
      sessionId,
      tipo: "EMPRESTIMO_QUITADO",
      detalhes: `Empréstimo quitado por R$ ${emp.valorDevido}`,
    });

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return { quitado: true, valorPago: emp.valorDevido };
  });
}
```

**Quitação parcial:** não permitida (simplifica). O jogador quita tudo ou nada.

---

## ETAPA 8 — Execução da garantia (integração com falência)

**PONTO MAIS DELICADO.** A garantia deve ser executada **ANTES** de a
falência limpar as propriedades.

Modificar `verificarFalencia`:

```typescript
private async verificarFalencia(sessionId, session, player) {
  const { prisma } = await import("../../lib/prisma.js");
  const dividaAtiva = await prisma.debt.findFirst({
    where: { sessionId, playerId: player.id, pago: false },
  });
  if (!dividaAtiva) return null;

  const atual = await prisma.sessionPlayer.findUnique({
    where: { id: player.id },
    select: { rodadasDevendo: true, saldo: true },
  });
  const rodadas = (atual?.rodadasDevendo ?? 0) + 1;

  if (rodadas < 3) {
    await prisma.sessionPlayer.update({
      where: { id: player.id },
      data: { rodadasDevendo: rodadas },
    });
    return null;
  }

  // ── NOVO: ANTES da falência, executar a garantia do empréstimo ──
  await this.executarGarantia(sessionId, player.id);

  // ...resto da lógica de falência EXISTENTE (patrimônio, limpar posses, etc.)
}

/**
 * Executa a garantia: o banco toma a propriedade dada como garantia.
 * Chamado quando o jogador vai falir.
 */
private async executarGarantia(sessionId: number, playerId: number) {
  const emp = await emprestimoRepository.findAtivo(sessionId, playerId);
  if (!emp) return;

  const { prisma } = await import("../../lib/prisma.js");
  await prisma.$transaction(async (tx) => {
    // A propriedade da garantia volta ao banco (sem dono, sem casas)
    await tx.sessionPosses.updateMany({
      where: { sessionId, propriedadeId: emp.garantiaPropId, playerId },
      data: { playerId: null, casas: 0, hipotecada: false, negociando: false },
    });

    await tx.emprestimo.update({
      where: { id: emp.id },
      data: { executado: true, quitado: true, quitadoEm: new Date() },
    });
  });

  await turnoRepository.criarHistorico({
    sessionId,
    tipo: "GARANTIA_EXECUTADA",
    detalhes: `Garantia executada: o banco tomou a propriedade do empréstimo não pago.`,
  });

  emitToRoom(sessionId, "emprestimo:garantia_executada", {
    playerId,
    propId: emp.garantiaPropId,
  });
}
```

**ATENÇÃO:** a falência **já limpa todas as propriedades** de qualquer jeito.
A execução da garantia é importante porque:
1. Registra explicitamente que o banco tomou o ativo (histórico/UX)
2. Marca o empréstimo como `executado` (evita dívida fantasma)
3. Se no futuro a falência mudar (ex: leilão dos bens), a garantia já sai antes

---

## ETAPA 9 — Travas de segurança

### 9.1 — Não pode desistir com empréstimo ativo

Em `session.service.ts`, na `desistirSession`, junto da trava de dívida:

```typescript
// Já existe: bloqueia desistir com dívida pendente
// ADICIONAR: bloquear com empréstimo ativo
const empAtivo = await prisma.emprestimo.findFirst({
  where: { sessionId, playerId: player.id, quitado: false },
});
if (empAtivo) {
  throw new AppError(400, "Você não pode desistir com empréstimo ativo. Quite-o primeiro.");
}
```

### 9.2 — Não pode hipotecar/vender a propriedade dada em garantia

Em `propriedade.service.ts`, nas funções de hipoteca e venda:

```typescript
// Antes de hipotecar ou vender uma propriedade, verificar se é garantia
const empAtivo = await prisma.emprestimo.findFirst({
  where: { sessionId, playerId, quitado: false, garantiaPropId: propId },
});
if (empAtivo) {
  throw new AppError(400, "Esta propriedade está dada como garantia de um empréstimo.");
}
```

**Isso é essencial.** Sem essa trava, o jogador pega o empréstimo, hipoteca
a garantia (recebendo mais dinheiro) e deixa o banco sem nada para executar.

### 9.3 — Não pode negociar a propriedade em garantia

Mesma verificação no módulo de negociação.

---

## ETAPA 10 — Rotas e API

```typescript
// server/src/api/routes/emprestimo.route.ts
router.get("/:sessionId/limite", authenticate, roomAuth, emprestimoController.getLimite);
router.post("/:sessionId/pegar", authenticate, roomAuth, emprestimoController.pegar);
router.post("/:sessionId/quitar", authenticate, roomAuth, emprestimoController.quitar);
```

O `getLimite` retorna: limite disponível, garantia que seria usada, e a
projeção de juros — para a UI mostrar antes de confirmar.

---

## ETAPA 11 — UI/UX (crítico)

O empréstimo é uma **armadilha se mal comunicado**. O jogador precisa
entender exatamente o que está arriscando.

### Modal de empréstimo

```
┌─────────────────────────────────────────────┐
│           🏦 EMPRÉSTIMO BANCÁRIO             │
│                                             │
│  Seu limite:      R$ 8.500                  │
│  (50% das suas propriedades livres)         │
│                                             │
│  Valor:  [  R$ 5.000            ]           │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ ⚠️ GARANTIA                            │  │
│  │                                       │  │
│  │ Av. Paulista (2 casas)                │  │
│  │ Sua propriedade que mais rende         │  │
│  │                                       │  │
│  │ Se você falir, o banco toma ela.      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  📈 Projeção de juros (10% por rodada):     │
│     Rodada 1:   R$ 5.500                    │
│     Rodada 3:   R$ 6.655                    │
│     Rodada 5:   R$ 8.053                    │
│     Rodada 7:   R$ 9.744  ← quase dobrou    │
│                                             │
│  [ Cancelar ]         [ Pegar Empréstimo ]  │
└─────────────────────────────────────────────┘
```

**Elementos obrigatórios:**
- Limite disponível, com explicação de como foi calculado
- **Garantia em destaque** — qual propriedade e por que ela foi escolhida
- **Projeção de juros** — mostrar como a dívida cresce. Isso é o que impede
  o jogador de se enforcar sem entender
- Aviso claro: falir = perder a garantia

### Indicador permanente (aba Início)

Se há empréstimo ativo:

```
┌────────────────────────────────────┐
│ 🏦 Empréstimo ativo                │
│                                    │
│ Devido agora:      R$ 6.655        │
│ Próxima rodada:    R$ 7.320  (+10%)│
│ Garantia:          Av. Paulista    │
│                                    │
│         [ Quitar agora ]           │
└────────────────────────────────────┘
```

Sempre visível. O jogador não pode "esquecer" que está devendo.

### Notificação de juros

A cada rodada, toast discreto:
`"Juros do empréstimo: R$ 6.655 → R$ 7.320"`

### Execução da garantia

Modal de destaque (é um evento grave):
```
🏦 GARANTIA EXECUTADA

O banco tomou Av. Paulista pelo empréstimo não pago.
```

---

## ETAPA 12 — Atualizar regras (Client + README)

### Onboarding
- Você pode pegar empréstimo do banco: até **50% do valor das suas
  propriedades livres**
- **Juros de 10% por rodada, compostos** — a dívida dobra em ~7 rodadas
- A **propriedade que mais rende** fica como garantia
- Se você falir, **o banco toma a garantia**
- Não é possível hipotecar, vender ou negociar a propriedade em garantia
- Não é possível desistir com empréstimo ativo

### README
```markdown
### Modo Tabuleiro — Empréstimos
- Limite de 50% do valor das propriedades não hipotecadas
- Juros compostos de 10% por rodada (afetados por eventos econômicos)
- Garantia automática: a propriedade que mais rende para o jogador
- Propriedade em garantia não pode ser hipotecada, vendida ou negociada
- Falência executa a garantia: o banco toma a propriedade
- Apenas 1 empréstimo ativo por vez
```

---

## ETAPA 13 — Testes manuais obrigatórios

### Limite e garantia
- [ ] Limite = 50% do valor das propriedades não hipotecadas
- [ ] Propriedade hipotecada NÃO conta no limite
- [ ] Casas construídas contam no valor
- [ ] Sem propriedades livres → não pode pegar empréstimo
- [ ] Garantia é a propriedade de MAIOR renda (aluguel + renda passiva)
- [ ] Pegar acima do limite é rejeitado

### Juros
- [ ] Juros de 10% aplicados a cada rodada do jogador
- [ ] Juros são COMPOSTOS (incidem sobre o valor já com juros)
- [ ] Após 7 rodadas, a dívida praticamente dobrou
- [ ] Evento "Alta de Juros" dobra a taxa (se Mecânica 2 ativa)
- [ ] Evento "Corte de Juros" reduz pela metade

### Quitação
- [ ] Quitar debita o valor devido (com juros) do saldo
- [ ] Quitar sem saldo suficiente é rejeitado
- [ ] Após quitar, pode pegar novo empréstimo
- [ ] Não pode ter 2 empréstimos ativos ao mesmo tempo

### Travas de segurança (crítico)
- [ ] **NÃO pode hipotecar a propriedade em garantia**
- [ ] **NÃO pode vender a propriedade em garantia**
- [ ] **NÃO pode negociar a propriedade em garantia**
- [ ] **NÃO pode desistir com empréstimo ativo**
- [ ] Vender CASAS da propriedade em garantia: permitido? (decidir — sugiro
      permitir, já que a propriedade em si permanece)

### Falência e execução
- [ ] Falência com empréstimo ativo executa a garantia
- [ ] Garantia é executada ANTES de a falência limpar as propriedades
- [ ] Empréstimo marcado como `executado` (não fica dívida fantasma)
- [ ] Histórico registra a execução
- [ ] Falência sem empréstimo funciona igual a antes

### Integração
- [ ] Extrato do Início (Mecânica 1) funciona normalmente
- [ ] Eventos econômicos (Mecânica 2) afetam os juros
- [ ] Escolha de movimento (Mecânica 3) inalterada
- [ ] Leilão (Mecânica 4) — pode dar lance com dinheiro de empréstimo
- [ ] Compra, aluguel, prisão, feriado inalterados
- [ ] Modo Banca NÃO afetado

### UX
- [ ] Modal mostra o limite e como foi calculado
- [ ] Garantia em destaque, com aviso claro
- [ ] **Projeção de juros visível ANTES de confirmar**
- [ ] Indicador permanente na aba Início com valor devido
- [ ] Toast de juros a cada rodada
- [ ] Modal de destaque na execução da garantia

### Build
- [ ] `make validate` passa

---

## Definição de "pronto"

1. Tabela `Emprestimo` no schema
2. Limite = 50% das propriedades livres
3. Garantia = a propriedade de maior renda
4. Juros compostos de 10% aplicados por rodada
5. Quitação integral funcionando
6. **Travas:** não hipotecar/vender/negociar a garantia; não desistir com
   empréstimo ativo
7. Execução da garantia integrada à falência (ANTES de limpar posses)
8. UI com projeção de juros e indicador permanente
9. Regras atualizadas (onboarding + README)
10. Todos os testes passando; Modo Banca intacto

---

## Anti-exploit — por que não dá para "pegar e não pagar"

| Tentativa de roubo | Como está fechado |
|--------------------|-------------------|
| Pegar e deixar rolar até falir | Juros compostos: a dívida dobra em ~7 rodadas. Falir = perder a garantia (o melhor ativo) |
| Hipotecar a garantia após pegar | **Bloqueado** (Etapa 9.2) |
| Vender a garantia | **Bloqueado** (Etapa 9.2) |
| Passar a garantia numa negociação | **Bloqueado** (Etapa 9.3) |
| Desistir e escapar | **Bloqueado** (Etapa 9.1) |
| Empilhar vários empréstimos | Apenas 1 ativo por vez |
| Pegar mais do que pode pagar | Limite de 50% do patrimônio livre |

As travas da Etapa 9 são o que fazem a mecânica funcionar. **Sem elas, o
empréstimo vira dinheiro grátis.**
