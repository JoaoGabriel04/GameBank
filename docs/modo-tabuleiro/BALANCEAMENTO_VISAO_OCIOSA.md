# Balanceamento do Modo Tabuleiro: Visão limitada + Propriedade Ociosa

> Escopo: **somente Modo Tabuleiro**. O Mapa 2D está pausado e não deve ser tocado.
> Origem: jogadores relatam "jogo quebrado" e que é quase impossível um jogador falir.

---

## 0. Regras de execução (gate de aprovação)

1. **Etapa 1 é somente leitura.** Faça a auditoria (seção 6) e apresente o resultado.
2. **Não escreva nenhum arquivo até receber aprovação explícita** do Gabriel para a Etapa 2.
3. Implemente na ordem da seção 7, um commit por etapa, rodando `make validate` antes de cada push.
4. Se algo na auditoria contradizer este documento (nomes, linhas, comportamento), **pare e reporte**. Não adapte em silêncio.

---

## 1. Diagnóstico (medido por simulação, 300–400 partidas de 4 bots)

Simulador usa `server/data/propriedades.json` e `tabuleiro.json` reais, economia atual (IPTU 15%, renda passiva 35%, manutenção 12%/casa, Início R$ 2.000, saldo R$ 25.000) e a regra atual de "Escolher dados".

| Fato | Número |
|---|---|
| Jogadas que terminam em propriedade alheia (paga aluguel), regra atual | **52%** (31% nas rodadas 1-15, ~58% a partir da 41) |
| Mesmo número sem créditos de visão | 61% |
| Jogadas COM visão que caem em alheia | 34% (os jogadores usam a visão para fugir do aluguel) |
| Jogadas às cegas que caem em alheia | 67% |
| Aluguel que não cabe no caixa do pagador | **2,7%** |
| Aluguel mediano / caixa mediano | R$ 220 / ~R$ 20 mil (≈ 1%) |
| 1ª falência (rodada) | ~46, tarde demais para a duração real das partidas |
| Aumentar todos os aluguéis em 4x | dificuldade sobe só 2,7% → 3,8% |

Conclusões:
- O aluguel é **frequente, mas minúsculo** frente ao caixa. O caixa é sustentado por saldo inicial, Início e renda passiva.
- A regra de "Escolher dados" com **2 créditos de visão e recarga em 3 rodadas** deixa ~47% das jogadas informadas, o que reduz a exposição ao aluguel em ~9 pontos.
- Nada pune quem **acumula propriedades sem desenvolver**.

Limitações: os bots compram tudo o que podem, usam visão de forma ótima e não usam empréstimo. Os números servem para **comparar variantes**, não para prever partidas reais. Revisar após 3-5 partidas reais.

---

## 2. Mudança A: limitar os Créditos de Visão

Estado atual (hardcoded em vários lugares): **2 créditos**; quando chega a 0, recarga agendada para **rodada atual + 3**.

Novo: **1 crédito**; quando chega a 0, recarga em **rodada atual + 4**.

Resultado simulado:

| Cenário | Jogadas com visão | Alheia (todas) | Alheia r.16-40 | Alheia r.41+ |
|---|---|---|---|---|
| Atual (2 créditos, recarga 3) | 47% | 51,8% | 56,8% | 57,6% |
| **Novo (1 crédito, recarga 4)** | **23%** | **56,9%** | **62,1%** | **63,6%** |

Isto **por si só** muda pouco a falência (jogos com falência 23% → 32% na simulação, com ruído). Por isso vem junto com a mudança B.

### 2.1 Constantes (única fonte de verdade)
Em `server/src/constants/economia.ts`:

```ts
/** Créditos de visão: quantos o jogador tem por ciclo. */
export const VISAO_CREDITOS_MAX = 1;
/** Rodadas de espera após zerar os créditos, até a recarga. */
export const VISAO_RECARGA_RODADAS = 4;
```

### 2.2 Onde está hardcoded hoje (confirmado no clone de 18/10/2026; reconfirmar na auditoria)
Servidor:
- `server/prisma/schema.prisma:279`: `creditoVisao Int @default(2)` → default vira `1` (migration).
- `server/src/modules/turno/turno.repository.ts:170`: `resetarCreditosVisao` grava `creditoVisao: 2`.
- `server/src/modules/turno/turno.service.ts` ~178-194 (`revelarDados`): `player.creditoVisao = 2` e `rodadaAtual + 3`.
- `server/src/modules/turno/services/dados.service.ts` ~56-59: `player.creditoVisao = 2`.

