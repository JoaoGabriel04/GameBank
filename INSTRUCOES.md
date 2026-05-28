# Planos Futuros — sgpController

## 1. Sistema de Negociação entre Jogadores

### Problema Atual
A aba "Especiais" existe mas o fluxo é limitado (troca 1:1 via `trocarPropriedade`). Não permite negociações complexas com múltiplas propriedades + dinheiro.

---

### 1.1 Fluxo Proposto

#### Abertura da Negociação
1. Jogador 1 (proponente) clica em "Negociar" — acesso por um botão no menu **Especiais** (remover a lógica simples de troca atual) ou diretamente no **Início** como uma ação rápida
2. Seleciona um jogador alvo (dropdown/exclusive select com os jogadores da sala, exceto ele mesmo)
3. Monta a oferta em duas seções visuais lado a lado ou empilhadas:
   - **O que eu ofereço**: grid de propriedades dele com checkbox (multiselect) + input de valor em dinheiro
   - **O que eu quero**: grid de propriedades do alvo com checkbox (multiselect) + input de valor em dinheiro
4. Pelo menos um dos lados precisa ter pelo menos um item (propriedade ou dinheiro). Pode ser:
   - Só dinheiro de um lado (ex: ofereço R$ 2.000 por uma propriedade)
   - Só propriedades (ex: troco uma propriedade por outra)
   - Propriedades + dinheiro (ex: ofereço 2 propriedades + R$ 1.000 por 1 propriedade do alvo)
   - Dinheiro dos dois lados (ex: ofereço R$ 500 e quero R$ 200 — improbable mas possível)
5. Envia → notificação em tempo real pro jogador alvo via socket `negotiation:new`

#### Travamento de Propriedades
- Propriedades ofertadas pelo proponente ficam **travadas** imediatamente ao enviar a oferta
- Enquanto travadas: não podem ser vendidas (`sellProp`), hipotecadas (`hipotecar`), nem incluídas em outra negociação
- Destravam automaticamente quando a oferta: **expira** (60s sem resposta), é **recusada**, ou é **respondida** (aceita ou contra-oferta)
- Implementação: adicionar campo `negociando: Boolean @default(false)` em `SessionPosses`, ou usar uma tabela separada de locks com expiração

#### Resposta do Alvo
O jogador alvo recebe a notificação e vê um resumo no formato de modal com:
- Cards das propriedades que receberia (com cor, nome, número de casas)
- Cards das propriedades que daria (com cor, nome, número de casas)
- Valores em dinheiro envolvidos (quanto recebe / quanto paga)
- Três botões de ação:

| Ação | Comportamento |
|---|---|
| **Aceitar** | Executa a troca: atualiza `playerId` das propriedades envolvidas, ajusta saldos, notifica ambos com `negotiation:accepted`, broadcast de `session:updated` |
| **Recusar** | Oferta descartada. Propriedades do proponente são destravadas. Nada mais acontece |
| **Contra-ofertar** | Reabre o modal de criação pré-preenchido com os termos atuais. O alvo vira o novo proponente, ajusta o que quiser e reenvia como nova negociação (novo ID, novo timer de 60s) |

#### Timeout
- 60 segundos para responder
- Se expirar: oferta é cancelada automaticamente, propriedades destravadas
- O proponente é notificado com `negotiation:expired`
- Implementação: `setTimeout` no servidor ao criar a oferta, armazenar o `timerId` ou usar `createdAt` + verificação

#### Visibilidade
- A negociação é **particular** entre os dois jogadores envolvidos
- Ninguém mais vê os detalhes da oferta
- Apenas o resultado final (aceitação) gera um `session:updated` que todos veem (as propriedades mudam de dono)

---

### 1.2 Models Prisma Necessários

```prisma
model Negotiation {
  id              Int      @id @default(autoincrement())
  sessionId       Int
  session         Session  @relation(fields: [sessionId], references: [id])
  fromPlayerId    Int
  fromPlayer      SessionPlayer @relation("NegotiationFrom", fields: [fromPlayerId], references: [id])
  toPlayerId      Int
  toPlayer        SessionPlayer @relation("NegotiationTo", fields: [toPlayerId], references: [id])
  status          String   @default("pendente") // "pendente" | "aceita" | "recusada" | "expirada"
  createdAt       DateTime @default(now())
  respondedAt     DateTime?

  @@map("negociacoes")
}

model NegotiationItem {
  id              Int     @id @default(autoincrement())
  negotiationId   Int
  negotiation     Negotiation @relation(fields: [negotiationId], references: [id])
  sessionPossesId Int?   // null se for apenas dinheiro
  fromSide        Boolean // true = "o que ofereço", false = "o que quero"
  valor           Float?  // valor em dinheiro (se sessionPossesId for null, ou complemento)

  @@map("negociacao_itens")
}
```

