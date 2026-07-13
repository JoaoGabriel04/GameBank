# Fix: Race condition de saldo (TOCTOU) — saque duplo em várias mecânicas

## Contexto

Em `banco.service.ts`, `divida.service.ts`, `carta.service.ts` e
`shop.service.ts` (incluindo a compra com diamantes), o padrão de código é
sempre o mesmo:

```ts
// 1. LER o saldo/coins/diamonds atual (fora de qualquer lock)
const player = await this.repo.findPlayerById(id);
if (player.saldo < valor) throw new AppError(400, "Saldo insuficiente");

// 2. DEPOIS decrementar, numa transação separada (ou até dentro de uma
//    transação, mas sem travar a leitura)
await prisma.$transaction([
  prisma.sessionPlayer.update({ data: { saldo: { decrement: valor } } }),
  ...
]);
```

**O problema:** a leitura (passo 1) e a escrita (passo 2) não são atômicas
entre si. Duas requisições quase simultâneas do mesmo jogador (duplo
clique, replay de request, script) fazem as duas leituras ANTES de
qualquer decremento ser aplicado — as duas passam na validação de saldo,
as duas decrementam. **Saldo pode ficar negativo**, ou seja, o jogador
gasta/transfere/compra o dobro do que realmente tinha.

Isso vale como exploit de **auto-benefício** (comprar em dobro pagando uma
vez, sacar duas vezes) e de **sabotagem** (zerar/negativar o próprio saldo
de propósito para forçar falência num momento estratégico, ou space pra
alegar bug).

`buyItem` e `buyCoinsWithDiamonds` (shop) já usam transação interativa
(`prisma.$transaction(async (tx) => {...})`), mas isso **não resolve
sozinho**: sob o isolamento padrão do Postgres (Read Committed), um
`SELECT` simples dentro da transação não trava a linha — duas transações
concorrentes ainda podem ler o mesmo valor antes de qualquer uma escrever.//
O fix real é fazer a checagem e o decremento serem **a mesma operação
atômica no banco**, não duas etapas.

**Regra inviolável:** Modo Banca não pode ser afetado — aliás, é
exatamente o Modo Banca que mais usa `banco.service.ts` (depósito, saque,
transferência, aluguel), então esse módulo precisa ficar impecável.

## Etapa 0 — Auditoria (achar TODOS os pontos, não só os já listados aqui)

```bash
# Padrão "ler saldo/coins/diamonds, decidir, decrementar depois" —
# confirmar os pontos já identificados e procurar outros que eu possa
# ter deixado passar
grep -rn "saldo\s*<\|coins\s*<\|diamonds\s*<" server/src/modules --include="*.service.ts" | grep -v node_modules

grep -rln "decrement" server/src/modules --include="*.service.ts" | grep -v node_modules

# Confirmar quais desses NÃO usam withLock
for f in $(grep -rln "decrement" server/src/modules --include="*.service.ts" | grep -v node_modules); do
  grep -q "withLock" "$f" || echo "SEM LOCK: $f"
done
```

Pontos já confirmados nesta auditoria (linha aproximada no momento desta
análise — confirme se ainda batem antes de editar):

| Arquivo | Função | Risco |
|---|---|---|
| `banco/banco.service.ts` | `saque` (linha 44) | saque duplicado |
| `banco/banco.service.ts` | `transferencia` (linha 77) | transferência além do saldo |
| `banco/banco.service.ts` | `pagarAluguel` (linha 126) | pagamento duplicado |
| `banco/banco.service.ts` | `aluguelAcao` (linha 172) | pagamento duplicado |
| `banco/banco.service.ts` | `receberDeTodos` (linha 210) | menos crítico (não decrementa por escolha do próprio jogador), mas mesma família |
| `divida/divida.service.ts` | `pagarDivida` (linha 12) | dívida paga 2x com um saldo só, ou `debt.pago` corrida (mesma dívida quitada duas vezes) |
| `carta/carta.service.ts` | `aplicarEfeito` casos `perder_dinheiro`, `pagar_jogadores` (linhas ~97, ~178) | valor não é escolhido pelo jogador, mas a chamada dupla ao endpoint pode sacar 2 cartas numa jogada só |
| `carta/carta.service.ts` | `usarCartaPrisao` (linha 313) | usar 1 carta 2 vezes |
| `shop/shop.service.ts` | `buyItem` (linha 17) | compra dupla pagando uma vez |
| `shop/shop.service.ts` | `buyCoinsWithDiamonds` (linha 291) | conversão dupla |

