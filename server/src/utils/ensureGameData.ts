import { prisma } from "../lib/prisma.js";
import propriedades from "../../data/propriedades.json"

export async function ensureGameData() {

  // 1️⃣ Popular propriedades se estiverem vazias
  const countPropriedades = await prisma.propriedade.count()

  if (countPropriedades === 0) {
    console.log("Inserindo propriedades iniciais...")

    await prisma.propriedade.createMany({
      data: propriedades
    })

    console.log("Propriedades criadas.")
  }

  // 2️⃣ Popular posses se estiverem vazias
  const countPosses = await prisma.posses.count()

  if (countPosses === 0) {
    console.log("Inserindo posses iniciais...")

    const propriedadesDB = await prisma.propriedade.findMany()
    
    const possesData = propriedadesDB.map((prop) => ({
      id_prop: prop.id,
      casas: 0,
      hipotecada: false
    }))

    await prisma.posses.createMany({
      data: possesData
    })

    console.log("Posses criadas.")
  }

}