import axios from 'axios'

// API Base URL - Uses VITE_API_URL env variable, or production backend as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://clauson-sozluk-backend.clausondictionary.workers.dev' // Production backend
    : 'http://localhost:8787')

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Bir hata oluştu'
    return Promise.reject(new Error(message))
  }
)

// API fonksiyonları
export const searchWords = async ({ query, type = 'both', fuzzy = 0.3, limit = 50, etymology }) => {
  const params = { q: query, type, fuzzy, limit }
  if (etymology) params.etymology = etymology
  return api.get('/api/search', { params })
}

export const getWordDetail = async (id) => {
  return api.get(`/api/search/word/${id}`)
}

export const autocomplete = async (query) => {
  return api.get('/api/search/autocomplete', { params: { q: query, limit: 10 } })
}

export const getStatistics = async () => {
  return api.get('/api/search/statistics')
}

export const getRandomWord = async () => {
  return api.get('/api/search/random')
}

export default api
