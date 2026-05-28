import axios from 'axios'
import { getRoomToken, setRoomToken } from '@/stores/roomTokenStore'

const resolvedBaseUrl =
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== "")
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === 'development'
    ? 'http://localhost:7000/api'
    : "https://sgpcontroller.onrender.com/api";

const api = axios.create({
  baseURL: resolvedBaseUrl,
  withCredentials: true,
})

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('jwt_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      const roomToken = getRoomToken()
      if (roomToken) {
        config.headers['X-Room-Token'] = roomToken
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => {
    if (response.data?.roomToken) {
      setRoomToken(response.data.roomToken)
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const data = error.response?.data
      if (data?.error === 'Acesso não autorizado a esta sala' || data?.error === 'Token de sala inválido ou expirado' || data?.error === 'Senha incorreta' || data?.error === 'Esta sala requer senha') {
        console.warn('Room access issue — not logging out:', data?.error)
        return Promise.reject(error)
      }
      localStorage.removeItem('jwt_token')
      localStorage.removeItem('jwt_user')
      window.location.href = '/login'
    }
    if (error.code === 'ERR_CANCELED') {
      console.warn('[API] cancelado:', error.config?.url)
    } else if (!error.response) {
      console.error('[API] Network Error — sem resposta do servidor', {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        baseURL: error.config?.baseURL,
        message: error.message,
        code: error.code,
      })
    } else {
      console.error('[API] Error ' + error.response.status + ':', error.response?.data || error.message)
    }
    return Promise.reject(error)
  }
)

export default api

// Re-export das APIs de módulos para compatibilidade
export { sessionsApi } from './sessions'
export { playersApi } from './players'
export { propertiesApi } from './properties'
export { bancoApi } from './banco'