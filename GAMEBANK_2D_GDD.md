# GameBank 2D — Documento de Design (GDD)

> Documento vivo. Captura a visão do jogo antes da implementação. Seções
> marcadas com **[A DEFINIR]** são lacunas conhecidas a preencher.
>
> **Versionar no repositório.** Este documento substitui o PDF perdido — não
> deve viver fora do controle de versão.

---

## 1. Visão geral

**GameBank 2D** é um jogo de **gestão econômica competitiva** — um tycoon
imobiliário multiplayer em 2D, com estética pixelada em tiles (referência:
Stardew Valley).

Não é uma variação de Banco Imobiliário. Não há tabuleiro, peão nem dados. Os
jogadores administram um **império imobiliário** num mapa compartilhado,
comprando terrenos, construindo, precificando aluguéis e lendo o ciclo
econômico para prosperar — enquanto decisões erradas levam à falência.

### Pilares de design

1. **A vantagem vem da gestão, não do tamanho.** Ter muitas propriedades não
   garante nada se elas estão mal precificadas ou vazias.
2. **O mercado é vivo.** Inquilinos reagem a preço e inflação. Eventos movem o
   ciclo. Quem lê o mercado ganha.
3. **Decisão errada tem consequência real.** Alavancagem, custos e vacância
   podem quebrar um jogador.
4. **Tempo é pressão.** Rodadas simultâneas cronometradas — todos agem ao
   mesmo tempo, sob o relógio.

---

## 2. Loop de jogo

### Estrutura temporal

```
PARTIDA = sequência de MESES (rodadas)
  │
  ├─ RODADA (1 mês fictício)
  │    ├─ Fase de AÇÃO (5 min reais — todos jogam ao mesmo tempo)
  │    │    · comprar terreno
  │    │    · construir / demolir
  │    │    · ajustar aluguéis
  │    │    · negociar, pegar/quitar empréstimo
  │    │    · (fase 2) sublocar terreno de outro jogador
  │    │
  │    └─ FECHAMENTO (a rodada avança)
  │         · inquilinos avaliam preços vs. mercado → ocupam ou saem
  │         · aluguéis são creditados
  │         · custos: manutenção, impostos, juros de dívida
  │         · evento econômico do próximo mês é revelado
  │         · TELA DE RESULTADOS do mês (o que cada um ganhou/perdeu)
```

### Rodadas simultâneas (diferença central do jogo atual)

Ao contrário do GameBank atual (turnos alternados), **todos os jogadores agem
ao mesmo tempo** durante os 5 minutos. Não se espera a vez. Isso muda a
natureza do jogo: é administração sob pressão de tempo, com informação
imperfeita sobre o que os rivais estão fazendo.

- **Duração da rodada:** 5 min (valor de teste — ajustável)
- **Ação:** livre, limitada apenas por dinheiro
- **Inatividade:** se o jogador não faz nada, a rodada avança e ele apenas
  colhe/paga o que já tinha em andamento

**[DECIDIDO]** As ações são aplicadas em **tempo real**: cada jogador tem 5
minutos para realizar manutenções e melhorias nas suas propriedades, e as
mudanças valem imediatamente. Todos agem ao mesmo tempo. O fechamento apenas
resolve a economia do mês (inquilinos, aluguéis, custos) sobre o estado final
que cada jogador deixou. Ver implicações técnicas na Seção 9.

### Início de partida

**[DECIDIDO]** O início segue estas regras:

1. **Posição simétrica em valor, assimétrica em geografia.** Todos os
   jogadores começam com o **mesmo saldo**. Ao iniciar a partida, cada um
   recebe **um terreno sorteado**, sempre entre os **mais baratos** do mapa
   (nunca um terreno valioso de largada). Ninguém começa em vantagem
   financeira, mas cada um começa em um ponto diferente do mapa — cria
   identidade de partida sem desbalancear.

2. **Sem fase de preparação.** Não há "mês 0" calmo. O relógio dos 5 minutos
   já corre desde o mês 1. A pressão de tempo é parte do jogo desde o
   primeiro instante.

3. **Mapa começa vazio.** Nenhuma construção neutra ou pré-existente. Toda
   construção do mapa é fruto de decisão de algum jogador.

4. **Saldo inicial: R$ 1.000 (confirmado — validado por simulação
   rescalada).** Testado contra a economia real do mapa nomeado de 30
   terrenos (rescalada ÷10 em relação à primeira simulação, mesmas
   proporções):
   - Dá para **construir casa nível 1** no terreno grátis (custo R$ 120)
     **e ainda comprar um 2º terreno** na mesma categoria "comum" (R$ 180 a
     R$ 210) com sobra de ~R$ 700 — a decisão real de "expandir agora ou
     consolidar"
   - **Acumular terreno vazio sem construir já se autopune, com a mesma
     força de antes:** simulado um jogador que gasta R$ 900 comprando 5
     terrenos vazios de Vila Nova (a região mais barata) — sobra R$ 100, e
     IPTU + imposto progressivo (~R$ 37/mês) quebram esse jogador em **~2,7
     meses**, idêntico ao teste original em escala maior.
   - **Atenção de escassez:** neste mapa de apenas 30 terrenos, 5 terrenos
     vazios já representam **17% do mapa inteiro** — a disputa por terreno é
     mais acirrada que num mapa de 140. Isso reforça a pergunta em aberto na
     Seção 4 sobre o tamanho definitivo do mapa.

