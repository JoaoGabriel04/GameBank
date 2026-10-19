# Fase 1: segurança operacional (P0.1 e P0.2)

> Referência: `docs/geral/OTIMIZACAO_SISTEMA.md`, seção 4. Baseline em `docs/otimizacao/baseline.md`.

## P0.1: boot de produção sem `db push --accept-data-loss` (commit `ec6a8da`)

| | Antes | Depois |
|---|---|---|
| `migrate deploy` falha | Apagava uma linha fixa de `_prisma_migrations`, tentava de novo e, se falhasse, rodava `prisma db push --accept-data-loss` (podia apagar colunas e dados) | O boot **aborta** (exit 1, o Render mantém a versão anterior no ar) e o Sentry recebe um alerta `fatal` (`server/scripts/alertar-falha-boot.mjs`) |
| Migration `20260608000001_add_animated_flag` | Motivo original da gambiarra | Já estava idempotente desde `a263679` (`IF NOT EXISTS` em `loja_itens`); nada a mudar no SQL |
| Recuperação de uma migration com falha | Automática e destrutiva | Manual: `npx prisma migrate resolve --rolled-back <nome>` (instrução no próprio script) |

Verificado no container do servidor:

| Cenário | Resultado |
|---|---|
| Banco inacessível (`127.0.0.1:1`) | `P1001` → "abortando o boot" → alerta chamado → **exit 1**, sem `db push` |
| Banco real | "Migrations aplicadas com sucesso" → "servidor iniciado" |

## P0.2: `withLock` com dono, espera e fallback (commit `e52a074`)

| | Antes | Depois |
|---|---|---|
| Lock ocupado | 423 **imediato** | Espera até ~1,5s (backoff exponencial de 25 a 200 ms + jitter); 423 só depois disso |
| Liberação | `DEL` sem conferir o dono | Script Lua: só apaga se o token for o da aquisição |
| Ação que passa do TTL (10s) | Apagava o lock de quem pegou depois; duas ações em paralelo | Não toca no lock alheio; loga `lock expirou antes de a ação terminar` |
| Sem Redis | **Nenhum lock** | Lock em memória com o mesmo contrato (token, TTL, espera) |
| TTL | Fixo | 10s padrão, configurável por chamada (`{ ttlMs }`) |

### Duplo clique contra o servidor real (com Redis)

`scripts/otimizacao/duplo-clique.mjs`: 40 jogadas, 3 bots, cada ação disparada duas vezes ao mesmo tempo.

| Segunda requisição | Antes (sessão 120) | Depois (sessão 121) |
|---|---|---|
| **423 "Recurso ocupado"** | **45 de 45** | **0** |
| 400/403 de negócio ("não há escolha pendente", "não é sua vez"...) | 0 | 38 |
| 200 (revelar, idempotente) | 0 | 5 |
| 200 (rolar) | 0 | 2 (ver abaixo) |

**Rolar na prisão:** a prisão permite até 3 tentativas de duplo no mesmo turno, então a segunda rolagem válida é uma segunda tentativa legítima, que antes o 423 escondia. No jogo real o botão "Rolar" já bloqueia o duplo clique no cliente (`if (rolando) return` em `Board`).

### Testes (`server/src/__tests__/unit/lock.test.ts`)

Os mesmos 4 cenários rodam **sem Redis** (lock em memória) e **com Redis**: 8 testes.
1. Duplo clique: a segunda chamada espera e as duas rodam em série, sem 423.
2. O 423 só sai depois de ~1,5s de espera.
3. Quem passou do TTL não libera o lock de quem pegou depois.
4. O lock é liberado quando a ação lança erro.

`make validate` verde antes de cada push.

### O que não foi remedido

A latência sem disputa pelo lock não muda: continuam sendo 2 comandos no Redis por ação (`SET NX` e `EVAL` no lugar de `SET NX` e `DEL`). A medição completa de latência volta na Fase 3, onde o número de queries por jogada muda.
