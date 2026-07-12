# GameBank

Gerenciador multiplayer completo para o jogo de tabuleiro **Super Banco Imobiliário**. Substitui o banqueiro físico por uma aplicação web que controla saldos, propriedades, dívidas, negociações e recompensas em tempo real.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind CSS v4 + TypeScript |
| Animações | Framer Motion 12 + GSAP 3 |
| Estado | Zustand 5 (fonte de verdade) + SWR (fetching) |
| Backend | Express 4 + TypeScript |
| ORM | Prisma 7 + PostgreSQL 16 |
| Tempo real | Socket.IO 4 + Redis adapter |
| Auth | JWT + bcrypt + OAuth (Google, Discord) |
| Validação | Zod (schemas compartilhados) |
| Upload | Cloudinary (avatares e banners) via Multer |
| Infra | Docker Compose (dev e prod) |

## Funcionalidades

### Sessão de jogo
- Criação de sessões com senha opcional e modos solo/duplas
- Suporte a até 6 jogadores simultâneos com atualização em tempo real via Socket.IO
- Sistema de equipes para modo duplas
- Chat integrado por sessão
- Encerramento automático e ranking de resultado com confete

### Sistema bancário
- Depósito, saque e transferência entre jogadores
- Pagamento de aluguel simples e por ação de carta
- Receber de todos (carta sorte/revés)
- Histórico completo de movimentações por sessão

### Propriedades
- Compra, venda, hipoteca e deshipoteca
- Construção e venda de casas e hotéis
- Cálculo automático de aluguel por número de casas/hotéis

### Modo Tabuleiro — Economia
- Renda passiva por propriedade desenvolvida (15% do aluguel atual)
- IPTU sobre todas as propriedades (8% do valor de compra)
- Custo de manutenção por casa/hotel (12% do custo da casa)
- Cobrança consolidada na passagem pelo Início, com extrato detalhado
- Propriedades hipotecadas não pagam IPTU nem geram renda
- Ações (grupo Preto) não têm IPTU nem manutenção

### Modo Tabuleiro — Eventos Econômicos
- Evento a cada 3 rodadas (dura 2 rodadas), anunciado com 1 rodada de antecedência
- 10 eventos: crises, booms, mudanças de IPTU, custo de construção, dividendos
- Afetam a rodada inteira: aluguéis, IPTU, manutenção, renda passiva, construção
- Informação pública — a vantagem vem de saber reagir, não de saber antes

### Modo Tabuleiro — Escolha de Movimento
- Após rolar, o jogador escolhe andar: dado 1, dado 2 ou a soma
- A UI mostra o destino de cada opção (casa, dono, preço, aluguel)
- Duplo só concede jogada extra se o jogador escolher a soma
- Na prisão a escolha não se aplica (vale sempre a soma)
- Timeout aplica a soma automaticamente

### Modo Tabuleiro — Leilão Cego
- Propriedade recusada vai a leilão entre todos os jogadores
- Lances simultâneos e secretos (leilão cego) — evita conluio
- Lance mínimo de 50% do preço de tabela; lance é vinculante
- Empate resolvido pelo menor patrimônio (catch-up)
- Timeout de 30s; sem lances, a propriedade segue sem dono

### Negociações
- Proposta de troca entre jogadores (dinheiro + propriedades)
- Notificações em tempo real para o jogador alvo
- Aceitar, recusar ou fazer contraproposta

### Dívidas
- Registro de dívidas entre jogadores
- Cobrança e quitação controladas pelo sistema

### Cartas Sorte e Revés
- Baralho configurável pelo admin
- Efeitos: ganhar, pagar, pagar por casa, ir para prisão, sair da prisão

### Perfil e progressão
- Sistema de XP e níveis com cálculo automático ao fim de partidas
- Coins (moeda gratuita) ganhos por posição e missões concluídas
- Histórico de partidas e estatísticas por jogador
- Ranking global

### Loja e cosméticos
- Banners de perfil (gradiente CSS ou imagem Cloudinary)
- Emblemas (badges) com imagem personalizada
- Títulos decorativos
- Inventário por usuário com equip/desequip e venda com reembolso de 50%

### Missões
- Missões configuráveis pelo admin (tipo, meta, recompensas de XP e coins)
- Progresso rastreado automaticamente ao fim de partidas
- Resgate de recompensa com proteção contra duplo claim

