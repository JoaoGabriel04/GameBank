# Implementação: Leilão Cego — GameBank

## Contexto

Quarta das cinco mecânicas econômicas (ver MECANICAS_ECONOMICAS.md).
Quando um jogador **recusa comprar** uma propriedade em que caiu, ela vai a
**leilão cego** entre todos os jogadores.

**Objetivo:** transformar cada casa recusada numa decisão coletiva. Quanto
vale essa propriedade pra você? Vale pagar acima da tabela pra impedir o
monopólio do adversário?

**Por que CEGO:** elimina conluio na raiz. Como ninguém vê o lance dos
outros, não dá para combinar "não dou lance se você não der" — o parceiro
pode te trair e levar barato. A incerteza mata o acordo.

**IMPORTANTE — exclusivo do Modo Tabuleiro.** O Modo Banca não é afetado.

**RISCO ALTO:** esta mecânica **pausa o fluxo de turno** e envolve todos os
jogadores simultaneamente. É a de maior risco das cinco. Teste exaustivamente.

---

## DESCOBERTA DA AUDITORIA

### O gatilho já existe
`recusarCompra` (turno.service.ts) hoje apenas limpa `aguardandoAcao` e
avança o turno. É exatamente aí que o leilão vai entrar.

### O cálculo de patrimônio já existe
Usado na desistência (linhas ~241-245): `saldo + custo_compra das props +
casas × custo_casa`. Reutilizar para o **desempate** do leilão.

### PROBLEMA: timers em memória
`turnoTimers` é um `Map` em memória (linha 20). O leilão precisa de um timer
próprio de 30s — e ele sofre do **mesmo problema do BUG 6** (perdido se o
processo hibernar no free tier).

**Solução:** o timer do leilão deve seguir o mesmo padrão de resiliência
adotado na correção do BUG 6 (timestamp no banco + varredura periódica).
Se o BUG 6 ainda não foi corrigido, corrija ANTES desta mecânica.

---

## ETAPA 0 — Auditoria obrigatória

```bash
# 1. Confirmar que o BUG 6 (timers resilientes) foi corrigido
grep -n "varrerTurnosExpirados\|garantirTimerAtivo" server/src/modules/turno/turno.service.ts
# Se NÃO existir, PARE. Corrija o BUG 6 primeiro (TABULEIRO_FIXES.md).

# 2. Ver o recusarCompra (gatilho do leilão)
sed -n '/async recusarCompra/,/^  }$/p' server/src/modules/turno/turno.service.ts

# 3. Ver o cálculo de patrimônio (reutilizar no desempate)
grep -n "patrimony" server/src/modules/turno/turno.service.ts

# 4. Ver a estrutura de timers
grep -n "turnoTimers\|cancelTurnoTimer\|agendarTimeout" server/src/modules/turno/turno.service.ts

# 5. Ver buyProp (será reutilizado para transferir ao vencedor)
grep -n "buyProp" server/src/modules/propriedade/propriedade.service.ts

# 6. Ver os eventos socket existentes
grep -rn "emitToRoom\|emitUpdatedSession" server/src/modules/socket/socket.handler.ts | head
```

---

## ETAPA 1 — Schema

```prisma
model Session {
  // ...campos existentes...
  emLeilao          Boolean   @default(false)
  leilaoPropId      Int?      // propriedade sendo leiloada
  leilaoIniciadoEm  DateTime? // para timer resiliente (padrão do BUG 6)
  leilaoLanceMinimo Int?      // 50% do preço de tabela
}

model LeilaoLance {
  id         Int      @id @default(autoincrement())
  sessionId  Int
  propId     Int
  playerId   Int
  valor      Int      // 0 = passou (não quer)
  criadoEm   DateTime @default(now())

  session    Session       @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  player     SessionPlayer @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([sessionId, propId, playerId])  // 1 lance por jogador por leilão
  @@index([sessionId, propId])
}
```

**`@@unique` é crítico:** garante que cada jogador dá **um único lance** por
leilão (lance vinculante, não pode mudar de ideia).

---

## ETAPA 2 — Constantes

Adicionar em `server/src/constants/economia.ts`:

```typescript
/** Lance mínimo: % do preço de tabela da propriedade. */
export const LEILAO_LANCE_MINIMO_PCT = 0.50;

/** Tempo para dar o lance (ms). */
export const LEILAO_TIMEOUT_MS = 30_000;
```

---

## ETAPA 3 — Iniciar o leilão (a partir da recusa)

Modificar `recusarCompra`:

