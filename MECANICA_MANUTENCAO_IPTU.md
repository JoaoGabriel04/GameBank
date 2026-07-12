# Implementação: Manutenção, IPTU e Renda Passiva — GameBank

## Contexto

Primeira das cinco mecânicas econômicas (ver MECANICAS_ECONOMICAS.md).
Transforma o jogo de "sorte com dados" em "administração sob incerteza":
propriedades passam a ter **custo recorrente** (IPTU + manutenção) e
**renda passiva**, ambos cobrados/creditados quando o jogador **passa pelo
Início**.

**Objetivo estratégico:** punir a passividade. Quem só anda pelo tabuleiro
sem desenvolver fica para trás; quem investe e administra bem prospera.

**IMPORTANTE — esta mecânica só se aplica ao Modo Tabuleiro.** O Modo Banca
NÃO deve ser afetado de forma alguma.

---

## ETAPA 0 — Auditoria obrigatória

```bash
# 1. Ver onde o crédito do Início é aplicado hoje (ponto de inserção)
grep -n "CREDITO_INICIO\|passouInicio\|moverEResolver" \
  server/src/modules/turno/turno.service.ts

# 2. Ver o cálculo de aluguel existente (será reutilizado)
grep -n "calcularAluguel" server/src/modules/turno/turno.service.ts

# 3. Ver cobrarComFallbackDivida (será reutilizado para a cobrança)
grep -n "cobrarComFallbackDivida\|criarDivida\|criarHistorico" \
  server/src/modules/turno/turno.service.ts

# 4. Ver como propriedades do jogador são buscadas
grep -rn "findSessionPossesByPlayer\|findPossesByPlayer\|posses.*player" \
  server/src/modules/propriedade/propriedade.repository.ts

# 5. Confirmar que ações têm custo_casa 0 (não pagam manutenção)
python3 -c "import json; p=json.load(open('server/data/propriedades.json')); print(set(x['custo_casa'] for x in p if x['tipo']=='ação'))"

# 6. Ver o sistema de toast/notificação do jogo
grep -n "emitToRoom\|aluguel:toast" server/src/modules/turno/turno.service.ts

# 7. Ver onde ficam as regras no client
cat client/src/app/onboarding/page.tsx | head -40
```

---

## ETAPA 1 — Constantes econômicas

Criar `server/src/constants/economia.ts`:

```typescript
// Percentuais calibrados por simulação contra a economia real do jogo
// (saldo inicial R$ 25.000, propriedades R$ 600-4.000).
// AJUSTÁVEIS: revisar após 3-5 partidas reais.

/** IPTU: % do custo_compra, cobrado por volta completa. */
export const IPTU_PCT = 0.08;

/** Manutenção: % do custo_casa, por casa construída, por volta. */
export const MANUTENCAO_PCT = 0.12;

/** Renda passiva: % do aluguel atual (considerando nº de casas), por volta. */
export const RENDA_PASSIVA_PCT = 0.15;

/** Hotel conta como 5 casas para efeito de manutenção. */
export const HOTEL_EQUIVALE_CASAS = 5;
```

---

## ETAPA 2 — Serviço de cálculo do extrato

Criar um método no `turno.service.ts` que calcula o extrato completo da
passagem pelo Início. **Não altera nada ainda — só calcula.**

