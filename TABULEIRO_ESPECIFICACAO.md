# Especificação: Tabuleiro 2D e Regras — Modo Tabuleiro GameBank

## Contexto

Esta é a especificação completa do tabuleiro do Super Banco Imobiliário
para o novo Modo Tabuleiro do GameBank. Contém o mapa exato das 40 casas,
o mapeamento com as propriedades existentes (`propriedades.json`), e todas
as regras de jogo (dados, prisão, feriado, falência, etc.).

**Convenção de índice:** as casas usam índice interno **0 a 39** (posição 0
= Início). Para o usuário, pode-se exibir 1 a 40, mas internamente é 0-39
para simplificar o cálculo de volta completa (`novaPos = (pos + dados) % 40`).

---

## 1. MAPA DO TABULEIRO (40 casas)

| Pos | Nome | Tipo | ID Prop | Grupo |
|-----|------|------|---------|-------|
| 0  | Início | `inicio` | — | — |
| 1  | Av. 9 de Julho | `propriedade` | 1 | Verde-Claro |
| 2  | Av. Brasil | `propriedade` | 3 | Verde-Claro |
| 3  | Ações do Banco | `acao` | 23 | Preto |
| 4  | Av. Beira Mar | `propriedade` | 2 | Verde-Claro |
| 5  | Av. Rio Branco | `propriedade` | 4 | Vermelho |
| 6  | Notícias | `noticias` | — | — |
| 7  | Av. do Estado | `propriedade` | 7 | Vermelho |
| 8  | Ações da Estrela Card | `acao` | 24 | Preto |
| 9  | Av. do Contorno | `propriedade` | 8 | Vermelho |
| 10 | Prisão (visita) | `prisao_visita` | — | — |
| 11 | Notícias | `noticias` | — | — |
| 12 | Av. Rebouças | `propriedade` | 6 | Azul |
| 13 | Av. Santo Amaro | `propriedade` | 9 | Azul |
| 14 | Ações do E-Commerce | `acao` | 25 | Preto |
| 15 | Rua da Consolação | `propriedade` | 5 | Azul |
| 16 | Restituição IR (+R$2.000) | `restituicao` | — | — |
| 17 | Av. Morumbi | `propriedade` | 10 | Rosa |
| 18 | Av. Higienópolis | `propriedade` | 11 | Rosa |
| 19 | Av. São João | `propriedade` | 16 | Roxo |
| 20 | Feriado | `feriado` | — | — |
| 21 | Av. Ipiranga | `propriedade` | 12 | Roxo |
| 22 | Ações da Petroleira | `acao` | 26 | Preto |
| 23 | Receita Federal (−R$2.000) | `imposto` | — | — |
| 24 | Notícias | `noticias` | — | — |
| 25 | Av. Brigadeiro Faria Lima | `propriedade` | 14 | Verde-Escuro |
| 26 | Av. Paulista | `propriedade` | 15 | Verde-Escuro |
| 27 | Notícias | `noticias` | — | — |
| 28 | Av. Recife | `propriedade` | 13 | Verde-Escuro |
| 29 | Ações da Companhia Aérea | `acao` | 27 | Preto |
| 30 | Vá para a Detenção | `va_para_prisao` | — | — |
| 31 | Av. Juscelino Kubitschek | `propriedade` | 17 | Laranja |
| 32 | Notícias | `noticias` | — | — |
| 33 | Rua Oscar Freire | `propriedade` | 18 | Laranja |
| 34 | Av. Ibirapuera | `propriedade` | 19 | Laranja |
| 35 | Av. Vieira Souto | `propriedade` | 20 | Amarelo |
| 36 | Ações da Emissora de TV | `acao` | 28 | Preto |
| 37 | Av. Presidente Vargas | `propriedade` | 21 | Amarelo |
| 38 | Notícias | `noticias` | — | — |
| 39 | Av. Niemeyer | `propriedade` | 22 | Amarelo |

**Nota sobre nomes:** no `propriedades.json`, "Av. Vieira Souto" está grafada
como "Av. Viera Souto" (id 20) — usar o id, não o nome, para evitar erro.