### Painel Admin
- Gerenciamento completo de usuários (coins, XP, nível, ban/unban)
- Controle de sessões ativas com encerramento forçado
- CRUD de itens da loja, banners, emblemas e missões
- Cards de sorte/revés configuráveis
- Auditoria de ações administrativas

## Regras do jogo

O GameBank implementa o **Super Banco Imobiliário** (variante brasileira do
Monopoly) em dois modos. As regras abaixo refletem exatamente o que está
implementado no backend — não é um resumo genérico do jogo de tabuleiro.

### Modos de jogo

| | Modo Banca | Modo Tabuleiro |
|---|---|---|
| Tabuleiro físico | Sim — os jogadores jogam no tabuleiro real | Não — tudo acontece no app |
| Peões, dados, casas | Físicos, fora do app | Digitais, dentro do app |
| O app cuida de | Saldos, propriedades, dívidas | Tudo: dados, movimento, resolução de casa, turnos |
| Sequência de turnos | Livre (sem imposição) | Controlada pelo servidor, com timeout de 60s por turno |

Em **Modo Banca** o jogador registra manualmente cada ação (comprar,
pagar aluguel, sortear carta) através dos menus do app, informando quem
paga/recebe. Em **Modo Tabuleiro** o app rola os dados, move o peão,
resolve a casa automaticamente e controla de quem é a vez.

### Sessão e jogadores

- Sala aceita de **3 a 6 jogadores** (padrão: 6), com saldo inicial
  configurável (padrão **R$ 25.000**)
- Modo **individual** (padrão) ou **duplas** por times (times exigem pelo
  menos 2 jogadores cada; a UI atual só expõe o modo individual —
  "Em breve" para duplas)
- Apenas o dono da sala pode iniciar ou encerrar a partida
- Sala com senha exige token de acesso; sem senha, entrada livre

### O tabuleiro

40 casas, dispostas nos 4 lados de um tabuleiro 11×11 (posições 0–39, a
partir do canto Início, sentido horário):

| Tipo de casa | Quantidade | Efeito |
|---|---|---|
| **Início** | 1 (pos. 0) | Nenhum efeito próprio; passar por ela ou cair nela credita **R$ 2.000** |
| **Propriedade** | 28 | Pode ser comprada; cobra aluguel de quem não é dono |
| **Ação** | 6 (grupo Preto) | Pode ser comprada; cobra **dividendo fixo** por dado, não tem casas |
| **Notícias** | 6 | Sorteia uma carta de Sorte ou Revés |
| **Prisão (só visitando)** | 1 (pos. 10) | Sem efeito se o jogador não está preso |
| **Vá para a Detenção** | 1 (pos. 30) | Envia direto para a prisão, sem passar por Início |
| **Restituição IR** | 1 | Recebe R$ 2.000 do banco |
| **Receita Federal (Imposto)** | 1 | Paga R$ 2.000 ao banco |
| **Feriado** | 1 | Pula a próxima rodada |

### Propriedades e grupos de cor

As 28 propriedades normais são organizadas em **8 grupos de cor** (2 ou 3
imóveis cada: Verde-Claro, Roxo, Verde-Escuro, Azul, Vermelho, Amarelo,
Laranja, Rosa) mais o grupo **Preto** com as 6 Ações. Cada propriedade tem:

- **Custo de compra** — pago ao cair numa casa sem dono
- **Aluguel base** — cobrado de quem cai lá sem ser o dono
- **Aluguel por casas** (1 a 4 casas) e **aluguel com hotel** (5ª casa)
- **Custo por casa** — preço de cada casa construída
- **Valor de hipoteca**

Ao cair numa propriedade/ação sem dono, o jogador pode comprá-la pelo
custo de compra. Se pertence a outro jogador (e não está hipotecada), o
aluguel correspondente é cobrado automaticamente.

### Construção de casas e hotéis

- Só é permitido construir em propriedades **normais com monopólio**
  (o jogador precisa possuir **todas** as propriedades daquele grupo de
  cor) — **ações nunca permitem construção**, mesmo com o grupo Preto
  completo (rendem apenas o dividendo fixo por dado)
- Máximo de **5 níveis**: 1 a 4 casas, o 5º nível vira **hotel**
- Limite de **1 casa construída por propriedade por turno**
- Só é possível vender casas de uma propriedade sem hipotecá-la primeiro

