import api from './index'

export interface UserNotification {
  id: number;
  userId: number;
  titulo: string;
  corpo: string;
  lida: boolean;
  lidaEm: string | null;
  createdAt: string;
}

export const notificationsApi = {
  comprarHipotecada: (sessionPossesId: number, sessionId: number, compradorId: number) =>
    api.put('/propriedades/comprar-hipotecada', { sessionPossesId, sessionId, compradorId }),

  responder: (notificationId: number, aceitar: boolean, respondedorId: number, sessionId: number) =>
    api.put(`/propriedades/responder-notificacao/${notificationId}`, { aceitar, respondedorId, sessionId }),

  getMyNotifications: () =>
    api.get<UserNotification[]>('/profile/notifications').then(r => r.data),

  markAllRead: () =>
    api.patch('/profile/notifications/read').then(r => r.data),
}

export const comprarHipotecadaApi = (sessionPossesId: number, sessionId: number, compradorId: number) =>
  notificationsApi.comprarHipotecada(sessionPossesId, sessionId, compradorId).then(res => res.data)

export const responderNotificacaoApi = (notificationId: number, aceitar: boolean, respondedorId: number, sessionId: number) =>
  notificationsApi.responder(notificationId, aceitar, respondedorId, sessionId).then(res => res.data)