```typescript
type ExtratoInicio = {
  creditoInicio: number;      // R$ 2.000 fixo
  rendaPassiva: number;       // soma da renda de todas as propriedades
  iptu: number;               // soma do IPTU
  manutencao: number;         // soma da manutenção
  liquido: number;            // crédito + renda - iptu - manutenção
  detalhes: Array<{           // para o extrato detalhado na UI
    propId: number;
    nome: string;
    casas: number;
    iptu: number;
    manutencao: number;
    rendaPassiva: number;
  }>;
};

private async calcularExtratoInicio(
  sessionId: number,
  playerId: number
): Promise<ExtratoInicio> {
  // Buscar TODAS as propriedades do jogador nesta sessão
  const posses = await propriedadeRepository.findSessionPossesByPlayer(sessionId, playerId);

  let iptu = 0;
  let manutencao = 0;
  let rendaPassiva = 0;
  const detalhes: ExtratoInicio["detalhes"] = [];

  for (const posse of posses) {
    const prop = posse.propriedade;
    if (!prop) continue;

    // REGRA: propriedade hipotecada NÃO paga IPTU nem manutenção,
    // e NÃO gera renda passiva (está com o banco)
    if (posse.hipotecada) continue;

    // REGRA: ações (grupo Preto) não têm IPTU nem manutenção nem renda passiva.
    // Identificar por tipo "ação" OU custo_casa === 0.
    const ehAcao = prop.tipo === "ação";
    if (ehAcao) continue;

    const casas = posse.casas ?? 0;
    const casasEquivalentes = casas >= 5 ? HOTEL_EQUIVALE_CASAS : casas;

    const propIptu = Math.round(prop.custo_compra * IPTU_PCT);
    const propManut = Math.round(prop.custo_casa * MANUTENCAO_PCT * casasEquivalentes);
    const aluguelAtual = this.calcularAluguel(prop, casas);  // reutiliza método existente
    const propRenda = Math.round(aluguelAtual * RENDA_PASSIVA_PCT);

    iptu += propIptu;
    manutencao += propManut;
    rendaPassiva += propRenda;

    detalhes.push({
      propId: prop.id,
      nome: prop.nome,
      casas,
      iptu: propIptu,
      manutencao: propManut,
      rendaPassiva: propRenda,
    });
  }

  const liquido = CREDITO_INICIO + rendaPassiva - iptu - manutencao;

  return { creditoInicio: CREDITO_INICIO, rendaPassiva, iptu, manutencao, liquido, detalhes };
}
```

**Se `findSessionPossesByPlayer` não existir**, criar no
`propriedade.repository.ts` seguindo o padrão do projeto:

```typescript
findSessionPossesByPlayer: (sessionId: number, playerId: number) =>
  prisma.sessionPosses.findMany({
    where: { sessionId, playerId },
    include: { propriedade: true },
  }),
```

---

## ETAPA 3 — Aplicar o extrato na passagem pelo Início

Modificar `moverEResolver` (linhas ~143-162 do `turno.service.ts`).

**Estado atual:**
```typescript
const saldoAposInicio = passouInicio ? player.saldo + CREDITO_INICIO : player.saldo;
await turnoRepository.moverPlayer(player.id, {
  posicao: novaPosicao,
  ...(passouInicio ? { saldo: saldoAposInicio } : {}),
});
```