Cliente:
- `client/src/components/Board/index.tsx:360`: `... ? 2 : creditoVisao`.
- `client/src/components/Board/TurnoModal/index.tsx:434` e `:452`: texto `/2` fixo.
- `client/src/components/Board/TurnoModal/index.tsx:456`: texto "recarregam em 3 rodadas" fixo.

Regra: **nenhum desses pontos pode manter o número literal.** O servidor importa as constantes. O cliente recebe os valores pelo mesmo mecanismo que já usa para constantes compartilhadas (verificar `client/src/shared/`; se não houver, criar espelho `client/src/shared/economia-constants.ts` e documentar que deve ser mantido igual ao servidor).

### 2.3 Migration para partidas em andamento
Jogadores existentes têm `creditoVisao` 0, 1 ou 2. Na migration:
```sql
UPDATE "SessionPlayer" SET "creditoVisao" = LEAST("creditoVisao", 1);
```
(confirmar o nome real da tabela/coluna no schema). `creditoRecargaEm` não muda.

### 2.4 UX
- Rótulos passam a ser dinâmicos: `Créditos restantes: {n}/{VISAO_CREDITOS_MAX}` e `recarregam em {VISAO_RECARGA_RODADAS} rodadas` (idealmente calculando a rodada exata: `creditoRecargaEm - rodadaAtual`).
- Os textos hoje usam o emoji `'👁'`. **Trocar por ícone `Eye` do Lucide React** (o projeto não usa emojis em interface). Mudança só visual, sem tocar na lógica.
- Atualizar a descrição da regra no README e na tela de regras do cliente.

---

## 3. Mudança B: Propriedade Ociosa (ideia do Gabriel)

> "Uma propriedade que ninguém cai vai gerando mais custo de manutenção com o tempo, meio que perdendo valor."

### 3.1 Regra (versão calibrada)
Uma propriedade **normal, com dono, sem casas e não hipotecada** que **ninguém visita** há `OCIOSA_CARENCIA_RODADAS` rodadas passa a cobrar uma **manutenção de terreno ocioso** por rodada, crescente até um teto.

- **O que conta como visita:** qualquer jogador terminar o movimento naquela casa (inclusive o dono).
- **O que zera o contador:** visita, compra (novo dono), construir casa, hipotecar, recomprar hipoteca, troca por negociação, execução de garantia, leilão.
- **Nunca cobra em:** ações (grupo Preto), propriedades hipotecadas, propriedades com 1+ casas/hotel.
- **Quem paga:** o dono, junto com a manutenção por rodada na virada de rodada.

### 3.2 Fórmula
```
ociosas = rodadaAtual - ultimaAtividadeRodada
se ociosas >= OCIOSA_CARENCIA_RODADAS e casas == 0 e !hipotecada e tipo == "normal":
  degrau = min(ociosas - OCIOSA_CARENCIA_RODADAS + 1, OCIOSA_DEGRAUS_MAX)
  custo  = round(custo_compra * OCIOSA_PCT * degrau)
  custo  = aplicarMod(custo, mods.manutencaoMult)   // Inflação afeta também
```
Constantes em `economia.ts`:
```ts
export const OCIOSA_CARENCIA_RODADAS = 8;
export const OCIOSA_PCT = 0.03;        // 3% do custo_compra por degrau
export const OCIOSA_DEGRAUS_MAX = 4;   // teto = 12% do custo_compra por rodada
```

### 3.3 Exemplos (custo por rodada)

| Propriedade | custo_compra | Degrau 1 | 2 | 3 | Teto (4) | Renda passiva do terreno cru |
|---|---|---|---|---|---|---|
| Av. 9 de Julho | 1.000 | 30 | 60 | 90 | 120 | 21 |
| Av. Rio Branco | 2.400 | 72 | 144 | 216 | 288 | 70 |
| Av. Paulista (Rosa) | 4.000 | 120 | 240 | 360 | 480 | 175 |

Leitura: depois da carência, o terreno parado **deixa de render líquido** e passa a drenar. É o "perder valor" que o Gabriel descreveu. Quem desenvolve não é afetado, o que incentiva construir.

