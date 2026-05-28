-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propriedades" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo_cor" TEXT NOT NULL,
    "custo_compra" INTEGER NOT NULL,
    "aluguel_base" INTEGER NOT NULL,
    "aluguel_1c" INTEGER NOT NULL,
    "aluguel_2c" INTEGER NOT NULL,
    "aluguel_3c" INTEGER NOT NULL,
    "aluguel_4c" INTEGER NOT NULL,
    "aluguel_hotel" INTEGER NOT NULL,
    "custo_casa" INTEGER NOT NULL,
    "hipoteca" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "propriedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posses" (
    "id" SERIAL NOT NULL,
    "id_prop" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "casas" INTEGER NOT NULL,
    "hipotecada" BOOLEAN NOT NULL,

    CONSTRAINT "Posses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Historico" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalhes" TEXT NOT NULL,

    CONSTRAINT "Historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_nome_key" ON "users"("nome");

-- AddForeignKey
ALTER TABLE "Posses" ADD CONSTRAINT "Posses_id_prop_fkey" FOREIGN KEY ("id_prop") REFERENCES "propriedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posses" ADD CONSTRAINT "Posses_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