**Critério de "terreno mais barato" no sorteio:** o terreno inicial gratuito
é sempre sorteado dentre os das regiões **Periferia** ou **Popular** (as duas
mais baratas do mapa).

---

## 3. Fim de partida

A partida termina quando **qualquer uma** destas condições é atingida:

1. **Limite de meses:** ao completar **24 meses** (2 anos fictícios)
2. **Colapso populacional:** quando resta **metade ou menos** dos jogadores
   (os demais faliram)

### Vitória (com desempate por Reputação — [DECIDIDO, com suposições marcadas])

O vencedor é decidido por **dois critérios combinados**: patrimônio líquido
e **Reputação** (índice de confiança pública — nova mecânica, ver Seção 5).

```
1. Calcula o ranking de patrimônio líquido (ativos − dívidas) de todos.

2. Se a diferença entre o 1º e o 2º colocado for PEQUENA
   (limiar proposto: ~12% do patrimônio do líder — ver nota de calibragem):

     a. Se apenas um dos dois tem Reputação ≥ 4.0 → esse vence,
        mesmo com patrimônio levemente menor
     b. Se AMBOS têm Reputação ≥ 4.0 → vence quem tiver a MAIOR Reputação
     c. Se NENHUM tem Reputação ≥ 4.0 → critério normal: maior patrimônio vence

3. Se a diferença for GRANDE (acima do limiar) → vence quem tem maior
   patrimônio. Reputação não interfere — uma vantagem financeira clara
   não pode ser anulada por reputação.
```

**Por que isto é coerente com o resto do design:** o "aluguel justo" (Seção
5) já recompensa precificar com equilíbrio em vez de espremer o inquilino.
A Reputação estende esse princípio para o critério de vitória — o jogador
"quase empatado" que jogou de forma mais responsável (não só mais rico)
pode levar a taça.

**[SUPOSIÇÕES A CONFIRMAR — assumidas para não travar o design]:**
- Esta regra vale para **qualquer** forma de encerramento (tempo esgotado em
  24 meses OU colapso populacional) — não só o fim antecipado. Se a intenção
  era restringir só ao fim antecipado, avisar para corrigir.
- O limiar de "diferença pequena" foi proposto como **percentual** (~12% do
  patrimônio do líder) em vez de um valor fixo em reais — assim a regra
  continua válida mesmo se a economia for recalibrada no futuro. O valor
  exato (12%) é um ponto de partida; precisa de uma simulação de partida
  completa (24 meses) para validar se é a faixa certa de "quase empate".

### Derrota (falência)
Um jogador **fale** quando seu **patrimônio atual não cobre suas dívidas
totais** — mesmo critério do GameBank atual. Ativos podem ser liquidados para
cobrir; se ainda assim não cobre, está fora.

**[A DEFINIR]** A falência é imediata (no fechamento em que a dívida supera o
patrimônio) ou há um período de graça (X meses para se recuperar, como as 3
rodadas atuais)?

---

## 4. O mapa

- **Estilo:** tiles pixelados, mapa **inteiro visível** (com zoom/pan)
- **Regiões:** o mapa tem zonas distintas com características econômicas
  diferentes
- **Terrenos:** cada terreno é uma célula (ou bloco de células) clicável, com
  estado próprio (dono, construções, valor)

### Regiões (nomeadas e expandidas — validado por simulação)

**18 regiões nomeadas**, organizadas em **3 categorias** (comum, mediana,
rica), **76 terrenos** no total:

| Categoria | Região | Terrenos | Mult. | Preço do terreno | Aluguel base (casa N1) |
|-----------|--------|----------|-------|--------------------|--------------------------|
| Comum | Vila Nova | 5 | 0,60× | R$ 180 | R$ 30/mês |
| Comum | Trizidela | 4 | 0,70× | R$ 210 | R$ 35/mês |
| Comum | Formosa | 5 | 0,65× | R$ 195 | R$ 32/mês |
| Comum | Boa Vista | 4 | 0,55× | R$ 165 | R$ 28/mês |
| Comum | Santa Cruz | 5 | 0,72× | R$ 215 | R$ 36/mês |
| Comum | Vila Operária | 5 | 0,68× | R$ 205 | R$ 34/mês |
| Mediana | Mascherano | 5 | 1,30× | R$ 390 | R$ 65/mês |
| Mediana | Duque de Caxias | 4 | 1,50× | R$ 450 | R$ 75/mês |
| Mediana | Vila Esperança | 4 | 1,10× | R$ 330 | R$ 55/mês |
| Mediana | Paulo Feto | 4 | 1,40× | R$ 420 | R$ 70/mês |
| Mediana | Jardim das Flores | 5 | 1,20× | R$ 360 | R$ 60/mês |
| Mediana | Vila Progresso | 4 | 1,15× | R$ 345 | R$ 57/mês |
| Mediana | Nova Aliança | 4 | 1,45× | R$ 435 | R$ 72/mês |
| Rica | Alphaville | 3 | 3,50× | R$ 1.050 | R$ 175/mês |
| Rica | Lagoa de Pedra | 4 | 2,80× | R$ 840 | R$ 140/mês |
| Rica | Três Poderes | 4 | 3,20× | R$ 960 | R$ 160/mês |
| Rica | Jardins Altos | 3 | 3,70× | R$ 1.110 | R$ 185/mês |
| Rica | Riviera | 4 | 3,00× | R$ 900 | R$ 150/mês |

