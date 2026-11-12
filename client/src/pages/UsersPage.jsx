import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUsers, updateUserRole } from '../services/userService'

// Helper to format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Recently'

  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)

  if (diffInSeconds < 5) return 'Just now'
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes === 1) return '1m ago'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInSeconds / 60)
  if (diffInHours === 1) return '1h ago'
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) return '1d ago'
  if (diffInDays < 30) return `${diffInDays}d ago`
  return date.toLocaleDateString()
}

// Format date to local string
function formatDate(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Role badge styling
function getRoleBadge(role) {
  switch (role?.toLowerCase()) {
    case 'admin':
      return {
        bg: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
        dot: 'bg-purple-400',
        label: 'ADMIN',
      }
    case 'analyst':
      return {
        bg: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        dot: 'bg-amber-400',
        label: 'ANALYST',
      }
    case 'viewer':
      return {
        bg: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        dot: 'bg-cyan-400',
        label: 'VIEWER',
      }
    default:
      return {
        bg: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
        dot: 'bg-slate-400',
        label: (role || 'OPERATOR').toUpperCase(),
      }
  }
}

export default function UsersPage() {
  const { user: currentAuthUser, logout } = useAuth()
  const navigate = useNavigate()

  const currentUserId = currentAuthUser?.id || currentAuthUser?._id

  // State
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Track pending dropdown selections per user: { [userId]: 'admin' | 'analyst' | 'viewer' }
  const [selectedRoles, setSelectedRoles] = useState({})
  // Track in-progress saves: { [userId]: boolean }
  const [savingMap, setSavingMap] = useState({})
  // Track per-row feedback messages: { [userId]: { type: 'success' | 'error', text: string } }
  const [rowFeedback, setRowFeedback] = useState({})

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers()
      const userList = Array.isArray(data) ? data : data?.users || []
      setUsers(userList)

      // Initialize selected roles map
      const initialRoles = {}
      userList.forEach((u) => {
        initialRoles[u._id] = u.role
      })
      setSelectedRoles(initialRoles)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to fetch registered users'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleRoleSelect = (userId, newRole) => {
    setSelectedRoles((prev) => ({
      ...prev,
      [userId]: newRole,
    }))
    // Clear previous feedback on change
    if (rowFeedback[userId]) {
      setRowFeedback((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
    }
  }

  const handleSaveRole = async (targetUser) => {
    const userId = targetUser._id
    const newRole = selectedRoles[userId]

    if (!newRole || newRole === targetUser.role) return

    setSavingMap((prev) => ({ ...prev, [userId]: true }))
    setRowFeedback((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })

    try {
      const updated = await updateUserRole(userId, newRole)

      // Update user in place in local state
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, ...updated } : u))
      )
      setSelectedRoles((prev) => ({
        ...prev,
        [userId]: updated.role || newRole,
      }))

      setRowFeedback((prev) => ({
        ...prev,
        [userId]: {
          type: 'success',
          text: `Role updated to ${newRole}`,
        },
      }))

      // Auto-clear success message after 4s
      setTimeout(() => {
        setRowFeedback((prev) => {
          if (prev[userId]?.type === 'success') {
            const next = { ...prev }
            delete next[userId]
            return next
          }
          return prev
        })
      }, 4000)
    } catch (err) {
      console.error('Failed to update role:', err)
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to update user role'

      setRowFeedback((prev) => ({
        ...prev,
        [userId]: {
          type: 'error',
          text: errorMsg,
        },
      }))
    } finally {
      setSavingMap((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Quick stats
  const adminCount = users.filter((u) => u.role === 'admin').length
  const analystCount = users.filter((u) => u.role === 'analyst').length
  const viewerCount = users.filter((u) => u.role === 'viewer').length

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans antialiased relative overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-300 pb-16">
      {/* Background Matrix Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_15%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#0b1324]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3.5">
            <Link
              to="/dashboard"
              className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center shadow-inner shadow-cyan-500/20 text-cyan-400 hover:border-cyan-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-white uppercase tracking-tight font-mono">
                  Device Security &amp; <span className="text-cyan-400">Threat Monitoring</span>
                </h1>
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-500/30">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span className="text-[10px] font-mono font-semibold tracking-wider text-purple-300 uppercase">
                    Admin Access Console
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Operator Provisioning &amp; Role-Based Access Control
              </p>
            </div>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-4">
            <nav className="hidden lg:flex items-center gap-1 border-r border-slate-800 pr-4">
              <Link
                to="/dashboard"
                className="px-3 py-1.5 rounded text-xs font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/alerts"
                className="px-3 py-1.5 rounded text-xs font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                Alerts Feed
              </Link>
              <Link
                to="/audit-logs"
                className="px-3 py-1.5 rounded text-xs font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                Audit Log
              </Link>
              <Link
                to="/users"
                className="px-3 py-1.5 rounded text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 transition-colors"
              >
                Users
              </Link>
            </nav>

            {currentAuthUser && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200">
                  {currentAuthUser.name || currentAuthUser.email}
                </span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                  Role: {currentAuthUser.role || 'Admin'}
                </span>
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={fetchUsers}
              disabled={loading}
              title="Refresh operator roster"
              className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 hover:text-white rounded text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6 relative z-10">
        {/* Notice Banner */}
        <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs font-mono text-cyan-300 flex items-center gap-2.5 shadow-sm">
          <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Role changes take effect after the user logs in again.</span>
        </div>

        {/* Page Title & Metrics Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold font-mono text-white tracking-tight uppercase">
                User Access &amp; Permissions
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-semibold">
                {users.length} Registered Operators
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Manage platform operator credentials and privilege elevation levels.
            </p>
          </div>

          {/* Quick Role Breakdown Chips */}
          <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-purple-950/50 border border-purple-500/30 text-purple-300">
              Admin: <strong>{adminCount}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-500/30 text-amber-300">
              Analyst: <strong>{analystCount}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-950/50 border border-cyan-500/30 text-cyan-300">
              Viewer: <strong>{viewerCount}</strong>
            </span>
          </div>
        </div>

        {/* General Error Banner */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={fetchUsers}
              className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800/80 text-white font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Users Table */}
        <section className="bg-[#0b1324] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#070e1c] text-slate-400 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">Operator / Identity</th>
                  <th className="py-3.5 px-4 font-semibold">Email</th>
                  <th className="py-3.5 px-4 font-semibold">Current Role</th>
                  <th className="py-3.5 px-4 font-semibold">Joined Date</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Role Assignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400 font-mono">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span>Loading user directory...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400 font-mono">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <p className="text-slate-300 font-medium">No users found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((rowUser) => {
                    const rowUserId = rowUser._id
                    const isCurrentUser =
                      String(currentUserId) === String(rowUserId)

                    const selectedRole =
                      selectedRoles[rowUserId] ?? rowUser.role
                    const isDirty = selectedRole !== rowUser.role
                    const isSaving = Boolean(savingMap[rowUserId])
                    const feedback = rowFeedback[rowUserId]

                    const currentBadge = getRoleBadge(rowUser.role)

                    return (
                      <tr
                        key={rowUserId}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isCurrentUser ? 'bg-cyan-950/15' : ''
                        }`}
                      >
                        {/* Operator / Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0">
                              {(rowUser.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-100 block">
                                  {rowUser.name || 'Unnamed Operator'}
                                </span>
                                {isCurrentUser && (
                                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold uppercase tracking-wider">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500">
                                ID: {rowUserId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-slate-300">
                          {rowUser.email}
                        </td>

                        {/* Current Role Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold tracking-wider ${currentBadge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${currentBadge.dot}`} />
                            {currentBadge.label}
                          </span>
                        </td>

                        {/* Joined Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                          <div className="text-slate-200">
                            {formatDate(rowUser.createdAt)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatRelativeTime(rowUser.createdAt)}
                          </div>
                        </td>

                        {/* Role Assignment & Save Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center justify-end gap-2">
                              {/* Role Dropdown */}
                              <select
                                value={selectedRole}
                                onChange={(e) =>
                                  handleRoleSelect(rowUserId, e.target.value)
                                }
                                disabled={isCurrentUser || isSaving}
                                className={`bg-[#020617] border border-slate-700 text-slate-200 text-xs font-mono rounded-lg px-2.5 py-1.5 outline-none transition-colors ${
                                  isCurrentUser
                                    ? 'opacity-60 cursor-not-allowed bg-slate-900 border-slate-800'
                                    : 'focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer'
                                }`}
                              >
                                <option value="admin">Admin</option>
                                <option value="analyst">Analyst</option>
                                <option value="viewer">Viewer</option>
                              </select>

                              {/* Save Button */}
                              <button
                                onClick={() => handleSaveRole(rowUser)}
                                disabled={!isDirty || isSaving || isCurrentUser}
                                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                                  !isDirty || isCurrentUser
                                    ? 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
                                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border border-cyan-400 shadow-sm shadow-cyan-500/20 active:scale-95'
                                }`}
                              >
                                {isSaving ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                    <span>Saving...</span>
                                  </>
                                ) : (
                                  <span>Save</span>
                                )}
                              </button>
                            </div>

                            {/* Self-managed Indicator or Row Feedback */}
                            {isCurrentUser && (
                              <span className="text-[10px] text-slate-500 italic">
                                Self-demotion is locked
                              </span>
                            )}

                            {feedback && (
                              <span
                                className={`text-[11px] font-mono ${
                                  feedback.type === 'success'
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {feedback.text}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3.5 bg-[#070e1c] border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>
              Showing <strong className="text-slate-200">{users.length}</strong> registered operators
            </span>
            <span className="text-slate-500">
              Role changes take effect upon re-authentication
            </span>
          </div>
        </section>
      </main>
    </div>
  )
}

