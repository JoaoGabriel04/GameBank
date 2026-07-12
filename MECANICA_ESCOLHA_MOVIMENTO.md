# Implementação: Escolha de Movimento — GameBank

## Contexto

Terceira das cinco mecânicas econômicas (ver MECANICAS_ECONOMICAS.md).
Após rolar os dados, o jogador **escolhe** quantas casas andar:

- Apenas o **dado 1**
- Apenas o **dado 2**
- A **soma** dos dois (comportamento atual)

**Objetivo:** reduzir o peso da sorte. Cada rolagem passa a ser uma decisão
tática real — "ando 3 e compro aquela propriedade livre, ou ando 8 e escapo
do hotel dele?".

**IMPORTANTE — exclusivo do Modo Tabuleiro.** O Modo Banca não é afetado.

---

## DESCOBERTA DA AUDITORIA — O fluxo atual é atômico

Hoje `rolarDados` faz **tudo numa única chamada**:

```
rolarDados()
  → sorteia dado1, dado2
  → verifica 3 duplos
  → moverEResolver(dado1 + dado2)     ← move E resolve a casa
  → avancarTurno (se não houver duplo/ação pendente)
```

Para a escolha de movimento, esse fluxo precisa ser **quebrado em duas
etapas**, com um estado intermediário: *dados rolados, aguardando escolha*.

Esta é a mudança estrutural mais delicada da mecânica.

---

## ETAPA 0 — Auditoria obrigatória

```bash
# 1. Ver o fluxo atual de rolarDados (será dividido)
sed -n '81,140p' server/src/modules/turno/turno.service.ts

# 2. Ver o estado aguardandoAcao (padrão a seguir)
grep -n "aguardandoAcao\|setAguardandoAcao" server/src/modules/turno/turno.service.ts

# 3. Ver o timeout automático (precisa escolher sozinho)
sed -n '/async avancarPorTimeout/,/^  }$/p' server/src/modules/turno/turno.service.ts

# 4. Ver a regra de duplos (será alterada)
grep -n "duplosConsecutivos\|duplo" server/src/modules/turno/turno.service.ts | head -12

# 5. Ver a prisão (NÃO deve ser afetada)
sed -n '/private async rolarDadosEmPrisao/,/^  }$/p' server/src/modules/turno/turno.service.ts | head -30

# 6. Frontend: onde os dados são rolados
grep -rn "rolarDados\|handleRolar" client/src/components/Board --include="*.tsx"
```

---

## ETAPA 1 — Schema: estado de escolha pendente

```prisma
model Session {
  // ...campos existentes...
  aguardandoEscolha  Boolean  @default(false)  // dados rolados, esperando escolha
  // ultimoDado1 e ultimoDado2 já existem — serão reutilizados
}
```

**Não criar campos novos para os dados** — `ultimoDado1` e `ultimoDado2` já
existem e guardam a rolagem.

---

## ETAPA 2 — Dividir `rolarDados` em duas etapas

### 2.1 — `rolarDados` (nova versão: só rola, não move)

