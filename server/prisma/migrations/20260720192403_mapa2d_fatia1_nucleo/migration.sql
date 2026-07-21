-- CreateEnum
CREATE TYPE "CategoriaRegiao" AS ENUM ('comum', 'mediana', 'rica');

-- CreateEnum
CREATE TYPE "TipoConstrucao" AS ENUM ('casa', 'sobrado', 'comercio', 'apartamento', 'centro_comercial', 'hotel', 'corporativo');

-- AlterEnum
ALTER TYPE "TipoJogo" ADD VALUE 'mapa2d';

-- AlterTable
ALTER TABLE "session_players" ADD COLUMN     "reputacao" DOUBLE PRECISION NOT NULL DEFAULT 3.0;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "fecharMesEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "terrenos_mapa2d" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "regiaoNome" TEXT NOT NULL,
    "categoria" "CategoriaRegiao" NOT NULL,
    "multiplicador" DOUBLE PRECISION NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "precoBase" INTEGER NOT NULL,

    CONSTRAINT "terrenos_mapa2d_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_terrenos_mapa2d" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "terrenoId" INTEGER NOT NULL,
    "donoId" INTEGER,
    "precoPago" INTEGER,
    "adquiridoEm" TIMESTAMP(3),

    CONSTRAINT "session_terrenos_mapa2d_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construcoes_mapa2d" (
    "id" SERIAL NOT NULL,
    "sessionTerrenoId" INTEGER NOT NULL,
    "tipo" "TipoConstrucao" NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "aluguelPedido" INTEGER NOT NULL DEFAULT 0,
    "ocupado" BOOLEAN NOT NULL DEFAULT false,
    "construidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "construcoes_mapa2d_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terrenos_mapa2d_codigo_key" ON "terrenos_mapa2d"("codigo");

-- CreateIndex
CREATE INDEX "session_terrenos_mapa2d_sessionId_idx" ON "session_terrenos_mapa2d"("sessionId");

-- CreateIndex
CREATE INDEX "session_terrenos_mapa2d_donoId_idx" ON "session_terrenos_mapa2d"("donoId");

-- CreateIndex
CREATE UNIQUE INDEX "session_terrenos_mapa2d_sessionId_terrenoId_key" ON "session_terrenos_mapa2d"("sessionId", "terrenoId");

-- CreateIndex
CREATE UNIQUE INDEX "construcoes_mapa2d_sessionTerrenoId_key" ON "construcoes_mapa2d"("sessionTerrenoId");

-- AddForeignKey
ALTER TABLE "session_terrenos_mapa2d" ADD CONSTRAINT "session_terrenos_mapa2d_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_terrenos_mapa2d" ADD CONSTRAINT "session_terrenos_mapa2d_terrenoId_fkey" FOREIGN KEY ("terrenoId") REFERENCES "terrenos_mapa2d"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_terrenos_mapa2d" ADD CONSTRAINT "session_terrenos_mapa2d_donoId_fkey" FOREIGN KEY ("donoId") REFERENCES "session_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construcoes_mapa2d" ADD CONSTRAINT "construcoes_mapa2d_sessionTerrenoId_fkey" FOREIGN KEY ("sessionTerrenoId") REFERENCES "session_terrenos_mapa2d"("id") ON DELETE CASCADE ON UPDATE CASCADE;
