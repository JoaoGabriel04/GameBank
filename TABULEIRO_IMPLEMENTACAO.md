# Implementação: Modo Tabuleiro 2D — GameBank (Guia Mestre para Claude Code)

## LEIA ISTO PRIMEIRO — Como usar este documento

Este é o guia mestre da maior feature já adicionada ao GameBank: transformar
o gerenciador de banca em um jogo de tabuleiro 2D jogável. É grande demais
para uma única sessão. **Implemente uma FASE por vez**, na ordem dada,
validando cada uma antes de avançar.

**Regras invioláveis para toda fase:**
1. Rode a auditoria (Etapa 0) da fase ANTES de escrever qualquer código.
2. Não altere o Modo Banca existente — o Modo Tabuleiro é ADITIVO.
3. Siga os padrões reais do projeto (documentados na seção "Padrões" abaixo).
4. Toda rolagem de dados e sorteio é SERVER-SIDE. Nunca confie no cliente.
5. Não avance de fase sem passar os testes manuais da fase atual.
6. Preserve o padrão `withLock` em toda mutação financeira.
7. Após toda mutação de estado, chame `emitUpdatedSession(sessionId)`.

---

## PADRÕES DO PROJETO (não desviar destes)

Descobertos por auditoria do repositório. Seguir à risca:

### Backend — fluxo de camadas
```
Middleware (authenticate → room-auth → withLock → validate)
  → Controller (req/res, Zod inline, parseError)
    → Service  (regras, $transaction, AppError)
      → Repository (queries Prisma puras)
```
- Módulos em `server/src/modules/<nome>/` com 3 arquivos:
  `<nome>.repository.ts` → `<nome>.service.ts` → `<nome>.controller.ts`
- Rotas SEMPRE em `server/src/api/routes/<nome>.route.ts`, nunca no módulo.
- `withLock(resourceId, async () => {...})` em toda mutação concorrente.
  Fica em `server/src/middleware/lock.middleware.ts`.
- Erros: `throw new AppError(status, mensagem)`.
- Transações: `prisma.$transaction([...])` (array) ou `async (tx) => {}` (callback).

### Sincronização de estado (CRÍTICO)
- Fonte de verdade do cliente: **Zustand** (`client/src/stores/gameStore.ts`).
- Após QUALQUER mutação no servidor, chamar:
  ```typescript
  await emitUpdatedSession(sessionId)
  // Isso: invalida cache Redis → recarrega estado → emite "session:updated"
  ```
- O cliente escuta `session:updated` em `socketStore.ts` e atualiza o gameStore.
- `emitUpdatedSession` está em `server/src/modules/socket/socket.handler.ts`.
- Estado é cacheado em Redis (`session:cache:${sessionId}`, TTL definido).
  `invalidateCache` é chamado automaticamente por `emitUpdatedSession`.

### Eventos Socket.IO no namespace `/game`
- Já existem: `session:updated`, `session:closed`, `chat:message`,
  `notification:new`, `player:updated`, `game:vote_*`, `aluguel:toast`.
- Novos eventos de tabuleiro seguem o mesmo padrão de emit.

### Lógica de jogo que JÁ EXISTE (reutilizar, não recriar)
O gameStore já tem estas ações — o Modo Tabuleiro vai CHAMÁ-LAS
automaticamente em vez de depender do clique manual:
- `aluguel({ sessionId, pagadorId, sessionPossesId })` — pagar aluguel
- `aluguelAcao({ ..., numDados })` — aluguel de ação (depende dos dados)
- `buyProperty(propriedadeId, sessionId, userId)` — comprar propriedade
- `sortearCarta(sessionId, playerId)` — puxar Sorte/Revés
- `usarCartaPrisao(sessionId, playerId)` — sair da prisão com carta
- `receberDeTodos({ sessionId, userId })` — carta "receber de todos"
- `pagarDivida(debtId, playerId, sessionId)` — quitar dívida
- Cálculo de aluguel: `getAluguel(propriedade, casas)` no gameStore