```typescript
async rolarDados(sessionId: number, playerId: number) {
  return withLock(`turno:${sessionId}`, async () => {
    const session = await this.validarESessaoAtiva(sessionId);

    if (session.turnoAtualPlayerId !== playerId) {
      throw new AppError(403, "Não é sua vez de jogar.");
    }
    if (session.aguardandoAcao) {
      throw new AppError(400, "Resolva a ação pendente antes de rolar os dados.");
    }
    // NOVO: não pode rolar de novo se já rolou e não escolheu
    if (session.aguardandoEscolha) {
      throw new AppError(400, "Escolha o movimento antes de rolar novamente.");
    }

    const player = await turnoRepository.findPlayerParaJogada(playerId);
    if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");

    const falencia = await this.verificarFalencia(sessionId, session, player);
    if (falencia) return falencia;

    // PRISÃO: fluxo inalterado — não há escolha de movimento na prisão
    if (player.emPrisao) {
      return this.rolarDadosEmPrisao(sessionId, session, player);
    }

    const dado1 = Math.floor(Math.random() * 6) + 1;
    const dado2 = Math.floor(Math.random() * 6) + 1;
    const duplo = dado1 === dado2;

    // Contagem de duplos: mantida IGUAL (3 duplos → prisão)
    const contagemAnterior = duplosConsecutivos.get(playerId) ?? 0;
    const contagemAtual = duplo ? contagemAnterior + 1 : 0;
    duplosConsecutivos.set(playerId, contagemAtual);

    // 3 duplos seguidos → prisão direta, SEM escolha de movimento
    if (contagemAtual >= 3) {
      duplosConsecutivos.set(playerId, 0);
      await turnoRepository.moverPlayer(playerId, { posicao: POS_PRISAO, emPrisao: true, turnosPrisao: 3 });
      await turnoRepository.registrarDados(sessionId, {
        ultimoDado1: dado1, ultimoDado2: dado2,
        aguardandoAcao: false, aguardandoEscolha: false,
      });

      const avanco = await this.avancarTurno(sessionId, session);
      return { dado1, dado2, duplo: true, foiPreso: true, novaPosicao: POS_PRISAO, passouInicio: false, ...avanco };
    }

    // NOVO: guarda os dados e ENTRA EM ESTADO DE ESCOLHA (não move ainda)
    await turnoRepository.registrarDados(sessionId, {
      ultimoDado1: dado1, ultimoDado2: dado2,
      aguardandoAcao: false,
      aguardandoEscolha: true,   // ← aguarda a escolha do jogador
    });

    // Reset do timer: o jogador tem os 60s para escolher
    await this.agendarTimeout(sessionId);

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    // Retorna os dados e as OPÇÕES — sem mover
    return {
      dado1, dado2, duplo,
      aguardandoEscolha: true,
      opcoes: this.calcularOpcoesMovimento(player.posicao, dado1, dado2),
    };
  });
}
```

### 2.2 — Calcular as opções (para a UI mostrar o destino de cada uma)

```typescript
/** Retorna as 3 opções de movimento com o destino de cada uma. */
private calcularOpcoesMovimento(posAtual: number, dado1: number, dado2: number) {
  const montar = (passos: number, tipo: "dado1" | "dado2" | "soma") => {
    const destino = (posAtual + passos) % TOTAL_CASAS;
    const casa = getCasa(destino);
    return {
      tipo,
      passos,
      destino,
      nomeCasa: casa.nome,
      tipoCasa: casa.tipo,
      passaInicio: (posAtual + passos) >= TOTAL_CASAS,
    };
  };

  return [
    montar(dado1, "dado1"),
    montar(dado2, "dado2"),
    montar(dado1 + dado2, "soma"),
  ];
}
```

### 2.3 — `escolherMovimento` (novo método: move e resolve)

```typescript
async escolherMovimento(
  sessionId: number,
  playerId: number,
  escolha: "dado1" | "dado2" | "soma"
) {
  return withLock(`turno:${sessionId}`, async () => {
    const session = await this.validarESessaoAtiva(sessionId);

    if (session.turnoAtualPlayerId !== playerId) {
      throw new AppError(403, "Não é sua vez de jogar.");
    }
    if (!session.aguardandoEscolha) {
      throw new AppError(400, "Não há escolha de movimento pendente.");
    }

    const dado1 = session.ultimoDado1 ?? 0;
    const dado2 = session.ultimoDado2 ?? 0;
    if (!dado1 || !dado2) throw new AppError(400, "Dados não encontrados.");

    const player = await turnoRepository.findPlayerParaJogada(playerId);
    if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");

    // Quantos passos, conforme a escolha
    const passos = escolha === "dado1" ? dado1
                 : escolha === "dado2" ? dado2
                 : dado1 + dado2;

    const duplo = dado1 === dado2;

    // ── REGRA CRÍTICA: duplo só concede nova jogada se escolher a SOMA ──
    // Senão seria abuso: escolher o dado menor E ainda jogar de novo.
    const duploValido = duplo && escolha === "soma";

    // Se o duplo NÃO for válido (escolheu dado avulso), zera a contagem
    // — não acumula para os 3 duplos.
    if (duplo && !duploValido) {
      duplosConsecutivos.set(playerId, 0);
    }

    // Sai do estado de escolha e entra em resolução
    await turnoRepository.registrarDados(sessionId, {
      aguardandoEscolha: false,
      aguardandoAcao: true,
    });

    const { novaPosicao, passouInicio, resolucao, extratoInicio } =
      await this.moverEResolver(sessionId, player, passos);

    // Avanço do turno: mesma lógica de antes, mas usando duploValido
    // e respeitando encerraVez (feriado/prisão encerram mesmo com duplo)
    const deveEncerrar = (!duploValido || resolucao.encerraVez) && !resolucao.aguardandoAcao;

    if (deveEncerrar) {
      const avanco = await this.avancarTurno(sessionId, session);
      return {
        dado1, dado2, duplo, duploValido, escolha, passos,
        foiPreso: false, novaPosicao, passouInicio,
        ...resolucao, ...avanco, extratoInicio,
      };
    }

    // Duplo válido ou ação pendente: não avança, reseta o timer
    await this.agendarTimeout(sessionId);
    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return {
      dado1, dado2, duplo, duploValido, escolha, passos,
      foiPreso: false, novaPosicao, passouInicio,
      ...resolucao, extratoInicio,
    };
  });
}
```

