import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://tromen-backend-production.up.railway.app'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('tromen_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('tromen_token')
      localStorage.removeItem('tromen_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
}

export const dashboardApi = {
  today: () => api.get('/api/dashboard/today'),
  summary: (from: string, to: string) =>
    api.get(`/api/dashboard/summary?from=${from}&to=${to}`),
  collections: () => api.get('/api/dashboard/collections'),
  alerts: () => api.get('/api/dashboard/alerts'),
}

export const routesApi = {
  list: (date?: string) =>
    api.get(`/api/routes${date ? `?date=${date}` : ''}`),
  get: (id: string) => api.get(`/api/routes/${id}`),
}

export const gpsApi = {
  live: () => api.get('/api/gps/live'),
  track: (routeId: string) => api.get(`/api/gps/track/${routeId}`),
}

export const clientsApi = {
  list: () => api.get('/api/clients'),
  balances: () => api.get('/api/clients/report/balances'),
}