**Total por categoria:** Comum — 6 regiões, 28 terrenos · Mediana — 7
regiões, 30 terrenos · Rica — 5 regiões, 18 terrenos (deliberadamente a
categoria mais escassa — prestígio e disputa).

O **multiplicador da região** continua sendo o eixo de todo o resto da
economia (preço do terreno, aluguel base, e o `aluguel_justo` da Seção 5).

**Nota de escala:** a economia foi **rescalada para baixo (÷10)** em relação
à primeira simulação, para caber no saldo inicial de R$ 1.000. As
**proporções e comportamentos validados se mantêm de forma idêntica** —
payback (7,6 a 11,5 meses), curva de níveis, e o anti-exploit de terreno
vazio funcionam igual, só com números menores.

**Escassez revalidada com o mapa maior:** com 76 terrenos, comprar 6
terrenos vazios (o máximo que R$ 1.000 permite no terreno mais barato) agora
representa **7,9% do mapa** — contra 17% no rascunho anterior de 30
terrenos. Espaço real para múltiplas estratégias coexistirem sem briga
imediata por escassez, mesmo com 6 jogadores.

A tensão de design permanece: a região rica **paga mais mas exige leitura de
mercado** — se você superprecifica ou o ciclo vira, os imóveis ficam
**vazios** e você paga custo sem receita. A região comum é **estável mas de
margem baixa**.

**[A DEFINIR]** Layout espacial de onde cada região fica no mapa (adjacência,
formato do continente/cidade).

### Terreno e construção por slots

Cada terreno tem um número de **slots** — não medidas reais. Uma construção
ocupa um número inteiro de slots. Sem medidas em metros, sem arredondamento:
é encaixe de peças inteiras, como inventário de RPG.

Terrenos maiores têm mais slots → comportam mais/maiores construções. O
tamanho do terreno vira um recurso estratégico: um terreno grande numa região
rica é um ativo cobiçado.

### Tabela de construções (validada por simulação de payback, rescalada ÷10)

Custo de construção = **R$ 120 por slot**. Payback (terreno + construção
nível 1, região "mediana" de referência) testado entre **7,6 e 11,5 meses** —
saudável para uma partida de 24 meses: dá espaço a múltiplos ciclos de
reinvestimento sem ser instantâneo.

| Construção | Slots | Nível máx. | Custo N1 | Mult. aluguel |
|-----------|-------|------------|----------|---------------|
| Casa | 1 | 3 | R$ 120 | 1,0× |
| Sobrado | 2 | 3 | R$ 240 | 1,6× |
| Comércio | 2 | 3 | R$ 240 | 1,8× |
| Apartamento | 3 | 5 | R$ 360 | 2,5× |
| Centro comercial | 4 | 4 | R$ 480 | 3,2× |
| Hotel | 4 | 5 | R$ 480 | 3,0× |
| Prédio corporativo | 6 | 5 | R$ 720 | 4,0× |

Manutenção nível 1 = 12% do aluguel nível 1 (equilíbrio inicial saudável —
não drena, mas é real).

### Níveis de propriedade (curva validada por simulação)

Subir de nível: aluguel cresce **+55% por nível**; a manutenção cresce **mais
rápido**, com uma taxa que depende do **multiplicador da região**:

```
ganho_manutencao_por_nivel = 0,55 + 0,10 × multiplicador_da_região

  Periferia (0,6×): ~61%/nível
  Popular   (1,0×): ~65%/nível
  Nobre     (2,5×): ~80%/nível
  Elite     (4,0×): ~95%/nível
```

Custo de cada upgrade = **1,8× o upgrade anterior**.

**Por que a manutenção cresce mais nas regiões ricas:** o inquilino rico é
mais sensível e mais caro de manter satisfeito. Isso cria uma característica
por região — subir de nível na Periferia é seguro e previsível; subir na
Elite é lucrativo mas caro de sustentar.

### A aposta do nível máximo é estocástica, não determinística (validado)

Em condições normais, subir de nível **sempre compensa em valor esperado** —
inclusive na Elite. O risco real do "nível alto não se paga sozinho" aparece
na **combinação de dois fatores**, testada por simulação:

1. **Manutenção é fixa**; o aluguel de mercado varia com eventos (recessão
   derruba o `aluguel_justo`)
2. **Se o jogador não reprecifica a tempo** (mantém o preço antigo, alto,
   durante uma recessão), a ocupação despenca — e a manutenção, que não
   caiu, vira prejuízo

Simulação (Hotel em região rica de referência, recessão, preço não ajustado —
valores rescalados ÷10 da simulação original):

| Nível | Manutenção | Se não reprecificar na recessão |
|-------|-----------|----------------------------------|
| 1 | R$ 72/mês | −R$ 42 (perda pequena) |
| 3 | R$ 274/mês | −R$ 202 |
| 5 | R$ 1.041/mês | **−R$ 868 (prejuízo severo)** |

**Conclusão validada:** o nível máximo não é ruim por si só — é uma aposta que
**exige administração ativa**. Quem sobe de nível e depois ignora o mercado
(não reprecifica quando o cenário vira) é punido proporcionalmente ao tamanho
da aposta. É a mesma lógica de "quanto maior, mais exposto" que o imposto
progressivo aplica ao patrimônio (Seção 6).

**[A DEFINIR]** Ajuste fino dos coeficientes (55%, 1,8×, etc.) durante
playtest — a forma da curva está validada, os números finais podem calibrar.

---

## 5. Receita: aluguel com inquilinos inteligentes