Se a auditoria encontrar mais algum arquivo com o mesmo padrão fora dessa
lista, **tratar com o mesmo template abaixo** antes de considerar a tarefa
concluída.

## Etapa 1 — O padrão de correção (aplicar em TODOS os pontos acima)

Trocar "ler → decidir → decrementar" por um **update condicional atômico**:
o `WHERE` da query já inclui a condição de saldo suficiente, e o resultado
(quantas linhas foram afetadas) é a prova de que a operação é válida.

```ts
// ANTES (vulnerável)
const player = await this.repo.findPlayerById(id);
if (player.saldo < valor) throw new AppError(400, "Saldo insuficiente!");
await prisma.$transaction([
  prisma.sessionPlayer.update({
    where: { id },
    data: { saldo: { decrement: valor } },
  }),
  // ...outras operações (historico, etc.)
]);
```

```ts
// DEPOIS (atômico — a checagem e o decremento são UMA operação no banco)
await prisma.$transaction(async (tx) => {
  const player = await tx.sessionPlayer.findUnique({ where: { id } });
  if (!player) throw new AppError(404, "Jogador não encontrado!");
  if (player.desistiu) throw new AppError(400, "Este jogador já saiu da partida.");

  const debitado = await tx.sessionPlayer.updateMany({
    where: { id, saldo: { gte: valor } }, // condição no WHERE, não numa leitura separada
    data: { saldo: { decrement: valor } },
  });
  if (debitado.count === 0) {
    throw new AppError(400, "Saldo insuficiente!"); // faz rollback automático da tx
  }

  // ...demais operações (historico, incrementar o outro jogador, etc.)
  // usando tx.* em vez de prisma.* — todas dentro da mesma transação
});
```

**Por que isso funciona sem precisar de `withLock`/Redis:** o `WHERE id =
? AND saldo >= ?` é avaliado pelo próprio banco no momento do `UPDATE`,
contra o valor mais atual da linha — não contra uma leitura antiga em
memória da aplicação. Duas requisições concorrentes vão disputar a mesma
linha no nível do banco (que serializa updates na mesma row); a segunda só
vê o resultado já decrementado da primeira, então `saldo >= valor` falha
corretamente pra ela.

**Aviso crítico:** `updateMany` (não `update`) é obrigatório aqui — `update`
sozinho lançaria uma exceção de "record not found" se a condição do WHERE
não bater, o que é mais difícil de diferenciar de "jogador não existe".
`updateMany` retorna `{ count: 0 }` de forma previsível, que é o que
usamos para decidir se foi saldo insuficiente.

## Etapa 2 — Aplicar em `banco.service.ts`

Reescrever `saque`, `transferencia`, `pagarAluguel` e `aluguelAcao`
seguindo o template da Etapa 1. Para `transferencia` (2 jogadores + 1
histórico), a ordem dentro da transação interativa:

```ts
async transferencia(pagadorId: number, recebedorId: number, sessionId: number, valor: number) {
  if (valor <= 0) throw new AppError(400, "Valor deve ser maior que zero!");
  if (valor > MAX_VALOR) throw new AppError(400, `Valor máximo permitido é R$ ${MAX_VALOR.toLocaleString("pt-BR")}`);

  return prisma.$transaction(async (tx) => {
    const pagador = await tx.sessionPlayer.findUnique({ where: { id: pagadorId } });
    if (!pagador) throw new AppError(404, "Jogador pagador não encontrado!");
    if (pagador.desistiu) throw new AppError(400, "Este jogador já saiu da partida.");

    const recebedor = await tx.sessionPlayer.findUnique({ where: { id: recebedorId } });
    if (!recebedor) throw new AppError(404, "Jogador recebedor não encontrado!");
    if (recebedor.desistiu) throw new AppError(400, "O jogador destinatário já saiu da partida.");

    const debitado = await tx.sessionPlayer.updateMany({
      where: { id: pagadorId, saldo: { gte: valor } },
      data: { saldo: { decrement: valor } },
    });
    if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente para transferência!");

    await tx.sessionPlayer.update({
      where: { id: recebedorId },
      data: { saldo: { increment: valor } },
    });

    await tx.historico.create({
      data: {
        sessionId: Number(sessionId),
        data: new Date(),
        tipo: "TRANSFERENCIA",
        detalhes: `${pagador.nome} transferiu R$ ${valor} para ${recebedor.nome}`,
      },
    });

    return {
      pagadorNome: pagador.nome,
      recebedorNome: recebedor.nome,
      recebedorId: recebedor.id,
      recebedorUserId: recebedor.userId,
      valor,
    };
  });
}
```

