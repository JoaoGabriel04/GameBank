# Sistema de Troféus — GameBank

> Documento de planejamento completo para implementação futura.  
> Status: **Pendente** — artes das patentes serão criadas à parte.  
> Última revisão: adicionada distinção entre desistência voluntária e falência (seção 5.4 e 7.8).

---

## 1. Visão Geral

O sistema de troféus substitui/complementa o sistema de Ranking por XP (que já foi removido da aba de classificação) com uma progressão competitiva baseada em desempenho por partida. O jogador possui uma **contagem de troféus** que sobe ou desce a cada partida finalizada, determinando sua **patente** e **subdivisão**.

A filosofia central:

- **Só o top 3 ganha troféus.** O 4º lugar é neutro. O 5º e 6º perdem.
- **Quanto mais alta a patente, mais difícil subir** — os ganhos diminuem e as perdas aumentam progressivamente.
- **Progressão natural para novos jogadores** — no Bronze a expectativa de ganho por partida é positiva até para jogadores medianos; no Mestre, apenas os consistentemente bons mantêm a posição.

---

## 2. Estrutura de Patentes e Subdivisões

| Patente   | Subdivisões       | Total de sub-tiers |
|-----------|-------------------|--------------------|
| Bronze    | 1, 2, 3           | 3                  |
| Prata     | 1, 2, 3           | 3                  |
| Ouro      | 1, 2, 3           | 3                  |
| Platina   | 1, 2, 3, 4        | 4                  |
| Diamante  | 1, 2, 3, 4        | 4                  |
| Mestre    | — (sem subdivisão)| 1                  |
| **Total** |                   | **18 sub-tiers**   |

---

## 3. Faixas de Troféus por Sub-tier

Cada sub-tier possui uma faixa de troféus que o jogador precisa atravessar para subir (ou abaixo da qual ele desce de divisão).

| Sub-tier    | Mínimo | Máximo | Largura |
|-------------|--------|--------|---------|
| Bronze 1    | 0      | 99     | 100     |
| Bronze 2    | 100    | 199    | 100     |
| Bronze 3    | 200    | 299    | 100     |
| Prata 1     | 300    | 449    | 150     |
| Prata 2     | 450    | 599    | 150     |
| Prata 3     | 600    | 749    | 150     |
| Ouro 1      | 750    | 999    | 250     |
| Ouro 2      | 1.000  | 1.249  | 250     |
| Ouro 3      | 1.250  | 1.499  | 250     |
| Platina 1   | 1.500  | 1.799  | 300     |
| Platina 2   | 1.800  | 2.099  | 300     |
| Platina 3   | 2.100  | 2.399  | 300     |
| Platina 4   | 2.400  | 2.699  | 300     |
| Diamante 1  | 2.700  | 3.049  | 350     |
| Diamante 2  | 3.050  | 3.399  | 350     |
| Diamante 3  | 3.400  | 3.749  | 350     |
| Diamante 4  | 3.750  | 4.099  | 350     |
| Mestre      | 4.100  | ∞      | —       |

**Piso absoluto:** o jogador nunca pode ter menos de 0 troféus (não cai abaixo de Bronze 1 com troféus negativos).

---

## 4. Ganhos e Perdas por Posição

Os deltas de troféu variam de acordo com a **patente atual do jogador**, não a da sala. Um jogador no Diamante que joga numa sala com Bronze ainda usa os valores do Diamante.

| Posição | Bronze | Prata | Ouro | Platina | Diamante | Mestre |
|---------|--------|-------|------|---------|----------|--------|
| 🥇 1º   | +30    | +28   | +25  | +22     | +20      | +18    |
| 🥈 2º   | +20    | +18   | +15  | +13     | +11      | +10    |
| 🥉 3º   | +10    | +8    | +7   | +6      | +5       | +4     |
| 4º      | 0      | 0     | 0    | 0       | 0        | 0      |
| 5º      | −10    | −12   | −15  | −16     | −20      | −24    |
| 6º      | −20    | −22   | −25  | −26     | −32      | −40    |

### Esperança por partida (distribuição uniforme entre 6 posições)

> Indica o ganho médio esperado se o jogador for igualmente provável em qualquer posição.