**Esta é a mecânica que corrige o problema do jogo atual** (renda passiva que
premia só o tamanho).

### Como funciona

A cada fechamento de rodada, cada construção tenta atrair/manter inquilinos.
**O inquilino avalia o preço do aluguel contra o mercado:**

```
O inquilino aceita/permanece SE:
   aluguel_pedido ≤ aluguel_justo(região, tipo, mercado, inflação)

Senão:
   o imóvel fica VAZIO (sem receita, mas com custo de manutenção)
```

Consequências de design:
- **Preço justo → imóvel ocupado → renda estável**
- **Preço ganancioso → imóvel vazio → prejuízo** (paga manutenção sem receber)
- **O mercado muda a cada mês** (inflação, eventos) → o preço justo de ontem
  pode ser caro demais amanhã → **reprecificar é uma decisão contínua**

Isso torna a renda **ativa**, não passiva. O jogador que só constrói e senta
vê seus imóveis esvaziarem quando o mercado vira. **Não há mais bola de neve
automática.**

**[A DEFINIR]** A fórmula do `aluguel_justo`. Precisa considerar: valor base
da região, tipo de construção, inflação acumulada, e talvez oferta/demanda
(se todos construíram apartamentos, o aluguel de apê cai). Esta fórmula é o
coração econômico do jogo — merece simulação dedicada antes de fixar.

### O sistema RECOMENDA, o jogador DECIDE

O jogo calcula, a cada mês, um **aluguel recomendado** para cada imóvel,
considerando o contexto completo da partida naquele momento:

```
aluguel_recomendado = f(
  valor base da região,
  tipo de construção,
  inflação acumulada,
  aquecimento do mercado / evento vigente,
  oferta e demanda (quantos imóveis do tipo existem vs. procura)
)
```

O jogador vê essa recomendação e **escolhe o preço**:

| Escolha do jogador | Efeito |
|--------------------|--------|
| **Abaixo** do recomendado | Enche rápido, ocupação garantida, mas margem menor |
| **No** recomendado | Equilíbrio — boa chance de ocupar com boa margem |
| **Acima** do recomendado | Margem alta SE ocupar — mas risco de vacância |

O inquilino, no fechamento, aceita ou não com base em quão longe do justo está
o preço pedido. **Precificar é a decisão central e recorrente do jogo** — e o
recomendado é uma bússola, não uma garantia. Um jogador que lê o mercado
melhor que a recomendação (ex: sabe que um evento de alta vem aí) pode ganhar
precificando "errado" de propósito.

**Isto responde diretamente ao problema do jogo atual:** não existe renda
automática. Todo mês, todo imóvel exige uma decisão de preço sob incerteza.

### Fórmula do aluguel recomendado (validada por simulação)

```
recomendado = base_regiao × mult_construcao × inflacao × mercado × oferta_demanda
```

- **base_regiao** — quanto um inquilino típico daquela zona paga (pobre <
  mediana < rica)
- **mult_construcao** — casa 1.0, comércio 1.8, apê 2.5, hotel 3.0, corp 4.0
- **inflacao** — acumulada na partida (sobe o patamar geral)
- **mercado** — fator do ciclo/evento vigente (boom > 1, recessão < 1)
- **oferta_demanda** — se há excesso do tipo no mercado, cai; se há escassez, sobe

### Curva de ocupação (o que torna a decisão interessante)

O inquilino ocupa conforme a razão `preço_pedido / recomendado`:

- **Até ~10% abaixo** do recomendado → ocupação satura em 100% (baixar mais é
  desperdício — dinheiro deixado na mesa)
- **No recomendado** → ocupação alta (~75-85%, conforme a região)
- **Acima do recomendado** → ocupação cai; a **sensibilidade varia por região**:
  - Pobre: sensível (sens ≈ 0.15) — +10% já esvazia
  - Mediana: intermediária (sens ≈ 0.30)
  - Rica: tolerante (sens ≈ 0.50) — aguenta preço alto por qualidade

**Resultados validados em simulação:**

- O preço ótimo fica **levemente abaixo** do recomendado — realista e
  intuitivo ("um pouco abaixo do mercado enche mais rápido")
- **Baixar demais é subótimo** — acaba o exploit "quanto mais barato, melhor"
- **A região rica premia a ousadia** — dá para lucrar precificando acima, se o
  mercado aguentar; a pobre pune qualquer excesso
- **Ler eventos dá vantagem real mas limitada:** quem antecipa um boom e
  precifica alto ganha mais que quem ignora — mas quem *exagera* no preço
  (acima do novo justo) perde ocupação e lucra menos. Informação recompensa,
  ganância pune.

**[A DEFINIR]** Os coeficientes exatos (bases, multiplicadores, sensibilidades)
saem de simulação continuada durante o desenvolvimento. A *forma* da fórmula
está validada; os números finais se ajustam com playtest.

### Sublocação (fase 2 — não no núcleo inicial)

Um jogador pode **usar o terreno de outro** para instalar seu próprio negócio,
pagando aluguel ao dono do terreno. Cria dependência e negociação entre
jogadores. **Adiado para depois do núcleo** por complexidade.

### Reputação (Índice de Confiança Pública) — nova mecânica

Cada jogador tem uma **Reputação**: um índice de **0.0 a 5.0** que representa
como a sociedade (os NPCs) o enxerga. Começa em **3.0** (neutro) e varia
conforme o comportamento do jogador ao longo da partida.

