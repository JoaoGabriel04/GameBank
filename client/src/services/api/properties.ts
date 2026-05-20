import api from './index'
import { Propriedade } from '@/types/game'

export const propertiesApi = {
  getById: (propriedadeId: number) =>
    api.get<Propriedade>(`/propriedades/getById/${propriedadeId}`),
  
  buy: (propriedadeId: number, sessionId: number, userId: number) =>
    api.put('/propriedades/buyProp', { propriedadeId, sessionId, userId }),
  
  buyHouse: (userId: number, sessionId: number, propriedadeId: number) =>
    api.put('/propriedades/buyHouse', { userId, sessionId, propriedadeId }),
  
  sellHouse: (userId: number, sessionId: number, propriedadeId: number) =>
    api.put('/propriedades/sellHouse', { userId, sessionId, propriedadeId }),
  
  sell: (propriedadeId: number, sessionId: number, userId: number) =>
    api.put('/propriedades/sellProp', { propriedadeId, sessionId, userId }),
  
  mortgage: (propriedadeId: number, sessionId: number, userId: number) =>
    api.put('/propriedades/hipotecar', { propriedadeId, sessionId, userId }),
  
  trade: (propriedadeId: number, sessionId: number, userId: number) =>
    api.put('/propriedades/trocar', { propriedadeId, sessionId, userId }),
}

// Funções helper para compatibilidade
export const getPropByIdApi = (propriedadeId: number): Promise<Propriedade | null> =>
  propertiesApi.getById(propriedadeId).then(res => res.data).catch(() => null)

export const buyPropApi = (propriedadeId: number, sessionId: number, userId: number) =>
  propertiesApi.buy(propriedadeId, sessionId, userId).then(res => res.data)

export const buyHouseApi = (userId: number, sessionId: number, propriedadeId: number) =>
  propertiesApi.buyHouse(userId, sessionId, propriedadeId).then(res => res.data)

export const sellHouseApi = (userId: number, sessionId: number, propriedadeId: number) =>
  propertiesApi.sellHouse(userId, sessionId, propriedadeId).then(res => res.data)

export const sellPropriedadeApi = (propriedadeId: number, sessionId: number, userId: number) =>
  propertiesApi.sell(propriedadeId, sessionId, userId).then(res => res.data)

export const hipotecarPropApi = (propriedadeId: number, sessionId: number, userId: number) =>
  propertiesApi.mortgage(propriedadeId, sessionId, userId).then(res => res.data)

export const trocaPropriedadeApi = (propriedadeId: number, sessionId: number, userId: number) =>
  propertiesApi.trade(propriedadeId, sessionId, userId).then(res => res.data)