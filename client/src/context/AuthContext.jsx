import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [networkError, setNetworkError] = useState(null)

  const getAuthEndpoint = (path) => {
    const base = api.defaults.baseURL || ''
    return base.endsWith('/api') ? `/auth/${path}` : `/api/auth/${path}`
  }

  const verifySession = useCallback(async () => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (!storedToken) {
      setLoading(false)
      return
    }

    setLoading(true)
    setNetworkError(null)

    try {
      const response = await api.get(getAuthEndpoint('me'), {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      })
      const freshUser = response.data

      setToken(storedToken)
      setUser(freshUser)
      localStorage.setItem('user', JSON.stringify(freshUser))
    } catch (err) {
      console.error('Session verification error:', err)
      const is401 = err.response && err.response.status === 401
      const isNetworkErr = !err.response || err.code === 'ERR_NETWORK'

      if (is401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
      } else if (isNetworkErr) {
        // Do NOT log the user out on network failure
        setToken(storedToken)
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser))
          } catch {
            setUser(null)
          }
        }
        setNetworkError(
          'Unable to reach security server. Please verify the backend is running.'
        )
      } else {
        // Other unexpected errors (e.g. 500)
        setToken(storedToken)
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser))
          } catch {
            setUser(null)
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    verifySession()

    const handleAuthExpired = () => {
      setToken(null)
      setUser(null)
      setLoading(false)
    }

    window.addEventListener('auth:expired', handleAuthExpired)
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired)
    }
  }, [verifySession])

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
      setNetworkError(null)

      return response.data
    } catch (error) {
      throw error
    }
  }

  const register = async (name, email, password) => {
    try {
      const payload = { name, email, password }

      const response = await api.post(getAuthEndpoint('register'), payload)
      const { user: registeredUser, token: receivedToken } = response.data

      localStorage.setItem('token', receivedToken)
      if (registeredUser) {
        localStorage.setItem('user', JSON.stringify(registeredUser))
      }

      setToken(receivedToken)
      setUser(registeredUser || null)
      setNetworkError(null)

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
    setNetworkError(null)
  }

  // Loading state while verifying existing session on startup
  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400">Verifying session credentials...</span>
        </div>
      </div>
    )
  }

  // Network error state if server is down on startup
  if (networkError) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-6 font-mono">
        <div className="max-w-md w-full bg-[#0b1324] border border-amber-500/40 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">Backend Server Unreachable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {networkError}
          </p>
          <p className="text-[11px] text-slate-500">
            Your login session is preserved. Reconnect once the server is back online.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={verifySession}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  const value = {
    user,
    token,
    loading,
    networkError,
    login,
    register,
    logout,
    verifySession,
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