**O que aumenta a Reputação:**
- Precificar aluguel de forma equilibrada (dentro da faixa "justa" — não
  espremer o inquilino) de forma sustentada por vários meses
- Manter alta ocupação (imóveis bem administrados, sem vacância negligenciada)
- Pagar dívidas e empréstimos em dia, sem entrar no período de graça

**O que diminui a Reputação:**
- Precificar muito acima do justo repetidamente (ganância visível)
- Deixar imóveis vagos por negligência (não reagir ao mercado)
- Entrar em atraso de dívida (mesmo dentro do período de graça de 2 meses)
- Declarar falência (penalidade forte)

**Efeito no jogo (mecânico, não só cosmético):** a Reputação modula
ligeiramente a **tolerância de preço do inquilino** (a curva de ocupação da
Seção 5). Um jogador bem visto consegue cobrar um pouco mais e ainda ocupar;
um jogador mal visto sofre mais vacância mesmo cobrando o preço justo — os
NPCs desconfiam dele.

**Papel na vitória:** critério de desempate quando os patrimônios do 1º e 2º
colocados estão próximos (ver Seção 3). Um jogador raivosamente rico mas mal
visto pode perder para um jogador quase tão rico e bem visto.

**[A DEFINIR — a simular, mesmo método usado no aluguel]:**
- A magnitude exata do efeito da Reputação na tolerância de ocupação
- A velocidade de ganho/perda de Reputação por evento (quanto sobe/desce por
  mês de bom/mau comportamento)
- Se a falência **reseta parcialmente** a Reputação ou apenas a penaliza

---

## 6. Custos e o que quebra um jogador

Fluxo de despesas (aplicado no fechamento):

| Custo | Quando | Base |
|-------|--------|------|
| **Manutenção** | Todo mês | Por construção (mesmo vazia!) |
| **Impostos** | Mensal | Terreno + imóvel, com alíquota progressiva |
| **Juros de dívida** | Todo mês | Sobre empréstimos em aberto |
| **Vacância** | Todo mês | Imóvel vazio = manutenção sem receita |

### Impostos mensais e progressivos (faixas validadas por simulação, rescaladas ÷10)

Todo mês, o jogador paga imposto sobre **cada terreno** (IPTU, ~3% do valor do
terreno) e um **imposto progressivo sobre o patrimônio total**:

| Faixa de patrimônio | Alíquota mensal |
|----------------------|-------------------|
| Até R$ 1.500 | 1,0% |
| R$ 1.500 – 5.000 | 2,0% |
| R$ 5.000 – 15.000 | 3,5% |
| Acima de R$ 15.000 | 5,5% |

O imposto é calculado por **faixas** (como IR): só a fatia do patrimônio
dentro de cada faixa paga aquela alíquota — não é "tudo pela alíquota mais
alta".

**Por que isto é o freio que o jogo atual não tinha:** no GameBank atual, o
líder faz bola de neve — quanto mais tem, mais recebe, sem limite. Testado em
simulação (proporções idênticas às da escala original): um jogador com
patrimônio 8× maior que outro paga alíquota efetiva **2,4× mais alta** — o
império gigante paga proporcionalmente mais, dando aos menores espaço para
alcançar, sem impedir o líder de lucrar.

**Princípio:** *quem mais possui, mais presta contas do que possui.*

A falência vem da combinação: construir demais (manutenção alta) + precificar
mal (vacância) + alavancar demais (juros) + imposto progressivo no topo → o
patrimônio não cobre as dívidas.

**Design intencional:** ter muitas propriedades é **arriscado**, não
automaticamente bom. Cada imóvel é um custo fixo que precisa ser coberto por
receita ativa — e quanto maior o império, maior a fatia que o Estado cobra
dele.

**[A DEFINIR]** As faixas acima são o ponto de partida validado; ajuste fino
via playtest (se o líder nunca for alcançado, aumentar a alíquota do topo; se
ninguém consegue crescer, reduzir).

---

## 7. Eventos econômicos (o eixo do jogo)

Diferente do jogo atual (onde eventos são tempero), aqui o **ciclo econômico é
central**. As decisões de investimento devem ser feitas **lendo o mercado**.

- Eventos são **anunciados com antecedência** (1 mês) — informação pública
- Afetam: inflação, aluguel justo por região, custo de construção, juros,
  demanda por tipo de imóvel
- **A vantagem vem de se posicionar antes**: quem previu o boom construiu na
  hora certa; quem ignorou a crise fica com imóveis vazios e dívida

**[A DEFINIR]** Catálogo de eventos adaptado ao novo jogo. Os do GameBank atual
(crise, boom, alta de juros…) servem de base, mas agora com efeitos espaciais
e por região (ex: "gentrificação da região X" — aluguéis daquela zona sobem).

### Catálogo proposto (base — a expandir e calibrar)

Eventos são anunciados 1 mês antes. O que separa os jogadores é reagir a
tempo, não saber antes.

**Eventos de mercado (afetam a economia toda):**

| Evento | Efeito | Como reagir |
|--------|--------|-------------|
| Boom econômico | Aluguel justo sobe em todas as regiões; hotéis lotam | Construir/precificar alto antes |
| Recessão | Aluguel justo cai; vacância aumenta; hotéis esvaziam | Baixar preços, ter caixa, evitar hotel |
| Inflação alta | Custos (construção, manutenção) sobem; aluguéis acompanham com atraso | Adiar obras; segurar caixa |
| Alta de juros | Empréstimos ficam caros | Quitar dívida antes |
| Corte de juros | Empréstimos baratos | Bom momento para alavancar e construir |