---

## ETAPA 3 — Timeout: escolher automaticamente

**CRÍTICO.** Hoje o timeout já joga pelo jogador. Agora ele também precisa
**escolher o movimento** se o tempo acabar durante a escolha.

Em `avancarPorTimeout`, adicionar o tratamento ANTES da lógica existente:

```typescript
async avancarPorTimeout(sessionId: number) {
  return withLock(`turno:${sessionId}`, async () => {
    const session = await turnoRepository.findSessionComJogadores(sessionId);
    if (!session || session.status !== "Em Andamento" || session.tipoJogo !== "tabuleiro") {
      cancelTurnoTimer(sessionId);
      return null;
    }

    // ── NOVO: escolha de movimento pendente → escolhe a SOMA (padrão) ──
    if (session.aguardandoEscolha && session.turnoAtualPlayerId) {
      sessionLogger.info(
        { sessionId, playerId: session.turnoAtualPlayerId },
        "timeout na escolha de movimento — usando a soma (padrão)"
      );
      // Delega para escolherMovimento com a soma.
      // ATENÇÃO: escolherMovimento tem seu próprio withLock — chamar a
      // versão interna sem lock, ou refatorar para evitar deadlock.
      return this.escolherMovimentoInterno(sessionId, session, "soma");
    }

    // ...resto da lógica existente (aguardandoAcao, prisão, falência)...
  });
}
```

**ATENÇÃO — deadlock:** `escolherMovimento` já usa `withLock`. Chamá-lo de
dentro de `avancarPorTimeout` (que também tem lock) causaria deadlock.

**Solução:** extrair o corpo de `escolherMovimento` para um método privado
`escolherMovimentoInterno(sessionId, session, escolha)` **sem lock**, e ter
os dois pontos de entrada chamando ele:

```typescript
// Público, com lock (chamado pelo jogador via API)
async escolherMovimento(sessionId, playerId, escolha) {
  return withLock(`turno:${sessionId}`, async () => {
    const session = await this.validarESessaoAtiva(sessionId);
    if (session.turnoAtualPlayerId !== playerId) throw new AppError(403, "Não é sua vez.");
    return this.escolherMovimentoInterno(sessionId, session, escolha);
  });
}

// Privado, SEM lock (chamado de dentro de contextos já travados)
private async escolherMovimentoInterno(sessionId, session, escolha) {
  // ...toda a lógica da Etapa 2.3, sem o withLock...
}
```

---

## ETAPA 4 — Prisão: NÃO afetada

**Regra:** na prisão **não há escolha de movimento**.

- Tentar duplo para sair: precisa de duplo real (dado1 === dado2)
- Ao sair (com duplo ou pagando multa), move a **soma** dos dados
- `rolarDadosEmPrisao` continua **exatamente como está** — não tocar

Isso é importante: se o jogador pudesse escolher o movimento ao sair da
prisão, ganharia vantagem indevida sobre quem nunca foi preso.

---

## ETAPA 5 — Rota e API

### Backend

```typescript
// server/src/api/routes/turno.route.ts
router.post(
  "/:sessionId/escolher-movimento",
  authenticate,
  roomAuth,
  turnoController.escolherMovimento
);
```

