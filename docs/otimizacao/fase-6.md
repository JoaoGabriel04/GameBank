# Fase 6: boot, fontes locais, higiene e métricas (P3)

> Referência: `docs/geral/OTIMIZACAO_SISTEMA.md`, seção 2 (P3) e seção 4. Fases anteriores: `fase-1.md` a `fase-5.md`.
> Inclui também a correção do logout por 429 encontrado na Fase 5 (`fase-5.md`, "Observação de método").

## O que mudou

| Commit | Item | Mudança |
|---|---|---|
| `55b75aa` | achado da Fase 5 | O limiter de `/api/auth` (20 req / 15 min, contra força bruta) deixa de contar o `GET /me`, que já exige JWT e continua no limiter geral (300/min). O `AuthGuard` passa a deslogar só com **401**; 429 e 5xx são transitórios. |
| `4de20b9` + `276f1fb` | higiene | Saem do versionamento: `node_modules/` da raiz (759 arquivos), `package.json` e `package-lock.json` da raiz (só declaravam `dotenv`, `lenis` e `zod`, já declarados no cliente/servidor), `server/client-economia-core.ts` (arquivo vazio criado pelo bind mount do compose de dev) e 5 `*:Zone.Identifier`. O `.gitignore` passa a cobri-los. Os arquivos **continuam no disco**. |
| `185b2cc` | fontes | `next/font/google` → `next/font/local`. Os woff2 do subset latin (Jaro 400, Inconsolata variável 200–900) ficam em `client/public/fonts`. As variáveis CSS não mudam. |
| `ed9f249` | boot | `entrypoint.prod.sh` e `npm start` chamam o binário local do Prisma em vez de `npx`. |
| `6052c46` | observabilidade | `emitirSnapshotAgora` loga tempo de reconstrução e bytes do payload de cada `session:updated`: `debug` normalmente, `warn` acima de 500 ms ou 30 KB. |

## Medições

### Limiter de `/api/auth`

Servidor de dev reiniciado (limiter em memória), 25 × `GET /auth/me` com token inválido, depois 22 × `POST /auth/login`:

| | Antes | Depois |
|---|---|---|
| `/auth/me` | 429 a partir da 21ª e o `AuthGuard` deslogava (pela configuração do limiter e pelo observado na Fase 5; não remedido aqui) | 401 nas 25 |
| `/auth/login` | 429 a partir da 21ª | 429 a partir da 21ª (proteção mantida) |

### Build offline

`next build` do cliente num container com `--network none`: **conclui** (antes quebrava no fetch do Google Fonts, reproduzido na auditoria). As duas fontes saem em `.next/static/media` com preload, e o CSS compilado mantém `.font-jaro{font-family:var(--font-jaro-next),sans-serif}`.

### Boot do servidor

`prisma migrate status` no container de dev (conecta no banco, como o `migrate deploy` do boot), 3 execuções:

| | npx | binário local |
|---|---|---|
| Tempos | 2,8 / 3,7 / 3,4 s | 2,5 / 2,6 / 2,4 s |

Ganho de 0,3–1,2 s por boot. O resto do tempo é o próprio Prisma (carregar o engine e conectar), que só sai do boot se as migrations virarem uma etapa separada do deploy no Render. Isso depende da configuração do serviço no painel e ficou para depois.

### Broadcasts (métrica nova)

Partida real com 4 bots (`medir-partida.mjs`, 15 rodadas, sessão 137), lida do log do servidor:

| Broadcasts | Tempo p50 / p95 / máx | Bytes p50 / p95 / máx | Avisos (`warn`) |
|---|---|---|---|
| 174 | 7 / 38 / 67 ms | 13,0 / 13,3 / 13,3 KB | 0 |

O tamanho bate com o medido no cliente pelo script (p50 de 13.041 bytes). A meta de broadcast típico abaixo de 15 KB continua atendida.

## O que não foi feito

- **Contagem de queries por requisição** em produção: exigiria instrumentar o Prisma Client. Para investigar, continua valendo o `scripts/otimizacao/contar-queries.mjs`.
- **Dockerfile do cliente × Netlify**: o cliente de produção vai pela Netlify (`client/netlify.toml`). O `client/Dockerfile` só serve ao `docker-compose.yml` (stack de produção local) e foi mantido.
- **Apagar do disco** o `node_modules/`, o `package.json` e o `package-lock.json` da raiz: estão fora do Git, mas o `package-lock.json` local ainda faz o Next avisar "multiple lockfiles" até ser apagado à mão.

## Verificação

- `make validate` verde antes do push.
- `tsc --noEmit` do servidor sem erros com a métrica nova.