```typescript
async recusarCompra(sessionId: number, playerId: number) {
  return withLock(`turno:${sessionId}`, async () => {
    const session = await this.validarPendenciaDeCompra(sessionId, playerId);
    await turnoRepository.setAguardandoAcao(sessionId, false);

    const casa = getCasa(session.posicaoJogador);
    if (casa.propId == null) {
      // Nada a leiloar — comportamento antigo
      return this.finalizarRecusaSemLeilao(sessionId, session);
    }

    // ── NOVO: recusar dispara LEILÃO ──────────────────────────────
    return this.iniciarLeilao(sessionId, session, casa.propId);
  });
}

private async iniciarLeilao(sessionId: number, session, propId: number) {
  const posse = await propriedadeRepository.findSessionPosses(sessionId, propId);
  if (!posse?.propriedade) {
    return this.finalizarRecusaSemLeilao(sessionId, session);
  }

  const lanceMinimo = Math.round(
    posse.propriedade.custo_compra * LEILAO_LANCE_MINIMO_PCT
  );

  // PAUSA o timer do turno — o leilão tem timer próprio
  cancelTurnoTimer(sessionId);

  await turnoRepository.updateTurno(sessionId, {
    emLeilao: true,
    leilaoPropId: propId,
    leilaoIniciadoEm: new Date(),
    leilaoLanceMinimo: lanceMinimo,
  });

  // Limpar lances antigos desta propriedade (segurança)
  await leilaoRepository.limparLances(sessionId, propId);

  // Agendar encerramento em 30s (timer resiliente — ver Etapa 6)
  await this.agendarTimeoutLeilao(sessionId);

  emitToRoom(sessionId, "leilao:iniciado", {
    propId,
    nome: posse.propriedade.nome,
    precoTabela: posse.propriedade.custo_compra,
    lanceMinimo,
    timeoutMs: LEILAO_TIMEOUT_MS,
  });

  const { emitUpdatedSession } = await import("../socket/socket.handler.js");
  await emitUpdatedSession(sessionId);

  return { recusado: true, leilaoIniciado: true, propId, lanceMinimo };
}
```

**ATENÇÃO — o turno NÃO avança durante o leilão.** O jogador da vez continua
sendo o mesmo; o turno só avança **depois** que o leilão for resolvido.

---

## ETAPA 4 — Dar lance (cego)

```typescript
async darLance(sessionId: number, playerId: number, valor: number) {
  return withLock(`leilao:${sessionId}`, async () => {   // lock PRÓPRIO do leilão
    const session = await turnoRepository.findSessionComTurno(sessionId);
    if (!session?.emLeilao || session.leilaoPropId == null) {
      throw new AppError(400, "Não há leilão em andamento.");
    }

    const player = await turnoRepository.findPlayerParaJogada(playerId);
    if (!player || player.sessionId !== sessionId || player.desistiu) {
      throw new AppError(403, "Você não participa desta sessão.");
    }

    // Já deu lance? (lance é VINCULANTE — não pode mudar)
    const existente = await leilaoRepository.findLance(sessionId, session.leilaoPropId, playerId);
    if (existente) throw new AppError(400, "Você já deu seu lance neste leilão.");

    // valor 0 = passou (não quer participar)
    if (valor > 0) {
      const minimo = session.leilaoLanceMinimo ?? 0;
      if (valor < minimo) {
        throw new AppError(400, `O lance mínimo é R$ ${minimo}.`);
      }
      if (valor > player.saldo) {
        throw new AppError(400, "Você não tem saldo suficiente para esse lance.");
      }
    }

    await leilaoRepository.criarLance({
      sessionId, propId: session.leilaoPropId, playerId, valor,
    });

    // NÃO revela o lance — só avisa que o jogador já decidiu
    emitToRoom(sessionId, "leilao:jogador_decidiu", { playerId });

    // Se TODOS os jogadores ativos já deram lance, encerra antes do timeout
    const ativos = await leilaoRepository.contarJogadoresAtivos(sessionId);
    const lances = await leilaoRepository.contarLances(sessionId, session.leilaoPropId);

    if (lances >= ativos) {
      return this.encerrarLeilaoInterno(sessionId, session);
    }

    return { lanceRegistrado: true };
  });
}
```

**Privacidade do lance:** o evento `leilao:jogador_decidiu` informa **apenas
que o jogador decidiu**, nunca o valor. Os lances só são revelados no fim.

---

## ETAPA 5 — Encerrar o leilão e definir o vencedor