### Ações (grupo Preto)

As 6 empresas do grupo Preto são compráveis como qualquer propriedade,
mas seu rendimento é diferente: quem cair numa ação de outro jogador paga
**R$ 500 × soma dos dados** da própria jogada, não um valor fixo de
tabela. Não têm casas, hotéis nem aluguel progressivo.

### Hipoteca

- Hipotecar uma propriedade **remove a posse** (ela some do jogador,
  fica marcada como hipotecada) e credita o **valor de hipoteca** ao
  jogador — só é permitido sem casas construídas
- Qualquer jogador pode comprar de volta uma propriedade hipotecada,
  pagando **hipoteca × 1.1** (10% de juros)
- Se for o **dono original**, a compra é imediata; se for outro jogador,
  o dono original recebe uma notificação e pode aceitar ou recusar
- Comprar uma propriedade hipotecada "do zero" (sem dono) custa
  **custo de compra × 1.2**

### Turno (Modo Tabuleiro)

1. O jogador da vez rola 2 dados (1–6 cada) — o peão **ainda não se move**
2. O jogador **escolhe o movimento**: andar o dado 1, o dado 2 ou a soma
   dos dois (ver [Modo Tabuleiro — Escolha de Movimento](#modo-tabuleiro--escolha-de-movimento))
3. Só então o peão avança; se passar ou cair em Início, recebe os
   **R$ 2.000** de crédito junto com o extrato de IPTU, manutenção e
   renda passiva de todas as suas propriedades (ver
   [Modo Tabuleiro — Economia](#modo-tabuleiro--economia))
4. A casa onde parou é resolvida automaticamente (compra, aluguel,
   imposto, carta, prisão, feriado...)
5. **Dados iguais (duplo)** → joga de novo, **só se escolher a soma**,
   **exceto** se a casa onde parou for **Feriado**, **Vá para a Detenção**
   ou uma carta de prisão — nesses casos a vez encerra mesmo com duplo
6. **3 duplos seguidos** na mesma vez → vai direto para a prisão, sem
   completar o movimento e sem oferecer escolha
7. Cada turno tem **60 segundos**; se o tempo acabar em qualquer fase, o
   servidor joga automaticamente pelo jogador (rola, escolhe a soma,
   move, recusa compras pendentes, paga o que for devido) e passa a vez
8. Comprar uma propriedade pode ficar **pendente durante todo o turno**
   — o jogador pode navegar para vender/hipotecar outras propriedades
   e conseguir dinheiro antes de decidir
9. **Recusar a compra** manda a propriedade a **leilão** entre todos os
   jogadores — o turno fica pausado até o leilão fechar (ver
   [Modo Tabuleiro — Leilão Cego](#modo-tabuleiro--leilão-cego))

### Modo Tabuleiro — Economia

Exclusivo do Modo Tabuleiro (o Modo Banca não é afetado). A cada volta
completa (passagem pelo Início), o extrato de cada jogador é calculado
e aplicado de uma vez, junto com o crédito de R$ 2.000:

- **Renda passiva** — 15% do aluguel atual de cada propriedade
  desenvolvida (`RENDA_PASSIVA_PCT`)
- **IPTU** — 8% do valor de compra de cada propriedade (`IPTU_PCT`)
- **Manutenção** — 12% do custo da casa, por casa construída; um hotel
  conta como 5 casas (`MANUTENCAO_PCT`, `HOTEL_EQUIVALE_CASAS`)
- **Propriedades hipotecadas** não pagam IPTU nem manutenção e não
  geram renda passiva — estão com o banco
- **Ações (grupo Preto)** não têm IPTU, manutenção nem renda passiva
- Se o líquido (crédito + renda − IPTU − manutenção) for negativo, o
  jogador recebe o que tem direito e a cobrança do restante segue a
  mesma regra de dívida do resto do jogo (conta para a falência em 3
  rodadas)
- Os percentuais ficam em `server/src/constants/economia.ts`, ajustáveis
  conforme o balanceamento observado em partidas reais

### Modo Tabuleiro — Eventos Econômicos

Exclusivo do Modo Tabuleiro. Ciclo de **3 rodadas**: 1 rodada de aviso (sem
evento ativo, só o anúncio) seguida de **2 rodadas com o evento ativo**
(`EVENTO_DURACAO_RODADAS`) — cada rodada dessas afeta o jogo inteiro. O
anúncio sai **1 rodada antes** do evento começar, então todos sabem ao
mesmo tempo; o que diferencia os jogadores é a capacidade de reagir, não
informação privilegiada.

- **Banner de aviso** no topo do tabuleiro durante a rodada de antecedência
  (não pode ser dispensado — é informação crítica)
- **Modal** para todos os jogadores no momento em que o evento entra em
  vigor, com descrição e dica de como reagir
- **Badge permanente** enquanto o evento está ativo, clicável para reabrir
  os detalhes
- Aluguéis, custo de construção e o extrato do Início (IPTU, manutenção,
  renda passiva) exibidos na UI já refletem o modificador ativo

Catálogo (`server/src/constants/eventos.ts`, espelhado em
`client/src/constants/eventos.ts`):

| Evento | Efeito |
|---|---|
| Crise Imobiliária | Aluguéis −50% |
| Boom Imobiliário | Aluguéis +50% |
| IPTU Extraordinário | IPTU dobra |
| Isenção Fiscal | IPTU zerado |
| Escassez de Material | Construção +50% |
| Aquecimento do Mercado | Construção −30% |
| Inflação | Manutenção +50% |
| Recessão | Renda passiva zerada |
| Dividendos Extraordinários | Ações (grupo Preto) rendem 2x |
| Injeção de Liquidez | Todos recebem R$ 1.000 imediatamente |

Sorteio aleatório, sem repetir o evento anterior em sequência. **Venda de
casa não usa o modificador de construção** (sempre custo base) —
anti-exploit contra "comprar barato no boom, vender caro na escassez".

### Modo Tabuleiro — Escolha de Movimento

Exclusivo do Modo Tabuleiro. Depois de rolar os dados, o jogador **escolhe**
quantas casas andar — dado 1, dado 2 ou a soma — antes de o peão se mover.
A UI mostra o destino de cada opção: nome da casa, se está livre e por
quanto, de quem é e o aluguel, ou o tipo de casa especial (carta, imposto,
feriado...), já refletindo eventos econômicos ativos.

- **Duplo só concede jogada extra se a escolha for a soma** — escolher um
  dado avulso zera a contagem de duplos (não acumula para os 3 seguidos)
- **Na prisão não há escolha** — sair (com duplo ou pagando multa) sempre
  move a soma dos dados, como antes
- **3 duplos seguidos** vão direto para a prisão, sem oferecer escolha
- **Timeout**: se os 60s acabarem em meio à escolha, o servidor aplica a
  soma automaticamente
- A escolha é uma segunda chamada ao servidor (`escolher-movimento`) —
  rolar os dados não move mais o peão sozinho

### Modo Tabuleiro — Leilão Cego

Exclusivo do Modo Tabuleiro. Quando o jogador da vez **recusa** comprar a
propriedade em que caiu, ela vai a leilão entre todos os jogadores ativos —
**pausa o turno** até o leilão fechar.

- **Cego**: todos dão lance ao mesmo tempo, **sem ver o lance dos outros**
  — o evento de socket só informa que cada jogador decidiu, nunca o valor.
  Isso elimina conluio: como ninguém vê o lance alheio, não dá pra combinar
  "não dou lance se você não der"
- **Lance mínimo**: 50% do preço de tabela (`LEILAO_LANCE_MINIMO_PCT`)
- **Lance vinculante**: quem vence é obrigado a comprar — não há como
  desistir depois. Um único lance por jogador por leilão (constraint
  `@@unique` no banco)
- **Empate no maior lance**: vence quem tem **menor patrimônio** (saldo +
  propriedades + casas) — mecânica de catch-up para quem está perdendo
- **Ninguém deu lance**: a propriedade continua sem dono
- **Timeout de 30s** (`LEILAO_TIMEOUT_MS`); quem não decidiu a tempo conta
  como "passou". Timer resiliente com varredura periódica (mesmo padrão
  do timer de turno) — um leilão não trava a partida mesmo se o processo
  reiniciar no meio dele
- Revelação de todos os lances **só acontece no resultado**, nunca antes
- Depois do leilão, o turno retoma: avança normalmente, ou o mesmo jogador
  joga de novo se tinha tirado duplo antes de recusar

### Prisão

- Vai para a prisão: 3 duplos seguidos, cair em "Vá para a Detenção" ou
  tirar uma carta de prisão
- Nas 2 primeiras rodadas presas: uma tentativa de duplo por rodada; se
  falhar, permanece preso e a rodada acaba
- Na 3ª rodada (última): até 3 tentativas de duplo na mesma vez; se
  todas falharem, paga a **multa de R$ 500** e sai sem se mover
- Tirar duplo a qualquer momento liberta imediatamente (fica na casa
  Prisão, sem se mover, e ganha outra jogada)
- Carta "Saia da Prisão" (ganha em carta de Sorte/Revés) pode ser usada
  a qualquer momento para sair sem pagar nem esperar

### Cartas de Sorte e Revés

Baralho de 50 cartas de Sorte + 50 de Revés, sorteadas ao cair em
"Notícias". Tipos de efeito:

| Efeito | Descrição |
|---|---|
| Ganhar dinheiro | Recebe valor fixo do banco |
| Perder dinheiro | Paga valor fixo ao banco (vira dívida se não tiver saldo) |
| Receber dos jogadores | Recebe valor fixo de cada outro jogador |
| Pagar aos jogadores | Paga valor fixo a cada outro jogador |
| Saia da Prisão | Ganha a carta (ou, se já tiver uma, ganha R$ 500 em dinheiro) |
| Vá para a prisão | Envia direto para a prisão |

### Dívidas e falência

- Quando um jogador não tem saldo suficiente para pagar aluguel,
  imposto ou carta, ele paga o que der e o restante vira uma **dívida**
  registrada — o credor recebe o valor cheio (o banco cobre a diferença)
- Dívidas pendentes contam **rodadas sem quitar**; na **3ª rodada**
  seguida sem pagar, o jogador **declara falência**: todas as suas
  propriedades voltam ao banco (sem dono, sem leilão), o saldo zera e
  ele sai da partida
- Não é possível desistir voluntariamente com dívidas pendentes
  (Modo Tabuleiro) nem com patrimônio ≥ **R$ 15.000**

### Negociações

Jogadores podem propor trocas (propriedades e/ou dinheiro dos dois
lados) para qualquer outro jogador da sessão. O alvo pode **aceitar**,
**recusar** ou enviar uma **contraproposta**. Propostas sem resposta
**expiram em 2 minutos**.

### Fim de partida e classificação

A partida termina quando o dono encerra manualmente ou automaticamente
quando **metade ou mais** dos jogadores desistiu/faliu. A colocação
final é ordenada por:

1. **Jogadores ativos até o fim**, do maior para o menor **patrimônio**
   (saldo + custo de compra das propriedades + custo das casas)
2. **Jogadores falidos**, pelo patrimônio que tinham no momento da falência
3. **Jogadores que desistiram voluntariamente**, por ordem de quem saiu
   por último primeiro

### Recompensas por partida

Ao final, cada jogador ganha coins e XP conforme a colocação:

| Posição | Coins | XP |
|---|---|---|
| 1º | 500 | 400 |
| 2º | 350 | 200 |
| 3º | 200 | 100 |
| 4º+ | 100 | 50 |

Multiplicado por bônus de duração (×1.2 partidas ≥30min, ×1.5 ≥60min).
Proteções anti-farm: nenhuma recompensa se a partida durar menos de 5
minutos, se a atividade do jogador for muito baixa (possível AFK), ou
dentro do cooldown de 20 minutos entre partidas recompensadas do mesmo
usuário. Há também um teto diário de 3.000 coins e 1.500 XP por usuário.

## Desenvolvimento

### Pré-requisitos
- Docker e Docker Compose
- Make

### Iniciar ambiente de desenvolvimento

```bash
# Subir todos os serviços (server, client, db, redis) com rebuild
make dev

# Subir em background
make dev-up

# Acompanhar logs
make dev-logs

# Parar
make dev-down
```

A aplicação fica disponível em:
- **Cliente:** http://localhost:3000
- **API:** http://localhost:7000

### Banco de dados

```bash
make db-migrate        # Rodar migrations pendentes
make db-reset          # Resetar banco do zero (apaga dados)
make db-studio         # Abrir Prisma Studio
make db-purge-users    # Remover usuários de teste
make db-backup         # Dump do banco atual
```

### Outros comandos úteis

```bash
make dev-shell SVC=server   # Shell no container do servidor
make dev-shell SVC=client   # Shell no container do cliente
make dev-restart SVC=server # Reiniciar serviço sem rebuild
make test                   # Health check HTTP
```

### Após instalar dependências

Sempre rebuild a imagem do serviço afetado:

```bash
docker compose -f docker-compose.dev.yml build --no-cache server
# ou
docker compose -f docker-compose.dev.yml build --no-cache client
```

### Variáveis de ambiente

Copiar `.env.example` para `.env` na raiz e preencher:

```env
# Banco
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...

# Admin (criado automaticamente no startup)
ADMIN_EMAIL=admin@gamebank.com
ADMIN_PASSWORD=...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_AVATAR_FOLDER=gamebank/avatars

# Redis
REDIS_URL=redis://redis:6379
```

Variáveis públicas do cliente (`NEXT_PUBLIC_*`) são injetadas via bloco `environment:` no `docker-compose.dev.yml` — não há `.env.local` no client.

## Arquitetura

### Servidor

```
Middleware (auth → room-auth → lock → validate)
  → Controller (req/res, HTTP status)
    → Service  (regras de negócio, transações, AppError)
      → Repository (queries Prisma puras)
```

Módulos em `server/src/modules/`: `admin`, `auth`, `avatar`, `badge`, `banco`, `banner`, `carta`, `divida`, `historico`, `missions`, `negociacao`, `profile`, `propriedade`, `ranking`, `session`, `shop`, `socket`, `user`.

Rotas em `server/src/api/routes/` — nunca dentro dos módulos.

### Cliente

Pages (App Router) em `client/src/app/user/`:
- `(main)/` — Dashboard, Sessões, Perfil, Ranking, Loja, Cofre, Recompensas, Nova Sessão
- `game/[sessionId]/` — Interface de jogo em tempo real

Zustand stores em `client/src/stores/` são a fonte de verdade. SWR cuida do fetching inicial; Socket.IO atualiza o estado via `session:updated`.

## Testes

Backend com Jest + Supertest, usando um banco isolado (`gamebank_test`). Rodam dentro do container:

```bash
make test-ci                       # roda toda a suíte
make dev-shell SVC=server          # ou entre no container e use:
  npm test                         # todos os testes
  npm run test:unit                # só unitários (sem banco)
  npm run test:integration         # só integração (banco de teste)
```

## Antes de fazer push

Sempre rodar antes de push para `main` (requer containers de dev rodando — `make dev-up`):

```bash
make validate      # valida tudo
make safe-push     # valida e só faz push se passar
```

O que é verificado (via Docker, banco local — nunca toca produção):
1. TypeScript sem erros (servidor e cliente)
2. Schema Prisma válido
3. Nenhuma migration com status `failed` (erro P3009)
4. Migrations sem pendências inesperadas
5. Build de produção passa (servidor e cliente)
6. Testes automatizados passam

### Instalação do hook pre-push

Após clonar o projeto, instalar o hook (não é versionado em `.git/hooks/`):

```bash
bash scripts/install-hooks.sh
```

O hook roda validações rápidas (TypeScript + Prisma + migrations) antes de cada push. A suíte completa roda no CI (GitHub Actions, `.github/workflows/validate.yml`), que dispara o deploy no Render apenas se tudo passar.

## Convenções de código

Regras detalhadas em [AGENTS.md](./AGENTS.md). Resumo:

| Área | Padrão |
|------|--------|
| **Componentes** | `export default function` + `type NomeProps` local + `index.tsx` |
| **Páginas** | `'use client'` → Zustand store → guard loading → `export default function` |
| **Store** | `create<NomeStore>()` com `loading: Record<string, boolean>` |
| **API client** | Objeto `xxxApi` + helpers `.then(res => res.data)` |
| **Server módulo** | 3 arquivos: `repository.ts` → `service.ts` → `controller.ts` |
| **Repository** | Class ou object literal, queries Prisma puras |
| **Service** | `AppError` para erros, cross-module via `new Servico()` |
| **Controller** | Object literal, Zod inline, `parseError()` helper |
| **Transações** | `$transaction([...])` (array) ou `async (tx) =>` (callback) |
| **Socket emit** | `emitUpdatedSession(sessionId)` após mutações |
| **Z-index** | `z-40` navbars, `z-100` header, `z-[200]` modais, `z-[100000]` toast |

## Licença

MIT