**Novo comportamento:**
```typescript
private async moverEResolver(
  sessionId: number,
  player: { id: number; nome: string; posicao: number; saldo: number },
  total: number,
  opts?: { creditarInicio?: boolean }   // permite suprimir (ex: Vá para Prisão)
) {
  const novaPosicao = (player.posicao + total) % TOTAL_CASAS;
  const passouInicio = (player.posicao + total) >= TOTAL_CASAS;
  const deveCreditar = passouInicio && (opts?.creditarInicio ?? true);

  let saldoAtualizado = player.saldo;
  let extrato: ExtratoInicio | null = null;

  // Mover primeiro (posição sempre atualiza)
  await turnoRepository.moverPlayer(player.id, { posicao: novaPosicao });

  if (deveCreditar) {
    extrato = await this.calcularExtratoInicio(sessionId, player.id);

    if (extrato.liquido >= 0) {
      // Saldo positivo: credita direto
      saldoAtualizado = player.saldo + extrato.liquido;
      await turnoRepository.moverPlayer(player.id, { saldo: saldoAtualizado });

      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "PASSAGEM_INICIO",
        detalhes: `${player.nome} passou pelo Início: +R$ ${extrato.creditoInicio} (crédito) ` +
                  `+R$ ${extrato.rendaPassiva} (renda passiva) ` +
                  `−R$ ${extrato.iptu} (IPTU) −R$ ${extrato.manutencao} (manutenção) ` +
                  `= R$ ${extrato.liquido >= 0 ? "+" : ""}${extrato.liquido}`,
      });
    } else {
      // Líquido negativo: credita o que recebe, cobra o que deve.
      // Usa cobrarComFallbackDivida (gera dívida se não tiver saldo).
      const aReceber = extrato.creditoInicio + extrato.rendaPassiva;
      const aPagar = extrato.iptu + extrato.manutencao;

      // Credita primeiro
      const saldoComReceita = player.saldo + aReceber;
      await turnoRepository.moverPlayer(player.id, { saldo: saldoComReceita });

      // Depois cobra (pode gerar dívida — integra com falência em 3 rodadas)
      await this.cobrarComFallbackDivida(
        sessionId,
        { ...player, saldo: saldoComReceita },
        aPagar,
        null,   // credor = banco
        `IPTU e manutenção (passagem pelo Início)`
      );

      // Recarregar saldo real após a cobrança
      const atualizado = await turnoRepository.findPlayer(player.id);
      saldoAtualizado = atualizado?.saldo ?? saldoComReceita;
    }

    // Notificar o jogador com o extrato detalhado
    emitToRoom(sessionId, "inicio:extrato", {
      playerId: player.id,
      playerNome: player.nome,
      extrato,
    });
  }

  const resolucao = await this.resolverCasa(
    sessionId,
    { ...player, posicao: novaPosicao, saldo: saldoAtualizado },
    total
  );

  const { emitUpdatedSession } = await import("../socket/socket.handler.js");
  await emitUpdatedSession(sessionId);

  return { novaPosicao, passouInicio: deveCreditar, resolucao, extratoInicio: extrato };
}
```

### ATENÇÃO — Não quebrar regras existentes

- **Vá para a Detenção:** o jogador NÃO recebe o crédito do Início ao ser
  movido para a prisão, mesmo passando por ela. Se o código atual já trata
  isso, preservar. Se `moverEResolver` for usado nesse caminho, passar
  `{ creditarInicio: false }`.
- **Sair da prisão:** ao sair e mover, o crédito vale normalmente se passar
  pelo Início.
- **Dívida e falência:** a cobrança usa `cobrarComFallbackDivida`, que já
  cria dívida e integra com a regra de falência em 3 rodadas. NÃO criar
  lógica de dívida paralela.
- **Hipoteca:** propriedade hipotecada não paga IPTU/manutenção nem rende.
- **Ações:** grupo Preto não paga IPTU/manutenção nem gera renda passiva.
- **Desistência:** ao desistir, as propriedades voltam ao banco — nenhuma
  cobrança pendente de IPTU deve permanecer.

---

## ETAPA 4 — Notificação e ordem correta (delay do servidor)

**Requisito crítico de UX:** o extrato do Início deve aparecer **na ordem
certa**, mesmo com latência do free tier. A sequência correta é:

```
1. Dados aparecem (resultado da rolagem)
2. Peão anda (animação)
3. SE passou pelo Início → mostra o EXTRATO (modal/toast destacado)
4. Depois, o desfecho da casa onde parou
```

O extrato **não pode aparecer antes dos dados** nem competir com o desfecho
da casa. Implementar como uma fase intermediária:

```typescript
// No frontend, o RolarDadosResult agora traz `extratoInicio`.
// Inserir uma fase entre o movimento e o desfecho:

// Fase "extrato-inicio" (só se passouInicio && extratoInicio):
if (r.passouInicio && r.extratoInicio) {
  setFase("extrato-inicio")
  setExtrato(r.extratoInicio)
  await sleep(2500)   // tempo para o jogador ler
}

// Só então:
setFase("desfecho")
```