| Patente  | Esperança/partida | Leitura                                               |
|----------|-------------------|-------------------------------------------------------|
| Bronze   | **+5,0**          | Todos sobem no longo prazo — patente de aprendizado   |
| Prata    | **+3,3**          | Ainda favorável, exige um pouco mais de consistência  |
| Ouro     | **+1,2**          | Quase neutro — jogar bem começa a importar mais       |
| Platina  | **−0,2**          | Ponto de equilíbrio — precisa performar acima da média|
| Diamante | **−2,7**          | Só quem domina o top 3 consistentemente sobe          |
| Mestre   | **−5,3**          | Posição de elite — perda líquida para jogo mediano    |

### Jogador consistentemente bom (40% 1º · 35% 2º · 25% 3º)

| Patente  | Ganho médio/partida | Ganho em 4 partidas/dia |
|----------|---------------------|-------------------------|
| Bronze   | +21,5               | ~86 troféus/dia         |
| Prata    | +20,1               | ~80 troféus/dia         |
| Ouro     | +17,5               | ~70 troféus/dia         |
| Platina  | +15,4               | ~62 troféus/dia         |
| Diamante | +13,8               | ~55 troféus/dia         |
| Mestre   | +12,4               | ~50 troféus/dia         |

Com esse ritmo, um jogador de alto nível leva cerca de:

- **Bronze completo (300 troféus):** ~4 dias
- **Prata completa (450 troféus a percorrer):** ~6 dias
- **Ouro completo (750 troféus a percorrer):** ~11 dias
- **Platina completa (1.200 troféus a percorrer):** ~19 dias
- **Diamante completo (1.400 troféus a percorrer):** ~25 dias
- **Chegar ao Mestre (4.100 troféus totais):** ~47 dias de jogo intenso

---

## 5. Mecânicas Especiais

### 5.1 Rebaixamento de Sub-tier

Quando o jogador cai abaixo do **mínimo** da sua sub-divisão atual, desce automaticamente para a divisão imediatamente inferior, com os troféus preservados (fica no topo da divisão anterior).

Exemplo: Ouro 2 começa em 1.000. Se o jogador cai para 999, entra em Ouro 1.

Não há "escudo" de promoção — o rebaixamento é imediato.

### 5.2 Rebaixamento de Patente

Troféus cruzam as fronteiras de patente normalmente. Se um jogador em Prata 1 cai abaixo de 300, volta para Bronze 3 (com troféus em 299, topo do Bronze 3).

### 5.3 Partidas com Menos de 6 Jogadores

O jogo suporta 2–6 jogadores. Quando há menos de 6, as posições são ajustadas:

| Jogadores | Ganha troféus   | Neutro | Perde troféus     |
|-----------|-----------------|--------|-------------------|
| 6         | 1º, 2º, 3º     | 4º     | 5º, 6º            |
| 5         | 1º, 2º, 3º     | 4º     | 5º (usa valor 6º) |
| 4         | 1º, 2º, 3º     | 4º     | — (ninguém perde) |
| 3         | 1º, 2º         | 3º     | — (ninguém perde) |
| 2         | 1º             | —      | 2º (usa valor 6º) |

> Regra geral: `último colocado` usa sempre o delta da 6ª posição; `penúltimo` usa o da 5ª.  
> Com 3 ou 4 jogadores, o último colocado é o 4º (neutro), suavizando a perda em partidas menores.

### 5.4 Desistência Voluntária vs. Falência

O campo `desistiu` no `SessionPlayer` cobre dois cenários hoje tratados de forma idêntica, mas com significados opostos para o ranking:

| Situação | O que significa | Justo para troféus? |
|---|---|---|
| **Falência** (`FALENCIA`) | Jogador foi eliminado pelo jogo — ficou sem dinheiro para pagar dívidas | ✅ Sim — é o Monopoly canônico; quem faliu primeiro fica por último |
| **Desistência voluntária** (`VOLUNTARIA`) | Jogador saiu por vontade própria, possivelmente ainda rico | ❌ Não — congelar o patrimônio no pico e herdar troféus de top 3 é injusto |

#### Regra adotada para troféus

O campo `motivoDesistencia` (`"FALENCIA" | "VOLUNTARIA"`) será adicionado ao `SessionPlayer`. O `calculateRankings` usará essa informação para ordenar em três grupos, nesta ordem de prioridade:

```
1º grupo — Jogadores que NUNCA desistiram (ativos até o fim)
           → ordenados por patrimônio final DESC

2º grupo — Jogadores que desistiram por FALENCIA
           → ordenados por patrimônio no momento da falência DESC
           (quem faliu mais rico / mais tarde é melhor colocado)

3º grupo — Jogadores que desistiram VOLUNTARIAMENTE
           → ordenados pelo momento da desistência DESC
           (quem ficou mais tempo na partida é melhor colocado)
```

Um jogador que desistiu voluntariamente com R$ 50.000 **nunca ficará à frente** de um que lutou até o fim com R$ 10.000. Isso resolve o problema de fairness sem alterar a experiência de quem joga honestamente até o encerramento.

#### Impacto no fluxo de troféus

- `calcularDeltaTrofeus` não muda — recebe apenas a `position` final
- Quem desiste voluntariamente compete em desvantagem de colocação e consequentemente perde mais troféus (ou ganha menos), naturalmente desincentivando a prática

### 5.6 Mestre — Sem Teto

Mestre não tem teto de troféus. O jogador continua acumulando troféus normalmente e o total funciona como sub-ranking dentro da patente (pode ser exibido como "Mestre — 4.850 troféus").

---

## 6. Assets Visuais

As artes serão criadas pelo usuário posteriormente. Nomenclatura definida:

```
BRONZE_1.png    BRONZE_2.png    BRONZE_3.png
PRATA_1.png     PRATA_2.png     PRATA_3.png
OURO_1.png      OURO_2.png      OURO_3.png
PLATINA_1.png   PLATINA_2.png   PLATINA_3.png   PLATINA_4.png
DIAMANTE_1.png  DIAMANTE_2.png  DIAMANTE_3.png  DIAMANTE_4.png
MESTRE.png
```

**Total: 18 imagens.**

Recomendação de pasta no cliente: `client/public/ranks/`.

---

## 7. Plano de Implementação Técnica

### 7.1 Schema Prisma — Alterações

```prisma
// ── Em model User ────────────────────────────────────────────────────────────
trophies        Int       @default(0)

// ── Novo campo em model GameResult ───────────────────────────────────────────
// (tabela já existe — apenas adicionar a coluna)
trophyDelta     Int       @default(0)   // delta aplicado nesta partida (+/−)
trophyBefore    Int       @default(0)   // troféus antes da partida
trophyAfter     Int       @default(0)   // troféus após a partida
```

> **Não** criar uma tabela separada de histórico de troféus — o `GameResult` já é o registro imutável por partida e comporta esses três campos sem custo adicional.

**Migration manual necessária** (adicionar colunas com DEFAULT sem alterar dados existentes — operação segura):

```sql
ALTER TABLE "User" ADD COLUMN "trophies" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GameResult"
  ADD COLUMN "trophyDelta"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trophyBefore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trophyAfter"  INTEGER NOT NULL DEFAULT 0;
```

### 7.2 Constantes de Troféus

Criar `server/src/shared/constants/trophies.ts`:

```typescript
export type TrophyRank = "BRONZE" | "PRATA" | "OURO" | "PLATINA" | "DIAMANTE" | "MESTRE";

export interface TierInfo {
  rank: TrophyRank;
  tier: number;      // 1-based
  min: number;
  max: number | null; // null = sem teto (Mestre)
}

export const TROPHY_TIERS: TierInfo[] = [
  { rank: "BRONZE",   tier: 1, min: 0,    max: 99   },
  { rank: "BRONZE",   tier: 2, min: 100,  max: 199  },
  { rank: "BRONZE",   tier: 3, min: 200,  max: 299  },
  { rank: "PRATA",    tier: 1, min: 300,  max: 449  },
  { rank: "PRATA",    tier: 2, min: 450,  max: 599  },
  { rank: "PRATA",    tier: 3, min: 600,  max: 749  },
  { rank: "OURO",     tier: 1, min: 750,  max: 999  },
  { rank: "OURO",     tier: 2, min: 1000, max: 1249 },
  { rank: "OURO",     tier: 3, min: 1250, max: 1499 },
  { rank: "PLATINA",  tier: 1, min: 1500, max: 1799 },
  { rank: "PLATINA",  tier: 2, min: 1800, max: 2099 },
  { rank: "PLATINA",  tier: 3, min: 2100, max: 2399 },
  { rank: "PLATINA",  tier: 4, min: 2400, max: 2699 },
  { rank: "DIAMANTE", tier: 1, min: 2700, max: 3049 },
  { rank: "DIAMANTE", tier: 2, min: 3050, max: 3399 },
  { rank: "DIAMANTE", tier: 3, min: 3400, max: 3749 },
  { rank: "DIAMANTE", tier: 4, min: 3750, max: 4099 },
  { rank: "MESTRE",   tier: 1, min: 4100, max: null },
];

// Delta por posição (1-indexed) indexado por patente
export const TROPHY_DELTAS: Record<TrophyRank, Record<number, number>> = {
  BRONZE:   { 1: 30,  2: 20,  3: 10,  4: 0, 5: -10, 6: -20 },
  PRATA:    { 1: 28,  2: 18,  3: 8,   4: 0, 5: -12, 6: -22 },
  OURO:     { 1: 25,  2: 15,  3: 7,   4: 0, 5: -15, 6: -25 },
  PLATINA:  { 1: 22,  2: 13,  3: 6,   4: 0, 5: -16, 6: -26 },
  DIAMANTE: { 1: 20,  2: 11,  3: 5,   4: 0, 5: -20, 6: -32 },
  MESTRE:   { 1: 18,  2: 10,  3: 4,   4: 0, 5: -24, 6: -40 },
};

export function getTierInfo(trophies: number): TierInfo {
  // Percorre do maior para o menor — Mestre primeiro
  for (let i = TROPHY_TIERS.length - 1; i >= 0; i--) {
    if (trophies >= TROPHY_TIERS[i].min) return TROPHY_TIERS[i];
  }
  return TROPHY_TIERS[0]; // Bronze 1 como fallback
}

export function getRankFromTrophies(trophies: number): TrophyRank {
  return getTierInfo(trophies).rank;
}

/** Retorna o asset name: "BRONZE_1", "MESTRE", etc. */
export function getTrophyAssetName(trophies: number): string {
  const info = getTierInfo(trophies);
  if (info.rank === "MESTRE") return "MESTRE";
  return `${info.rank}_${info.tier}`;
}

/**
 * Calcula o delta de troféus com base na posição e número de jogadores.
 * Adapta a posição efetiva para partidas com menos de 6 jogadores.
 */
export function calcularDeltaTrofeus(
  currentTrophies: number,
  rawPosition: number,    // posição real na partida (1-based)
  totalPlayers: number    // quantos jogadores havia na partida
): number {
  const rank = getRankFromTrophies(currentTrophies);
  const deltas = TROPHY_DELTAS[rank];

  // Normaliza posição para até 6 slots
  let effectivePosition = rawPosition;
  if (totalPlayers < 6 && rawPosition > 3) {
    // Último colocado → posição 6; penúltimo → posição 5
    const stepsFromLast = totalPlayers - rawPosition; // 0 = último, 1 = penúltimo
    effectivePosition = stepsFromLast === 0 ? 6 : 5;
    // Com 4+ jogadores, o "neutro" (posição 4 original) vira pos 4 mesmo
    if (totalPlayers === 4 && rawPosition === 4) effectivePosition = 4;
    if (totalPlayers === 3 && rawPosition === 3) effectivePosition = 4; // neutro
    if (totalPlayers === 2 && rawPosition === 2) effectivePosition = 6; // perda
  }

  const delta = deltas[effectivePosition] ?? 0;

  // Impede trofeus negativos
  if (currentTrophies + delta < 0) return -currentTrophies;

  return delta;
}
```

### 7.3 Backend — Integração com `endSession`

O hook de troféus vai dentro da transação existente em `session.service.ts → endSession`, logo após o bloco que atualiza `totalGames` / `totalWins` / `totalTop3`.

```typescript
// Dentro do for (const entry of ranked) { ... } na $transaction:

const trophyBefore = user.trophies;
const trophyDelta  = calcularDeltaTrofeus(
  trophyBefore,
  entry.position,
  ranked.length
);
const trophyAfter  = Math.max(0, trophyBefore + trophyDelta);

await tx.user.update({
  where: { id: p.userId },
  data: {
    // campos já existentes...
    trophies: trophyAfter,
  },
});

// Atualiza o GameResult que acabou de ser criado com os campos de troféu
await tx.gameResult.update({
  where: { sessionId_userId: { sessionId, userId: p.userId } },
  data: { trophyDelta, trophyBefore, trophyAfter },
});
```

