import axios from 'axios'
import { showForbiddenToast } from '../utils/toast'

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
    if (error.response && error.response.status === 403) {
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        "You don't have permission to perform this action"
      showForbiddenToast(message)
    }
    return Promise.reject(error)
  }
)

export default api
