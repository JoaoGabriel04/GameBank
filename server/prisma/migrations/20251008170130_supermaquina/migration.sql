/*
  Warnings:

  - You are about to drop the column `tipo` on the `propriedades` table. All the data in the column will be lost.
  - You are about to drop the `Historico` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Posses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Posses" DROP CONSTRAINT "Posses_id_prop_fkey";

-- DropForeignKey
ALTER TABLE "public"."Posses" DROP CONSTRAINT "Posses_id_user_fkey";

-- AlterTable
ALTER TABLE "propriedades" DROP COLUMN "tipo";

-- DropTable
DROP TABLE "public"."Historico";

-- DropTable
DROP TABLE "public"."Posses";

-- CreateTable
CREATE TABLE "acoes" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo_cor" TEXT NOT NULL,
    "custo_compra" INTEGER NOT NULL,
    "aluguel" INTEGER NOT NULL,
    "hipoteca" INTEGER NOT NULL,

    CONSTRAINT "acoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posses" (
    "id" SERIAL NOT NULL,
    "id_prop" INTEGER NOT NULL,
    "id_acao" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "casas" INTEGER NOT NULL,
    "hipotecada" BOOLEAN NOT NULL,

    CONSTRAINT "posses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalhes" TEXT NOT NULL,

    CONSTRAINT "historico_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "posses" ADD CONSTRAINT "posses_id_prop_fkey" FOREIGN KEY ("id_prop") REFERENCES "propriedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posses" ADD CONSTRAINT "posses_id_acao_fkey" FOREIGN KEY ("id_acao") REFERENCES "acoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posses" ADD CONSTRAINT "posses_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
