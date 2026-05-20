import axios from 'axios'

const resolvedBaseUrl =
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== "")
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === 'development'
    ? 'http://localhost:7000/api'
    : "https://sgpcontroller.onrender.com/api";

const api = axios.create({
  baseURL: resolvedBaseUrl,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api

// Re-export das APIs de módulos para compatibilidade
export { sessionsApi } from './sessions'
export { playersApi } from './players'
export { propertiesApi } from './properties'
export { bancoApi } from './banco'