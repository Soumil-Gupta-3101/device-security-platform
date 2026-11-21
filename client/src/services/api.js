import axios from 'axios'
import { showForbiddenToast, showSessionExpiredToast } from '../utils/toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response) {
      const status = error.response.status
      const requestUrl = error.config?.url || ''

      // Skip 401 handling for login and register requests
      const isAuthCall =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.endsWith('/login') ||
        requestUrl.endsWith('/register')

      if (status === 401 && !isAuthCall) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')

        const message = 'Your session expired. Please log in again.'

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('auth:expired', { detail: { message } })
          )

          showSessionExpiredToast(message)

          if (window.location.pathname !== '/login') {
            sessionStorage.setItem('auth_message', message)
            window.location.href = '/login'
          }
        }
      } else if (status === 403) {
        const message =
          error.response.data?.message ||
          error.response.data?.error ||
          "You don't have permission to perform this action"
        showForbiddenToast(message)
      }
    }
    return Promise.reject(error)
  }
)

export default api
