# Especificação: Mecânicas Econômicas — GameBank

## Objetivo

Transformar o jogo de "sorte com dados" em "administração sob incerteza".
Cinco mecânicas que, somadas, premiam quem sabe **investir, negociar e
administrar** — e punem a passividade.

**Princípio central:** inatividade tem que custar caro. Quem só anda pelo
tabuleiro sem desenvolver nada fica para trás automaticamente, sem precisar
de policiamento — a própria economia do jogo pune isso.

---

## Contexto econômico atual (do código)

- **Saldo inicial:** R$ 25.000
- **Crédito ao passar no Início:** R$ 2.000
- **22 propriedades normais** (R$ 600 a R$ 4.000) + **6 ações** (grupo Preto)
- **Custo de casa:** R$ 500 a R$ 2.000 (varia por grupo)
- Ações não têm casas (`custo_casa: 0`)

---

## MECÂNICA 1 — Custo de Manutenção + IPTU

### Regra

Toda propriedade gera **despesa recorrente**. A cobrança acontece **quando
o jogador passa pelo Início**, junto com o recebimento dos R$ 2.000 —
criando um momento de tensão: "recebi 2.000, mas paguei 1.800 de despesas".

| Item | Custo por volta |
|------|-----------------|
| **IPTU** (toda propriedade, mesmo sem casas) | 8% do `custo_compra` |
| **Manutenção** (por casa construída) | 12% do `custo_casa` × nº de casas |
| **Manutenção** (hotel) | 12% do `custo_casa` × 5 |
| **Ações** (grupo Preto) | Sem IPTU, sem manutenção |
| **Propriedade hipotecada** | Sem IPTU (já está com o banco) |

### Renda Passiva (contrapartida)

Propriedades geram renda passiva a cada volta: **15% do aluguel atual**
(considerando o nº de casas). Quanto mais desenvolvida, mais rende.

- Terreno cru: 15% do `aluguel_base` (praticamente nada)
- Com 4 casas: 15% do `aluguel_4c` (significativo)
- Hotel: 15% do `aluguel_hotel` (excelente)

### Fórmula da passagem pelo Início

```
Recebe:  R$ 2.000 (crédito fixo)
       + Σ (aluguel_atual × 0.15)   [renda passiva de cada propriedade]

Paga:    Σ (custo_compra × 0.08)    [IPTU de cada propriedade não hipotecada]
       + Σ (custo_casa × 0.12 × casas)  [manutenção]

Líquido = Recebe − Paga
```

### Balanceamento validado (simulação)

| Estratégia | Líquido por volta |
|-----------|-------------------|
| 6 propriedades cruas (passivo) | **+1.197** |
| Monopólio Azul, 0 casas | +1.618 |
| Monopólio Azul, 2 casas | +1.762 |
| Monopólio Azul, 4 casas | +3.562 |
| Monopólio Azul, hotéis | **+4.102** |

**Por que funciona:** o passivo sobrevive (não entra em espiral de morte),
mas fica **3,4x atrás** de quem desenvolve. Há um "vale" em 1-2 casas onde
a liquidez aperta — exige planejamento para atravessar.

### Impacto no código
- Novo cálculo na lógica de "passar pelo Início" (`turno.service.ts`)
- Extrato detalhado no frontend (o jogador precisa VER de onde vem/vai o dinheiro)
- Se o líquido for negativo e o jogador não tiver saldo → gera dívida
  (usa a regra de falência em 3 rodadas já existente)

---

## MECÂNICA 2 — Leilão Cego

### Regra

Quando um jogador **recusa comprar** uma propriedade em que caiu, ela vai a
**leilão cego** entre todos os jogadores (inclusive quem recusou).

### Fluxo

1. Jogador cai em propriedade sem dono → oferece compra pelo preço de tabela
2. Se **recusa** → abre leilão para todos
3. **Todos dão lance simultâneo e secreto** (ninguém vê o lance dos outros)
4. Timeout de **30 segundos** para dar o lance
5. Quem não quer participar → **passa** (não dá lance)
6. Ao fim, revela os lances e o **maior lance leva**

### Regras do leilão

- **Lance mínimo:** 50% do preço de tabela da propriedade
- **Lance vinculante:** quem vence é obrigado a comprar (não pode desistir)
- **Não pode dar lance acima do próprio saldo**
- **Empate:** vence quem tem **menor patrimônio total** (mecânica de catch-up
  — ajuda quem está perdendo)
- **Ninguém deu lance:** a propriedade continua sem dono

