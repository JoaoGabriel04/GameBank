import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/index.js";
import propriedades from "../../data/propriedades.json"
import { logger } from "../lib/logger.js";

const shopItems = [
  { name: "Título Investidor",    description: "Mostre que você investe bem",          price: 200,  icon: "faChartLine",   type: "title", value: '{"title":"Investidor"}',  raridade: "COMUM",    fragmentavel: true, fragmentosTotal: 5  },
  { name: "Título Banqueiro",     description: "O dinheiro é com você",                price: 500,  icon: "faBuilding",    type: "title", value: '{"title":"Banqueiro"}',   raridade: "COMUM",    fragmentavel: true, fragmentosTotal: 10 },
  { name: "Título Magnata",       description: "Propriedades são seu sobrenome",       price: 2000, icon: "faTrophy",      type: "title", value: '{"title":"Magnata"}',     raridade: "COMUM",    fragmentavel: true, fragmentosTotal: 20 },
  { name: "Título Lendário",      description: "Sua fama ecoa pelo tabuleiro",         price: 5000, icon: "faCrown",      type: "title", value: '{"title":"Lendário"}',    raridade: "COMUM",    fragmentavel: true, fragmentosTotal: 50 },
  { name: "Medalha de Bronze",    description: "Uma medalha de bronze reluzente",      price: 0,    icon: null,          type: "badge", raridade: "COMUM",              fragmentavel: true, fragmentosTotal: 10 },
  { name: "Medalha de Prata",     description: "Uma medalha de prata brilhante",       price: 0,    icon: null,          type: "badge", raridade: "INCOMUM",            fragmentavel: true, fragmentosTotal: 25 },
  { name: "Medalha de Ouro",      description: "Uma medalha de ouro cintilante",       price: 0,    icon: null,          type: "badge", raridade: "RARO",               fragmentavel: true, fragmentosTotal: 40 },
  { name: "Medalha de Platina",   description: "Uma medalha de platina rara",          price: 0,    icon: null,          type: "badge", raridade: "EPICO",              fragmentavel: true, fragmentosTotal: 60 },
  { name: "Medalha de Diamante",  description: "Uma medalha de diamante lendária",     price: 0,    icon: null,          type: "badge", raridade: "LENDARIO",           fragmentavel: true, fragmentosTotal: 100 },
];

export async function ensureGameData() {

  // 1️⃣ Popular propriedades se estiverem vazias
  const countPropriedades = await prisma.propriedade.count()

  if (countPropriedades === 0) {
    logger.info("seed inserindo propriedades iniciais")

    await prisma.propriedade.createMany({
      data: propriedades
    })

    logger.info("seed propriedades criadas")
  }

  // 2️⃣ Popular itens da loja se estiverem vazios
  const countItens = await prisma.shopItem.count()

  if (countItens === 0) {
    logger.info("seed inserindo itens da loja")

    await prisma.shopItem.createMany({
      data: shopItems as Prisma.ShopItemCreateManyInput[]
    })

    logger.info({ count: shopItems.length }, "seed itens da loja criados")
  }
}