---

## 2. DADOS DE TABULEIRO (novo JSON)

Criar `server/data/tabuleiro.json` — define a ordem e tipo de cada casa.
O `propId` referencia a propriedade em `propriedades.json` quando aplicável.

```json
[
  { "pos": 0,  "nome": "Início",                      "tipo": "inicio" },
  { "pos": 1,  "nome": "Av. 9 de Julho",              "tipo": "propriedade", "propId": 1 },
  { "pos": 2,  "nome": "Av. Brasil",                  "tipo": "propriedade", "propId": 3 },
  { "pos": 3,  "nome": "Ações do Banco",              "tipo": "acao", "propId": 23 },
  { "pos": 4,  "nome": "Av. Beira Mar",               "tipo": "propriedade", "propId": 2 },
  { "pos": 5,  "nome": "Av. Rio Branco",              "tipo": "propriedade", "propId": 4 },
  { "pos": 6,  "nome": "Notícias",                    "tipo": "noticias" },
  { "pos": 7,  "nome": "Av. do Estado",               "tipo": "propriedade", "propId": 7 },
  { "pos": 8,  "nome": "Ações da Estrela Card",       "tipo": "acao", "propId": 24 },
  { "pos": 9,  "nome": "Av. do Contorno",             "tipo": "propriedade", "propId": 8 },
  { "pos": 10, "nome": "Prisão",                      "tipo": "prisao_visita" },
  { "pos": 11, "nome": "Notícias",                    "tipo": "noticias" },
  { "pos": 12, "nome": "Av. Rebouças",                "tipo": "propriedade", "propId": 6 },
  { "pos": 13, "nome": "Av. Santo Amaro",             "tipo": "propriedade", "propId": 9 },
  { "pos": 14, "nome": "Ações do E-Commerce",         "tipo": "acao", "propId": 25 },
  { "pos": 15, "nome": "Rua da Consolação",           "tipo": "propriedade", "propId": 5 },
  { "pos": 16, "nome": "Restituição IR",              "tipo": "restituicao", "valor": 2000 },
  { "pos": 17, "nome": "Av. Morumbi",                 "tipo": "propriedade", "propId": 10 },
  { "pos": 18, "nome": "Av. Higienópolis",            "tipo": "propriedade", "propId": 11 },
  { "pos": 19, "nome": "Av. São João",                "tipo": "propriedade", "propId": 16 },
  { "pos": 20, "nome": "Feriado",                     "tipo": "feriado" },
  { "pos": 21, "nome": "Av. Ipiranga",                "tipo": "propriedade", "propId": 12 },
  { "pos": 22, "nome": "Ações da Petroleira",         "tipo": "acao", "propId": 26 },
  { "pos": 23, "nome": "Receita Federal",             "tipo": "imposto", "valor": 2000 },
  { "pos": 24, "nome": "Notícias",                    "tipo": "noticias" },
  { "pos": 25, "nome": "Av. Brigadeiro Faria Lima",   "tipo": "propriedade", "propId": 14 },
  { "pos": 26, "nome": "Av. Paulista",                "tipo": "propriedade", "propId": 15 },
  { "pos": 27, "nome": "Notícias",                    "tipo": "noticias" },
  { "pos": 28, "nome": "Av. Recife",                  "tipo": "propriedade", "propId": 13 },
  { "pos": 29, "nome": "Ações da Companhia Aérea",    "tipo": "acao", "propId": 27 },
  { "pos": 30, "nome": "Vá para a Detenção",          "tipo": "va_para_prisao" },
  { "pos": 31, "nome": "Av. Juscelino Kubitschek",    "tipo": "propriedade", "propId": 17 },
  { "pos": 32, "nome": "Notícias",                    "tipo": "noticias" },
  { "pos": 33, "nome": "Rua Oscar Freire",            "tipo": "propriedade", "propId": 18 },
  { "pos": 34, "nome": "Av. Ibirapuera",              "tipo": "propriedade", "propId": 19 },
  { "pos": 35, "nome": "Av. Vieira Souto",            "tipo": "propriedade", "propId": 20 },
  { "pos": 36, "nome": "Ações da Emissora de TV",     "tipo": "acao", "propId": 28 },
  { "pos": 37, "nome": "Av. Presidente Vargas",       "tipo": "propriedade", "propId": 21 },
  { "pos": 38, "nome": "Notícias",                    "tipo": "noticias" },
  { "pos": 39, "nome": "Av. Niemeyer",                "tipo": "propriedade", "propId": 22 }
]
```

