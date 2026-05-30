import { prisma } from "../lib/prisma.js";
import propriedades from "../../data/propriedades.json"

const missions = [
  { name: "Primeiros Passos",       description: "Jogue sua primeira partida",                    metric: "games_played",      target: 1,   xpReward: 50,  coinReward: 10,  perGame: false },
  { name: "Veterano",               description: "Jogue 10 partidas",                             metric: "games_played",      target: 10,  xpReward: 300, coinReward: 100, perGame: false },
  { name: "Viciado",                description: "Jogue 50 partidas",                             metric: "games_played",      target: 50,  xpReward: 1000,coinReward: 500, perGame: false },
  { name: "Primeira Vitória",       description: "Vença sua primeira partida",                    metric: "wins",              target: 1,   xpReward: 100, coinReward: 30,  perGame: false },
  { name: "Campeão",                description: "Vença 3 partidas",                              metric: "wins",              target: 3,   xpReward: 500, coinReward: 150, perGame: false },
  { name: "Lenda do Top 3",         description: "Fique no Top 3 em 10 partidas",                 metric: "top3",              target: 10,  xpReward: 1000,coinReward: 300, perGame: false },
  { name: "Colecionador",           description: "Compre 5 propriedades",                         metric: "properties_bought", target: 5,   xpReward: 100, coinReward: 25,  perGame: false },
  { name: "Magnata",                description: "Compre 20 propriedades",                        metric: "properties_bought", target: 20,  xpReward: 400, coinReward: 100, perGame: false },
  { name: "Construtor",             description: "Construa 10 casas",                             metric: "houses_built",      target: 10,  xpReward: 150, coinReward: 40,  perGame: false },
  { name: "Incorporador",           description: "Construa 50 casas",                             metric: "houses_built",      target: 50,  xpReward: 600, coinReward: 200, perGame: false },
  { name: "Cobrador",               description: "Receba R$ 50.000 em aluguéis",                  metric: "rent_earned",       target: 50000,   xpReward: 200, coinReward: 50,  perGame: false },
  { name: "Usurário",               description: "Receba R$ 500.000 em aluguéis",                 metric: "rent_earned",       target: 500000,  xpReward: 1000,coinReward: 300, perGame: false },
  { name: "Monopolista",            description: "Tenha 3 grupos de cor completos em 1 partida",  metric: "full_groups",       target: 3,   xpReward: 200, coinReward: 60,  perGame: true  },
  { name: "Milionário",             description: "Termine com R$ 100.000+ de patrimônio",         metric: "patrimony",        target: 100000, xpReward: 300, coinReward: 100, perGame: true  },
];

const shopItems = [
  { name: "Título Investidor",    description: "Mostre que você investe bem",          price: 200,  icon: "faChartLine",   type: "title", value: '{"title":"Investidor"}' },
  { name: "Título Banqueiro",     description: "O dinheiro é com você",                price: 500,  icon: "faBuilding",    type: "title", value: '{"title":"Banqueiro"}' },
  { name: "Título Magnata",       description: "Propriedades são seu sobrenome",       price: 2000, icon: "faTrophy",      type: "title", value: '{"title":"Magnata"}' },
  { name: "Título Lendário",      description: "Sua fama ecoa pelo tabuleiro",         price: 5000, icon: "faCrown",      type: "title", value: '{"title":"Lendário"}' },
  { name: "Cor Rosa",             description: "Destaque-se com a cor rosa",           price: 100,  icon: "faPalette",    type: "color", value: '{"color":"pink"}' },
  { name: "Cor Ciano",            description: "Destaque-se com a cor ciano",          price: 100,  icon: "faPalette",    type: "color", value: '{"color":"cyan"}' },
  { name: "Cor Dourado",          description: "Destaque-se com a cor dourada",        price: 500,  icon: "faPalette",    type: "color", value: '{"color":"gold"}' },
  { name: "Cor Neon",             description: "Destaque-se com a cor neon",           price: 1000, icon: "faPalette",    type: "color", value: '{"color":"neon"}' },
  { name: "Badge Diamante",       description: "Um brilho que poucos têm",             price: 1000, icon: "faGem",        type: "badge", value: '{"badge":"diamond"}' },
  { name: "Badge Esmeralda",      description: "Um verde que atrai sorte",             price: 750,  icon: "faGem",        type: "badge", value: '{"badge":"emerald"}' },
  { name: "Badge Rubi",           description: "Vermelho de sangue frio",              price: 500,  icon: "faGem",        type: "badge", value: '{"badge":"ruby"}' },
];

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

  // 3️⃣ Popular missões se estiverem vazias
  const countMissoes = await prisma.mission.count()

  if (countMissoes === 0) {
    console.log("Inserindo missões...")

    await prisma.mission.createMany({
      data: missions
    })

    console.log(`${missions.length} missões criadas.`)
  }

  // 4️⃣ Popular itens da loja se estiverem vazios
  const countItens = await prisma.shopItem.count()

  if (countItens === 0) {
    console.log("Inserindo itens da loja...")

    await prisma.shopItem.createMany({
      data: shopItems
    })

    console.log(`${shopItems.length} itens da loja criados.`)
  }
}
