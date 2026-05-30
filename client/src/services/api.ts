import axios from "axios";

// Determine baseURL: prefer NEXT_PUBLIC_API_URL (set in env),
// otherwise use localhost in development and the production URL otherwise.
const resolvedBaseUrl =
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== "")
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === 'development'
    ? 'http://localhost:7000/api'
    : "https://gamebank-vtsb.onrender.com/api";

const api = axios.create({
  baseURL: resolvedBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("jwt_token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;