### Convenções de frontend
- Componentes: `export default function` + `type NomeProps` + `index.tsx`
- Páginas: `'use client'` → Zustand → guard loading → export default
- Z-index: `z-40` navbars, `z-100` header, `z-[200]` modais, `z-[100000]` toast
- Animações: **GSAP** (migração de Framer Motion em andamento) — usar
  `useEffect + gsap.context() + ctx.revert()` como no BauAbertura
- Toast: `useToast()` de `@/components/Toast`

### Antes de push
`make validate` valida tudo (TS, Prisma, migrations, build, testes).
Nunca commitar sem passar.

---

## VISÃO GERAL DAS FASES

| Fase | O que faz | Risco |
|------|-----------|-------|
| 0 | Modo de sessão (banca vs tabuleiro) — flag no schema | 🟢 Baixo |
| 1 | Schema: campos de posição, turno, prisão, dívida | 🟢 Baixo |
| 2 | `tabuleiro.json` + loader | 🟢 Baixo |
| 3 | Tabuleiro visual 2D estático (zoom/pan) | 🔴 Alto (UX) |
| 4 | Sistema de turnos (ordem, vez, timeout) | 🟡 Médio |
| 5 | Dados + movimento do peão | 🟡 Médio |
| 6 | Lógica de "cair na casa" | 🔴 Alto |
| 7 | Prisão, feriado, falência | 🟡 Médio |
| 8 | Animações e polish | 🟡 Médio |

**Ordem estratégica:** a Fase 3 (tabuleiro visual) vem cedo de propósito —
é o maior risco de UX. Se o tabuleiro não funcionar bem no celular, todo o
resto perde sentido. Validar isso antes de investir na lógica pesada.

---

## FASE 0 — Modo de sessão (banca vs tabuleiro)

**Objetivo:** permitir escolher o modo ao criar a sessão, sem quebrar nada.

### Etapa 0 — Auditoria
```bash
# Ver o enum de modo atual e a criação de sessão
grep -n "SessionModo\|modo" server/prisma/schema.prisma
grep -n "createSession" server/src/modules/session/session.service.ts
grep -rn "modo.*individual\|modo.*duplas" client/src --include="*.tsx" | grep -v node_modules | head
```

### Etapa 1 — Schema
O enum `SessionModo` já existe (`individual | duplas`). Adicionar um campo
SEPARADO para o tipo de jogo (não misturar com modo de equipe):

```prisma
enum TipoJogo {
  banca       // modo atual — só gerencia dinheiro
  tabuleiro   // novo — jogo completo com tabuleiro
}

model Session {
  // ...campos existentes...
  tipoJogo TipoJogo @default(banca)
}
```

### Etapa 2 — Criação de sessão
Adicionar `tipoJogo` como parâmetro opcional em `createSession` (default
`banca` para não quebrar sessões existentes). Passar pela cadeia
controller → service → repository.

### Etapa 3 — UI de nova sessão
Na página `client/src/app/user/(main)/new-session/`, adicionar seletor:
```
Tipo de jogo:
  ○ Modo Banca      (você usa o tabuleiro físico, o app cuida do dinheiro)
  ○ Modo Tabuleiro  (jogue tudo no app, com tabuleiro digital)
```

### Testes
- [ ] Criar sessão Modo Banca funciona exatamente como antes
- [ ] Criar sessão Modo Tabuleiro salva `tipoJogo: "tabuleiro"`
- [ ] Sessões antigas continuam com `tipoJogo: "banca"` (default)
- [ ] `make validate` passa

---

## FASE 1 — Schema de tabuleiro

**Objetivo:** adicionar todos os campos que o jogo de tabuleiro precisa,
sem tocar em nada do modo banca.

### Etapa 0 — Auditoria
```bash
grep -n "model SessionPlayer\|model Session " server/prisma/schema.prisma
sed -n '162,240p' server/prisma/schema.prisma
```

### Etapa 1 — Campos em SessionPlayer
```prisma
model SessionPlayer {
  // ...campos existentes NÃO REMOVER...
  posicao            Int      @default(0)   // casa atual (0 = Início)
  emPrisao           Boolean  @default(false)
  turnosPrisao       Int      @default(0)   // rodadas restantes preso (max 3)
  tentativasPrisao   Int      @default(0)   // tentativas de duplo na rodada atual
  pularProximaRodada Boolean  @default(false) // feriado
  rodadasDevendo     Int      @default(0)   // contador de falência
  dividaBanco        Int      @default(0)   // valor devido ao banco
}
```