**Eventos regionais (afetam UMA região — a parte nova e interessante):**

| Evento | Efeito | Como reagir |
|--------|--------|-------------|
| Gentrificação da região X | Aluguéis e valor dos terrenos daquela zona disparam | Ter comprado ali antes = lucro enorme |
| Decadência da região X | Aquela zona perde valor e inquilinos | Vender antes; evitar investir ali |
| Nova linha de metrô em X | Região antes pobre valoriza (acesso) | Comprar barato antes do anúncio se concretizar |
| Obra pública / interdição em X | Região fica temporariamente ruim (barulho, acesso) | Vacância temporária; segurar |
| Polo comercial em X | Comércios e corporativos daquela zona bombam | Construir comércio ali |

**Eventos setoriais (afetam UM tipo de construção):**

| Evento | Efeito | Como reagir |
|--------|--------|-------------|
| Turismo em alta | Hotéis lotam e rendem em dobro | Ter hotéis prontos |
| Êxodo corporativo (home office) | Prédios corporativos esvaziam | Reduzir exposição a corporativo |
| Boom populacional | Demanda por moradia (casas, apês) dispara | Construir residencial |
| Excesso de oferta de apês | Muitos apês no mercado → aluguel de apê despenca | Diversificar tipos |

**Por que este catálogo serve ao jogo:** os eventos **regionais e setoriais**
premiam quem **diversificou e se posicionou** — não quem só acumulou. Um
jogador com tudo em hotéis quebra num "êxodo corporativo"? Não — mas quebra
numa recessão. A leitura do ciclo vira a habilidade central. Ninguém está
seguro só por ser grande.

---

## 8. Interface (HUD, sem menus)

O jogo parece um jogo 2D real, não um app de menus.

- **HUD superior fixo:** saldo, nº de propriedades, patrimônio, mês atual /
  total, timer da rodada, botão de configurações (sair / desistir)
- **Mapa:** ocupa a tela, com zoom/pan
- **Clique num terreno:** abre o painel daquele terreno (construir, precificar,
  ver inquilinos) — sobreposto, não uma tela separada
- **Fechamento de rodada:** tela de resultados do mês (ganhos, perdas,
  ocupação, evento seguinte)

**[A DEFINIR]** Wireframes das telas principais: HUD, painel de terreno,
construção posicional, resultados do mês.

---

## 9. Direção técnica

### Renderização do mapa

**Recomendação: tilemap (grade de tiles), não SVG nem matriz de pixels.**

- O mapa é uma **grade de tiles**. Cada terreno é uma célula (ou bloco).
- O clique converte posição em coordenada de grade — **não há verificação
  pixel a pixel**:
  ```
  col = floor(clickX / TILE_SIZE)
  row = floor(clickY / TILE_SIZE)
  terreno = mapa[row][col]
  ```
- A construção posicional é a **mesma técnica numa escala menor**: cada terreno
  é uma subgrade de slots.
- Regiões (pobre/rica) são grupos de tiles com textura/cor diferente.

Isto reaproveita a lógica de grade que o projeto **já tem** (`posToGrid` do
tabuleiro atual).

### Sistema de tiles: tileset + tilemap (decisão fechada)

O mapa **nunca** é uma imagem única. É montado em tempo real a partir de um
**conjunto pequeno de texturas reutilizáveis** (o *tileset*), encaixadas numa
grade (o *tilemap*).

**Por quê:**
- Qualidade preservada — cada textura é desenhada uma vez, com capricho, e
  repetida nítida por todo o mapa
- O mapa é **dado, não imagem** — uma matriz de índices, leve e versionável:
  ```
  [[grama, grama, chão ],
   [grama, casa,  chão ],
   ...]
  ```
- Tudo é dinâmico de graça — construir/vender/demolir só troca o índice da
  célula; nada é redesenhado
- Peso mínimo — poucas texturas de KB em vez de uma imagem de vários MB

### Camadas de renderização

O desenho acontece em camadas, de baixo para cima:

1. **Chão** (base achatada): grama, terra, calçada, asfalto, água. Desenhado
   primeiro, sem ordenação entre si.
2. **Construções**: casa, apartamento, hotel, comércio, prédio. Ficam sobre o
   chão.
3. **Detalhes/decoração**: árvores, postes, arbustos, carros. Sobre tudo.

A separação em camadas permite **combinar** peças (grama + árvore) em vez de
desenhar cada combinação como textura única. Uma célula = chão + (opcional)
construção + (opcional) decoração.

### Y-sorting (ordenação por profundidade)

As camadas de **objetos que "ficam em pé"** no mundo (construções, árvores,
decoração, e qualquer elemento móvel) são ordenadas por profundidade para
simular a perspectiva 2D:

**Regra:** quanto maior o Y (mais abaixo na tela), maior a prioridade de
desenho — o elemento aparece **por cima** dos que têm Y menor. Um objeto em
(20,54) é desenhado acima de um em (20,53).

**Ponto de âncora — crítico:** a ordenação usa a **base** do objeto (onde ele
toca o chão), **não** a célula ou o topo. Uma árvore de 3 tiles de altura é
ordenada pela base do tronco. Assim um elemento com a base acima da árvore
passa atrás dela; com a base abaixo, passa na frente. Ordenar pelo topo produz
o "esquisito visual" de objetos altos se comportando como se estivessem longe.