Mesmo padrão para `pagarAluguel` e `aluguelAcao` (pagador debitado com
`updateMany` condicional, recebedor incrementado com `update` normal,
histórico dentro da mesma `tx`). `deposito` **não precisa mudar** (incrementar
não tem risco de saldo negativo) e `receberDeTodos` também não decrementa
por escolha do jogador-alvo — mas troque os `decrement` dos "outros
jogadores" por `updateMany` com `saldo: { gte: RECEBER_DE_TODOS_VALOR }`
só por consistência (evita saldo negativo se alguém já estiver zerado por
outra corrida).

## Etapa 3 — Aplicar em `divida.service.ts`

Duas condições precisam virar `updateMany` no mesmo `tx`: o saldo do
jogador E o `debt.pago` (pra não pagar a mesma dívida duas vezes em
paralelo):

```ts
async pagarDivida(debtId: number, playerId: number) {
  return prisma.$transaction(async (tx) => {
    const debt = await tx.debt.findUnique({ where: { id: debtId } });
    if (!debt) throw new AppError(404, "Dívida não encontrada!");
    if (debt.playerId !== playerId) throw new AppError(403, "Esta dívida não pertence a você!");
    if (debt.pago) throw new AppError(400, "Dívida já foi paga!");

    const player = await tx.sessionPlayer.findUnique({ where: { id: playerId } });
    if (!player) throw new AppError(404, "Jogador não encontrado!");

    const debitado = await tx.sessionPlayer.updateMany({
      where: { id: playerId, saldo: { gte: debt.valor } },
      data: { saldo: { decrement: debt.valor } },
    });
    if (debitado.count === 0) throw new AppError(400, "Saldo insuficiente para pagar esta dívida!");

    const quitada = await tx.debt.updateMany({
      where: { id: debtId, pago: false },
      data: { pago: true, paidAt: new Date() },
    });
    if (quitada.count === 0) throw new AppError(400, "Dívida já foi paga!"); // corrida perdida

    await tx.historico.create({
      data: {
        sessionId: debt.sessionId,
        data: new Date(),
        tipo: "DIVIDA",
        detalhes: `${player.nome} pagou R$ ${debt.valor} de dívida: ${debt.descricao}.`,
      },
    });

    const aindaDeve = await tx.debt.findFirst({ where: { playerId, pago: false } });
    if (!aindaDeve) {
      await tx.sessionPlayer.update({ where: { id: playerId }, data: { rodadasDevendo: 0 } });
    }

    return { message: `Dívida de R$ ${debt.valor} paga com sucesso!` };
  });
}
```

## Etapa 4 — Aplicar em `carta.service.ts`

Diferente dos outros: o valor da carta não é escolhido pelo jogador, então
o risco real não é "escolher um valor maior que o saldo" — é **chamar o
endpoint duas vezes rápido e sortear/aplicar 2 cartas numa jogada só**
(ou usar a carta "Saia da Prisão" duas vezes com uma carta só).

Duas mudanças:

1. `perder_dinheiro` e `pagar_jogadores` (que decrementam `player.saldo`):
   trocar os `prisma.sessionPlayer.update({ data: { saldo: { decrement } } })`
   por `updateMany` condicional, mesmo template da Etapa 1. Como o valor
   pago já é `Math.min(carta.valor, saldo)` (o código já lida com saldo
   insuficiente cobrindo o que der), a condição aqui é só proteção contra
   corrida, não uma nova regra de negócio — **não mude o cálculo de quanto
   é pago**, só torne o decremento atômico.

2. `sortearCarta` e `usarCartaPrisao`: envolver com `withLock` por jogador,
   já que aqui o problema é chamada duplicada, não valor. Exemplo:

```ts
import { withLock } from "../../middleware/lock.middleware.js";

async sortearCarta(sessionId: number, playerId: number): Promise<SorteioResult> {
  return withLock(`carta:${playerId}`, async () => {
    // ...corpo atual do método, sem mudanças
  });
}

async usarCartaPrisao(sessionId: number, playerId: number): Promise<string> {
  return withLock(`carta-prisao:${playerId}`, async () => {
    const player = await this.repo.findPlayerById(playerId);
    if (!player) throw new AppError(404, "Jogador não encontrado!");
    if (!player.carta_prisao) throw new AppError(400, "Você não possui uma carta 'Saia da Prisão'!");

    const usada = await prisma.sessionPlayer.updateMany({
      where: { id: playerId, carta_prisao: true },
      data: { carta_prisao: false },
    });
    if (usada.count === 0) throw new AppError(400, "Você não possui uma carta 'Saia da Prisão'!");

    await prisma.historico.create({
      data: {
        sessionId: Number(sessionId),
        data: new Date(),
        tipo: "CARTA_PRISAO",
        detalhes: `${player.nome} usou a carta "Saia da Prisão".`,
      },
    });

    return `${player.nome} usou a carta "Saia da Prisão".`;
  });
}
```