### 3.4 Calibragem (simulação, visão 1 crédito/recarga 4)

| Variante | Jogadores com dívida | Jogos com falência | 1ª falência | Líder % patrimônio |
|---|---|---|---|---|
| Só visão limitada | 14% | 32% | 46 | 57% |
| Ociosa 6 rod, 3%, teto 4 | 38% | 79% | 51 | 76% |
| **Ociosa 8 rod, 3%, teto 4 (adotada)** | **31%** | **65%** | **50** | **70%** |
| Ociosa 8 rod, 2%, teto 5 | 25% | 53% | 49 | 65% |
| Renda passiva 35% → 25% | +2 pts | +4 pts | sem mudança | sem mudança |

Decisões:
- **Adotar 8 rodadas / 3% / teto 4.** Mantém ~30% dos jogadores sob pressão sem a mortandade da versão forte (6 rodadas ou sobre todas as propriedades, que levou 50%+ dos jogadores a dívida).
- **Não mexer na renda passiva agora.** O efeito medido é pequeno e atrapalharia a leitura do efeito da mudança B.
- A 1ª falência continua perto da rodada ~50 no simulador. Se após testes reais ainda for tarde, o próximo passo seria reduzir `OCIOSA_CARENCIA_RODADAS` para 6 (e aceitar mais dívida), não aumentar o percentual.
- Valores AJUSTÁVEIS: ficam só em `economia.ts`.

### 3.5 Modelo de dados (decisão de arquitetura)
**Não usar contador incrementado por rodada.** No free tier do Render (hiberna), jobs de incremento são frágeis. Usar um **timestamp lógico no banco**:

```prisma
model SessionPosses {
  // ...
  ultimaAtividadeRodada Int @default(0) // rodada da última visita/compra/construção/hipoteca/troca
}
```
- O tempo ocioso é **derivado**: `session.rodadaAtual - ultimaAtividadeRodada`. Não precisa de varredura.
- **Backfill na migration:** para linhas existentes, `ultimaAtividadeRodada = Session.rodadaAtual` (evita cobrança retroativa injusta em partidas em andamento).

### 3.6 Onde implementar
Cobrança: `server/src/modules/turno/services/rodada.service.ts`, em `creditarRendaPassivaRodada`, somando ao total `manutencao` do jogador (a lógica existente de líquido e `cobrarComFallbackDivida` já trata saldo insuficiente com dívida, mantenha). Registrar no histórico a parcela ociosa separada, para o jogador entender:
`"Terreno ocioso: Av. Rio Branco (10 rodadas sem visita) R$ 72"`.

Reset do contador (auditar **todos** os pontos que mudam `SessionPosses.playerId`, `casas` ou `hipotecada`):
- `casa-resolver.service.ts`: ao resolver casa de propriedade (visita).
- `propriedade.service.ts` (`buyProp`, construir/vender casa, hipotecar, recomprar), `negociacao`, `leilao`, `emprestimo` (execução de garantia), `turno.service.verificarFalencia` (properties voltam ao banco: contador irrelevante, mas definir valor coerente).
- Usar a rodada atual da sessão. As atualizações devem acontecer na **mesma transação** da mudança que as motivou.

---

## 4. Notificações e UX (obrigatório)

- **Aviso prévio:** quando uma propriedade estiver a 2 rodadas de começar a cobrar, mostrar aviso em Imóveis ("Av. X começa a cobrar em 2 rodadas se ninguém cair nela").
- **Card da propriedade (aba Imóveis):** mostrar badge "Ociosa há N rodadas · custo R$ X/rodada" quando já estiver cobrando, e "Cobra em N rodadas" na carência final. Indicar também que construir ou receber visita zera.
- **Extrato da rodada:** linha própria para terreno ocioso (separada da manutenção por casas), para não parecer bug.
- **Histórico (Últimas jogadas):** entrada ao cobrar, com nome da propriedade.
- **Regras:** atualizar README (seções "Hipoteca/Turno/Propriedades") e a tela de regras do cliente com as duas mudanças.
- Nada de emojis novos. Ícones Lucide.
- Estados de loading/erro seguem o padrão já usado (finally + timeout + estado visível).

---

## 5. Compatibilidade com o que já existe (não quebrar)