```typescript
private async encerrarLeilaoInterno(sessionId: number, session) {
  const propId = session.leilaoPropId;
  if (propId == null) return null;

  cancelLeilaoTimer(sessionId);

  const lances = await leilaoRepository.findLances(sessionId, propId);
  const validos = lances.filter(l => l.valor > 0);

  let vencedor: { playerId: number; valor: number } | null = null;

  if (validos.length > 0) {
    const maiorValor = Math.max(...validos.map(l => l.valor));
    const empatados = validos.filter(l => l.valor === maiorValor);

    if (empatados.length === 1) {
      vencedor = { playerId: empatados[0].playerId, valor: maiorValor };
    } else {
      // ── DESEMPATE: menor patrimônio leva (mecânica de catch-up) ──
      const patrimonios = await Promise.all(
        empatados.map(async l => ({
          playerId: l.playerId,
          patrimonio: await this.calcularPatrimonio(l.playerId),
        }))
      );
      patrimonios.sort((a, b) => a.patrimonio - b.patrimonio);
      vencedor = { playerId: patrimonios[0].playerId, valor: maiorValor };
    }
  }

  // Aplicar o resultado
  if (vencedor) {
    // Lance VINCULANTE: o vencedor é obrigado a comprar.
    // Reutiliza buyProp, mas com o valor do lance (não o de tabela).
    await propriedadeService.buyPropPorValor(propId, sessionId, vencedor.playerId, vencedor.valor);

    await turnoRepository.criarHistorico({
      sessionId,
      tipo: "LEILAO",
      detalhes: `Leilão encerrado: propriedade arrematada por R$ ${vencedor.valor}`,
    });
  } else {
    await turnoRepository.criarHistorico({
      sessionId,
      tipo: "LEILAO",
      detalhes: `Leilão encerrado sem lances — propriedade segue sem dono.`,
    });
  }

  // Limpar o estado de leilão
  await turnoRepository.updateTurno(sessionId, {
    emLeilao: false,
    leilaoPropId: null,
    leilaoIniciadoEm: null,
    leilaoLanceMinimo: null,
  });
  await leilaoRepository.limparLances(sessionId, propId);

  // Revelar TODOS os lances (agora sim)
  emitToRoom(sessionId, "leilao:resultado", {
    propId,
    lances: lances.map(l => ({ playerId: l.playerId, valor: l.valor })),
    vencedorId: vencedor?.playerId ?? null,
    valorFinal: vencedor?.valor ?? null,
  });

  // ── RETOMAR O TURNO ──────────────────────────────────────────
  // O jogador que recusou continua na vez (a menos que tenha tirado duplo,
  // caso em que joga de novo; senão o turno avança).
  const foiDuplo = session.ultimoDado1 != null && session.ultimoDado1 === session.ultimoDado2;

  if (!foiDuplo) {
    const sessionAtual = await turnoRepository.findSessionComJogadores(sessionId);
    const avanco = await this.avancarTurno(sessionId, sessionAtual!);
    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);
    return { leilaoEncerrado: true, vencedor, ...avanco };
  }

  // Duplo: o mesmo jogador joga de novo — reagenda o timer do turno
  await this.agendarTimeout(sessionId);
  const { emitUpdatedSession } = await import("../socket/socket.handler.js");
  await emitUpdatedSession(sessionId);
  return { leilaoEncerrado: true, vencedor, avancou: false, duplo: true };
}
```

### `buyPropPorValor` (novo método no propriedade.service)

O `buyProp` atual cobra o preço de tabela. O leilão precisa cobrar **o valor
do lance**:

```typescript
async buyPropPorValor(propId: number, sessionId: number, playerId: number, valor: number) {
  // Mesma lógica de buyProp, mas com valor customizado.
  // Reutilizar o máximo possível; extrair o corpo comum se necessário.
  // Debita `valor` do saldo, atribui a posse ao playerId.
  // Se o saldo não cobrir (não deveria — validado no lance), usar
  // cobrarComFallbackDivida para não quebrar.
}
```

---

## ETAPA 6 — Timer resiliente do leilão

**Mesmo padrão da correção do BUG 6.** O timer em memória não basta.