```typescript
// turno.controller.ts
escolherMovimento: async (req, res) => {
  try {
    const schema = z.object({
      escolha: z.enum(["dado1", "dado2", "soma"]),
    });
    const { escolha } = schema.parse(req.body);
    const sessionId = Number(req.params.sessionId);
    const playerId = /* obter do room-auth, como nos outros endpoints */;

    const result = await turnoService.escolherMovimento(sessionId, playerId, escolha);
    res.json(result);
  } catch (err) {
    parseError(err, res);
  }
},
```

### Frontend

```typescript
// client/src/services/api/turno.ts
export type OpcaoMovimento = {
  tipo: "dado1" | "dado2" | "soma";
  passos: number;
  destino: number;
  nomeCasa: string;
  tipoCasa: string;
  passaInicio: boolean;
};

export async function escolherMovimento(
  sessionId: number,
  escolha: "dado1" | "dado2" | "soma"
) {
  return api.post(`/turno/${sessionId}/escolher-movimento`, { escolha })
    .then(res => res.data);
}
```

---

## ETAPA 6 — UI/UX (o coração da mecânica)

A escolha só é boa se o jogador **entender as consequências**. Mostrar
apenas "3, 5 ou 8" é insuficiente — ele precisa ver **onde vai parar**.

### Modal de escolha (integrado ao modal de turno unificado)

Nova fase entre "resultado dos dados" e "movendo":

```
┌──────────────────────────────────────────────┐
│         🎲 Você tirou 3 e 5                  │
│                                              │
│         Escolha seu movimento:               │
│                                              │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ │
│  │  Andar 3   │ │  Andar 5   │ │  Andar 8  │ │
│  │            │ │            │ │           │ │
│  │ Av.Paulista│ │  Notícias  │ │ Av.Morumbi│ │
│  │ 🟢 Livre   │ │  ❓ Carta  │ │ 🔴 de João│ │
│  │ R$ 3.500   │ │            │ │ Aluguel   │ │
│  │            │ │            │ │ R$ 1.200  │ │
│  └────────────┘ └────────────┘ └───────────┘ │
│                                              │
│              ⏱ 42s                           │
└──────────────────────────────────────────────┘
```

**Cada opção deve mostrar:**
- Quantas casas anda
- **Nome da casa de destino**
- **Situação da casa** (livre / de quem é / tipo especial)
- Se for propriedade livre: **preço**
- Se for de outro jogador: **quanto vai pagar de aluguel**
- Se passar pelo Início: indicador **+R$ 2.000** (e o extrato, se Mecânica 1
  estiver ativa)
- Destaque visual: verde (bom), vermelho (ruim), neutro

**Regra de duplo — comunicar claramente:**

Se tirou duplo, a opção "soma" deve ter um selo:

```
┌───────────────┐
│   Andar 8     │
│  ⭐ SOMA       │
│               │
│ 🔁 Joga de    │
│    novo!      │
└───────────────┘
```

E as opções de dado avulso devem avisar que **perdem a jogada extra**:

```
┌───────────────┐
│   Andar 4     │
│               │
│ ⚠️ Sem jogada │
│    extra      │
└───────────────┘
```

Sem isso o jogador escolhe o dado avulso sem saber que abriu mão do duplo.

### Timer visível

Countdown claro (o timeout de 60s continua rodando). Aos 10s, destaque
visual + SFX `tempo-acabando` (já implementado).

### Timeout → soma automática

Se o tempo acabar, usa a **soma** (comportamento clássico) e avisa:
`"Tempo esgotado — movimento padrão aplicado (8 casas)"`.

### Ordem correta (delay do servidor)

```
1. SFX + animação de dados rolando
2. Resultado dos dados aparece
3. Fase de ESCOLHA (modal com as 3 opções)   ← NOVO
4. Jogador escolhe (ou timeout → soma)
5. Peão anda
6. Extrato do Início (se passou)
7. Desfecho da casa
```

O peão **só se move após a escolha**. Não pode haver movimento otimista.

---

## ETAPA 7 — Atualizar regras (Client + README)