### Etapa 2 — Campos em Session
```prisma
model Session {
  // ...campos existentes NÃO REMOVER...
  turnoAtualPlayerId Int?      // de quem é a vez
  ordemTurnos        String?   // JSON: array de playerIds na ordem de jogo
  ultimoDado1        Int?      // último resultado (para exibição)
  ultimoDado2        Int?
  aguardandoAcao     Boolean   @default(false) // esperando decisão do jogador
  turnoIniciadoEm    DateTime? // para timeout de 60s
}
```

### Etapa 3 — Migration
```bash
make dev-shell SVC=server
# dentro do container:
npx prisma migrate dev --name add_tabuleiro_fields
```

### Testes
- [ ] Migration aplica sem erro
- [ ] Campos têm defaults corretos (sessões existentes não quebram)
- [ ] `npx prisma studio` mostra os campos novos
- [ ] `make validate` passa

---

## FASE 2 — Dados do tabuleiro

**Objetivo:** criar o mapa das 40 casas e um loader que o disponibiliza.

### Etapa 1 — Criar `server/data/tabuleiro.json`
Usar EXATAMENTE o conteúdo definido em TABULEIRO_ESPECIFICACAO.md,
seção 2 (as 40 casas com pos, nome, tipo e propId).

**ATENÇÃO ao mapeamento de nomes:** no `propriedades.json`, "Av. Vieira
Souto" está grafada "Av. Viera Souto" (id 20). Use SEMPRE o `propId`
numérico, nunca comparação por nome.

### Etapa 2 — Loader do tabuleiro
Criar `server/src/modules/tabuleiro/tabuleiro.data.ts`:
```typescript
import tabuleiroData from "../../../data/tabuleiro.json" assert { type: "json" }

export type CasaTipo =
  | "inicio" | "propriedade" | "acao" | "noticias"
  | "prisao_visita" | "restituicao" | "imposto"
  | "feriado" | "va_para_prisao"

export type Casa = {
  pos: number
  nome: string
  tipo: CasaTipo
  propId?: number
  valor?: number
}

export const TABULEIRO: Casa[] = tabuleiroData as Casa[]

export const TOTAL_CASAS = 40
export const POS_INICIO = 0
export const POS_PRISAO = 10
export const POS_VA_PARA_PRISAO = 30
export const CREDITO_INICIO = 2000
export const MULTA_PRISAO = 500

export function getCasa(pos: number): Casa {
  return TABULEIRO[pos % TOTAL_CASAS]
}
```

### Etapa 3 — Expor ao cliente
O cliente precisa do mapa para renderizar. Criar rota
`GET /api/tabuleiro` que retorna o array (é estático, cachear no cliente).
Ou incluir no payload de `loadSession` quando `tipoJogo === "tabuleiro"`.
**Preferir incluir no loadSession** para evitar request extra.

### Testes
- [ ] `tabuleiro.json` tem exatamente 40 entradas (pos 0-39)
- [ ] Todos os propId batem com propriedades existentes
- [ ] Loader importa sem erro de TypeScript
- [ ] `make validate` passa

---

## FASE 3 — Tabuleiro visual 2D (o maior desafio)

**Objetivo:** renderizar o tabuleiro com peões nas posições, com zoom/pan,
funcionando bem no celular. SEM lógica de jogo ainda — só visual.

**Por que agora:** validar o maior risco de UX antes de construir a lógica.

### Etapa 0 — Auditoria
```bash
# Ver como a página de jogo organiza abas hoje
grep -n "linksNav\|abaAtual\|Inicio\|Especiais" client/src/app/user/game/\[sessionId\]/page.tsx
# Ver bibliotecas disponíveis para zoom/pan
cat client/package.json | grep -iE "zoom|pan|gesture|motion|gsap"
```

