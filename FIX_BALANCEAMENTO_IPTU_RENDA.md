# Correção: Balanceamento Econômico — IPTU e Renda Passiva

## O problema observado

Um jogador **inativo** (nunca jogava) acumulou **R$ 86.000 sem fazer nada**.
Tinha algumas propriedades, sem monopólio, sem casas construídas.

## O que já foi corrigido (e funcionou)

Duas mudanças já implementadas atacaram a raiz do problema:

### 1. Dados às cegas
Antes, o jogador via o resultado dos dados **antes** de escolher o movimento
— e sempre escolhia a opção que **desviava de propriedades alheias**. Ninguém
pagava aluguel. Todos só acumulavam renda passiva.

Com a escolha **às cegas** (escolhe antes de ver), o jogador não controla mais
onde cai. **Ele volta a pagar aluguel.**

Impacto medido (simulação, 117 rodadas, 12 partidas):
- Antes: o AFK acumulava indefinidamente
- Depois: o AFK **falha em ~50% das partidas** e acumula ~R$ 22k em vez de 86k

### 2. Renda e manutenção por rodada
`renda − manutenção` passou a ser cobrado **a cada rodada** (não mais só na
passagem pelo Início). O IPTU ficou no Início. Isso está correto e
implementado em `rodada.service.ts` (`creditarRendaPassivaRodada`).

Como uma volta leva ~7 rodadas, isso **amplifica muito** o efeito de
desenvolver: quem constrói recebe renda 7x mais vezes por volta.

---

## O que ainda falta: amplificar a vantagem de quem desenvolve

O AFK ainda **acumula devagar** (~R$ 22k). A causa é estrutural:

> O crédito de R$ 2.000 do Início representa **~90% da renda do jogador
> inativo**. Com IPTU de 8%, cinco propriedades custam apenas R$ 480 por
> volta — deixando **+R$ 1.520 líquidos por volta** para quem não faz nada.

### O que foi testado e NÃO funciona

| Tentativa | Resultado |
|---|---|
| IPTU de 40-50% | Mata os jogadores **ativos** junto (falências de 11 → 24 em 36). Quem compra e não fecha monopólio quebra. |
| IPTU diferenciado (cru alto, desenvolvido baixo) | Mesmo problema: os ativos também têm terreno cru esperando fechar monopólio. |
| Reduzir o crédito do Início | Não reduz o saldo do AFK de forma significativa e enfraquece o marco icônico do Início. |

**Nenhum ajuste de IPTU faz o AFK perder dinheiro** sem quebrar o jogo para
todos. Para isso seria preciso uma despesa fixa que anule o crédito (um
"custo de vida") — o que foi descartado por ser artificial.

### A solução adotada

**Aceitar que o inativo acumule devagar, mas fazê-lo perder a corrida por
larga margem.** Quem desenvolve deve ganhar múltiplas vezes mais.

---

## A MUDANÇA

Em `server/src/constants/economia.ts`:

```typescript
/** IPTU: % do custo_compra, cobrado ao passar pelo Início.
 *  ALTERADO: 0.08 → 0.25 (terreno ocioso precisa pesar). */
export const IPTU_PCT = 0.25;

/** Renda passiva: % do aluguel atual, creditado POR RODADA.
 *  ALTERADO: 0.15 → 0.35 (desenvolver precisa compensar de verdade). */
export const RENDA_PASSIVA_PCT = 0.35;

/** Manutenção: INALTERADA. */
export const MANUTENCAO_PCT = 0.12;
```

**Apenas duas constantes mudam. Nenhuma lógica é alterada.**

| Constante | Antes | Depois |
|---|---|---|
| `IPTU_PCT` | 0.08 | **0.25** |
| `RENDA_PASSIVA_PCT` | 0.15 | **0.35** |
| `MANUTENCAO_PCT` | 0.12 | 0.12 (inalterado) |
| `CREDITO_INICIO` | 2000 | 2000 (inalterado) |

---

## Resultado esperado (simulação: 117 rodadas, 12 partidas, 3 ativos + 1 AFK)