```typescript
const leilaoTimers = new Map<number, NodeJS.Timeout>();

function cancelLeilaoTimer(sessionId: number) {
  const t = leilaoTimers.get(sessionId);
  if (t) { clearTimeout(t); leilaoTimers.delete(sessionId); }
}

private async agendarTimeoutLeilao(sessionId: number) {
  cancelLeilaoTimer(sessionId);
  const timer = setTimeout(() => {
    this.encerrarLeilaoPorTimeout(sessionId).catch(err => {
      sessionLogger.error({ err, sessionId }, "erro ao encerrar leilão por timeout");
    });
  }, LEILAO_TIMEOUT_MS);
  leilaoTimers.set(sessionId, timer);
}

async encerrarLeilaoPorTimeout(sessionId: number) {
  return withLock(`leilao:${sessionId}`, async () => {
    const session = await turnoRepository.findSessionComTurno(sessionId);
    if (!session?.emLeilao) return null;   // já encerrado
    return this.encerrarLeilaoInterno(sessionId, session);
  });
}
```

### Varredura periódica (resiliência)

Estender a varredura criada no BUG 6 para também detectar **leilões travados**:

```typescript
async varrerLeiloesExpirados() {
  const sessions = await turnoRepository.findSessionsEmLeilao();
  const agora = Date.now();

  for (const s of sessions) {
    if (!s.leilaoIniciadoEm) continue;
    const elapsed = agora - new Date(s.leilaoIniciadoEm).getTime();

    if (elapsed >= LEILAO_TIMEOUT_MS + 2000) {  // margem
      sessionLogger.warn({ sessionId: s.id }, "leilão expirado detectado pela varredura");
      await this.encerrarLeilaoPorTimeout(s.id).catch(() => {});
    }
  }
}
```

Chamar junto com `varrerTurnosExpirados` no intervalo de 15s.

**Sem isso, um leilão pode travar a partida inteira no free tier.**

---

## ETAPA 7 — Rotas e API

```typescript
// server/src/api/routes/leilao.route.ts (novo arquivo, padrão do projeto)
router.post("/:sessionId/lance", authenticate, roomAuth, leilaoController.darLance);
```

```typescript
// Body: { valor: number }  — 0 = passar
```

Frontend: `client/src/services/api/leilao.ts`

---

## ETAPA 8 — UI/UX (crítico)

### Modal de leilão (para TODOS os jogadores, simultâneo)

```
┌────────────────────────────────────────────┐
│           🔨 LEILÃO CEGO                   │
│                                            │
│        Av. Paulista                        │
│        Preço de tabela: R$ 4.000           │
│        Lance mínimo:    R$ 2.000           │
│                                            │
│   Seu lance:  [  R$ 2.500        ]         │
│   Seu saldo:  R$ 12.400                    │
│                                            │
│   ⚠️ Lance vinculante — se vencer,          │
│      você é obrigado a comprar.            │
│      Ninguém vê seu lance.                 │
│                                            │
│   [ Dar lance ]        [ Passar ]          │
│                                            │
│   ⏱ 23s                                    │
│   Já decidiram: João ✓  Maria ✓  Pedro ⋯   │
└────────────────────────────────────────────┘
```

**Requisitos:**
- Aparece para **todos os jogadores ativos** ao mesmo tempo
- **Nunca mostra o lance dos outros** — só quem já decidiu (✓ ou ⋯)
- Aviso claro de que o lance é **vinculante**
- Validação no input: mínimo e saldo disponível
- Countdown de 30s bem visível
- Botão "Passar" para quem não quer participar
- Após dar o lance, o modal fica em estado de espera ("Aguardando os outros...")

### Modal de resultado (revelação)

```
┌────────────────────────────────────────────┐
│         🔨 RESULTADO DO LEILÃO             │
│                                            │
│         Av. Paulista                       │
│                                            │
│   🏆 Maria      R$ 3.200   ← arrematou     │
│      João       R$ 2.800                   │
│      Pedro      R$ 2.100                   │
│      Você       passou                     │
│                                            │
│   Maria arrematou por R$ 3.200             │
│   (R$ 800 abaixo da tabela)                │
│                                            │
│            [ Continuar ]                   │
└────────────────────────────────────────────┘
```

- **Agora sim revela todos os lances** — o momento de tensão do leilão cego
- Destaque no vencedor
- Fecha em 6s ou no clique

### Se ninguém deu lance

```
Ninguém arrematou. A propriedade continua sem dono.
```

### Ordem correta (delay)

```
1. Jogador cai na propriedade → modal de compra
2. Recusa
3. LEILÃO abre para todos (modal simultâneo)     ← NOVO
4. Todos dão lance (ou passam) / timeout 30s
5. Resultado revelado a todos
6. Turno retoma (avança ou joga de novo se duplo)
```

O turno **não avança** até o leilão fechar. Isso precisa estar claro na UI:
os outros jogadores veem "Leilão em andamento" no lugar do banner de turno.

---

## ETAPA 9 — Atualizar regras (Client + README)