### Etapa 1 — Layout do tabuleiro
O tabuleiro clássico é um quadrado com 11×11 casas na borda (40 casas no
perímetro). Layout com CSS Grid:
- Grid 11×11
- Cantos: pos 0 (Início, canto inferior-direito), pos 10 (Prisão,
  inferior-esquerdo), pos 20 (Feriado, superior-esquerdo), pos 30
  (Vá para Detenção, superior-direito)
- Lado inferior (direita→esquerda): pos 1-9
- Lado esquerdo (baixo→cima): pos 11-19
- Lado superior (esquerda→direita): pos 21-29
- Lado direito (cima→baixo): pos 31-39

Mapa de coordenadas grid (linha, coluna) para cada posição:
```typescript
// client/src/utils/tabuleiro-layout.ts
// Grid 11x11, casa 0 no canto inferior-direito, sentido horário anti-relógio
export function posToGrid(pos: number): { row: number; col: number } {
  if (pos <= 10) return { row: 11, col: 11 - pos }          // inferior
  if (pos <= 20) return { row: 11 - (pos - 10), col: 1 }    // esquerdo
  if (pos <= 30) return { row: 1, col: (pos - 20) + 1 }     // superior
  return { row: (pos - 30) + 1, col: 11 }                   // direito
}
```

### Etapa 2 — Componente BoardTile (casa individual)
Criar `client/src/components/Board/BoardTile/index.tsx`:
- Recebe `casa: Casa`, `posse?: SessionPosses`, `players: Player[]`
- Mostra: faixa de cor do grupo (topo), nome, preço, casas/hotéis
- Mostra donos via cor do jogador
- Casas especiais (Início, Prisão, etc.) têm visual próprio (ícone)
- Peões dos jogadores que estão nesta casa (sobrepostos)

### Etapa 3 — Componente Board (tabuleiro completo)
Criar `client/src/components/Board/index.tsx`:
- Renderiza o grid 11×11 com todos os BoardTiles
- Centro do tabuleiro: logo + dados + botão de rolar (fase futura)
- Zoom/pan: usar gesture handler. Se não houver lib, implementar com
  `transform: scale()` + `translate()` controlado por touch/wheel:
  ```typescript
  // Pinch to zoom + drag to pan
  // Guardar { scale, offsetX, offsetY } em estado
  // wheel → ajusta scale; drag → ajusta offset
  // Limitar scale entre 0.5 e 3
  ```

### Etapa 4 — Nova aba "Tabuleiro" na página de jogo
- Quando `session.tipoJogo === "tabuleiro"`, adicionar aba "Tabuleiro"
  como PRIMEIRA aba (antes de Início).
- Quando `tipoJogo === "banca"`, NÃO mostrar a aba (comportamento atual).
- Peões renderizados na `posicao` de cada player (fase 1 já tem o campo).

### Etapa 5 — Responsividade (o ponto crítico)
- Mobile: tabuleiro ocupa a largura toda, zoom/pan habilitado
- O tabuleiro inteiro cabe na tela em scale reduzido; jogador dá zoom
  para ver detalhes
- Botão "centralizar no meu peão" para reposicionar rápido
- Testar em viewport de 360px (celular pequeno)

### Testes
- [ ] Tabuleiro renderiza as 40 casas na ordem correta
- [ ] Cantos nas posições certas (0, 10, 20, 30)
- [ ] Cores dos grupos corretas em cada propriedade
- [ ] Peões aparecem na posição de cada jogador
- [ ] Zoom in/out funciona no desktop (wheel) e mobile (pinch)
- [ ] Pan (arrastar) funciona
- [ ] Legível em viewport de 360px
- [ ] Modo Banca NÃO mostra a aba Tabuleiro
- [ ] `make validate` passa

---

## FASE 4 — Sistema de turnos

**Objetivo:** controlar de quem é a vez, ordem e timeout. Sem dados ainda.

### Etapa 0 — Auditoria
```bash
grep -n "startSession" server/src/modules/session/session.service.ts
sed -n '212,272p' server/src/modules/session/session.service.ts
```

### Etapa 1 — Módulo turno
Criar `server/src/modules/turno/` (repository, service, controller):

