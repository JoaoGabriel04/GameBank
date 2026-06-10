-- =============================================================================
-- Migration: add_fragment_system_base
-- Descrição: Renomeia rarity → raridade, adiciona campos de fragmentos,
--            cria tabela user_fragments.
-- Seguro para produção: preserva todos os dados existentes.
-- =============================================================================

BEGIN;

-- ── 1. Renomear rarity → raridade (preserva valores existentes) ────────────
ALTER TABLE "loja_itens" RENAME COLUMN "rarity" TO "raridade";

-- ── 2. Mapear valores antigos para os novos ────────────────────────────────
-- super_raro/super_rare → INCOMUM
UPDATE "loja_itens"
SET "raridade" = 'INCOMUM'
WHERE "raridade" IN ('super_raro', 'super_rare');

-- raro/rare → RARO
UPDATE "loja_itens"
SET "raridade" = 'RARO'
WHERE "raridade" IN ('raro', 'rare');

-- epico/epic → EPICO
UPDATE "loja_itens"
SET "raridade" = 'EPICO'
WHERE "raridade" IN ('epico', 'epic');

-- lendario/legendary → LENDARIO
UPDATE "loja_itens"
SET "raridade" = 'LENDARIO'
WHERE "raridade" IN ('lendario', 'legendary');

-- NULL/comum/common → COMUM
UPDATE "loja_itens"
SET "raridade" = 'COMUM'
WHERE "raridade" IS NULL OR "raridade" IN ('comum', 'common');

-- ── 3. NOT NULL + DEFAULT ─────────────────────────────────────────────────
ALTER TABLE "loja_itens" ALTER COLUMN "raridade" SET NOT NULL;
ALTER TABLE "loja_itens" ALTER COLUMN "raridade" SET DEFAULT 'COMUM';

-- ── 4. Novos campos de fragmentos ─────────────────────────────────────────
ALTER TABLE "loja_itens" ADD COLUMN "fragmentavel"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "loja_itens" ADD COLUMN "fragmentosTotal" INTEGER;
ALTER TABLE "loja_itens" ADD COLUMN "fragmentosIcone" TEXT;

-- ── 5. Tabela user_fragments ──────────────────────────────────────────────
CREATE TABLE "user_fragments" (
    "id"         SERIAL    NOT NULL,
    "userId"     INTEGER   NOT NULL,
    "itemId"     INTEGER   NOT NULL,
    "quantidade" INTEGER   NOT NULL DEFAULT 0,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_fragments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_fragments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_fragments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "loja_itens"("id") ON DELETE CASCADE
);

-- ── 6. Índices ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "user_fragments_userId_itemId_key" ON "user_fragments"("userId", "itemId");
CREATE INDEX "user_fragments_userId_idx" ON "user_fragments"("userId");
CREATE INDEX "user_fragments_itemId_idx" ON "user_fragments"("itemId");

-- ── 7. Relação no User — framgments ───────────────────────────────────────
-- O Prisma gerencia relações via aplicação. Nenhuma FK extra necessária.

COMMIT;