**Evento Socket para os outros jogadores:** `inicio:extrato` notifica todos
(toast curto: "João passou pelo Início: +R$ 1.240"), mas o **modal detalhado
só aparece para o próprio jogador**.

---

## ETAPA 5 — UI do Extrato (crítico para a UX)

O jogador PRECISA entender de onde vem e para onde vai o dinheiro. Sem isso,
a mecânica parece punitiva e arbitrária.

### Modal de extrato (para o próprio jogador)

```tsx
// client/src/components/Board/ExtratoInicioModal/index.tsx

// Estrutura visual:
// ┌─────────────────────────────────┐
// │   🏁 Você passou pelo Início!   │
// ├─────────────────────────────────┤
// │  Crédito do Início     +2.000   │  verde
// │  Renda passiva         +1.150   │  verde
// │  ─────────────────────────────  │
// │  IPTU                    −448   │  vermelho
// │  Manutenção            −1.440   │  vermelho
// │  ═════════════════════════════  │
// │  LÍQUIDO               +1.262   │  destaque
// └─────────────────────────────────┘
//     [ Ver detalhes por propriedade ]
```

Requisitos de UX:
- **Cores claras:** verde para receita, vermelho para despesa
- **Líquido em destaque** — é a informação mais importante
- **Expansível:** botão "Ver detalhes" abre a lista por propriedade
  (`extrato.detalhes`), mostrando quanto cada uma custou/rendeu
- **Se o líquido for negativo:** alerta visual forte + aviso claro
  ("Você não tem saldo suficiente — R$ X viraram dívida")
- **Animação:** usar GSAP (padrão do projeto), entrada suave, não abrupta
- **Duração:** fecha automaticamente após ~4s OU no clique (o que vier primeiro)

### Toast para os outros jogadores

Curto e não intrusivo: `"João passou pelo Início: +R$ 1.262"`

### Indicador permanente na aba Início

Adicionar um card mostrando a **projeção da próxima passagem**:

```
┌────────────────────────────────┐
│ 📊 Próxima passagem pelo Início│
│                                │
│ Receita estimada     +3.150    │
│ Despesas estimadas   −1.888    │
│ ─────────────────────────────  │
│ Líquido previsto     +1.262    │
└────────────────────────────────┘
```

Isso é **essencial para a UX**: o jogador precisa poder **planejar**. Sem
essa visibilidade, ele constrói casas sem saber que vai quebrar na próxima
volta. É o que transforma a mecânica de "punição surpresa" em "decisão
estratégica informada".

---

## ETAPA 6 — Atualizar as regras (Client + README)

### 6.1 — Onboarding / Regras no Client

Em `client/src/app/onboarding/page.tsx` (e onde mais houver explicação de
regras), adicionar a nova mecânica. Buscar:

```bash
grep -rn "Gerencie seu Dinheiro\|regras\|Como jogar" client/src --include="*.tsx" | grep -v node_modules
```

Adicionar uma seção explicando:
- Propriedades geram **renda passiva** a cada volta
- Propriedades custam **IPTU** (8% do valor) a cada volta
- Casas custam **manutenção** (12% do custo da casa) a cada volta
- **Tudo é cobrado ao passar pelo Início**, junto com os R$ 2.000
- **Estratégia:** desenvolver propriedades aumenta a renda; segurar terreno
  cru só gera despesa

### 6.2 — README

Na seção de features do `README.md` (~linha 31-38), atualizar:

```markdown
### Modo Tabuleiro — Economia
- Renda passiva por propriedade desenvolvida (15% do aluguel atual)
- IPTU sobre todas as propriedades (8% do valor de compra)
- Custo de manutenção por casa/hotel (12% do custo da casa)
- Cobrança consolidada na passagem pelo Início, com extrato detalhado
- Propriedades hipotecadas não pagam IPTU nem geram renda
- Ações (grupo Preto) não têm IPTU nem manutenção
```