**Ao iniciar sessão tabuleiro (`startSession`):**
- Definir `ordemTurnos` = array embaralhado de playerIds
- `turnoAtualPlayerId` = primeiro da ordem
- `turnoIniciadoEm` = agora

**Service — passar a vez:**
```typescript
async passarVez(sessionId: number, playerIdAtual: number) {
  return withLock(`turno:${sessionId}`, async () => {
    // Validar que é a vez deste jogador
    // Encontrar próximo na ordemTurnos (pulando falidos e desistentes)
    // Se próximo tem pularProximaRodada → limpar flag e pular de novo
    // Atualizar turnoAtualPlayerId + turnoIniciadoEm
    // emitUpdatedSession
  })
}
```

### Etapa 2 — Timeout de 60s
- Timer no servidor por turno. Ao criar/passar turno, agendar timeout.
- Ao expirar: emitir `turno:timeout`, passar a vez automaticamente.
- Usar `setTimeout` com referência guardada por sessionId (Map em memória),
  cancelado quando o jogador age dentro do tempo.
- **Importante:** o timer pausa quando `aguardandoAcao === true` (jogador
  decidindo comprar/vender obrigatório).

### Etapa 3 — Frontend: indicador de turno
- Destaque claro de quem está jogando ("Vez de [nome]")
- Se é a vez do jogador local: botões de ação habilitados
- Se não: "Aguarde sua vez" + countdown do timeout
- Ações permitidas fora do turno (negociar, vender casa) continuam ativas

### Testes
- [ ] Ordem de turnos embaralhada ao iniciar
- [ ] Passar a vez avança para o próximo corretamente
- [ ] Jogador falido/desistente é pulado
- [ ] Feriado pula a vez do jogador uma vez
- [ ] Timeout de 60s passa a vez automaticamente
- [ ] Timer pausa durante decisão obrigatória
- [ ] `make validate` passa

---

## FASE 5 — Dados e movimento

**Objetivo:** rolar dados (server-side) e mover o peão com animação.

### Etapa 1 — Rolagem server-side
No módulo turno, adicionar:
```typescript
async rolarDados(sessionId: number, playerId: number) {
  return withLock(`turno:${sessionId}`, async () => {
    // Validar que é a vez do jogador e que não está aguardando ação
    // Se emPrisao → desviar para lógica de prisão (fase 7)
    const dado1 = Math.floor(Math.random() * 6) + 1
    const dado2 = Math.floor(Math.random() * 6) + 1
    const duplo = dado1 === dado2
    // Salvar ultimoDado1/2
    // Calcular novaPosicao e detectar volta pelo Início
    // Aplicar crédito de Início se passou
    // Atualizar posição do player
    // Marcar aguardandoAcao = true (vai resolver a casa na fase 6)
    // Retornar { dado1, dado2, duplo, novaPosicao, passouInicio }
    // emitUpdatedSession
  })
}
```

### Etapa 2 — Detecção de volta pelo Início
```typescript
const totalAndado = dado1 + dado2
const novaPos = (posAtual + totalAndado) % TOTAL_CASAS
const passouInicio = (posAtual + totalAndado) >= TOTAL_CASAS
if (passouInicio) {
  // creditar CREDITO_INICIO (2000) ao saldo do player
}
```

### Etapa 3 — Regra de dados duplos
- Se `duplo`, o jogador joga de novo APÓS resolver a casa.
- Contar duplos consecutivos (guardar em memória ou campo temporário).
- 3 duplos seguidos → prisão imediata, sem resolver a casa, sem jogar de novo.

### Etapa 4 — Frontend: animação de dados + peão (GSAP)
- Dados rolando: animação GSAP (sprite ou números girando)
- Peão andando casa por casa: GSAP timeline movendo por cada posição
  intermediária (não teleporta — anda visualmente)
- Ao passar pelo Início, feedback visual do +R$2.000

### Testes
- [ ] Dados rolam valores 1-6 (server-side)
- [ ] Peão move o número correto de casas
- [ ] Passar pelo Início credita R$2.000 (mesmo parando nele)
- [ ] Dados duplos permitem jogar de novo
- [ ] 3 duplos → prisão
- [ ] Animação do peão anda casa por casa
- [ ] Sincroniza para todos os jogadores (testar com 2 abas)
- [ ] `make validate` passa