E em `SessionPosses` adicionar:
```prisma
negociando  Boolean @default(false)
```

---

### 1.3 Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/negociacoes/criar` | Cria nova negociação + trava propriedades |
| POST | `/api/negociacoes/:id/aceitar` | Aceita e executa a troca |
| POST | `/api/negociacoes/:id/recusar` | Recusa e destrava |
| POST | `/api/negociacoes/:id/contra-oferta` | Cria nova negociação com base na atual |
| GET | `/api/negociacoes/pendentes/:playerId` | Lista negociações pendentes do jogador |

---

### 1.4 Eventos Socket

| Evento | Direção | Descrição |
|---|---|---|
| `negotiation:new` | Server → Jogador alvo | Notifica nova oferta recebida |
| `negotiation:accepted` | Server → Ambos | Notifica que a oferta foi aceita |
| `negotiation:rejected` | Server → Proponente | Notifica que a oferta foi recusada |
| `negotiation:expired` | Server → Proponente | Notifica que a oferta expirou |
| `negotiation:counter` | Server → Novo alvo | Notifica contra-oferta (mesmo fluxo de `negotiation:new`) |

---

### 1.5 UI

- **Modal de criação**: duas grids lado a lado (minhas propriedades / propriedades do alvo) com checkbox + inputs de valor. Cada grid com cabeçalho mostrando o nome do jogador e o saldo atual
- **Modal de resposta**: resumo visual com cards das propriedades + valores, três botões (Aceitar, Recusar, Contra-ofertar). Timer visível de 60s regressivo
- **Badge de notificação**: ícone de sino ou alerta no menu indicando negociações pendentes

---

---

## 2. Sistema de Sorte e Revés

### 2.1 Baralho
Arquivo `server/data/cartas.json` contendo todas as cartas de Sorte e Revés.

### 2.2 Tipos de Carta

| Tipo | Efeito | Aplicação |
|---|---|---|
| `ganhar_dinheiro` | Jogador recebe X reais do banco | Automática |
| `perder_dinheiro` | Jogador paga X reais ao banco | Automática |
| `pagar_jogadores` | Jogador paga X reais para **cada** adversário | Automática (ver regra de saldo) |
| `receber_jogadores` | Jogador recebe X reais de **cada** adversário | Automática (ver regra de saldo) |
| `prisao` | "Vá para a Prisão" — apenas notificação | Manual (só aviso) |
| `carta_prisao` | Jogador ganha carta "Saia da Prisão" | Automática (adiciona ao inventário) |

### 2.3 Regra de Saldo Insuficiente (para `pagar_jogadores` e `receber_jogadores`)

Quando uma carta obriga um pagador a transferir X reais para cada adversário, e o pagador não tem saldo suficiente:

1. Para **cada** adversário individualmente:
   - Se o pagador tem saldo ≥ X: transfere X normalmente
   - Se o pagador tem saldo < X: paga **tudo que tem** (saldo = 0), o **banco complementa** a diferença para o recebedor receber o valor integral
2. Isso garante que:
   - Nenhum saldo fica negativo (nunca)
   - Quem recebe nunca recebe menos do que a carta determina
   - O jogo nunca quebra por falta de saldo

**Exemplo**: Carta "Receba R$ 500 de cada jogador".
   - Jogador 1 (pagador) tem R$ 100 → paga R$ 100, banco complementa R$ 400
   - Jogador 2 (pagador) tem R$ 800 → paga R$ 500 integral
   - Jogador 3 (pagador) tem R$ 1.000 → paga R$ 500 integral
   - Receptor final: recebe R$ 1.500 (R$ 500 × 3)

### 2.4 Carta "Saia da Prisão"

- Quando um jogador tira a carta `carta_prisao`, ela vai para o inventário dele
- Armazenada em `SessionPlayer.carta_prisao: Boolean @default(false)` no Prisma
- Aparece em uma nova aba **"Cartas Especiais"** no menu inicial do jogador
- A aba mostra a carta com um botão **"Usar"**:
  - Clicar em "Usar" apenas consome a carta (marca `carta_prisao = false`)
  - A carta não tem efeito automático no sistema — o uso é **informativo** (o jogador se livra da prisão no tabuleiro real)