- **Ordem de jogo, compra, hipoteca, falência, desistência:** a mudança B só altera o valor da manutenção cobrada na virada de rodada. Não mexer em turnos nem em `verificarFalencia`.
- **Eventos econômicos:** `manutencaoMult` (Inflação) também afeta o terreno ocioso. Documentar na descrição do evento.
- **Empréstimos:** `calcularLimiteCredito` não muda.
- **Ações (grupo Preto):** continuam isentas.
- **Concorrência:** a cobrança roda dentro do fluxo de virada de rodada que já está sob `withLock("turno:...")`. Não introduzir novo lock; não ler-depois-escrever fora dele.
- **Cache Redis da sessão (TTL 60s):** chamar `emitUpdatedSession` depois de mutações, como já é padrão (houve bug por cache desatualizado em `revelarDados`).

---

## 6. ETAPA 1: Auditoria (somente leitura)

Reportar:
1. Todos os pontos onde `creditoVisao`, `creditoRecargaEm`, `2` e `+ 3` aparecem no servidor e no cliente (lista da seção 2.2; apontar divergências).
2. Todos os pontos que gravam `SessionPosses` mudando `playerId`, `casas`, `hipotecada` ou `negociando` (lista de candidatos da seção 3.6; apontar os que faltarem).
3. Como o cliente obtém constantes de economia hoje (existe `client/src/shared/`? há espelho?).
4. Se `rodadaAtual` está sempre disponível onde o reset precisa ser feito.
5. Como os testes existentes de turno/rodada criam sessões, para reaproveitar nos novos.
6. Lixo no repo: arquivos `nul` e `FIX_COMPRA_TRAVADA_LOADING.md:Zone.Identifier` na raiz. Sugerir remoção (**não remover sem aprovação**).

Terminar com: "Aguardo aprovação para a Etapa 2".

---

## 7. ETAPA 2: Implementação (após aprovação)

Ordem (um commit por item):
1. **Constantes** em `economia.ts` + espelho no cliente.
2. **Mudança A (visão):** substituir hardcoded por constantes; migration (default 1 + `LEAST(..., 1)`); textos dinâmicos e ícone `Eye`.
3. **Schema:** `ultimaAtividadeRodada` + migration com backfill.
4. **Resets do contador** nos pontos da auditoria (mesma transação de cada mudança).
5. **Cobrança** em `rodada.service.ts` + histórico.
6. **UI:** badges nos cards de Imóveis, aviso prévio, extrato, regras (README + cliente).
7. **Testes** (seção 8) e `make validate`.

Não alterar: Mapa 2D, fórmulas de aluguel, IPTU, renda passiva, empréstimos, leilão.

---

## 8. Testes (Jest + banco isolado `gamebank_test`)

Unitários (sem banco), função pura `calcularCustoOciosa(prop, casas, hipotecada, ociosas, mods)`:
- Antes da carência → 0. Na carência → 3%. Degraus 2, 3, 4 e **teto** (degrau 5+ continua 4).
- Com casas → 0. Hipotecada → 0. Ação → 0.
- `manutencaoMult` aplicado (Inflação 1,5x).

Integração:
- Propriedade sem visita por 8 rodadas cobra na virada; visita zera; construir zera; hipotecar/recomprar zera; troca por negociação zera.
- Saldo insuficiente gera dívida (fallback existente) e não saldo negativo.
- Backfill: sessão existente não cobra retroativamente.
- Visão: novo jogador começa com 1 crédito; ao usar, `creditoRecargaEm = rodadaAtual + 4`; na rodada de recarga volta a 1; dois cliques simultâneos em "revelar" não gastam 2 créditos.

Manual:
- Aba Imóveis mostra aviso, badge e custo corretos.
- Textos de visão mostram `/1` e "4 rodadas".
- F5 durante qualquer fluxo não deixa estado travado.

---

## 9. Definição de pronto

- Nenhum literal 2/3 de visão restante; tudo vindo de `economia.ts`.
- Cobrança de terreno ocioso só no escopo definido (normal, com dono, sem casas, não hipotecada), zerando em todos os eventos listados.
- UI explica a cobrança antes e depois dela acontecer.
- README e tela de regras atualizados.
- `make validate` verde, nenhuma regressão em turno, compra, hipoteca, falência ou empréstimo.
- Valores ajustáveis apenas em `economia.ts`.
