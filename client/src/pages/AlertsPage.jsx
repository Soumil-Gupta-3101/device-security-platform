import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAllAlerts } from '../services/alertService'

// Helper to format relative time (e.g. "5 minutes ago", "1 hour ago", "Just now")
function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'N/A'

  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)

  if (diffInSeconds < 5) return 'Just now'
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes === 1) return '1 minute ago'
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours === 1) return '1 hour ago'
  if (diffInHours < 24) return `${diffInHours} hours ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) return '1 day ago'
  if (diffInDays < 30) return `${diffInDays} days ago`
  return date.toLocaleDateString()
}

// Severity Badge Styling: green low, yellow medium, red high
const getSeverityBadge = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'low':
      return {
        wrapper: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: 'LOW',
      }
    case 'medium':
      return {
        wrapper: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        dot: 'bg-amber-400',
        label: 'MEDIUM',
      }
    case 'high':
      return {
        wrapper: 'bg-red-500/15 text-red-400 border border-red-500/30',
        dot: 'bg-red-400 animate-pulse',
        label: 'HIGH',
      }
    default:
      return {
        wrapper: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
        dot: 'bg-slate-400',
        label: (severity || 'INFO').toUpperCase(),
      }
  }
}

// Status Badge Styling: open / investigating / resolved
const getStatusBadge = (status) => {
  switch (status?.toLowerCase()) {
    case 'open':
      return {
        wrapper: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
        dot: 'bg-cyan-400',
        label: 'Open',
      }
    case 'investigating':
      return {
        wrapper: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        dot: 'bg-amber-400 animate-pulse',
        label: 'Investigating',
      }
    case 'resolved':
      return {
        wrapper: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
        dot: 'bg-slate-400',
        label: 'Resolved',
      }
    default:
      return {
        wrapper: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
        dot: 'bg-slate-400',
        label: status || 'Unknown',
      }
  }
}

export default function AlertsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Filter state defaulting to "all"
  const [status, setStatus] = useState('all')
  const [severity, setSeverity] = useState('all')

  // Search input within alerts
  const [searchQuery, setSearchQuery] = useState('')

  // Data fetching state
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (status !== 'all') {
        params.status = status
      }
      if (severity !== 'all') {
        params.severity = severity
      }

      const res = await getAllAlerts(params)

      // Handle response formats: { data: [...] }, { alerts: [...] }, or raw array [...]
      const alertList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.alerts)
        ? res.alerts
        : []

      setAlerts(alertList)
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to load security alerts. Please verify backend connectivity.'
      )
    } finally {
      setLoading(false)
    }
  }, [status, severity])

  // Call on mount and whenever filters change
  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Filtered by local search query
  const filteredAlerts = alerts.filter((alert) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const deviceName = (alert.device?.name || alert.device || '').toLowerCase()
    const reason = (alert.reason || '').toLowerCase()
    const alertStatus = (alert.status || '').toLowerCase()
    const alertSeverity = (alert.severity || '').toLowerCase()
    return (
      deviceName.includes(q) ||
      reason.includes(q) ||
      alertStatus.includes(q) ||
      alertSeverity.includes(q)
    )
  })

  // Quick stats computed from current feed
  const stats = {
    total: alerts.length,
    high: alerts.filter((a) => a.severity?.toLowerCase() === 'high').length,
    investigating: alerts.filter((a) => a.status?.toLowerCase() === 'investigating').length,
    open: alerts.filter((a) => a.status?.toLowerCase() === 'open').length,
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
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                  </span>
                  <span className="text-[10px] font-mono font-semibold tracking-wider text-cyan-300 uppercase">
                    Live Telemetry
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-mono">Real-Time Threat Detection &amp; Alert Management</p>
            </div>
          </div>

          {/* Navigation & User */}
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
                className="px-3 py-1.5 rounded text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 transition-colors"
              >
                Alerts Feed
              </Link>
            </nav>

            {user && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200">{user.name || user.email}</span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                  Role: {user.role || 'Operator'}
                </span>
              </div>
            )}

            <button
              onClick={fetchAlerts}
              disabled={loading}
              title="Refresh alerts"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-slate-700 transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 border border-red-900/40 text-red-400 text-xs font-mono transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-6">
        {/* Page Title & KPI Cards */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold font-mono tracking-tight text-white uppercase">
                  Alerts &amp; Incident Feed
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-400">
                  {alerts.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Monitored endpoint anomalies, intrusion triggers, and security events
              </p>
            </div>

            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 transition-colors font-mono text-xs self-start sm:self-auto"
            >
              &larr; Back to Dashboard
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-[#0b1324]/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Alerts</p>
                <p className="text-xl font-bold font-mono text-white mt-1">{stats.total}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="bg-[#0b1324]/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Open Incidents</p>
                <p className="text-xl font-bold font-mono text-cyan-400 mt-1">{stats.open}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            <div className="bg-[#0b1324]/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Investigating</p>
                <p className="text-xl font-bold font-mono text-amber-400 mt-1">{stats.investigating}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-950/40 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="bg-[#0b1324]/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">High Severity</p>
                <p className="text-xl font-bold font-mono text-red-400 mt-1">{stats.high}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-red-950/40 border border-red-500/20 flex items-center justify-center text-red-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Suite */}
        <div className="bg-[#0b1324]/90 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-medium text-slate-400 mr-1">Status:</span>
              {[
                { label: 'All', value: 'all' },
                { label: 'Open', value: 'open' },
                { label: 'Investigating', value: 'investigating' },
                { label: 'Resolved', value: 'resolved' },
              ].map((s) => {
                const isActive = status === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                        : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>

            {/* Severity Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-medium text-slate-400 mr-1">Severity:</span>
              {[
                { label: 'All', value: 'all' },
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
              ].map((sev) => {
                const isActive = severity === sev.value
                return (
                  <button
                    key={sev.value}
                    onClick={() => setSeverity(sev.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                      isActive
                        ? sev.value === 'high'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                          : sev.value === 'medium'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                          : sev.value === 'low'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {sev.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search query bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by device name, reason, or keyword..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 flex items-center justify-between text-xs font-mono text-red-300">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={fetchAlerts}
              className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800/80 text-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Alerts Table Card */}
        <div className="bg-[#0b1324]/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-400">Loading security alert telemetry...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold font-mono text-slate-300">No Alerts Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No alerts match the selected status ({status}) and severity ({severity}) filters.
              </p>
              {(status !== 'all' || severity !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setStatus('all')
                    setSeverity('all')
                    setSearchQuery('')
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400 hover:border-slate-700"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-6">Reason / Trigger Event</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Detected</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredAlerts.map((alert) => {
                    const sev = getSeverityBadge(alert.severity)
                    const stat = getStatusBadge(alert.status)
                    const deviceName = alert.device?.name || alert.device || 'Unknown Device'
                    const alertId = alert._id || alert.id

                    return (
                      <tr
                        key={alert._id || alertId}
                        onClick={() => navigate(`/alerts/${alert._id || alertId}`)}
                        className="hover:bg-slate-900/70 cursor-pointer transition-colors group"
                      >
                        {/* Severity Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider ${sev.wrapper}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                            {sev.label}
                          </span>
                        </td>

                        {/* Device Name */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400/80"></span>
                            <span className="group-hover:text-cyan-400 transition-colors">
                              {deviceName}
                            </span>
                          </div>
                        </td>

                        {/* Short Reason Text */}
                        <td className="py-3.5 px-6 text-slate-300">
                          <p className="line-clamp-2 leading-relaxed">
                            {alert.reason || 'Anomalous telemetry challenge triggered'}
                          </p>
                          {alert.notes && alert.notes.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 mt-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              {alert.notes.length} note{alert.notes.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${stat.wrapper}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${stat.dot}`} />
                            {stat.label}
                          </span>
                        </td>

                        {/* Relative Timestamp */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono text-slate-400 text-[11px]">
                          {formatRelativeTime(alert.createdAt)}
                        </td>

                        {/* Clickable indicator */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/40 transition-colors">
                            &rarr;
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-3.5 flex items-center justify-between text-xs font-mono text-slate-400">
            <div>
              Showing <span className="text-slate-200">{filteredAlerts.length}</span> of{' '}
              <span className="text-slate-200">{alerts.length}</span> loaded alerts
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