> `GameResult` tem `@@unique([sessionId, userId])` — confirmar se existe, ou usar `findFirst` + `update` por `id`.

### 7.4 Novos Arquivos do Módulo

Não é necessário um módulo dedicado para troféus — a lógica se encaixa nas constantes compartilhadas e no `session.service`. Porém, para o histórico e consulta de troféus no perfil:

```
server/src/modules/ranking/ranking.repository.ts   ← adicionar campo trophies ao SELECT
server/src/modules/profile/profile.service.ts      ← expor trophies e assetName no perfil
```

### 7.5 Ranking — Ordenação por Troféus

Adicionar `trophies` como nova opção de ordenação no `ranking.repository.ts`:

```typescript
// Adicionar trophies ao select de getRanking:
select: {
  // ... campos já existentes
  trophies: true,
}
```

E reintroduzir no `ranking/page.tsx` do cliente como nova métrica (retorna a aba removida com nome "Troféus"):

```typescript
type Metric = "nivel" | "trofeus" | "vitorias" | "partidas" | "winrate";

// Em METRIC_META:
trofeus: {
  label: "Troféus",
  icon: Trophy,
  getValue: (p) => p.trophies ?? 0,
  format: (v) => v.toLocaleString("pt-BR"),
  unit: "troféus"
},
```

### 7.6 Frontend — Exibição da Patente

#### Componente `TrophyBadge`

Criar `client/src/components/TrophyBadge/index.tsx`:

```tsx
import Image from "next/image";
import { getTrophyAssetName } from "@/utils/trophies"; // versão client dos helpers

interface Props {
  trophies: number;
  size?: number; // px
}

export default function TrophyBadge({ trophies, size = 40 }: Props) {
  const asset = getTrophyAssetName(trophies);
  return (
    <Image
      src={`/ranks/${asset}.png`}
      alt={asset.replace("_", " ")}
      width={size}
      height={size}
    />
  );
}
```

> Os utilitários `getTierInfo`, `getTrophyAssetName` devem ter uma cópia ou re-export em `client/src/utils/trophies.ts`.

#### Onde exibir

| Local | O que mostrar |
|-------|---------------|
| Perfil do usuário (`/user/perfil`) | Ícone da patente + total de troféus + delta da última partida |
| Modal do jogador no Ranking | Ícone da patente + troféus totais |
| Tela de fim de partida (PodiumModal / resultado) | Delta de troféus por jogador (+30, −20 etc.) com cor verde/vermelho |
| Card do jogador no jogo (PlayerCard) | Ícone pequeno da patente (opcional, menos prioritário) |

### 7.8 Distinção Voluntária vs. Falência — Esboço de Mudanças

#### Schema Prisma

```prisma
// ── Em model SessionPlayer ────────────────────────────────────────────────────
desistiu              Boolean  @default(false)
patrimonyAtDesistir   Int?
motivoDesistencia     String?  // "FALENCIA" | "VOLUNTARIA" | null (ainda em jogo)
desistiuEm            DateTime? // timestamp da saída — usado para desempate no grupo 3
```

> `motivoDesistencia` como `String?` em vez de enum porque `Session.status` já é string
> por acoplamento com o cliente — mesma pragmática do CLAUDE.md ("Intentionally NOT enums").
> `desistiuEm` substitui a necessidade de um campo `ordem de eliminação` separado.

**Migration manual:**

```sql
ALTER TABLE "session_players"
  ADD COLUMN "motivoDesistencia" TEXT,
  ADD COLUMN "desistiuEm"        TIMESTAMPTZ;
```

Colunas nullable sem default — não afeta linhas existentes. Migração segura.

#### `desistirSession` — preencher `motivoDesistencia`

Em `session.service.ts`, o método `desistirSession` é a desistência **voluntária**. Basta adicionar os dois campos novos no update final:

```typescript
// Dentro do $transaction em desistirSession:
await tx.sessionPlayer.update({
  where: { id: player.id },
  data: {
    saldo: 0,
    desistiu: true,
    motivoDesistencia: "VOLUNTARIA",   // ← novo
    desistiuEm: new Date(),            // ← novo
  },
});
```