### Onboarding
- Após rolar, você escolhe andar o dado 1, o dado 2 ou a soma
- **Dados iguais (duplo)** só dão jogada extra se você escolher a **soma**
- Na prisão não há escolha — vale a soma
- Se o tempo acabar, a soma é aplicada automaticamente

### README
```markdown
### Modo Tabuleiro — Escolha de Movimento
- Após rolar, o jogador escolhe andar: dado 1, dado 2 ou a soma
- A UI mostra o destino de cada opção (casa, dono, preço, aluguel)
- Duplo só concede jogada extra se o jogador escolher a soma
- Na prisão a escolha não se aplica (vale sempre a soma)
- Timeout aplica a soma automaticamente
```

---

## ETAPA 8 — Testes manuais obrigatórios

### Fluxo básico
- [ ] Rolar dados NÃO move o peão imediatamente
- [ ] Modal de escolha aparece com as 3 opções
- [ ] Escolher dado 1 move o número correto de casas
- [ ] Escolher dado 2 move o número correto
- [ ] Escolher soma move a soma (comportamento clássico)
- [ ] Peão só anda DEPOIS da escolha

### Regra de duplo (crítico)
- [ ] Duplo + escolher SOMA → joga de novo
- [ ] Duplo + escolher dado avulso → **NÃO** joga de novo
- [ ] Duplo + dado avulso → contagem de duplos **zera** (não acumula)
- [ ] 3 duplos seguidos (sempre escolhendo soma) → prisão
- [ ] 3º duplo vai preso SEM oferecer escolha de movimento

### Prisão (não afetada)
- [ ] Na prisão, rolar dados NÃO oferece escolha
- [ ] Sair da prisão com duplo → move a soma, sem escolha
- [ ] Sair pagando multa → comportamento inalterado

### Timeout
- [ ] Tempo acaba durante a escolha → aplica a SOMA automaticamente
- [ ] Mensagem clara: "Tempo esgotado — movimento padrão aplicado"
- [ ] **Sem deadlock** (escolherMovimentoInterno sem lock aninhado)
- [ ] Timer reseta corretamente após a escolha

### Integração com o existente
- [ ] Compra de propriedade após escolha funciona normal
- [ ] Aluguel cobrado corretamente na casa escolhida
- [ ] Extrato do Início (Mecânica 1) dispara se passar pelo Início
- [ ] Eventos econômicos (Mecânica 2) continuam funcionando
- [ ] Feriado/prisão encerram a vez mesmo com duplo (regra do BUG 4)
- [ ] Falência, hipoteca, negociação inalterados
- [ ] Modo Banca NÃO afetado

### UX
- [ ] Cada opção mostra nome da casa de destino
- [ ] Mostra se está livre, de quem é, e o valor (preço ou aluguel)
- [ ] Indica "+R$ 2.000" se a opção passa pelo Início
- [ ] Opção "soma" tem selo de "joga de novo" quando é duplo
- [ ] Opções avulsas avisam "sem jogada extra" quando é duplo
- [ ] Cores: verde (bom), vermelho (ruim)
- [ ] Countdown visível; SFX aos 10s
- [ ] Ordem correta mesmo com latência de 3s

### Build
- [ ] `make validate` passa

---

## Definição de "pronto"

1. `aguardandoEscolha` no schema
2. `rolarDados` dividido: rola e para (não move)
3. `escolherMovimento` (público, com lock) + `escolherMovimentoInterno`
   (privado, sem lock) — **sem deadlock**
4. Timeout escolhe a soma automaticamente
5. Duplo só vale com escolha "soma"; dado avulso zera a contagem
6. Prisão inalterada (sem escolha)
7. UI mostrando destino, dono, preço/aluguel e consequência do duplo
8. Regras atualizadas (onboarding + README)
9. Todos os testes passando; Modo Banca intacto

---

## Nota sobre anti-exploit

A preocupação de "circular em zona segura" é neutralizada por:

1. **A escolha é entre 3 opções que os dados deram** — frequentemente as três
   são ruins. Não é movimento livre.
2. **Duplo só vale com a soma** — não dá para escolher o dado menor e ainda
   ganhar jogada extra.
3. **Manutenção + IPTU (Mecânica 1)** — quem só circula sem desenvolver fica
   para trás economicamente. Evitar risco não gera renda.

As três mecânicas juntas fecham o buraco.
