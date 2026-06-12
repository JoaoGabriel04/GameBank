# Fix: distribuição de Ofertas do Dia

## Problema
- Cada refresh muda os itens (shuffle rodando sem semente fixa — esperado)
- Aparecem só 5 ofertas em vez de 6
- A ordem de prioridade não é respeitada (ex: 3 épicos, 0 comuns)

## Causa raiz

`server/src/modules/shop/daily-offers.service.ts:92`

```ts
picks.push(...pickN("EPICO", 6 - picks.length, used));
```

Numa situação onde o usuário tem poucos Comuns/Incomuns (ex: 0 Comum, 1 Incomum, 1 Raro), `picks.length` é 2, então `6 - 2 = 4` — puxa **até 4 épicos** de uma vez. Se existem 3 épicos no pool, pega os 3 e esgota. O fill step seguinte não acha mais nada, total = 5.

## Fix
Trocar `pickN("EPICO", 6 - picks.length, used)` por `pickN("EPICO", 1, used)` — respeita a cota de 1 item Épico/Lendário, deixando o fill step completar o resto.

## Fluxo corrigido (exemplo: 0C + 1I + 1R + 4E disponíveis)

| Passo | Pega | Acumulado |
|---|---|---|
| `pickN("COMUM", 2)` | 0 | 0 |
| `pickN("INCOMUM", 2)` | 1 | 1 |
| `pickN("RARO", 1)` | 1 | 2 |
| 10% Lendário / `pickN("EPICO", 1)` | 1 | 3 |
| Fill `(6 - 3 = 3)` — qualquer raridade | 3 | 6 ✅ |

## Arquivo
- `server/src/modules/shop/daily-offers.service.ts` — linha 92, mudar `6 - picks.length` → `1`

## Verificação
- Build server: `npx tsc --noEmit`
- Pre-push hook
- Refresh na loja com usuário que tem muitos fragmentáveis
