import { BAU_CONFIG, FRAGMENTOS_PESO, XP_BONUS, type TipoBau, type Raridade } from "../../constants/baus.js"
import { bauRepository } from "./bau.repository.js"
import { AppError }      from "../../middleware/error-handler.middleware.js"
import { prisma }        from "../../lib/prisma.js"
import { parseUserItems } from "../shop/shop.repository.js"
import { addXp }         from "../../utils/level.js"

function sortearPonderado<T extends { peso: number }>(opcoes: T[]): T {
  const total = opcoes.reduce((sum, o) => sum + o.peso, 0)
  let rand = Math.random() * total
  for (const opcao of opcoes) {
    rand -= opcao.peso
    if (rand <= 0) return opcao
  }
  return opcoes[opcoes.length - 1]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function distribuirFragmentos(
  itens: { id: number; raridade: Raridade }[],
  fragmentosTotal: number
): Map<number, number> {
  const resultado = new Map<number, number>()

  if (itens.length === 0) return resultado

  let restantes = fragmentosTotal - itens.length
  if (restantes < 0) restantes = 0
  itens.forEach(i => resultado.set(i.id, 1))

  if (restantes === 0) return resultado

  const pesoTotal = itens.reduce((sum, i) => sum + FRAGMENTOS_PESO[i.raridade], 0)
  itens.forEach(item => {
    const extra = Math.floor((FRAGMENTOS_PESO[item.raridade] / pesoTotal) * restantes)
    resultado.set(item.id, (resultado.get(item.id) ?? 1) + extra)
  })

  const totalDistribuido = Array.from(resultado.values()).reduce((a, b) => a + b, 0)
  const diferenca = fragmentosTotal - totalDistribuido
  if (diferenca > 0) {
    resultado.set(itens[0].id, (resultado.get(itens[0].id) ?? 1) + diferenca)
  }

  return resultado
}

export class BauService {
  async listar() {
    return bauRepository.findAllAtivos()
  }

  async historico(userId: number) {
    return bauRepository.findHistoricoUsuario(userId)
  }

  async abrir(userId: number, tipo: TipoBau) {
    const config = BAU_CONFIG[tipo]
    if (!config) throw new AppError(400, "Tipo de baú inválido")

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, diamonds: true, user_items: true },
    })
    if (!user) throw new AppError(404, "Usuário não encontrado")

    if (config.precoCoins && user.coins < config.precoCoins) {
      throw new AppError(400, `Coins insuficientes. Necessário: ${config.precoCoins}`)
    }
    if (config.precoDiamonds && user.diamonds < config.precoDiamonds) {
      throw new AppError(400, `Diamantes insuficientes. Necessário: ${config.precoDiamonds}`)
    }

    const ownedItemIds = new Set(parseUserItems(user.user_items).map(r => r.item_id))
    const bau = await bauRepository.findBauByTipo(tipo)
    if (!bau) throw new AppError(500, "Baú não encontrado no banco")

    const coinsGanhos = randInt(config.coinsMin, config.coinsMax)
    const fragmentosTotal = randInt(config.fragmentosMin, config.fragmentosMax)
    const qtdItens = randInt(config.itensMin, config.itensMax)

    type ItemSorteado = {
      id: number
      raridade: Raridade
      name: string
      type: string
      value: string | null
      imageUrl: string | null
      fragmentosTotal: number | null
      animated: boolean
    }

    const itensSorteados: ItemSorteado[] = []
    const idsUsados = new Set<number>()
    const ORDEM_RARIDADES: Raridade[] = ["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"]

    for (let i = 0; i < qtdItens; i++) {
      const { raridade } = sortearPonderado(config.probabilidadesRaridade)
      const idx = ORDEM_RARIDADES.indexOf(raridade)

      const deltas = [0]
      for (let step = 1; step < 5; step++) {
        deltas.push(step)
        deltas.push(-step)
      }

      let itemEncontrado: ItemSorteado | null = null
      for (const delta of deltas) {
        const rIdx = idx + delta
        if (rIdx < 0 || rIdx >= ORDEM_RARIDADES.length) continue
        const r = ORDEM_RARIDADES[rIdx]
        const candidatos = await bauRepository.findItensDisponiveisPorRaridade(r, ownedItemIds)
        const disponiveis = candidatos.filter(c => !idsUsados.has(c.id))
        if (disponiveis.length > 0) {
          const item = disponiveis[randInt(0, disponiveis.length - 1)]
          idsUsados.add(item.id)
          itemEncontrado = { ...item, raridade: r }
          break
        }
      }

      if (itemEncontrado) {
        itensSorteados.push(itemEncontrado)
      }
    }

    const temFragmentosPendentes = itensSorteados.length > 0

    let xpBonus = 0
    const xpConfig = XP_BONUS[tipo]
    if (!temFragmentosPendentes && xpConfig) {
      xpBonus = randInt(xpConfig.min, xpConfig.max)
    }

    const comXp = temFragmentosPendentes ? itensSorteados : []
    const distribuicao = distribuirFragmentos(
      comXp.map(i => ({ id: i.id, raridade: i.raridade })),
      xpBonus > 0 ? 0 : fragmentosTotal
    )

    const itensCompletos: number[] = []

    await prisma.$transaction(async (tx) => {
      if (config.precoCoins) {
        await tx.user.update({
          where: { id: userId },
          data: { coins: { decrement: config.precoCoins } },
        })
      }
      if (config.precoDiamonds) {
        await tx.user.update({
          where: { id: userId },
          data: { diamonds: { decrement: config.precoDiamonds } },
        })
      }

      await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: coinsGanhos } },
      })

      if (xpBonus > 0) {
        const userAtual = await tx.user.findUnique({
          where: { id: userId },
          select: { xp: true, level: true },
        })
        if (userAtual) {
          const { xp, level } = addXp(userAtual.xp, userAtual.level, xpBonus)
          await tx.user.update({
            where: { id: userId },
            data: { xp, level },
          })
        }
      }

      for (const item of comXp) {
        const qtdFrags = distribuicao.get(item.id) ?? 1

        await tx.userFragment.upsert({
          where: { userId_itemId: { userId, itemId: item.id } },
          create: { userId, itemId: item.id, quantidade: qtdFrags },
          update: { quantidade: { increment: qtdFrags } },
        })

        const fragmentoAtual = await tx.userFragment.findUnique({
          where: { userId_itemId: { userId, itemId: item.id } },
        })
        const totalNecessario = item.fragmentosTotal ?? 999

        if (fragmentoAtual && fragmentoAtual.quantidade >= totalNecessario) {
          if (!ownedItemIds.has(item.id)) {
            const userAtual = await tx.user.findUnique({
              where: { id: userId },
              select: { user_items: true },
            })
            const refs = parseUserItems(userAtual?.user_items)
            refs.push({
              item_id:    item.id,
              equipped:   false,
              acquiredAt: new Date().toISOString(),
            })
            await tx.user.update({
              where: { id: userId },
              data: { user_items: refs as any },
            })
            await tx.userFragment.delete({
              where: { userId_itemId: { userId, itemId: item.id } },
            })
            ownedItemIds.add(item.id)
            itensCompletos.push(item.id)
          }
        }
      }

      await tx.bauAbertura.create({
        data: {
          userId,
          bauId:       bau.id,
          coinsGanhos,
          custoPago:   config.precoCoins ? "coins" : "diamonds",
          valorPago:   config.precoCoins ?? config.precoDiamonds ?? 0,
          itens: {
            create: comXp.map(item => ({
              itemId:    item.id,
              raridade:  item.raridade,
              fragmentos: distribuicao.get(item.id) ?? 1,
            })),
          },
        },
      })
    })

    const fragmentosAtuais = await Promise.all(
      comXp.map(async item => {
        const frag = await bauRepository.findFragmentoUsuario(userId, item.id)
        return { itemId: item.id, atual: frag?.quantidade ?? 0 }
      })
    )
    const fragMap = new Map(fragmentosAtuais.map(f => [f.itemId, f.atual]))

    return {
      tipoBau: tipo,
      coinsGanhos,
      fragmentosTotal: xpBonus > 0 ? 0 : fragmentosTotal,
      xpBonus: xpBonus > 0 ? xpBonus : undefined,
      itens: comXp.map(item => ({
        id:              item.id,
        name:            item.name,
        type:            item.type,
        value:           item.value,
        imageUrl:        item.imageUrl,
        raridade:        item.raridade,
        animated:        item.animated,
        fragmentosGanhos: distribuicao.get(item.id) ?? 1,
        fragmentosAtuais: fragMap.get(item.id) ?? 0,
        fragmentosTotal:  item.fragmentosTotal,
        itemCompleto:     itensCompletos.includes(item.id),
      })),
    }
  }
}