---

## 3. REGRAS DE DADOS E MOVIMENTO

### 3.1 Rolagem
- Dois dados de 6 faces, **rolados no servidor** (nunca no cliente).
- Jogador move `dado1 + dado2` casas no sentido horário.
- `novaPos = (posAtual + dado1 + dado2) % 40`.

### 3.2 Dados duplos (dado1 === dado2)
- Jogador **joga novamente** após completar a ação da casa.
- **3 duplos seguidos** → vai direto para a Prisão (pos 10), sem completar
  o 3º movimento, e **perde o direito de jogar de novo**.

### 3.3 Passar pelo Início (regra de volta completa)
- Sempre que o jogador **passar ou parar** na posição 0 (Início), recebe
  **R$ 2.000**. Detecção: se `posAtual + dados >= 40`, houve volta completa.
- Vale mesmo se parar exatamente no Início.
- Detecção robusta: `if ((posAtual + totalDados) >= 40) creditarInicio()`.

---

## 4. LÓGICA DE CADA TIPO DE CASA (ao parar)

| Tipo | Ação ao parar |
|------|---------------|
| `inicio` | Nada extra (o crédito é por passar, tratado no movimento) |
| `propriedade` sem dono | Oferece compra ao jogador (só no turno dele). Se recusar, continua sem dono |
| `propriedade` de outro | Cobra aluguel automaticamente (usa cálculo existente). Se hipotecada, não cobra |
| `propriedade` própria | Nada |
| `acao` sem dono | Igual propriedade — oferece compra |
| `acao` de outro | Cobra "aluguel" da ação (mesma lógica) |
| `noticias` | Puxa carta Sorte/Revés e aplica efeito automaticamente |
| `prisao_visita` | Nada — apenas visitando |
| `restituicao` | Credita +R$ 2.000 automaticamente |
| `imposto` | Debita −R$ 2.000 automaticamente (pode gerar dívida) |
| `feriado` | Marca jogador para pular a **próxima 1 rodada** |
| `va_para_prisao` | Move para pos 10 e marca preso (3 rodadas). Não recebe Início mesmo passando |

---

## 5. REGRAS DE PRISÃO

### 5.1 Ir para a prisão
Três formas de ser preso:
1. Cair na casa "Vá para a Detenção" (pos 30)
2. Tirar 3 duplos seguidos
3. (Carta de Revés com efeito `prisao`, se existir)

Ao ser preso:
- Move para pos 10
- `emPrisao = true`, `turnosPrisao = 3`
- **Não recebe R$ 2.000** mesmo passando pelo Início no trajeto

### 5.2 Sair da prisão
A cada rodada do jogador preso:
- **Rodadas 1 e 2:** 1 tentativa de tirar dados duplos. Se conseguir, sai
  e move a soma dos dados. Se não, `turnosPrisao--` e permanece.
- **Rodada 3 (última):** até **3 tentativas** de dados duplos. Se conseguir
  em qualquer uma, sai e move. Se falhar nas 3, **paga R$ 500 de multa**
  e sai obrigatoriamente (move pela última rolagem).
- Carta "sair da prisão" (`sairPrisao`), se o jogador tiver, liberta na hora.

### 5.3 Detalhe importante — duplo dentro do corredor
Se o jogador está livre (não preso) e cai na Prisão-visita (pos 10) por
movimento normal, é só visita. Mas se durante o movimento ele tira duplo
e o 3º duplo o manda para a prisão, ele **não joga de novo** — a jogada
extra é cancelada.