### 6.3 — Documentação de regras (se houver .md dedicado)

```bash
find . -iname "*regra*.md" -o -iname "*rules*.md" | grep -v node_modules
```

Se existir, atualizar com as fórmulas completas.

---

## ETAPA 7 — Testes manuais obrigatórios

### Cálculo
- [ ] Passar pelo Início com 0 propriedades → recebe exatamente R$ 2.000
- [ ] Passar com 1 terreno cru → recebe 2.000 + renda mínima − IPTU
- [ ] Passar com monopólio + 4 casas → líquido positivo maior
- [ ] Passar com muitas casas e pouco caixa → líquido pode ser negativo
- [ ] Propriedade hipotecada NÃO cobra IPTU nem manutenção
- [ ] Propriedade hipotecada NÃO gera renda passiva
- [ ] Ações (grupo Preto) NÃO cobram IPTU nem manutenção
- [ ] Hotel cobra manutenção equivalente a 5 casas

### Integração com regras existentes
- [ ] "Vá para a Detenção" NÃO credita Início mesmo passando por ele
- [ ] Sair da prisão e passar pelo Início → credita normalmente
- [ ] Líquido negativo sem saldo → gera dívida corretamente
- [ ] Dívida gerada conta para a regra de falência em 3 rodadas
- [ ] Falência executa normalmente (propriedades voltam ao banco)
- [ ] Desistência não deixa cobranças pendentes
- [ ] Compra de propriedade continua funcionando normalmente
- [ ] Hipoteca/deshipoteca continua funcionando
- [ ] Ordem de turnos NÃO é afetada
- [ ] Pagamento de aluguel continua funcionando

### Notificação e ordem (delay)
- [ ] Extrato aparece DEPOIS dos dados e DEPOIS do peão mover
- [ ] Extrato aparece ANTES do desfecho da casa
- [ ] Com latência simulada (3s), a ordem se mantém correta
- [ ] Outros jogadores recebem toast curto (não o modal completo)
- [ ] Modal detalhado só para o jogador que passou

### UX
- [ ] Extrato é claro: verde receita, vermelho despesa, líquido em destaque
- [ ] "Ver detalhes" mostra a quebra por propriedade
- [ ] Líquido negativo tem alerta visual forte
- [ ] Card de projeção na aba Início mostra a previsão correta
- [ ] Projeção atualiza ao construir/vender casas
- [ ] Animações usam GSAP (padrão do projeto)

### Modo Banca
- [ ] Modo Banca NÃO é afetado de forma alguma
- [ ] Sessões de Modo Banca continuam funcionando idênticas

### Build
- [ ] `make validate` passa

---

## Definição de "pronto"

1. `economia.ts` com as constantes configuráveis
2. `calcularExtratoInicio` calculando corretamente
3. `moverEResolver` aplicando o extrato na passagem pelo Início
4. Dívida integrada com `cobrarComFallbackDivida` (sem lógica paralela)
5. Evento `inicio:extrato` notificando na ordem correta
6. Modal de extrato com UX clara (verde/vermelho/líquido)
7. Card de projeção na aba Início (permite planejamento)
8. Regras atualizadas no onboarding e no README
9. Todos os testes manuais passando
10. Modo Banca intacto

---

## Nota de balanceamento

Os percentuais (8% / 12% / 15%) foram calibrados por simulação, mas
**balanceamento só se valida jogando**. Após 3-5 partidas reais, revisar:

- Se ninguém constrói → manutenção está alta demais
- Se todos constroem sem pensar → manutenção está baixa demais
- Se o passivo vence → aumentar IPTU ou reduzir crédito do Início
- Se o passivo quebra rápido demais → reduzir IPTU

Os valores estão em `economia.ts` justamente para facilitar esse ajuste.