---

## FASE 6 — Lógica de cair na casa (o coração)

**Objetivo:** ao parar numa casa, disparar a ação correta automaticamente.

### Etapa 0 — Auditoria (reutilizar lógica existente)
```bash
# Ver as funções que já existem e serão CHAMADAS aqui
grep -n "aluguel\|buyProp\|sortearCarta\|receberDeTodos" \
  server/src/modules/propriedade/propriedade.service.ts \
  server/src/modules/banco/banco.service.ts \
  server/src/modules/carta/carta.service.ts
```

### Etapa 1 — Resolver casa
No módulo turno, após o movimento:
```typescript
async resolverCasa(sessionId: number, playerId: number) {
  const player = /* buscar player com posição */
  const casa = getCasa(player.posicao)

  switch (casa.tipo) {
    case "propriedade":
    case "acao": {
      const posse = /* buscar SessionPosses da propId nesta sessão */
      if (!posse.playerId) {
        // Sem dono → marcar aguardandoAcao, frontend oferece compra
        // Só o jogador do turno pode comprar
      } else if (posse.playerId !== playerId && !posse.hipotecada) {
        // De outro → cobrar aluguel AUTOMÁTICO
        // Reutilizar lógica de aluguel existente
        // Para "acao", usar aluguelAcao (depende de ultimoDado1+2)
        // Se saldo insuficiente → gerar dívida (fase 7)
      }
      // Própria ou hipotecada → nada
      break
    }
    case "noticias":
      // Puxar carta Sorte/Revés AUTOMÁTICO (reutilizar sortearCarta)
      // Aplicar efeito conforme carta.efeito
      break
    case "restituicao":
      // +2000 automático
      break
    case "imposto":
      // -2000 automático (pode gerar dívida)
      break
    case "feriado":
      // marcar pularProximaRodada = true
      break
    case "va_para_prisao":
      // mover para POS_PRISAO, emPrisao=true, turnosPrisao=3
      // NÃO credita Início mesmo passando
      break
    case "prisao_visita":
    case "inicio":
      // nada
      break
  }
  // Após resolver: se não aguarda ação de compra e não tirou duplo,
  // liberar para passar a vez
  // emitUpdatedSession
}
```

### Etapa 2 — Fluxo completo de um turno
```
1. Jogador clica "Rolar dados" → rolarDados()
2. Peão anima até a nova posição
3. resolverCasa() dispara automaticamente
4. Se casa exige decisão (comprar) → aguardandoAcao=true, mostra modal
5. Jogador decide (comprar/recusar) → resolve
6. Se tirou duplo → volta ao passo 1 (joga de novo)
7. Senão → botão "Passar a vez" → passarVez()
```

### Etapa 3 — Frontend: modais contextuais
- Ao cair em propriedade sem dono: modal "Comprar [nome] por R$X?"
  (só aparece para o jogador do turno)
- Ao pagar aluguel: toast automático (já existe `aluguel:toast`)
- Ao puxar carta: modal mostrando a carta e o efeito

### Testes
- [ ] Cair em propriedade sem dono oferece compra (só no turno)
- [ ] Recusar mantém sem dono
- [ ] Cair em propriedade de outro cobra aluguel automático
- [ ] Cair em propriedade hipotecada não cobra
- [ ] Cair em Notícias puxa carta e aplica efeito
- [ ] Restituição credita, Imposto debita
- [ ] Vá para Detenção move para prisão
- [ ] Ações (grupo Preto) cobram aluguel baseado nos dados
- [ ] `make validate` passa

---

## FASE 7 — Prisão, feriado e falência

**Objetivo:** completar as regras especiais.

### Etapa 1 — Lógica de prisão (rolarDados quando emPrisao)
Seguir TABULEIRO_ESPECIFICACAO.md seção 5:
- Rodadas 1-2: 1 tentativa de duplo. Duplo → sai e move. Senão turnosPrisao--
- Rodada 3: até 3 tentativas. Falhou todas → paga MULTA_PRISAO (500) e sai
- Carta `sairPrisao` liberta na hora (reutilizar usarCartaPrisao)