---

## 6. REGRA DE FERIADO

- Ao parar na casa Feriado (pos 20), o jogador fica marcado para **pular
  a próxima 1 rodada** dele.
- Implementação: `pularProximaRodada = true`. No início do turno, se a flag
  estiver ativa, o turno é pulado e a flag é limpa.

---

## 7. DÍVIDAS E FALÊNCIA

### 7.1 Ficar devendo ao banco
- Se o jogador não tem saldo para pagar algo (aluguel, imposto, multa),
  ele **fica devendo ao banco** (saldo pode ficar negativo ou registrar
  dívida separada).
- Enquanto deve, **não pode desistir voluntariamente** sem quitar.

### 7.2 Contador de falência
- Se o jogador passar **3 rodadas dele sem quitar a dívida**, é declarado
  **falido** e sai do jogo.
- Implementação: `rodadasDevendo` incrementa a cada turno do jogador se
  ainda houver dívida. Ao chegar em 3, falência automática.
- Ao falir: propriedades voltam ao banco (ficam sem dono) ou vão para o
  credor, conforme a regra que você definir (padrão clássico: voltam ao
  banco / leilão, mas você dispensou leilão, então voltam sem dono).

### 7.3 Evitar falência
- O jogador pode vender casas (a qualquer momento), hipotecar propriedades,
  ou negociar para levantar dinheiro e quitar antes das 3 rodadas.

---

## 8. AÇÕES MANUAIS vs AUTOMÁTICAS

| Ação | Quando | Automática? |
|------|--------|-------------|
| Rolar dados | Só no turno | Manual (botão) |
| Mover peão | Após rolar | Automática |
| Comprar propriedade/ação | Só no turno, ao cair nela sem dono | Manual (aceitar/recusar) |
| Pagar aluguel | Ao cair em prop. de outro | Automática |
| Comprar casas | **Só no turno do jogador** | Manual |
| Vender casas | **A qualquer momento** | Manual |
| Negociar | **A qualquer momento** | Manual |
| Hipotecar/deshipotecar | A qualquer momento | Manual |
| Transferência livre | A qualquer momento | Manual |
| Pagar imposto/multa | Ao cair/sair prisão | Automática |
| Puxar carta Sorte/Revés | Ao cair em Notícias | Automática |

---

## 9. SCHEMA — CAMPOS NOVOS

```prisma
model SessionPlayer {
  // ...campos existentes...
  posicao            Int      @default(0)
  emPrisao           Boolean  @default(false)
  turnosPrisao       Int      @default(0)
  tentativasPrisao   Int      @default(0)   // tentativas na rodada 3
  pularProximaRodada Boolean  @default(false)
  rodadasDevendo     Int      @default(0)
  dividaBanco        Int      @default(0)   // valor devido ao banco
}

model Session {
  // ...campos existentes...
  turnoAtualPlayerId Int?
  ordemTurnos        String?   // JSON array de playerIds na ordem
  ultimoDado1        Int?
  ultimoDado2        Int?
  aguardandoAcao     Boolean   @default(false)  // esperando decisão (comprar?)
}
```

---

## 10. TIMEOUT DE TURNO

- Cada jogador tem **60 segundos** para agir no seu turno.
- Se estourar, a vez é passada automaticamente (jogada perdida — não rola
  os dados por ele, apenas pula).
- Implementação: timer no servidor por turno. Ao expirar, emite evento
  `turno:timeout` e avança para o próximo jogador.
- O timer pausa quando o jogador está decidindo uma ação obrigatória
  (ex: escolher o que vender para pagar dívida).

---

## Definição de "pronto" para esta especificação

Esta spec cobre o **modelo de dados e as regras**. Ela é a base para:
1. Migração do schema (campos novos)
2. Criação do `tabuleiro.json`
3. Módulo de turnos, dados e movimento
4. Lógica de cair na casa
5. O tabuleiro visual 2D (spec separada)

Cada um desses vira um `.md` de implementação próprio, seguindo o modelo
incremental (um por vez, com auditoria e testes).