| Config | Saldo do AFK | Saldo do ativo | Vantagem do ativo |
|---|---|---|---|
| Atual (IPTU 8%, renda 15%) | +21.802 | +56.513 | 2,6x |
| **Nova (IPTU 25%, renda 35%)** | +22.118 | **+115.710** | **5,2x** |

O AFK continua acumulando algo, mas **vira irrelevante na disputa**. Quem
desenvolve ganha 5x mais.

### Curva por cenário (por volta, ~7 rodadas)

| Cenário | Por rodada | No Início | Por volta |
|---|---|---|---|
| 4 props cruas | +112 | +812 | +1.596 |
| 8 props cruas | +343 | **−1.238** | +1.164 |
| Monopólio, 0 casas | +154 | +600 | +1.678 |
| Monopólio, 2 casas | +1.450 | +600 | +10.750 |
| Monopólio, 4 casas | **+6.610** | +600 | **+46.870** |
| Monopólio, hotel | **+8.350** | +600 | **+59.050** |

Acumular terreno cru (8 props) já faz o IPTU **superar** o crédito do Início.
Desenvolver multiplica a renda por rodada — que incide 7x mais que o IPTU.

---

## ETAPA 0 — Auditoria

```bash
# Confirmar as constantes atuais
cat server/src/constants/economia.ts

# Confirmar que renda/manutenção JÁ são por rodada
grep -n "creditarRendaPassivaRodada" server/src/modules/turno/services/rodada.service.ts

# Confirmar que o IPTU está no extrato do Início
grep -rn "IPTU_PCT" server/src --include="*.ts" | grep -v node_modules

# Confirmar onde RENDA_PASSIVA_PCT é usado (há 2 lugares!)
grep -rn "RENDA_PASSIVA_PCT" server/src --include="*.ts" | grep -v node_modules
```

**ATENÇÃO:** `RENDA_PASSIVA_PCT` é usado em **dois lugares**:
1. `rodada.service.ts` — crédito de renda por rodada
2. `emprestimo.service.ts` — cálculo de qual propriedade "mais rende"
   (para escolher a garantia)

Ambos devem usar a mesma constante. Não duplicar o valor.

---

## ETAPA 1 — Alterar as constantes

Editar `server/src/constants/economia.ts` conforme a seção "A MUDANÇA".

Atualizar também os comentários, que hoje dizem "por volta" para a renda
passiva — ela agora é **por rodada**:

```typescript
/** Renda passiva: % do aluguel atual (considerando nº de casas).
 *  Creditada POR RODADA (não por volta). */
export const RENDA_PASSIVA_PCT = 0.35;

/** Manutenção: % do custo_casa, por casa construída.
 *  Cobrada POR RODADA (junto com a renda passiva). */
export const MANUTENCAO_PCT = 0.12;

/** IPTU: % do custo_compra.
 *  Cobrado ao PASSAR PELO INÍCIO (junto com o crédito de R$ 2.000). */
export const IPTU_PCT = 0.25;
```

---

## ETAPA 2 — Verificar a UI (nada deve quebrar, mas os valores mudam)

Os componentes que exibem projeções precisam refletir os novos valores.
**Nenhuma mudança de código deve ser necessária** — eles leem das constantes.
Mas é obrigatório verificar:

- [ ] Card de projeção do Início mostra o novo IPTU (bem maior)
- [ ] Modal de extrato do Início mostra o IPTU correto
- [ ] Toast/histórico de renda passiva por rodada mostra os novos valores
- [ ] Modal de empréstimo escolhe a garantia corretamente (usa `RENDA_PASSIVA_PCT`)

### Alerta de líquido negativo (importante para a UX)

Com IPTU de 25%, um jogador com muitas propriedades cruas pode ter **líquido
negativo** ao passar pelo Início. Se ainda não existe, adicionar um alerta:

> *Seu IPTU superou o crédito do Início. Desenvolva propriedades para gerar
> renda passiva ou hipoteque o que não usa.*

Sem essa mensagem, o jogador acha que o jogo está quebrado. Com ela, ele
entende que precisa **agir**.

---

## ETAPA 3 — Atualizar as regras (Client + README)

