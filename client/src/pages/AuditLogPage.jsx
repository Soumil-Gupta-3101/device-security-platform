import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAuditLogs } from '../services/auditService'

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
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours === 1) return '1h ago'
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) return '1d ago'
  if (diffInDays < 30) return `${diffInDays}d ago`
  return date.toLocaleDateString()
}

// Format full ISO timestamp to UTC/Local readable format
function formatDateTime(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// Action badge styling based on action category
function getActionBadge(action) {
  switch (action) {
    case 'user.login':
      return {
        bg: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
        dot: 'bg-cyan-400',
        label: 'USER LOGIN',
      }
    case 'user.registered':
      return {
        bg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: 'USER REGISTERED',
      }
    case 'user.role_changed':
      return {
        bg: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
        dot: 'bg-purple-400',
        label: 'ROLE CHANGED',
      }
    case 'device.created':
      return {
        bg: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        dot: 'bg-cyan-300',
        label: 'DEVICE CREATED',
      }
    case 'device.updated':
      return {
        bg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
        dot: 'bg-blue-400',
        label: 'DEVICE UPDATED',
      }
    case 'device.deleted':
      return {
        bg: 'bg-red-500/15 text-red-400 border border-red-500/30',
        dot: 'bg-red-400',
        label: 'DEVICE DELETED',
      }
    case 'alert.status_changed':
      return {
        bg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        dot: 'bg-amber-400',
        label: 'STATUS CHANGED',
      }
    case 'alert.note_added':
      return {
        bg: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
        dot: 'bg-teal-400',
        label: 'NOTE ADDED',
      }
    default:
      return {
        bg: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
        dot: 'bg-slate-400',
        label: (action || 'ACTION').toUpperCase(),
      }
  }
}

// Target badge styling based on targetType
function getTargetTypeBadge(type) {
  switch (type?.toLowerCase()) {
    case 'device':
      return 'bg-blue-950/70 text-blue-300 border border-blue-500/30'
    case 'alert':
      return 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
    case 'user':
      return 'bg-purple-950/70 text-purple-300 border border-purple-500/30'
    default:
      return 'bg-slate-900 text-slate-400 border border-slate-700/60'
  }
}

// Common preset actions for the filter dropdown
const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'user.login', label: 'user.login (Login)' },
  { value: 'user.registered', label: 'user.registered (Registration)' },
  { value: 'user.role_changed', label: 'user.role_changed (Role Change)' },
  { value: 'device.created', label: 'device.created (Device Created)' },
  { value: 'device.updated', label: 'device.updated (Device Updated)' },
  { value: 'device.deleted', label: 'device.deleted (Device Deleted)' },
  { value: 'alert.status_changed', label: 'alert.status_changed (Status Changed)' },
  { value: 'alert.note_added', label: 'alert.note_added (Note Added)' },
]

