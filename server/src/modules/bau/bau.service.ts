import { BAU_CONFIG, BAU_TEMPO_ESCOLTA, FRAGMENTOS_PESO, MAX_BAUS_PARTIDA_POR_DIA, XP_BONUS, type TipoBau, type Raridade } from "../../constants/baus.js"
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
  fragmentosTotal: number,
  tipo: TipoBau
): Map<number, number> {
  const resultado = new Map<number, number>()

  if (itens.length === 0) return resultado

  let restantes = fragmentosTotal - itens.length
  if (restantes < 0) restantes = 0
  itens.forEach(i => resultado.set(i.id, 1))

  if (restantes === 0) return resultado

  const pesos = FRAGMENTOS_PESO[tipo]
  const pesoTotal = itens.reduce((sum, i) => sum + pesos[i.raridade], 0)
  itens.forEach(item => {
    const extra = Math.floor((pesos[item.raridade] / pesoTotal) * restantes)
    resultado.set(item.id, (resultado.get(item.id) ?? 1) + extra)
  })

  const totalDistribuido = Array.from(resultado.values()).reduce((a, b) => a + b, 0)
  const diferenca = fragmentosTotal - totalDistribuido
  if (diferenca > 0) {
    resultado.set(itens[0].id, (resultado.get(itens[0].id) ?? 1) + diferenca)
  }

  return resultado
}

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

const ORDEM_RARIDADES: Raridade[] = ["COMUM", "INCOMUM", "RARO", "EPICO", "LENDARIO"]

export class BauService {
  async listar() {
    return bauRepository.findAllAtivos()
  }

  async abrir(userId: number, tipo: TipoBau, skipPayment = false) {
    const config = BAU_CONFIG[tipo]
    if (!config) throw new AppError(400, "Tipo de baú inválido")

    if (!skipPayment) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true, diamonds: true },
      })
      if (!user) throw new AppError(404, "Usuário não encontrado")
      if (config.precoCoins && user.coins < config.precoCoins) {
        throw new AppError(400, `Coins insuficientes. Necessário: ${config.precoCoins}`)
      }
      if (config.precoDiamonds && user.diamonds < config.precoDiamonds) {
        throw new AppError(400, `Diamantes insuficientes. Necessário: ${config.precoDiamonds}`)
      }
    }

    return this.executarAbertura(userId, tipo, config, bauRepository, skipPayment)
  }

  private async executarAbertura(
    userId: number,
    tipo: TipoBau,
    config: typeof BAU_CONFIG[typeof tipo],
    repo: typeof bauRepository,
    skipPayment: boolean,
  ) {
    const userItems = await repo.findUserItems(userId)
    const ownedItemIds = new Set(userItems.map(r => r.item_id))
    const bau = await repo.findBauByTipo(tipo)
    if (!bau) throw new AppError(500, "Baú não encontrado no banco")

    const coinsGanhos = randInt(config.coinsMin, config.coinsMax)
    const fragmentosTotal = randInt(config.fragmentosMin, config.fragmentosMax)
    const qtdItens = randInt(config.itensMin, config.itensMax)

    const itensSorteados: ItemSorteado[] = []
    const idsUsados = new Set<number>()

    const pegarItem = async (raridadeAlvo: Raridade): Promise<ItemSorteado | null> => {
      const deltas = [0]
      for (let step = 1; step < 5; step++) {
        deltas.push(step)
        deltas.push(-step)
      }
      const idx = ORDEM_RARIDADES.indexOf(raridadeAlvo)
      for (const delta of deltas) {
        const rIdx = idx + delta
        if (rIdx < 0 || rIdx >= ORDEM_RARIDADES.length) continue
        const r = ORDEM_RARIDADES[rIdx]
        const candidatos = await repo.findItensDisponiveisPorRaridade(r, ownedItemIds)
        const disponiveis = candidatos.filter(c => !idsUsados.has(c.id))
        if (disponiveis.length > 0) {
          const item = disponiveis[randInt(0, disponiveis.length - 1)]
          idsUsados.add(item.id)
          return { ...item, raridade: r }
        }
      }
      return null
    }

    if (tipo === "lendario") {
      const epic = await pegarItem("EPICO")
      if (epic) itensSorteados.push(epic)
      const lendario = await pegarItem("LENDARIO")
      if (lendario) itensSorteados.push(lendario)
    } else if (tipo === "premium") {
      const epic = await pegarItem("EPICO")
      if (epic) itensSorteados.push(epic)
    }

    const restantes = Math.max(0, qtdItens - itensSorteados.length)
    for (let i = 0; i < restantes; i++) {
      const { raridade } = sortearPonderado(config.probabilidadesRaridade)
      const item = await pegarItem(raridade)
      if (item) itensSorteados.push(item)
    }

    itensSorteados.sort((a, b) => {
      return ORDEM_RARIDADES.indexOf(a.raridade) - ORDEM_RARIDADES.indexOf(b.raridade)
    })

    const temFragmentosPendentes = itensSorteados.length > 0

    let xpBonus = 0
    const xpConfig = XP_BONUS[tipo]
    if (!temFragmentosPendentes && xpConfig) {
      xpBonus = randInt(xpConfig.min, xpConfig.max)
    }

    const comXp = temFragmentosPendentes ? itensSorteados : []
    const distribuicao = distribuirFragmentos(
      comXp.map(i => ({ id: i.id, raridade: i.raridade })),
      xpBonus > 0 ? 0 : fragmentosTotal,
      tipo
    )

    const itensCompletos: number[] = []

    await prisma.$transaction(async (tx) => {
      if (!skipPayment) {
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

  async concederBauPartida(
    userId: number, tipo: TipoBau, sessionId: number | undefined, position: number
  ) {
    const config = BAU_CONFIG[tipo]
    if (!config) throw new AppError(400, "Tipo de baú inválido")

    // Cap diário ignorado em dev para facilitar testes
    if (process.env.DISABLE_ANTI_FARM !== "true") {
      const countHoje = await bauRepository.countBauAdquiridosToday(userId)
      if (countHoje >= MAX_BAUS_PARTIDA_POR_DIA) return null
    }

    const bau = await bauRepository.findBauByTipo(tipo)
    if (!bau) return null

    const timerMin = BAU_TEMPO_ESCOLTA[tipo] ?? 10
    const unlockAt = new Date(Date.now() + timerMin * 60_000)

    return bauRepository.createBauAdquirido({
      userId, bauId: bau.id, sessionId, position, unlockAt,
    })
  }

  async listarAdquiridos(userId: number) {
    await bauRepository.unlockBauAdquiridos(userId)
    await bauRepository.deleteBauAdquiridoOld(userId)
    return bauRepository.findBauAdquiridos(userId)
  }

  async abrirAdquirido(userId: number, adquiridoId: number) {
    const adquirido = await bauRepository.findBauAdquiridoById(adquiridoId)
    if (!adquirido) throw new AppError(404, "Baú adquirido não encontrado")
    if (adquirido.userId !== userId) throw new AppError(403, "Este baú não pertence a você")
    if (adquirido.openedAt) throw new AppError(400, "Este baú já foi aberto")
    if (adquirido.status !== "PRONTO") throw new AppError(400, "Baú ainda bloqueado")

    const tipo = adquirido.bau.tipo as TipoBau
    const resultado = await this.abrir(userId, tipo, true)

    await bauRepository.updateBauAdquiridoOpened(adquiridoId)

    return resultado
  }
}
