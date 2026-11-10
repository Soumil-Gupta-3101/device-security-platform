import { createContext, useContext, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { token } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) {
      setSocket((prev) => {
        if (prev) {
          prev.removeAllListeners()
          prev.disconnect()
        }
        return null
      })
      setConnected(false)
      return
    }

    const rawUrl = import.meta.env.VITE_API_BASE_URL || ''
    const socketUrl = rawUrl.replace(/\/api\/?$/, '') || undefined

    const newSocket = io(socketUrl, {
      auth: { token },
    })

    const onConnect = () => {
      setConnected(true)
    }

    const onDisconnect = () => {
      setConnected(false)
    }

    const onConnectError = (err) => {
      console.error('Socket connect_error:', err.message)
    }

    newSocket.on('connect', onConnect)
    newSocket.on('disconnect', onDisconnect)
    newSocket.on('connect_error', onConnectError)

    setSocket(newSocket)

    return () => {
      newSocket.off('connect', onConnect)
      newSocket.off('disconnect', onDisconnect)
      newSocket.off('connect_error', onConnectError)
      newSocket.removeAllListeners()
      newSocket.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [token])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
