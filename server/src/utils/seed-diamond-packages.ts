import { prisma } from "../lib/prisma.js"
import { logger } from "../lib/logger.js"

const PACKAGES = [
  { name: "Faísca",           description: "",  diamonds: 100,  bonusPct: 0,  priceInCents: 299   },
  { name: "Cristal",          description: "",  diamonds: 250,  bonusPct: 0,  priceInCents: 699   },
  { name: "Gema",             description: "",  diamonds: 550,  bonusPct: 10, priceInCents: 1499  },
  { name: "Rubi",             description: "",  diamonds: 1200, bonusPct: 20, priceInCents: 2999  },
  { name: "Safira",           description: "",  diamonds: 2500, bonusPct: 35, priceInCents: 5999  },
  { name: "Diamante Supremo", description: "",  diamonds: 5500, bonusPct: 50, priceInCents: 11999 },
]

export async function seedDiamondPackages() {
  for (const pkg of PACKAGES) {
    const existing = await prisma.diamondPackage.findFirst({
      where: { name: pkg.name },
    })
    if (!existing) {
      await prisma.diamondPackage.create({ data: pkg })
      logger.info({ name: pkg.name }, "seed DiamondPackage criado")
    }
  }
}