**Escopo e custo:**
- O **chão não** precisa de Y-sorting (é fundo achatado)
- Só a camada de objetos é ordenada
- Como o GameBank 2D é majoritariamente **estático** (construções fixas), a
  ordenação é feita **uma vez** ao montar/atualizar a cena e recalculada só
  quando algo muda (construiu, demoliu) — não a cada frame. Bem mais barato
  que um jogo de ação, que reordena continuamente por causa do movimento.

### Oclusão ≠ sobrescrita (dado separado do render)

Quando um objeto (árvore) fica na frente de outro (casa), ele **tampa
visualmente**, mas **não apaga nem modifica** a casa. Dois princípios garantem
isso:

1. **Texturas com fundo transparente (PNG alpha).** O tile da árvore é a árvore
   recortada; tudo ao redor é transparente. Ao desenhar a árvore sobre a casa,
   só os pixels da árvore são pintados — a casa continua visível em volta e sob
   as folhas. Não há retângulo opaco "apagando" a região. (Todos os tiles de
   objeto são recortados com fundo transparente por esse motivo.)

2. **A cena é redesenhada do zero a cada frame**, de baixo para cima: chão →
   casa (inteira) → árvore (por cima). A casa nunca é alterada — é repintada
   completa toda vez, e a árvore é sobreposta *depois*. Levantar a árvore
   revela a casa intacta.

**Consequência de arquitetura:** o **dado** e o **render** são separados. A
casa é apenas um índice numa matriz (`casa em (20,53)`) — ela não "sabe" que
há uma árvore na frente. Quem resolve a sobreposição é só o renderizador, na
ordem do Y-sorting. Nenhuma sobreposição visual toca o estado do jogo. Isso
evita a classe de bug "minha casa some quando ponho uma árvore na frente".

### Construções multi-tile

Uma construção que ocupa vários tiles (hotel 3×3) pode ser:
- **Imagem única** maior cobrindo o bloco — mais simples, recomendado para começar
- **Pedaços de tile** que se encaixam — mais flexível, mais trabalho de arte

Começar pela imagem única.

### Escolha da tecnologia de render

Depende do tamanho do mapa (**[A DEFINIR]**):
- **Mapa modesto (dezenas de terrenos):** grade de elementos em React/SVG —
  mais simples, integra com o front atual
- **Mapa grande (centenas+):** canvas via **Pixi.js** ou similar — performático
  para muitos tiles com zoom/pan

### O que se aproveita do GameBank atual

| Aproveita | Substitui |
|-----------|-----------|
| Auth, contas, perfis | Tabuleiro de 40 casas |
| Sessões, salas, socket | Turnos alternados, dados, movimento |
| Loja, cosméticos, XP | Resolução de casa |
| Infra (Redis, filas, deploy) | Lógica de aluguel fixo |
| Padrões de código e arquitetura | — |

**Isto é um jogo novo compartilhando fundação, não uma atualização.** O núcleo
de jogo (turnos → rodadas simultâneas; tabuleiro → mapa; dados → decisão) é
reescrito.

### Rodadas simultâneas — o maior desafio técnico

**[DECIDIDO — ver Seção 2]** As ações são em **tempo real**, não resolvidas só
no fechamento. Isso é mais rico para o jogador (vê o mundo mudar ao vivo), mas
introduz um desafio real: **N jogadores mexendo em estado compartilhado ao
mesmo tempo, todo mês, durante toda a partida.**

O fechamento continua existindo, mas resolve só a **economia periódica**
(inquilinos, aluguéis, custos) — não as ações de compra/construção, que já
aconteceram ao vivo.

### Compra de terreno concorrente — requisito de segurança não-negociável

**Cenário:** dois ou mais jogadores tentam comprar o **mesmo terreno** dentro
da mesma janela de tempo (comum nos primeiros segundos de cada mês, quando
todos correm para os terrenos livres).

**A resposta errada (aparentemente intuitiva):** "quem clicou primeiro
vence." Isso **não é seguro** por si só. Se o servidor faz `verificar se está
livre` e, **depois**, `atribuir o dono` como dois passos separados, dois
jogadores podem passar pela verificação **antes** de qualquer um escrever o
resultado — os dois "compram" o mesmo terreno. Este é o padrão clássico
**TOCTOU (time-of-check to time-of-use)**, a mesma classe de bug já corrigida
no GameBank atual (ver `banco.service.ts`, `divida.service.ts` no jogo
original) — e aqui o risco é **maior**, porque agora todos os jogadores agem
ao mesmo tempo o tempo todo, não só um por vez.

**A solução correta:** a operação de compra precisa ser **atômica no banco de
dados** — a escrita só se completa se, no exato instante em que ela roda, o
terreno ainda estiver sem dono. Não é "quem foi mais rápido no clique", é "a
transação que o banco processou primeiro, de forma garantida, vence — e é
impossível duas vencerem".

```
Padrão a seguir (mesmo já usado no GameBank atual):
  UPDATE terreno SET dono = jogador_id
  WHERE id = terreno_id AND dono IS NULL

  → Se afetou 1 linha: compra confirmada
  → Se afetou 0 linhas: terreno já tinha dono — falha imediata
