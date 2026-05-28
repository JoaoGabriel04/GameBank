import axios from "axios";

// Determine baseURL: prefer NEXT_PUBLIC_API_URL (set in env),
// otherwise use localhost in development and the production URL otherwise.
const resolvedBaseUrl =
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== "")
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === 'development'
    ? 'http://localhost:7000/api'
    : "https://sgpcontroller.onrender.com/api";

const api = axios.create({
  baseURL: resolvedBaseUrl,
})

export default api;