### Onboarding
- Se você recusar comprar uma propriedade, ela vai a **leilão cego**
- Todos dão lance ao mesmo tempo, **sem ver o lance dos outros**
- Lance mínimo: 50% do preço de tabela
- **Lance vinculante:** se vencer, é obrigado a comprar
- Empate: quem tem **menor patrimônio** leva
- Ninguém deu lance? A propriedade continua sem dono

### README
```markdown
### Modo Tabuleiro — Leilão Cego
- Propriedade recusada vai a leilão entre todos os jogadores
- Lances simultâneos e secretos (leilão cego) — evita conluio
- Lance mínimo de 50% do preço de tabela; lance é vinculante
- Empate resolvido pelo menor patrimônio (catch-up)
- Timeout de 30s; sem lances, a propriedade segue sem dono
```

---

## ETAPA 10 — Testes manuais obrigatórios

### Fluxo básico
- [ ] Recusar compra abre o leilão para todos
- [ ] Modal aparece simultaneamente para todos os jogadores ativos
- [ ] Lance abaixo do mínimo é rejeitado
- [ ] Lance acima do saldo é rejeitado
- [ ] "Passar" registra lance 0
- [ ] Maior lance vence
- [ ] Vencedor é debitado o valor do LANCE (não o de tabela)
- [ ] Propriedade é transferida ao vencedor
- [ ] Ninguém deu lance → propriedade segue sem dono

### Sigilo (o coração da mecânica)
- [ ] Nenhum jogador vê o lance dos outros ANTES do resultado
- [ ] O evento socket só informa "fulano decidiu", nunca o valor
- [ ] Todos os lances são revelados APENAS no resultado

### Lance vinculante
- [ ] Não é possível dar dois lances no mesmo leilão
- [ ] Vencedor é obrigado a comprar (não há opção de desistir)
- [ ] Constraint @@unique impede lance duplicado no banco

### Desempate
- [ ] Empate no maior lance → menor patrimônio vence
- [ ] Patrimônio calculado corretamente (saldo + props + casas)

### Turno
- [ ] Turno NÃO avança durante o leilão
- [ ] Timer do turno pausa durante o leilão
- [ ] Após o leilão, turno avança normalmente
- [ ] Se o jogador que recusou tirou duplo → joga de novo após o leilão
- [ ] Outros jogadores veem "Leilão em andamento" (não o banner de turno)

### Timeout e resiliência (crítico)
- [ ] Timeout de 30s encerra o leilão automaticamente
- [ ] Quem não deu lance no tempo → conta como "passou"
- [ ] Todos deram lance antes dos 30s → encerra imediatamente
- [ ] **Restart do servidor durante o leilão → varredura recupera em ≤15s**
- [ ] Leilão travado não bloqueia a partida indefinidamente

### Não quebrar o existente
- [ ] Compra normal (aceitar) funciona igual
- [ ] Falência, hipoteca, negociação inalterados
- [ ] Eventos econômicos (Mecânica 2) continuam funcionando
- [ ] Extrato do Início (Mecânica 1) continua funcionando
- [ ] Escolha de movimento (Mecânica 3) continua funcionando
- [ ] Modo Banca NÃO afetado

### Build
- [ ] `make validate` passa

---

## Definição de "pronto"

1. Schema com `emLeilao`, `leilaoPropId`, `leilaoIniciadoEm`, `LeilaoLance`
2. `recusarCompra` dispara o leilão
3. `darLance` com lock próprio, validação de mínimo/saldo, lance único
4. Encerramento com desempate por menor patrimônio
5. `buyPropPorValor` cobrando o valor do lance
6. Timer resiliente + varredura periódica (não trava a partida)
7. Turno pausado durante o leilão, retomado corretamente após
8. UI: modal simultâneo, sigilo total, revelação no resultado
9. Regras atualizadas (onboarding + README)
10. Todos os testes passando; Modo Banca intacto

---

## Riscos conhecidos

| Risco | Mitigação |
|-------|-----------|
| Leilão trava a partida (timer perdido) | Varredura periódica de 15s (Etapa 6) |
| Deadlock entre lock de turno e de leilão | Locks separados: `turno:${id}` e `leilao:${id}` |
| Jogador desconecta durante o leilão | Timeout conta como "passou" |
| Lance vaza para outros jogadores | Evento socket nunca inclui o valor |
| Vencedor sem saldo (race condition) | Validação no lance + fallback de dívida |

**Este é o `.md` de maior risco.** Teste com 4+ jogadores reais antes de
considerar pronto.