### Por que leilão CEGO

Elimina conluio na raiz. Como você não vê o lance dos outros, não dá para
combinar "não dou lance se você não der" — o parceiro pode te trair e levar
a propriedade barato. A incerteza mata o acordo.

### Impacto no código
- Novo estado de sessão: `emLeilao` + `leilaoPropId` + `leilaoLances`
- Novo evento Socket.IO: `leilao:iniciado`, `leilao:lance`, `leilao:resultado`
- Timer de 30s (usar a mesma infra de timeout de turno, com a correção do BUG 6)
- Modal de lance cego no frontend
- **O turno NÃO avança até o leilão terminar**

---

## MECÂNICA 3 — Empréstimos com Garantia

### Regra

O jogador pode pegar empréstimo do banco, mas com **garantia real** e
**juros compostos** que crescem rápido.

### Parâmetros

| Item | Valor |
|------|-------|
| **Limite de crédito** | 50% do valor das propriedades **não hipotecadas** |
| **Juros** | 10% por rodada, **compostos** |
| **Garantia** | A propriedade que **mais rende** para o jogador |
| **Quitação** | A qualquer momento, valor integral + juros acumulados |

### Cálculo da garantia (a que "mais rende")

A propriedade dada em garantia é a de **maior renda atual** para o jogador:

```
renda_atual(prop) = aluguel_atual(prop, casas) + renda_passiva(prop)
```

Ou seja: a propriedade que mais dói perder. Isso desincentiva o empréstimo
irresponsável — você está apostando seu melhor ativo.

### Execução da garantia

Se o jogador **falir** (3 rodadas devendo, regra já existente):
- O banco **toma a propriedade dada em garantia**
- A propriedade volta ao banco (fica sem dono, sem leilão)
- As casas construídas nela são perdidas

### Por que não dá para "pegar e não pagar"

1. **Juros compostos a 10%/rodada** — a dívida dobra em ~7 rodadas
2. **Garantia é o melhor ativo** — falir significa perder o que mais rende
3. **Falência em 3 rodadas** (regra já existente) — não dá para rolar indefinidamente
4. **Limite baseado em patrimônio** — só pega proporcional ao que tem

### Impacto no código
- Novos campos: `emprestimoValor`, `emprestimoJuros`, `emprestimoGarantiaPropId`
- Aplicar juros compostos a cada rodada do jogador
- Integrar com a lógica de falência existente (executar garantia)
- UI: modal de empréstimo mostrando limite, juros projetados e garantia

---

## MECÂNICA 4 — Eventos Econômicos

### Regra

A cada **2 rodadas completas**, um evento econômico afeta todos os jogadores.
O evento é **anunciado com 1 rodada de antecedência** — todos sabem ao mesmo
tempo. O que diferencia os jogadores é a **capacidade de reagir**, não a
informação privilegiada.

### Fluxo

```
Rodada N:    "⚠️ Na próxima rodada: CRISE IMOBILIÁRIA"
             (jogadores têm 1 rodada para se preparar)
Rodada N+1:  Evento aplica seus efeitos
Rodada N+2:  "⚠️ Na próxima rodada: BOOM DE CONSTRUÇÃO"
...
```

### Catálogo de eventos

| Evento | Efeito | Estratégia de reação |
|--------|--------|---------------------|
| **Crise Imobiliária** | Aluguéis caem 50% nesta rodada | Vender casas antes; ter liquidez |
| **Boom Imobiliário** | Aluguéis sobem 50% nesta rodada | Construir antes; comprar propriedades |
| **Alta de Juros** | Juros de empréstimo sobem para 20% nesta rodada | Quitar dívidas antes |
| **Corte de Juros** | Juros caem para 5% nesta rodada | Bom momento para pegar empréstimo |
| **IPTU Extraordinário** | IPTU dobra (16%) nesta passagem pelo Início | Hipotecar o que não usa; ter caixa |
| **Isenção Fiscal** | IPTU zerado nesta passagem pelo Início | Momento de segurar patrimônio |
| **Aquecimento do Mercado** | Custo de construção cai 30% nesta rodada | Construir agora |
| **Escassez de Material** | Custo de construção sobe 50% nesta rodada | Construir antes do evento |
| **Dividendos Extraordinários** | Ações rendem 2x nesta rodada | Comprar ações antes |
| **Recessão** | Renda passiva zerada nesta rodada | Ter reserva de caixa |
| **Injeção de Liquidez** | Todos recebem R$ 1.000 | (evento de alívio) |
| **Inflação** | Custos de manutenção +50% nesta rodada | Vender casas; reduzir exposição |