## Etapa 5 — Aplicar em `shop.service.ts`

`buyItem` (linha 17) e `buyCoinsWithDiamonds` (linha 291) já usam
transação interativa — só trocar a checagem solta por `updateMany`
condicional dentro da mesma `tx`:

```ts
// buyItem — dentro do prisma.$transaction(async (tx) => {...})
const comprado = await tx.user.updateMany({
  where: { id: userId, coins: { gte: shopItem.price } },
  data: {
    coins: { decrement: shopItem.price },
    // user_items: [...refs, newRef] — CUIDADO: updateMany não pode
    // depender de `refs` lido antes da checagem de coins nesta mesma
    // race. Ver aviso crítico abaixo.
  },
});
if (comprado.count === 0) throw new AppError(400, "Coins insuficientes");
```

**Aviso crítico — `buyItem` tem uma segunda corrida além da de coins:**
o array `user_items` é lido, modificado em memória (`[...refs, newRef]`)
e reescrito por inteiro. Duas compras concorrentes de itens DIFERENTES
podem ambas ler a mesma lista antiga e uma sobrescrever o item que a
outra acabou de adicionar (perda de item comprado, não perda de dinheiro
— mas ainda um bug real). Isso não é resolvido por `updateMany` de coins
sozinho. Duas opções:

- **Opção simples:** envolver `buyItem` inteiro com `withLock(\`shop:${userId}\`, ...)`
  — serializa compras do mesmo usuário, resolve os dois problemas de uma vez.
- **Opção mais correta a longo prazo:** normalizar `user_items` pra uma
  tabela própria (`UserItem`) em vez de JSON array, e usar `create` (que
  não sofre esse tipo de corrida). Fora do escopo deste fix — só
  registrar como dívida técnica se optar pela Opção simples agora.

Recomendo a **Opção simples** agora (menor risco, resolve o exploit
imediato) e abrir uma nota separada pra normalizar `user_items` depois.

Mesmo tratamento (`updateMany` com `diamonds: { gte: pack.price }`) em
`buyCoinsWithDiamonds`.

## Etapa 6 — Teste de corrida (obrigatório, não pular)

Depois de aplicar tudo, simular a corrida de verdade — não basta testar
uma requisição por vez:

```ts
// server/src/modules/banco/__tests__/race.test.ts (exemplo — adaptar ao
// runner de testes do projeto)
test("duas transferências simultâneas não deixam saldo negativo", async () => {
  // Criar um sessionPlayer com saldo = 100
  // Disparar Promise.all([svc.transferencia(pagador, recebedor, s, 100), svc.transferencia(pagador, recebedor, s, 100)])
  // Esperar: uma resolve, a outra rejeita com "Saldo insuficiente"
  // Confirmar: saldo final do pagador é exatamente 0 (nunca negativo)
});
```

Repetir o mesmo teste de corrida para `saque`, `pagarDivida`,
`usarCartaPrisao` e `buyItem`.

## Testes manuais

- [ ] Testes de corrida automatizados (Etapa 6) passam para os 5 pontos
- [ ] Saque, transferência, pagamento de aluguel e de dívida continuam
      funcionando normalmente em uso sequencial (não só em corrida)
- [ ] Mensagens de erro ("Saldo insuficiente") continuam aparecendo do
      jeito certo na UI quando o saldo realmente não dá
- [ ] Sortear carta / usar carta prisão duas vezes rápido: só a primeira
      é aplicada, a segunda recebe erro claro (não trava, não perde o
      histórico)
- [ ] Compra na loja (coins) e conversão de diamantes duas vezes rápido:
      só uma é aplicada
- [ ] Histórico (`Historico`) continua registrando exatamente 1 entrada
      por operação bem-sucedida — nenhuma entrada órfã de operação que
      falhou no meio
- [ ] Modo Banca 100% funcional (depósito, saque, transferência, aluguel)
- [ ] Nenhum deadlock introduzido pelas transações interativas (testar com
      vários jogadores agindo ao mesmo tempo numa sessão de 6 jogadores)
- [ ] `make validate` passa
