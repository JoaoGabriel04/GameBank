import api from './index'

export const bancoApi = {
  deposit: (userId: number, sessionId: number, valor: number) =>
    api.put('/banco/deposito', { userId, sessionId, valor }),
  
  withdraw: (userId: number, sessionId: number, valor: number) =>
    api.put('/banco/saque', { userId, sessionId, valor }),
  
  transfer: (pagadorId: number, recebedorId: number, sessionId: number, valor: number) =>
    api.put('/banco/transferencia', { pagadorId, recebedorId, sessionId, valor }),
  
  payRent: (sessionId: number, pagadorId: number, sessionPossesId: number) =>
    api.put('/banco/aluguel', { sessionId, pagadorId, sessionPossesId }),
  
  payRentWithDice: (sessionId: number, pagadorId: number, sessionPossesId: number, numDados: number) =>
    api.put('/banco/aluguelAcao', { sessionId, pagadorId, sessionPossesId, numDados }),
  
  receiveFromAll: (sessionId: number, userId: number) =>
    api.put('/banco/receberDeTodos', { sessionId, userId }),
}

// Funções helper para compatibilidade
export const depositoApi = (userId: number, sessionId: number, valor: number) =>
  bancoApi.deposit(userId, sessionId, valor).then(res => res.data)

export const saqueApi = (userId: number, sessionId: number, valor: number) =>
  bancoApi.withdraw(userId, sessionId, valor).then(res => res.data)

export const transferenciaApi = (pagadorId: number, recebedorId: number, sessionId: number, valor: number) =>
  bancoApi.transfer(pagadorId, recebedorId, sessionId, valor).then(res => res.data)

export const aluguelApi = (sessionId: number, pagadorId: number, sessionPossesId: number) =>
  bancoApi.payRent(sessionId, pagadorId, sessionPossesId).then(res => res.data)

export const aluguelAcaoApi = (sessionId: number, pagadorId: number, sessionPossesId: number, numDados: number) =>
  bancoApi.payRentWithDice(sessionId, pagadorId, sessionPossesId, numDados).then(res => res.data)

export const receberDeTodosApi = (sessionId: number, userId: number) =>
  bancoApi.receiveFromAll(sessionId, userId).then(res => res.data)