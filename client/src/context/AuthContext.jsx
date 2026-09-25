import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken) {
      setToken(storedToken)
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch {
          setUser(null)
        }
      }
    }
    setLoading(false)
  }, [])

  const getAuthEndpoint = (path) => {
    const base = api.defaults.baseURL || ''
    return base.endsWith('/api') ? `/auth/${path}` : `/api/auth/${path}`
  }

  const login = async (email, password) => {
    try {
      const response = await api.post(getAuthEndpoint('login'), { email, password })
      const { user: loggedInUser, token: receivedToken } = response.data

      localStorage.setItem('token', receivedToken)
      if (loggedInUser) {
        localStorage.setItem('user', JSON.stringify(loggedInUser))
      }

      setToken(receivedToken)
      setUser(loggedInUser || null)

      return response.data
    } catch (error) {
      throw error
    }
  }

  const register = async (name, email, password, role) => {
    try {
      const payload = { name, email, password }
      if (role) {
        payload.role = role
      }

      const response = await api.post(getAuthEndpoint('register'), payload)
      const { user: registeredUser, token: receivedToken } = response.data

      localStorage.setItem('token', receivedToken)
      if (registeredUser) {
        localStorage.setItem('user', JSON.stringify(registeredUser))
      }

      setToken(receivedToken)
      setUser(registeredUser || null)

      return response.data
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