### Onboarding
- Ao passar pelo Início: **+R$ 2.000 − IPTU** das suas propriedades (25% do
  valor de compra)
- A cada rodada: **renda passiva − manutenção** das suas propriedades
- Renda passiva: 35% do aluguel atual (quanto mais casas, mais renda)
- Manutenção: 12% do custo da casa, por casa
- **Terreno parado só gera IPTU.** Desenvolver é o que gera renda
- Acumular propriedades sem construir leva ao prejuízo

### README
```markdown
### Modo Tabuleiro — Economia
- Ao passar pelo Início: +R$ 2.000, menos IPTU (25% do valor das propriedades)
- A cada rodada: renda passiva (35% do aluguel atual) menos manutenção
  (12% do custo da casa, por casa)
- Renda e manutenção incidem POR RODADA; o IPTU incide por volta
- Terreno cru gera IPTU sem renda — desenvolver é essencial
- Jogadores inativos ficam para trás: quem desenvolve ganha ~5x mais
```

---

## ETAPA 4 — Testes obrigatórios

### Balanceamento
- [ ] Jogador com 8 propriedades cruas tem líquido **negativo** no Início
      (IPTU supera os R$ 2.000)
- [ ] Jogador com monopólio + 4 casas tem renda por rodada muito alta
- [ ] Jogador que só anda (sem desenvolver) fica claramente para trás
- [ ] Um jogador que desenvolve vence com folga contra um passivo

### Não quebrou nada
- [ ] Renda/manutenção continuam sendo creditadas **por rodada**
- [ ] IPTU continua sendo cobrado **ao passar pelo Início**
- [ ] Propriedade hipotecada: sem IPTU, sem manutenção, sem renda
- [ ] Ações (grupo Preto): sem IPTU, sem manutenção, sem renda
- [ ] Líquido negativo sem saldo → gera dívida (`cobrarComFallbackDivida`)
- [ ] Dívida conta para falência em 3 rodadas
- [ ] Eventos econômicos continuam aplicando os modificadores corretamente
- [ ] `emprestimo.service` escolhe a garantia certa (usa `RENDA_PASSIVA_PCT`)
- [ ] Modo Banca NÃO afetado

### UX
- [ ] Card de projeção reflete o novo IPTU
- [ ] Alerta quando o líquido do Início for negativo
- [ ] Histórico de renda passiva por rodada com os valores corretos

### Build
- [ ] `make validate` passa

---

## Definição de "pronto"

1. `IPTU_PCT` = 0.25 (era 0.08)
2. `RENDA_PASSIVA_PCT` = 0.35 (era 0.15)
3. Comentários das constantes corrigidos (renda/manutenção são **por rodada**)
4. Alerta de líquido negativo na UI do Início
5. Regras atualizadas (onboarding + README)
6. Todos os testes passando

---

## Nota honesta sobre o limite desta correção

Esta mudança **não faz o jogador inativo perder dinheiro** — ela o faz
**perder a corrida**. Ele ainda acumula devagar (~R$ 22k em 117 rodadas),
mas quem desenvolve chega a ~R$ 115k.

Fazer o inativo **falir de verdade** exigiria uma das duas coisas abaixo,
ambas com custo de design:

1. **Custo de vida** — uma despesa fixa (~R$ 2.000) que todos pagam ao passar
   pelo Início. Resolve, mas é artificial: "receba 2.000, pague 2.000".
2. **Reduzir o crédito do Início** — de R$ 2.000 para ~R$ 500. Resolve, mas
   enfraquece um marco icônico do jogo.

A opção adotada preserva o feeling clássico e resolve o problema competitivo.
Se, após partidas reais, o acúmulo do inativo ainda incomodar, essas duas
alternativas continuam disponíveis.

### Ajuste fino

- Se os jogadores estiverem falindo demais → reduzir `IPTU_PCT` para 0.20
- Se o inativo ainda acumular demais → aumentar `IPTU_PCT` para 0.30
- Se ninguém construir → aumentar `RENDA_PASSIVA_PCT`

Os valores estão em `economia.ts` justamente para isso.