- A carta é de **uso único**: ao usar, some do inventário
- Não pode ser acumulada: se o jogador já tem `carta_prisao = true` e tira outra, a segunda carta é descartada (ou convertida em dinheiro, a definir)

### 2.5 Carta "Vá para a Prisão"

- Quando um jogador tira a carta `prisao`, um modal aparece com o aviso "Você foi preso! Vá para a prisão."
- Apenas **informativo** — nenhuma lógica de rodadas perdidas, fiança, ou dados é implementada
- O jogador se vira no tabuleiro real

### 2.6 Fluxo do Sorteio

1. Botão **"Sortear Carta"** na interface principal, disponível quando for a vez do jogador
2. Pode ter dois botões separados: "Sortear Sorte" e "Sortear Revés" cada um com seu baralho
3. Sorteia aleatoriamente do baralho correspondente
4. Efeito aplicado automaticamente (exceto `prisao` e `carta_prisao`)
5. Broadcast `card:drawn` para **todos os jogadores da sala** com:
   - Nome do jogador que sorteou
   - Tipo da carta (Sorte ou Revés)
   - Texto da carta
   - Efeito aplicado (ex: "João recebeu R$ 500", "Maria pagou R$ 200 para cada jogador")
6. Modal com animação mostrando a carta (opcional)
7. Baralho é **embaralhado** no início de cada partida

### 2.7 Models Prisma Necessários

Adicionar em `SessionPlayer`:
```prisma
carta_prisao Boolean @default(false)
```

### 2.8 Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/cartas/sortear/:sessionId/:playerId` | Sorteia uma carta, aplica efeito, broadcast |
| GET | `/api/cartas/:sessionId` | Lista as cartas disponíveis (útil para debug) |

### 2.9 Eventos Socket

| Evento | Direção | Descrição |
|---|---|---|
| `card:drawn` | Server → Sala toda | Broadcast com dados da carta sorteada e efeito aplicado |
| `card:prisao` | Server → Sala toda | Broadcast específico para carta de prisão (ênfase no aviso) |
| `carta_prisao:usada` | Server → Sala toda | Broadcast quando alguém usa a carta de sair da prisão |

---

## 3. Models Prisma — Resumo de Todos os Campos Novos

### SessionPlayer (adições)
```prisma
carta_prisao Boolean @default(false)
```

### SessionPosses (adição)
```prisma
negociando  Boolean @default(false)
```

### Novos Models
```prisma
model Negotiation { ... }       // negociações
model NegotiationItem { ... }   // itens da negociação
```

---

## 4. Observações Técnicas

### Transações
Todas as operações que envolvem dinheiro + propriedades (aceitar negociação, aplicar carta) devem usar `prisma.$transaction` para garantir atomicidade.

### Locks
Para evitar race conditions em negociações simultâneas sobre a mesma propriedade, usar `withLock` (já existente em `server/src/middleware/lock.middleware.ts`) com chave `negotiation:{playerId}` ou `prop:{sessionPossesId}`.

### Timeout de Negociação
Implementar com `setTimeout` no servidor ao criar a negociação. O timer deve ser armazenado em um `Map<number, NodeJS.Timeout>` para permitir cancelamento se a oferta for respondida antes de expirar.

### Histórico
Todas as ações (negociações aceitas, cartas sorteadas) devem gerar registros em `Historico` para auditabilidade.

### Baralho
- Estrutura sugerida para `server/data/cartas.json`:

```json
{
  "sorte": [
    { "id": 1, "texto": "Ganhe R$ 500", "tipo": "ganhar_dinheiro", "valor": 500 },
    { "id": 2, "texto": "Receba R$ 200 de cada jogador", "tipo": "receber_jogadores", "valor": 200 },
    { "id": 3, "texto": "Sorte! Ganhe uma carta 'Saia da Prisão'", "tipo": "carta_prisao", "valor": 0 }
  ],
  "reves": [
    { "id": 1, "texto": "Pague R$ 300", "tipo": "perder_dinheiro", "valor": 300 },
    { "id": 2, "texto": "Pague R$ 150 para cada jogador", "tipo": "pagar_jogadores", "valor": 150 },
    { "id": 3, "texto": "Vá para a Prisão", "tipo": "prisao", "valor": 0 }
  ]
}
```

- As cartas dos dois baralhos são unidas em um único array embaralhado no início da partida OU mantidas separadas com botões distintos (a decidir durante implementação)