export default function AuditLogPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Data & Pagination state
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [selectedAction, setSelectedAction] = useState('')

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = {
        page,
        limit,
      }
      if (selectedAction) {
        params.action = selectedAction
      }

      const res = await getAuditLogs(params)
      setLogs(res.data || [])
      setPage(res.page || 1)
      setLimit(res.limit || 20)
      setTotal(res.total || 0)
      setTotalPages(res.totalPages || 1)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to fetch system audit logs'
      )
    } finally {
      setLoading(false)
    }
  }, [page, limit, selectedAction])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleActionChange = (e) => {
    setSelectedAction(e.target.value)
    setPage(1) // Reset to page 1 on filter change
  }

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value))
    setPage(1)
  }

  const handleResetFilter = () => {
    setSelectedAction('')
    setPage(1)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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
                    Admin Audit Console
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                System Governance &amp; Regulatory Compliance Trail
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
                className="px-3 py-1.5 rounded text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 transition-colors"
              >
                Audit Log
              </Link>
              <Link
                to="/users"
                className="px-3 py-1.5 rounded text-xs font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                Users
              </Link>
            </nav>

            {user && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200">{user.name || user.email}</span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                  Role: {user.role || 'Admin'}
                </span>
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh audit logs"
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
        {/* Page Title & Context Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold font-mono text-white tracking-tight uppercase">
                Audit Trail &amp; Activity Log
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-semibold">
                {total} Events Recorded
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Immutable log tracking administrative authorizations, logins, and threat triage events.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
            <span className="px-3 py-1.5 rounded-lg bg-[#0b1324] border border-slate-800">
              Page: <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#0b1324] border border-slate-800">
              Limit: <strong className="text-cyan-400">{limit}</strong> / page
            </span>
          </div>
        </div>

        {/* Toolbar & Filter Card */}
        <div className="bg-[#0b1324] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filter by Action */}
            <div className="flex items-center gap-3 flex-wrap">
              <label htmlFor="action-filter" className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Filter Action:
              </label>
              <div className="relative">
                <select
                  id="action-filter"
                  value={selectedAction}
                  onChange={handleActionChange}
                  className="bg-[#020617] border border-slate-700 text-slate-200 text-xs font-mono rounded-lg px-3 py-2 pr-8 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAction && (
                <button
                  onClick={handleResetFilter}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
                >
                  Clear Filter &times;
                </button>
              )}
            </div>

            {/* Page Limit Selector */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-xs font-mono text-slate-400">Rows:</span>
              <select
                value={limit}
                onChange={handleLimitChange}
                className="bg-[#020617] border border-slate-700 text-slate-200 text-xs font-mono rounded-lg px-2.5 py-1.5 focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State Banner */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={fetchLogs}
              className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800/80 text-white font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Data Table Section */}
        <section className="bg-[#0b1324] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#070e1c] text-slate-400 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-3.5 px-4 font-semibold">User (Actor)</th>
                  <th className="py-3.5 px-4 font-semibold">Action</th>
                  <th className="py-3.5 px-4 font-semibold">Target (Type &amp; ID)</th>
                  <th className="py-3.5 px-4 font-semibold">Metadata / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400 font-mono">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span>Querying audit records...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400 font-mono">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <p className="text-slate-300 font-medium">No audit entries found</p>
                        <p className="text-[11px] text-slate-500">
                          {selectedAction
                            ? `No records match action "${selectedAction}".`
                            : 'No system actions have been logged yet.'}
                        </p>
                        {selectedAction && (
                          <button
                            onClick={handleResetFilter}
                            className="mt-2 text-cyan-400 hover:underline text-xs"
                          >
                            Reset filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const actionBadge = getActionBadge(log.action)
                    const actorName = log.user?.name || log.user?.email || 'System'
                    const actorEmail = log.user?.email || ''
                    const targetType = log.targetType || 'unknown'
                    const targetId = log.targetId || '—'
                    const hasMetadata =
                      log.metadata &&
                      typeof log.metadata === 'object' &&
                      Object.keys(log.metadata).length > 0

                    return (
                      <tr
                        key={log._id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Time */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-200">
                            {formatDateTime(log.timestamp)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatRelativeTime(log.timestamp)}
                          </div>
                        </td>

                        {/* User / Actor */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {actorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-200 block truncate">
                                {actorName}
                              </span>
                              {actorEmail && actorEmail !== actorName && (
                                <span className="text-[11px] text-slate-500 block truncate">
                                  {actorEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold ${actionBadge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${actionBadge.dot}`} />
                            {actionBadge.label}
                          </span>
                        </td>

                        {/* Target (targetType + id) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getTargetTypeBadge(
                                targetType
                              )}`}
                            >
                              {targetType}
                            </span>
                            {targetType === 'device' && targetId !== '—' ? (
                              <Link
                                to={`/devices/${targetId}`}
                                className="text-cyan-400 hover:underline font-mono text-xs font-semibold"
                                title={`View device ${targetId}`}
                              >
                                {targetId}
                              </Link>
                            ) : targetType === 'alert' && targetId !== '—' ? (
                              <Link
                                to={`/alerts/${targetId}`}
                                className="text-cyan-400 hover:underline font-mono text-xs font-semibold"
                                title={`View alert ${targetId}`}
                              >
                                {targetId}
                              </Link>
                            ) : (
                              <span className="text-slate-300 font-mono text-xs">
                                {targetId}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Metadata / Details */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {hasMetadata ? (
                            <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.metadata, null, 1)}
                            </div>
                          ) : (
                            <span className="text-slate-600 italic text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination Controls */}
          <div className="p-4 bg-[#070e1c] border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-slate-400">
            <div>
              Showing{' '}
              <strong className="text-slate-200">
                {total === 0 ? 0 : (page - 1) * limit + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-200">
                {Math.min(page * limit, total)}
              </strong>{' '}
              of <strong className="text-slate-200">{total}</strong> records
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                &larr; Previous
              </button>

              <span className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
                Page {page} of {totalPages || 1}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