Para falência (quando um jogador não consegue pagar dívidas e o servidor elimina ele), a chamada equivalente deve usar `"FALENCIA"`. Localizar todos os pontos onde `desistiu: true` é setado fora do `desistirSession` e garantir que `motivoDesistencia` seja preenchido corretamente — provavelmente em `banco.service.ts` ou similar.

#### `calculateRankings` — ordenação em três grupos

```typescript
private async calculateRankings(session: any) {
  const players = await mapSessionPlayers(session.jogadores ?? []);
  const posses  = session.sessionPosses ?? [];

  const withPatrimony = players.map((p: any) => {
    let patrimony = p.saldo;
    if (p.desistiu && p.patrimonyAtDesistir != null) {
      patrimony = p.patrimonyAtDesistir;
    } else {
      for (const sp of posses) {
        if (sp.playerId === p.id && sp.propriedade) {
          patrimony += sp.propriedade.custo_compra;
          patrimony += sp.casas * sp.propriedade.custo_casa;
        }
      }
    }
    return {
      player: p,
      patrimony,
      grupo: !p.desistiu
        ? 0                                                  // ativo até o fim
        : p.motivoDesistencia === "VOLUNTARIA" ? 2 : 1,     // falência = 1, voluntária = 2
      desistiuEm: p.desistiuEm as Date | null,
    };
  });

  withPatrimony.sort((a: any, b: any) => {
    // 1. grupo primeiro (0 < 1 < 2)
    if (a.grupo !== b.grupo) return a.grupo - b.grupo;

    // 2. dentro do grupo 0 e 1: maior patrimônio vence
    if (a.grupo < 2) return b.patrimony - a.patrimony;

    // 3. dentro do grupo 2 (voluntários): quem saiu mais tarde vence
    const ta = a.desistiuEm?.getTime() ?? 0;
    const tb = b.desistiuEm?.getTime() ?? 0;
    return tb - ta; // mais recente = melhor posição
  });

  return withPatrimony.map((entry: any, index: number) => ({
    ...entry,
    position: index + 1,
  }));
}
```

#### Compatibilidade com partidas antigas

Sessões finalizadas antes dessa mudança terão `motivoDesistencia = null`. No `calculateRankings`, `null` é tratado como `"FALENCIA"` (comportamento legado preservado), mantendo consistência no histórico de `GameResult`.

---

### 7.10 Tipo `RankingUser` — Atualizar

Em `client/src/types/shop.ts` (ou onde `RankingUser` estiver definido):

```typescript
export interface RankingUser {
  // ... campos existentes
  trophies: number;
}
```

---

## 8. Ordem de Implementação Sugerida

```
1. Adicionar motivoDesistencia + desistiuEm ao SessionPlayer (schema.prisma)
2. Adicionar trophies ao User + trophyDelta/Before/After ao GameResult (schema.prisma)
3. Criar migration manual (dois ALTERs — sessão 7.1 e 7.8)
4. Preencher motivoDesistencia: "VOLUNTARIA" em desistirSession
5. Mapear todos os pontos de falência forçada e preencher "FALENCIA"
6. Reescrever calculateRankings com a ordenação em 3 grupos (sessão 7.8)
7. Criar server/src/shared/constants/trophies.ts
8. Integrar calcularDeltaTrofeus em endSession (session.service.ts)
9. Expor trophies em ranking.repository + profile.service
10. Criar client/src/utils/trophies.ts (espelho client-side das funções puras)
11. Criar componente TrophyBadge
12. Adicionar aba "Troféus" no ranking page
13. Exibir no Perfil e no PodiumModal
14. Adicionar assets visuais quando as artes estiverem prontas (client/public/ranks/)
```

---

## 9. Considerações Futuras (não implementar agora)

- **Temporadas:** resetar troféus parcialmente (ex: `novosTrofeus = floor(atual * 0.5)`) a cada X semanas para manter o ranking dinâmico.
- **Proteção de promoção:** na primeira partida após subir de patente, o jogador não pode perder troféus abaixo do limiar da divisão recém-alcançada (escudo de 1 jogo).
- **Leaderboard por troféus:** top 100 da semana separado do ranking global.
- **Recompensas de patente:** baú ou moedas ao atingir uma nova patente pela primeira vez.
- **Partidas em equipe (modo dupla):** definir se o delta é individual ou compartilhado.