```

O(s) jogador(es) que perderam a corrida recebem, **na hora**, uma mensagem
clara: *"Este terreno já foi comprado."* Não é um bug nem uma corrida
vencida por sorte de rede — é o resultado garantido e determinístico da
primeira transação que o banco processou.

**Este requisito se aplica a toda ação concorrente do jogo**, não só compra de
terreno: construir, subir de nível, aceitar uma sublocação — qualquer
operação que dois jogadores possam disputar ao mesmo tempo precisa do mesmo
padrão de atomicidade.

---

## 10. Roadmap sugerido (do núcleo ao completo)

Construir em fatias jogáveis, não tudo de uma vez.

**Fatia 1 — Núcleo econômico (sem mapa bonito)**
Mapa simples (grade de terrenos genéricos), comprar terreno, 1 tipo de
construção, aluguel com inquilino inteligente, fechamento de rodada, falência.
Objetivo: **provar que o loop econômico é divertido e balanceado.**

**Fatia 2 — Profundidade econômica**
Múltiplos tipos de construção, regiões diferenciadas, eventos econômicos,
empréstimos, impostos.

**Fatia 3 — Construção posicional**
O mini-jogo de encaixar construções no terreno.

**Fatia 4 — Polimento visual**
Tiles pixelados, arte das regiões, HUD final, animações, tela de resultados.

**Fatia 5 — Interação avançada**
Sublocação, negociação entre jogadores, mecânicas competitivas diretas.

**Princípio:** cada fatia é jogável e testável. Não partir para arte antes do
loop econômico estar provado — foi a arte-antes-do-balanceamento que criou os
problemas do jogo atual.

---

## 11. Lacunas a preencher (índice dos [A DEFINIR])

1. Layout espacial das 18 regiões no mapa (adjacência, formato) (Seção 4)
2. Calibragem do catálogo de eventos (Seção 7)
3. Wireframes das telas (Seção 8)
4. Tecnologia de render conforme o tamanho final (76 terrenos — grid em
   React/SVG segue viável; reavaliar se crescer muito além disso) (Seção 9)
5. Magnitude do efeito da Reputação na ocupação; velocidade de ganho/perda;
   se falência reseta a Reputação (Seção 5) — a simular
6. Percentual exato do limiar de "diferença pequena" no desempate de vitória
   (Seção 3) — precisa de simulação de partida completa (24 meses)
7. Ajuste fino dos coeficientes numéricos (curva de nível, faixas de imposto,
   fórmula do aluguel) — **a forma de cada um já está validada por
   simulação**; o ajuste fino é trabalho de playtest, não de design

### Decisões de design FECHADAS nesta rodada

- **Reputação (novo):** índice 0.0-5.0, começa em 3.0, sobe com precificação
  equilibrada/ocupação alta/dívidas em dia, desce com ganância/vacância
  negligenciada/atraso/falência — modula a tolerância de ocupação do
  inquilino
- **Vitória:** patrimônio líquido é o critério principal; Reputação decide
  quando 1º e 2º estão próximos (limiar percentual, a calibrar) — quem tem
  Reputação ≥ 4.0 leva vantagem no empate
- **Início de partida:** saldo simétrico (**R$ 1.000**, confirmado e
  revalidado na escala nova) + terreno barato sorteado (categoria "comum");
  sem mês 0; mapa começa vazio
- **Falência:** período de graça de 2 meses; 3º mês devendo = falência
- **Mapa nomeado e expandido:** 18 regiões (6 comuns, 7 medianas, 5 ricas),
  76 terrenos, preços e aluguéis por região — rescalados ÷10 e revalidados
  (payback 7,6 a 11,5 meses; anti-exploit de terreno vazio idêntico;
  escassez revista de 17% para 7,9% do mapa com o crescimento)
- **Construções:** 7 tipos com custo, slots, nível máximo e payback validados
  na nova escala
- **Níveis de propriedade:** curva de aluguel (+55%/nível) e manutenção
  (+55 a 95%/nível conforme a região) validada — inclui o teste que comprova
  que o nível máximo é uma aposta estocástica (arrisca mais na recessão se o
  jogador não reprecificar), não uma jogada sempre segura
- **Imposto progressivo:** 4 faixas (1,0% a 5,5%, rescaladas), validado que o
  líder paga proporcionalmente mais sem travar seu crescimento
- **Ações em tempo real** (não resolvidas só no fechamento)
- Construção por **slots**, tabela de 7 tipos com perfil de risco distinto
- Aluguel: sistema **recomenda**, jogador **decide** — fórmula e curva de
  ocupação validadas, inclusive o teste de que ler eventos dá vantagem real
  mas limitada
- Catálogo de eventos em 3 camadas: mercado, regional, setorial

### Decisões técnicas FECHADAS (Seção 9)

- Tileset + tilemap (mapa montado a partir de texturas reutilizáveis)
- Renderização em camadas (chão → construções → decoração)
- Y-sorting pela base do objeto
- Oclusão por transparência + redesenho por frame (dado separado do render)
- Ordenação estática (recalculada só quando algo muda)
- Construções multi-slot começam como imagem única
- **Compra/ação concorrente exige atomicidade no banco** (padrão
  `UPDATE ... WHERE dono IS NULL`) — requisito de segurança não-negociável,
  aplicável a toda ação disputável (terreno, nível, sublocação)

---

## Nota final

Este documento é a **fundação**. Nenhuma linha de código do novo núcleo deve
ser escrita antes de as lacunas críticas (#1, #7 principalmente) estarem
resolvidas — são elas que definem se o jogo é divertido e balanceado.

A ordem certa: **fechar o design → simular a economia → provar o loop numa
fatia mínima → só então expandir.** O jogo atual sofreu por inverter isso.
