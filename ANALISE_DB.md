# Análise do Banco de Dados — GameBank

> Revisão completa do schema Prisma (`server/prisma/schema.prisma`) com pontos de
> melhoria priorizados, planos de migração, SQL e pontos de código a tocar.
>
> Gerado em 2026-06-14. Schema atual: **27 tabelas**.

---

## Índice

1. [Mapa do modelo de dados](#1-mapa-do-modelo-de-dados)
2. [Achados priorizados](#2-achados-priorizados)
3. [🔴 #1 — Eliminar a tabela `Posses`](#-1--eliminar-a-tabela-posses)
4. [🔴 #2 — Dinheiro: `Float` → `Int`](#-2--dinheiro-float--int)
5. [🔴 #3 — Strings de estado → `enum`](#-3--strings-de-estado--enum)
6. [🟠 #4 — FKs soltas (Int sem relation)](#-4--fks-soltas-int-sem-relation)
7. [🟠 #5 — Índices faltando em FKs](#-5--índices-faltando-em-fks)
8. [🟡 #6 — Unificar ledgers Coin/Diamond](#-6--unificar-ledgers-coindiamond)
9. [🟡 #7 — Unificar Badge/Banner/Frame em `Cosmetic`](#-7--unificar-badgebannerframe-em-cosmetic)
10. [🟡 #8 — Cosméticos equipados via FK no User](#-8--cosméticos-equipados-via-fk-no-user)
11. [🟢 Polish de baixa prioridade](#9--polish-de-baixa-prioridade)
12. [Ordem de execução sugerida](#10-ordem-de-execução-sugerida)

---

## 1. Mapa do modelo de dados

### 🎲 Jogo — referência global (estática)
| Tabela | Papel |
|---|---|
| `Propriedade` (`propriedades`) | 40 casas do tabuleiro — custos, aluguéis, hipoteca |
| `Posses` (`posses`) | **Espelho 1:1 de Propriedade** (ver #1) |
| `Card` (`cartas`) | Cartas de Sorte/Revés |

### 🎲 Jogo — estado por partida (efêmero)
```
Session
 ├── SessionPlayer ──── SessionTeam (modo duplas)
 ├── SessionPosses (estado das propriedades na partida)
 ├── Historico (log de transações)
 ├── Message (chat)
 ├── Notification (pedidos player↔player, ex.: comprar hipotecada)
 ├── Negotiation ──── NegotiationItem (trocas)
 └── Debt (dívidas)
```

### 👤 Usuário — progressão & economia
```
User
 ├── Mission ──── UserMission
 ├── UserFragment (fragmentos p/ montar item)
 ├── UserDailyOffer (ofertas diárias)
 ├── GameResult (resultado por partida + anti-farm)
 ├── Bau ──── BauAdquirido (baús em escolta)
 ├── CoinTransaction (ledger de coins)
 └── DiamondTransaction ──── DiamondPurchase ──── DiamondPackage
```

### 🎨 Cosméticos / loja
```
ShopItem (type: title|badge|banner|frame)
 ├── Badge
 ├── Banner
 └── Frame
User.user_items (JSON) — itens que o usuário possui
```

### ⚙️ Infra
`GameSettings` · `AuditLog` · `UserNotification`

---

## 2. Achados priorizados

| # | Prioridade | Ação | Ganho | Risco |
|---|---|---|---|---|
| 1 | 🔴 | Eliminar `Posses`, ligar `SessionPosses → Propriedade` | −1 tabela, −1 join em tudo de propriedade | Médio (toca muitas queries) |
| 2 | 🔴 | `Float` → `Int` em todo dinheiro | Correção de arredondamento | Baixo |
| 3 | 🔴 | Strings de estado → `enum` | Validação no DB, segurança de tipo | Baixo |
| 4 | 🟠 | Declarar FKs soltas | Integridade referencial | Baixo |
| 5 | 🟠 | Índices em FKs | Performance de join/filtro | Nenhum |
| 6 | 🟡 | Unir Coin/Diamond em `WalletTransaction` | −1 tabela | Médio |
| 7 | 🟡 | Unir Badge/Banner/Frame em `Cosmetic` | −2 tabelas, ShopItem mais simples | Médio |
| 8 | 🟡 | Cosméticos equipados via FK no User | −4 colunas, fim do sync manual | Baixo |

---

## 🔴 #1 — Eliminar a tabela `Posses`

### Diagnóstico
`Posses` é populada **1:1 a partir de `Propriedade`** em `ensureGameData.ts:39`
(uma linha por propriedade, sempre `casas:0, hipotecada:false`). Os campos globais
`casas`/`hipotecada` **nunca são lidos** — o estado real por partida vive em
`SessionPosses`. Hoje a cadeia de acesso é:

```
SessionPosses.possesId → Posses.id → Posses.id_prop → Propriedade.id
```

`Posses` é puro hop de indireção. Todo acesso a propriedade no código faz
`sp.posses.propriedade.X`, ou seja, um JOIN extra desnecessário.

### Alvo
```
SessionPosses.propId → Propriedade.id     (referência direta)
```

### Plano de migração

**1. Schema (`schema.prisma`)**
```prisma
model Propriedade {
  // ...
  sessionPosses SessionPosses[]   // NOVO: relação direta
  // remover: posses Posses[]
}

model SessionPosses {
  id        Int     @id @default(autoincrement())
  sessionId Int
  session   Session @relation(fields: [sessionId], references: [id])

  propId      Int                                       // ANTES: possesId
  propriedade Propriedade @relation(fields: [propId], references: [id])  // ANTES: posses Posses

  playerId    Int?
  player      SessionPlayer? @relation(fields: [playerId], references: [id])
  lastOwnerId Int?
  lastOwner   SessionPlayer? @relation("LastOwner", fields: [lastOwnerId], references: [id])

  casas      Int     @default(0)
  hipotecada Boolean @default(false)
  negociando Boolean @default(false)

  @@index([sessionId])
  @@index([playerId])
  @@index([sessionId, playerId])
  @@map("session_posses")
}

// REMOVER model Posses inteiro
```

**2. SQL de migração** (gerado pelo Prisma, mas o ponto sensível é migrar o dado existente ANTES de dropar):
```sql
-- 1) nova coluna
ALTER TABLE "session_posses" ADD COLUMN "propId" INTEGER;

-- 2) backfill: possesId -> id_prop da Posses correspondente
UPDATE "session_posses" sp
SET "propId" = p."id_prop"
FROM "posses" p
WHERE sp."possesId" = p."id";

-- 3) tornar obrigatória + FK
ALTER TABLE "session_posses" ALTER COLUMN "propId" SET NOT NULL;
ALTER TABLE "session_posses"
  ADD CONSTRAINT "session_posses_propId_fkey"
  FOREIGN KEY ("propId") REFERENCES "propriedades"("id");

-- 4) dropar coluna antiga e tabela
ALTER TABLE "session_posses" DROP COLUMN "possesId";
DROP TABLE "posses";
```
> ⚠️ Como há partidas ativas com dados em `session_posses`, **fazer o backfill (passo 2)
> antes de dropar `posses`**. Se o ambiente puder ser resetado (`make db-reset`), o
> Prisma gera tudo sozinho sem precisar do backfill manual.

**3. Pontos de código a tocar** (substituir `posses` por `propriedade` no acesso):
| Arquivo | Mudança |
|---|---|
| `server/src/utils/ensureGameData.ts` | Remover bloco que popula `posses` (linhas ~31-50) |
| `server/src/modules/session/session.repository.ts:242` | `prisma.posses.findMany()` → `prisma.propriedade.findMany()` |
| `server/src/modules/banco/banco.service.ts` | `poss.posses.propriedade` → `poss.propriedade` (linhas ~114, 200, 205) |
| `server/src/modules/propriedade/propriedade.service.ts` | `*.posses.propriedade` → `*.propriedade` (várias) |
| `server/src/modules/propriedade/propriedade.repository.ts` | `where: { possesId }` → `where: { propId }`; `include: { posses: { include: { propriedade }}}` → `include: { propriedade: true }` |
| `server/src/modules/negociacao/negociacao.service.ts` | `sp.posses.propriedade` → `sp.propriedade` (linhas ~102, 107, 115, 120, 366) |
| `server/src/modules/negociacao/negociacao.repository.ts:21` | `where: { id: possesId }` revisar |
| Schemas Zod / payloads que usam `possesId` | renomear para `propId` (ou manter alias no controller) |

> 💡 Para reduzir o blast radius no front, dá para **manter o nome `possesId` na API**
> e só renomear internamente — mas o mais limpo é propagar `propId`.

**Esforço:** ~1-2h. **É a mudança de maior impacto estrutural.**

---

## 🔴 #2 — Dinheiro: `Float` → `Int`

### Diagnóstico
`User.coins`/`diamonds` são `Int`, mas todo o dinheiro de jogo é `Float`:
`Session.saldoInicial`, `SessionPlayer.saldo`, `SessionTeam.saldo`, `Debt.valor`,
`NegotiationItem.valor`, `GameResult.patrimony`. `Float` acumula erro de ponto
flutuante (clássico `0.1 + 0.2 = 0.30000000000000004`) e é inconsistente.

### Plano
Como o jogo opera em valores inteiros (R$ 25.000 etc.), trocar para `Int`.
Se um dia precisar de centavos, usar `Decimal @db.Decimal(12,2)` — **nunca `Float`**.

**Schema:**
```prisma
model Session       { saldoInicial Int @default(25000) }   // era Float
model SessionPlayer { saldo Int }                          // era Float
model SessionTeam   { saldo Int @default(25000) }          // era Float
model Debt          { valor Int }                          // era Float
model NegotiationItem { valor Int? }                       // era Float?
model GameResult    { patrimony Int }                      // era Float
```

**SQL** (Postgres converte direto se não houver casas decimais reais):
```sql
ALTER TABLE "sessions"        ALTER COLUMN "saldoInicial" TYPE INTEGER USING ROUND("saldoInicial");
ALTER TABLE "session_players" ALTER COLUMN "saldo"        TYPE INTEGER USING ROUND("saldo");
ALTER TABLE "session_teams"   ALTER COLUMN "saldo"        TYPE INTEGER USING ROUND("saldo");
ALTER TABLE "dividas"         ALTER COLUMN "valor"        TYPE INTEGER USING ROUND("valor");
ALTER TABLE "negociacao_itens" ALTER COLUMN "valor"       TYPE INTEGER USING ROUND("valor");
ALTER TABLE "resultados_partidas" ALTER COLUMN "patrimony" TYPE INTEGER USING ROUND("patrimony");
```

**Código:** procurar `parseFloat`/`Number(` aplicados a esses campos e divisões que
gerem fração. Buscar por `.saldo`, `.valor`, `patrimony` nos services de
`banco`, `divida`, `negociacao`, `session`.

**Esforço:** ~1h. **Risco baixo** se os valores já são inteiros na prática.

---

## 🔴 #3 — Strings de estado → `enum`

### Diagnóstico
~15 campos são `String` com comentário listando valores válidos. Nada impede gravar
um typo (`"Em Andamto"`). Convertendo para `enum` do Prisma: validação no DB +
autocomplete no TypeScript.

### Enums propostos
```prisma
enum SessionStatus   { ESPERANDO  EM_ANDAMENTO  FINALIZADA }
enum SessionModo     { INDIVIDUAL  DUPLAS }
enum CardTipo        { SORTE  REVES }
enum CardEfeito      { GANHAR  PAGAR  PAGAR_PCT  PAGAR_POR_CASA  PRISAO  SAIR_PRISAO }
enum Raridade        { COMUM  INCOMUM  RARO  EPICO  LENDARIO }
enum NotificationStatus { PENDENTE  ACEITA  RECUSADA }
enum NegotiationStatus  { PENDENTE  ACEITA  RECUSADA  EXPIRADA }
enum CoinTxTipo      { PARTIDA  MISSAO  LOJA_COMPRA  LOJA_VENDA  ADMIN }
enum DiamondTxTipo   { COMPRA  GASTO_LOJA  ESTORNO  ADMIN }
enum PurchaseStatus  { PENDING  COMPLETED  FAILED  REFUNDED }
enum MissionMetric   { PROPERTIES_BOUGHT  HOUSES_BUILT  RENT_EARNED  GAMES_PLAYED  WINS  TOP3 }
enum ShopItemType    { TITLE  BADGE  BANNER  FRAME }
enum AuditSeverity   { INFO  SUCCESS  WARN  DANGER }
enum BauStatus       { BLOQUEADO  PRONTO }
```

> ⚠️ **Atenção aos valores legados.** `Session.status` hoje guarda `"Esperando"`,
> `"Em Andamento"`, `"Finalizada"` (com acento/espaço). O enum usa
> `ESPERANDO`/`EM_ANDAMENTO`. A migração precisa de um `UPDATE` mapeando os valores
> antigos para os novos **antes** de trocar o tipo da coluna, OU usar `@map` nos
> valores do enum para preservar a string atual no banco:
> ```prisma
> enum SessionStatus {
>   ESPERANDO    @map("Esperando")
>   EM_ANDAMENTO @map("Em Andamento")
>   FINALIZADA   @map("Finalizada")
> }
> ```
> Usar `@map` é o caminho **sem migração de dados** — recomendado.

### Estratégia recomendada (incremental)
Não converter tudo de uma vez. Ordem segura:
1. Começar pelos enums "limpos" (valores já em UPPER ou sem dado legado problemático):
   `Raridade`, `PurchaseStatus`, `CoinTxTipo`, `DiamondTxTipo`, `BauStatus`.
2. Depois os com dado legado, usando `@map` nos valores: `SessionStatus`, `SessionModo`, `CardEfeito`.
3. Atualizar os schemas Zod em `server/src/shared/schemas/` para `z.nativeEnum(...)`.

**Código:** trocar comparações de string literal por membros do enum
(`status === "Em Andamento"` → `status === SessionStatus.EM_ANDAMENTO`). Os Zod
schemas compartilhados são o ponto central.

**Esforço:** ~2-3h (incremental). **Maior retorno por esforço em robustez.**

---

## 🟠 #4 — FKs soltas (Int sem relation)

### Diagnóstico
IDs que apontam para outras tabelas sem `@relation` — sem FK real, sem cascata,
sem `include`:

| Campo | Deveria referenciar |
|---|---|
| `Notification.sessionPossesId` | `SessionPosses` |
| `NegotiationItem.sessionPossesId` | `SessionPosses` ⚠️ (núcleo da troca) |
| `BauAdquirido.sessionId` | `Session` |
| `CoinTransaction.sessionId` | `Session` |
| `DiamondTransaction.itemId` | `ShopItem` |

### Plano
Declarar as relations (opcionais onde fizer sentido). Exemplo:
```prisma
model NegotiationItem {
  // ...
  sessionPossesId Int?
  sessionPosses   SessionPosses? @relation(fields: [sessionPossesId], references: [id])
}

model SessionPosses {
  // ...
  negotiationItems NegotiationItem[]   // lado inverso
}
```

> ⚠️ Antes de adicionar a FK, verificar se não há linhas órfãs (IDs apontando para
> registros já deletados). Se houver, limpar ou usar `onDelete: SetNull`.
> Para `CoinTransaction`/`BauAdquirido` que referenciam `Session` (que pode ser
> deletada), usar `onDelete: SetNull` para não bloquear a exclusão de partidas.

**Esforço:** ~1h. **Risco baixo**, mas exige checar órfãos primeiro.

---

## 🟠 #5 — Índices faltando em FKs

### Diagnóstico
O Prisma **não cria índice automático** em FK no Postgres. Faltam índices em
colunas usadas em `where`/`include`:

| Tabela | Coluna sem índice |
|---|---|
| `Session` | `ownerId` |
| `SessionPlayer` | `teamId` |
| `SessionPosses` | `possesId`/`propId`, `lastOwnerId` |
| `Message` | `playerId` |
| `ShopItem` | `bannerId`, `frameId`, `badgeId` |
| `DiamondTransaction` | `purchaseId` |

### Plano
```prisma
model Session       { @@index([ownerId]) }
model SessionPlayer { @@index([teamId]) }
model SessionPosses { @@index([propId]) @@index([lastOwnerId]) }
model Message       { @@index([playerId]) }
model ShopItem      { @@index([bannerId]) @@index([frameId]) @@index([badgeId]) }
```

**Esforço:** 15min. **Risco nenhum** — só adiciona índices. Pode ir junto com qualquer
outra migração.

---

## 🟡 #6 — Unificar ledgers Coin/Diamond

### Diagnóstico
`CoinTransaction` e `DiamondTransaction` são quase idênticos:
`userId`, valor, `tipo`, `createdAt`. Candidatos a um único `WalletTransaction`
com discriminador de moeda.

### Proposta
```prisma
enum Currency { COINS  DIAMONDS }

model WalletTransaction {
  id        Int      @id @default(autoincrement())
  userId    Int
  currency  Currency
  amount    Int
  tipo      String   // ou enum unificado
  sessionId Int?     // p/ COINS de partida
  // campos de pagamento (só DIAMONDS):
  itemId          Int?
  purchaseId      String?
  paymentIntentId String?  @unique
  note            String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  @@index([userId, currency])
  @@index([userId, createdAt])
  @@map("wallet_transactions")
}
```

### Trade-off — decisão necessária
- **Prós:** −1 tabela, histórico financeiro único, queries de extrato unificadas.
- **Contras:** os campos de pagamento (`paymentIntentId`, `purchaseId`, `itemId`)
  ficam **nuláveis/esparsos** para todas as linhas de coins (a maioria). Mistura
  domínios (economia de jogo vs. pagamento real com Mercado Pago).

**Recomendação:** ⚖️ **Opcional.** Se você valoriza um extrato único, vale. Se o
domínio de pagamento (diamantes/MP) é sensível e auditado à parte, **manter separado
é defensável**. Não é uma melhoria óbvia como as outras — decida pelo uso.

**Esforço:** ~2h + migração de dados (merge das duas tabelas).

---

## 🟡 #7 — Unificar Badge/Banner/Frame em `Cosmetic`

### Diagnóstico
As três tabelas compartilham a maioria dos campos:

| Campo | Badge | Banner | Frame |
|---|---|---|---|
| nome | ✅ | ✅ | ✅ |
| imagem (`imageUrl`/`css`) | ✅ | ✅ (css) | ✅ |
| `imagePublicId` | ✅ | ✅ | ✅ |
| `animated` | — | ✅ | ✅ |
| `disponibilidade` | ✅ | ✅ | ✅ |
| `createdAt` | ✅ | ✅ | ✅ |
| específicos | — | — | `scale`, `tipo` |

E `ShopItem` tem **3 FKs nuláveis** (`bannerId`, `frameId`, `badgeId`) + `type` para
saber qual usar — um polimorfismo manual.

### Proposta
```prisma
enum CosmeticKind { BADGE  BANNER  FRAME }

model Cosmetic {
  id              Int      @id @default(autoincrement())
  kind            CosmeticKind
  nome            String
  imageUrl        String?
  imagePublicId   String?
  css             String?   // banner/frame gradiente
  animated        Boolean   @default(false)
  scale           Int?      // só frame
  tipo            String?   // só frame (image|gradient)
  disponibilidade Boolean   @default(true)
  createdAt       DateTime  @default(now())

  shopItems ShopItem[]
  @@index([kind])
  @@map("cosmetics")
}

model ShopItem {
  // ... remover bannerId/frameId/badgeId
  cosmeticId Int?
  cosmetic   Cosmetic? @relation(fields: [cosmeticId], references: [id], onDelete: SetNull)
}
```

### Trade-off
- **Prós:** −2 tabelas, `ShopItem` com 1 FK em vez de 3, um CRUD de admin em vez de 3.
- **Contras:** colunas específicas (`scale`, `tipo`) ficam nuláveis para badge/banner.
  Migração precisa fundir 3 tabelas e reapontar os `ShopItem`.

**Recomendação:** ✅ **Vale a pena** — a duplicação aqui é alta e o ganho no `ShopItem`
(fim do polimorfismo manual) é concreto. Mais valioso que o #6.

**Esforço:** ~3h + migração de dados (merge das 3 tabelas + reapontar FKs do ShopItem +
ajustar `User.banner`/`frame` — ver #8).

---

## 🟡 #8 — Cosméticos equipados via FK no User

### Diagnóstico
`User` carrega cópias dos atributos do item equipado:
`banner`, `frame`, `frameType`, `frameAnimated`, `frameScale`. Isso **dessincroniza**:
se o admin editar o `Frame` (escala/animação) no catálogo, o valor copiado no `User`
fica defasado.

### Proposta
```prisma
model User {
  // remover: banner, frame, frameType, frameAnimated, frameScale
  equippedFrameId  Int?
  equippedFrame    Frame?  @relation(fields: [equippedFrameId], references: [id], onDelete: SetNull)
  equippedBannerId Int?
  equippedBanner   Banner? @relation(fields: [equippedBannerId], references: [id], onDelete: SetNull)
  // (ou equippedCosmeticId se #7 for adotado)
}
```
Ler `scale`/`animated`/`css` via join em vez de coluna copiada.

### Trade-off
- **Prós:** −4 colunas, fim do risco de sync, mesma filosofia que te levou a eliminar
  `usuario_itens`.
- **Contras:** todo lugar que renderiza o frame/banner do user passa a precisar do
  join (ou de um `include`). Pequeno custo de query, mas elimina bug de dados.

**Recomendação:** ✅ **Faria.** Combina bem com o #7 (vira `equippedCosmeticId`).

**Esforço:** ~1.5h. Tocar onde o perfil/avatar é montado no client e no
`profile`/`avatar` service.

---

## 9. 🟢 Polish de baixa prioridade

| Item | Observação |
|---|---|
| `@map("createdAt")` | Mapeia a coluna para o mesmo nome — redundante, pode remover |
| Casing legado | `Frame.imageurl`/`createdat`, `User.frametype`/`frameanimated` — colunas lowercase por legado |
| `GameSettings.key` | `@id @unique` — o `@unique` é redundante com `@id` |
| `Historico.data` | Sem `@default(now())` — inconsistente com os outros timestamps |
| `Notification` vs `UserNotification` | Nomes colidem; `Notification` é na verdade um *pedido* in-game. Considerar renomear para `GameRequest`/`PropertyRequest` |
| `user_items` (JSON) | Desnormalização **intencional** (memória registra). Custo: admin precisa varrer o JSON ao deletar `ShopItem`, sem FK. Ciente, não reverter. |

---

## 10. Ordem de execução sugerida

Cada passo = 1 commit + 1 migration + build, como fizemos com os baús.

```
Fase 1 — Quick wins (baixo risco, alto valor)
  ├── #5  Índices em FKs            (15min, risco zero)
  ├── #2  Float → Int (dinheiro)    (~1h)
  └── #4  Declarar FKs soltas       (~1h, checar órfãos antes)

Fase 2 — Robustez de tipos
  └── #3  Strings → enum            (~2-3h, incremental, usar @map nos legados)

Fase 3 — Simplificação estrutural (o coração do pedido)
  ├── #1  Eliminar Posses           (~1-2h, maior impacto)
  ├── #7  Unificar Cosmetic         (~3h)
  └── #8  Equipados via FK          (~1.5h, junto com #7)

Fase 4 — Opcional (decisão de domínio)
  └── #6  Unificar Wallet ledger    (~2h, só se quiser extrato único)
```

> **Se fizer só 3 coisas:** #1 (Posses), #3 (enums) e #8 (equipados via FK) — são as
> que mais "unificam e tornam prático" sem risco, exatamente o objetivo.

---

### Recomendações finais de processo
- **Sempre backfill antes de drop/alter de tipo** quando há dados (#1, #3 legados, #6, #7).
- Se o ambiente puder ser resetado (`make db-reset`), muitas migrações ficam triviais —
  o Prisma gera tudo sem o SQL manual de backfill.
- Rodar `make db-migrate` (gera migration dentro do container) + `cd server && npm run build`
  a cada fase, e commitar isoladamente para facilitar rollback.