### Por que não é exploit

O evento é **público e antecipado** — todos têm a mesma informação. O que
separa os jogadores é:
- Ter **liquidez** para aproveitar (comprar barato na crise)
- Estar **posicionado** (não estar super alavancado quando os juros sobem)
- Saber **quando vender** (desfazer casas antes da crise)

Isso é habilidade econômica, não sorte nem exploit.

### Impacto no código
- Novos campos na sessão: `eventoAtual`, `eventoProximo`, `rodadaAtual`
- Aplicar modificadores nos cálculos de aluguel, IPTU, manutenção, juros
- Banner de aviso no frontend (destaque forte — é informação crítica)
- Histórico de eventos na aba de histórico

---

## MECÂNICA 5 — Escolha de Movimento

### Regra

Após rolar os dados, o jogador **escolhe** quantas casas andar:
- Apenas o **dado 1**
- Apenas o **dado 2**
- A **soma** dos dois (comportamento atual)

### Exemplo

Rolou 3 e 5. O jogador escolhe andar 3, 5 ou 8 casas.
- Andar 3 → cai numa propriedade livre que ele quer
- Andar 8 → escapa do hotel do adversário
- Andar 5 → cai numa casa de Notícias

### Regras

- **Dados duplos**: continuam valendo a regra de jogar de novo, MAS só se
  o jogador escolher a **soma** (senão seria abuso — escolher o dado menor
  e ainda jogar de novo)
- **Na prisão**: a regra de duplos para sair não muda (precisa tirar duplo real)
- **3 duplos seguidos**: continua indo preso

### Por que não vira "circular em zona segura"

1. A escolha é **entre 3 opções que os dados deram** — muitas vezes as três
   são ruins
2. **Custo de manutenção** (Mecânica 1) torna a passividade perdedora — não
   adianta evitar risco se você não desenvolve
3. Os R$ 2.000 do Início são **fixos** — dar voltas rápidas não multiplica renda

### Impacto no código
- `rolarDados` retorna os dados mas **não move** ainda
- Novo passo: jogador escolhe o movimento (modal com 3 botões)
- Timeout: se não escolher em X segundos, usa a soma (padrão)
- `aguardandoAcao` = true durante a escolha

---

## ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

| Ordem | Mecânica | Risco | Impacto |
|-------|----------|-------|---------|
| 1 | **Manutenção + IPTU + Renda Passiva** | 🟡 Médio | 🔥 Altíssimo — é o coração da mudança |
| 2 | **Eventos Econômicos** | 🟢 Baixo | 🔥 Alto — dá identidade própria ao jogo |
| 3 | **Escolha de Movimento** | 🟢 Baixo | 🔥 Médio — reduz sorte |
| 4 | **Leilão Cego** | 🔴 Alto | 🔥 Alto — mas mexe no fluxo de turno |
| 5 | **Empréstimos** | 🟡 Médio | 🔥 Médio — camada extra de estratégia |

**Comece pela Mecânica 1.** Ela sozinha já transforma o jogo — sem ela, as
outras não têm o mesmo efeito, porque a passividade continua viável.

---

## AVISO DE BALANCEAMENTO

Os números foram calibrados por simulação contra a economia real do jogo
(saldo inicial R$ 25.000, propriedades R$ 600-4.000). Mas **balanceamento
só se valida jogando**.

Recomendação: implementar a Mecânica 1, jogar 3-5 partidas completas, e
ajustar as porcentagens (IPTU 8%, manutenção 12%, renda 15%) conforme o
feedback real. Deixar esses valores em **constantes configuráveis**, não
hardcoded, para facilitar o ajuste fino.

```typescript
// server/src/constants/economia.ts
export const IPTU_PCT = 0.08          // 8% do custo de compra
export const MANUTENCAO_PCT = 0.12    // 12% do custo da casa, por casa
export const RENDA_PASSIVA_PCT = 0.15 // 15% do aluguel atual
export const CREDITO_INICIO = 2000    // já existe
export const EMPRESTIMO_LIMITE_PCT = 0.50  // 50% do patrimônio livre
export const EMPRESTIMO_JUROS_PCT = 0.10   // 10% compostos por rodada
export const LEILAO_LANCE_MINIMO_PCT = 0.50 // 50% do preço de tabela
export const LEILAO_TIMEOUT_S = 30
export const EVENTO_INTERVALO_RODADAS = 2
```