### Etapa 2 — Feriado
- Já marcado em resolverCasa. No passarVez/início de turno, se
  `pularProximaRodada`, limpar flag e pular a vez.

### Etapa 3 — Dívida e falência
Seguir seção 7:
- Débito sem saldo → `dividaBanco += valor`, saldo não fica negativo OU
  fica negativo conforme escolha (definir: usar campo `dividaBanco`).
- Jogador com dívida não pode desistir voluntariamente.
- A cada turno do jogador com dívida ativa: `rodadasDevendo++`.
- `rodadasDevendo >= 3` → falência: propriedades voltam ao banco (sem dono,
  sem leilão, conforme decidido), player marcado falido, removido dos turnos.
- Quitar dívida a qualquer momento zera `rodadasDevendo`.

### Testes
- [ ] Preso tenta duplo nas rodadas 1-2 (1 tentativa cada)
- [ ] Rodada 3 dá 3 tentativas, multa de 500 se falhar
- [ ] Carta sair-da-prisão liberta
- [ ] Feriado pula exatamente 1 rodada
- [ ] Débito sem saldo gera dívida
- [ ] Não pode desistir com dívida
- [ ] 3 rodadas devendo → falência, propriedades voltam ao banco
- [ ] `make validate` passa

---

## FASE 8 — Animações e polish

**Objetivo:** deixar o jogo fluido e agradável (tudo em GSAP).

- Dados rolando com física (bounce)
- Peão com movimento suave casa a casa + leve "pulo" a cada casa
- Destaque da casa atual (glow)
- Feedback de +R$2000 ao passar Início (número subindo)
- Transição de turno (nome do próximo jogador desliza)
- Efeito ao ir preso (grades descendo)
- Confete ao comprar propriedade rara

### Testes
- [ ] Animações não causam jank (testar DevTools Performance)
- [ ] GSAP limpa animações ao desmontar (ctx.revert)
- [ ] Funciona em mobile sem travar
- [ ] `make validate` passa

---

## CHECKLIST FINAL — Modo Tabuleiro completo

### Não quebrou o existente
- [ ] Modo Banca funciona 100% como antes
- [ ] Sessões antigas continuam abrindo normalmente
- [ ] Loja, cofre, ranking, missões intactos

### Fluxo completo de jogo
- [ ] Criar sessão tabuleiro → iniciar → ordem de turnos definida
- [ ] Rolar dados → mover → resolver casa → passar vez
- [ ] Comprar propriedade, pagar aluguel automático
- [ ] Cartas, impostos, restituição funcionam
- [ ] Prisão completa (ir, tentar sair, multa)
- [ ] Feriado, dívida, falência
- [ ] Negociar e vender casa a qualquer momento; comprar casa só no turno
- [ ] Tabuleiro visual legível e navegável no celular
- [ ] Tudo sincroniza em tempo real entre jogadores

### Qualidade
- [ ] Todas as rolagens e sorteios são server-side
- [ ] `withLock` em todas as mutações concorrentes
- [ ] `emitUpdatedSession` após cada mutação
- [ ] `make validate` passa
- [ ] Sem imports quebrados, sem erros de TypeScript

---

## Resumo para o Claude Code

Você está adicionando um Modo Tabuleiro ao GameBank SEM quebrar o Modo Banca
existente. A maior parte da lógica financeira (aluguel, compra, cartas,
dívida) JÁ EXISTE — seu trabalho é orquestrá-la automaticamente através de
turnos, dados e movimento, em vez de depender de cliques manuais.

Implemente FASE POR FASE, na ordem. Rode a auditoria de cada fase antes de
codar. Nunca confie no cliente para dados/sorteios. Sempre `withLock` +
`emitUpdatedSession`. Valide com `make validate` antes de cada avanço.

A referência de regras e o mapa do tabuleiro estão em
TABULEIRO_ESPECIFICACAO.md — consulte-o sempre que precisar de valores
exatos (ordem das casas, regras de prisão, falência, etc.).
