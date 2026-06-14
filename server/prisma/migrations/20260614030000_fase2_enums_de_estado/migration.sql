-- Fase 2: strings de estado -> enums nativos do Postgres.
-- Escrita à mão porque o Prisma não gera o cast text->enum automaticamente
-- (ele tentaria dropar/recriar as colunas, perdendo dados). O padrão abaixo
-- preserva os dados existentes via USING (col::text::"Enum").

-- ── CreateEnum ────────────────────────────────────────────────────────────────
CREATE TYPE "Raridade" AS ENUM ('COMUM', 'INCOMUM', 'RARO', 'EPICO', 'LENDARIO');
CREATE TYPE "ShopItemType" AS ENUM ('title', 'badge', 'banner', 'frame');
CREATE TYPE "NegotiationStatus" AS ENUM ('pendente', 'aceita', 'recusada', 'expirada');
CREATE TYPE "NotificationStatus" AS ENUM ('pendente', 'aceita', 'recusada');
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "AuditSeverity" AS ENUM ('info', 'success', 'warn', 'danger');
CREATE TYPE "BauStatus" AS ENUM ('BLOQUEADO', 'PRONTO');
CREATE TYPE "FrameTipo" AS ENUM ('image', 'gradient');
CREATE TYPE "MissionTipo" AS ENUM ('daily', 'weekly');
CREATE TYPE "MissionMetric" AS ENUM ('properties_bought', 'houses_built', 'rent_earned', 'games_played', 'wins', 'top3');
CREATE TYPE "SessionModo" AS ENUM ('individual', 'duplas');

-- ── AlterColumn: sessions.modo (default 'individual') ─────────────────────────
ALTER TABLE "sessions" ALTER COLUMN "modo" DROP DEFAULT;
ALTER TABLE "sessions" ALTER COLUMN "modo" TYPE "SessionModo" USING ("modo"::text::"SessionModo");
ALTER TABLE "sessions" ALTER COLUMN "modo" SET DEFAULT 'individual';

-- ── AlterColumn: notifications.status (default 'pendente') ────────────────────
ALTER TABLE "notifications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "status" TYPE "NotificationStatus" USING ("status"::text::"NotificationStatus");
ALTER TABLE "notifications" ALTER COLUMN "status" SET DEFAULT 'pendente';

-- ── AlterColumn: negociacoes.status (default 'pendente') ──────────────────────
ALTER TABLE "negociacoes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "negociacoes" ALTER COLUMN "status" TYPE "NegotiationStatus" USING ("status"::text::"NegotiationStatus");
ALTER TABLE "negociacoes" ALTER COLUMN "status" SET DEFAULT 'pendente';

-- ── AlterColumn: missoes.metric (sem default) ─────────────────────────────────
ALTER TABLE "missoes" ALTER COLUMN "metric" TYPE "MissionMetric" USING ("metric"::text::"MissionMetric");

-- ── AlterColumn: missoes.tipo (default 'daily') ──────────────────────────────
ALTER TABLE "missoes" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "missoes" ALTER COLUMN "tipo" TYPE "MissionTipo" USING ("tipo"::text::"MissionTipo");
ALTER TABLE "missoes" ALTER COLUMN "tipo" SET DEFAULT 'daily';

-- ── AlterColumn: loja_itens.raridade (default 'COMUM') ────────────────────────
ALTER TABLE "loja_itens" ALTER COLUMN "raridade" DROP DEFAULT;
ALTER TABLE "loja_itens" ALTER COLUMN "raridade" TYPE "Raridade" USING ("raridade"::text::"Raridade");
ALTER TABLE "loja_itens" ALTER COLUMN "raridade" SET DEFAULT 'COMUM';

-- ── AlterColumn: loja_itens.type (sem default) ───────────────────────────────
ALTER TABLE "loja_itens" ALTER COLUMN "type" TYPE "ShopItemType" USING ("type"::text::"ShopItemType");

-- ── AlterColumn: diamond_purchases.status (sem default) ──────────────────────
ALTER TABLE "diamond_purchases" ALTER COLUMN "status" TYPE "PurchaseStatus" USING ("status"::text::"PurchaseStatus");

-- ── AlterColumn: audit_logs.severity (default 'info') ────────────────────────
ALTER TABLE "audit_logs" ALTER COLUMN "severity" DROP DEFAULT;
ALTER TABLE "audit_logs" ALTER COLUMN "severity" TYPE "AuditSeverity" USING ("severity"::text::"AuditSeverity");
ALTER TABLE "audit_logs" ALTER COLUMN "severity" SET DEFAULT 'info';

-- ── AlterColumn: baus_adquiridos.status (default 'BLOQUEADO') ─────────────────
ALTER TABLE "baus_adquiridos" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "baus_adquiridos" ALTER COLUMN "status" TYPE "BauStatus" USING ("status"::text::"BauStatus");
ALTER TABLE "baus_adquiridos" ALTER COLUMN "status" SET DEFAULT 'BLOQUEADO';

-- ── AlterColumn: frames.tipo (default 'gradient') ────────────────────────────
ALTER TABLE "frames" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "frames" ALTER COLUMN "tipo" TYPE "FrameTipo" USING ("tipo"::text::"FrameTipo");
ALTER TABLE "frames" ALTER COLUMN "tipo" SET DEFAULT 'gradient';
