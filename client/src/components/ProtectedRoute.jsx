import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
        <p className="text-lg">Loading...</p>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children
}
