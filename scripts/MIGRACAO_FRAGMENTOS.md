# Migration segura — Sistema de Fragmentos

## Passo 1 — Verificar estado atual do banco

Conecte no banco de produção e confirme a coluna atual:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'loja_itens' AND column_name = 'rarity';
```

Se retornar uma linha com `rarity`, pode prosseguir.

---

## Passo 2 — Aplicar a migration

Execute **dentro do container server** ou diretamente no banco:

```bash
make dev-shell SVC=server
```

Cole o SQL abaixo no `psql` (ou execute via `\i`):

```sql
BEGIN;

-- 1. Renomear rarity → raridade (preserva valores)
ALTER TABLE "loja_itens" RENAME COLUMN "rarity" TO "raridade";

-- 2. Mapear valores antigos → novos
UPDATE "loja_itens" SET "raridade" = 'INCOMUM'  WHERE "raridade" IN ('super_raro', 'super_rare');
UPDATE "loja_itens" SET "raridade" = 'RARO'     WHERE "raridade" IN ('raro', 'rare');
UPDATE "loja_itens" SET "raridade" = 'EPICO'    WHERE "raridade" IN ('epico', 'epic');
UPDATE "loja_itens" SET "raridade" = 'LENDARIO' WHERE "raridade" IN ('lendario', 'legendary');
UPDATE "loja_itens" SET "raridade" = 'COMUM'    WHERE "raridade" IS NULL OR "raridade" IN ('comum', 'common');

-- 3. NOT NULL + default
ALTER TABLE "loja_itens" ALTER COLUMN "raridade" SET NOT NULL;
ALTER TABLE "loja_itens" ALTER COLUMN "raridade" SET DEFAULT 'COMUM';

-- 4. Novos campos de fragmento
ALTER TABLE "loja_itens" ADD COLUMN "fragmentavel"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "loja_itens" ADD COLUMN "fragmentosTotal" INTEGER;
ALTER TABLE "loja_itens" ADD COLUMN "fragmentosIcone" TEXT;

-- 5. Tabela user_fragments
CREATE TABLE "user_fragments" (
    "id"         SERIAL       NOT NULL,
    "userId"     INTEGER      NOT NULL,
    "itemId"     INTEGER      NOT NULL,
    "quantidade" INTEGER      NOT NULL DEFAULT 0,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_fragments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_fragments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_fragments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "loja_itens"("id") ON DELETE CASCADE
);

-- 6. Índices
CREATE UNIQUE INDEX "user_fragments_userId_itemId_key" ON "user_fragments"("userId", "itemId");
CREATE INDEX "user_fragments_userId_idx" ON "user_fragments"("userId");
CREATE INDEX "user_fragments_itemId_idx" ON "user_fragments"("itemId");

COMMIT;
```

---

## Passo 3 — Avisar o Prisma que a migration foi aplicada

```bash
npx prisma migrate resolve --applied 20260610000001_add_fragment_system_base
```

Isso cria o registro na tabela `_prisma_migrations` sem rodar nada.

---

## Passo 4 — Regenerar o client

```bash
npx prisma generate
```

---

## Passo 5 — Verificar

Confira que o Prisma está feliz:

```bash
npx prisma migrate status
```

Deverá mostrar "Database schema is up to date".

---

## Rollback (se der ruim)

```sql
BEGIN;
DROP TABLE IF EXISTS "user_fragments";
ALTER TABLE "loja_itens" DROP COLUMN IF EXISTS "fragmentavel";
ALTER TABLE "loja_itens" DROP COLUMN IF EXISTS "fragmentosTotal";
ALTER TABLE "loja_itens" DROP COLUMN IF EXISTS "fragmentosIcone";
ALTER TABLE "loja_itens" RENAME COLUMN "raridade" TO "rarity";
ALTER TABLE "loja_itens" ALTER COLUMN "rarity" DROP NOT NULL;
ALTER TABLE "loja_itens" ALTER COLUMN "rarity" DROP DEFAULT;
COMMIT;
```

Depois:
```bash
npx prisma migrate resolve --rolled-back 20260610000001_add_fragment_system_base
```

---

## Mapeamento de valores

| Valor antigo | Novo valor |
|---|---|
| `NULL` / `comum` / `common` | `COMUM` |
| `super_raro` / `super_rare` | `INCOMUM` |
| `raro` / `rare` | `RARO` |
| `epico` / `epic` | `EPICO` |
| `lendario` / `legendary` | `LENDARIO` |
