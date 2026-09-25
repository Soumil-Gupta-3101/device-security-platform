import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDeviceById, getRiskBreakdown, getDeviceEvents } from '../services/deviceService'
import { getDeviceAlerts } from '../services/alertService'

// Metadata map for human-friendly rule titles, descriptions, and default points
const RULE_METADATA = {
  port_scan: {
    title: 'Port Scan Detected',
    desc: 'Unusual network port scanning activity observed from or directed to this endpoint.',
    defaultPoints: 30,
  },
  failed_auth: {
    title: '3+ Failed Authentication Attempts',
    desc: 'Multiple consecutive failed authentication challenges detected within the observation window.',
    defaultPoints: 20,
  },
  firmware_change: {
    title: 'Firmware / System Signature Change',
    desc: 'Unscheduled modification or variance in hardware firmware or kernel image integrity.',
    defaultPoints: 10,
  },
  location_change: {
    title: 'Anomalous Location / Network Jump',
    desc: 'Device reported telemetry from a different subnet, geo-location, or unexpected gateway.',
    defaultPoints: 15,
  },
  failed_login_attempts: {
    title: '2+ Failed Login Attempts',
    desc: 'Multiple invalid credentials or unauthorized login attempts recorded.',
    defaultPoints: 15,
  },
}

export default function DeviceDetailPage() {
  const { id } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // State
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [generalError, setGeneralError] = useState(null)

  const [device, setDevice] = useState(null)
  const [riskData, setRiskData] = useState(null)
  const [events, setEvents] = useState([])
  const [alerts, setAlerts] = useState([])

  // UI helpers
  const [copiedField, setCopiedField] = useState(null)
  const [eventFilter, setEventFilter] = useState('ALL')

  // Fetch all device data in parallel
  const fetchAllData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    setGeneralError(null)

    try {
      const [deviceRes, riskRes, eventsRes, alertsRes] = await Promise.allSettled([
        getDeviceById(id),
        getRiskBreakdown(id),
        getDeviceEvents(id, 50),
        getDeviceAlerts(id),
      ])

      // Handle Device Fetch Result
      if (deviceRes.status === 'fulfilled') {
        const devData = deviceRes.value?.data || deviceRes.value
        if (!devData) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setDevice(devData)
      } else {
        const statusCode = deviceRes.reason?.response?.status
        if (statusCode === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setGeneralError(
          deviceRes.reason?.response?.data?.message ||
          deviceRes.reason?.message ||
          'Failed to load device information'
        )
      }

      // Handle Risk Breakdown Result
      if (riskRes.status === 'fulfilled') {
        const rData = riskRes.value?.data || riskRes.value
        setRiskData(rData)
      } else {
        console.warn('Risk breakdown fetch failed or empty:', riskRes.reason)
      }

      // Handle Device Events Result
      if (eventsRes.status === 'fulfilled') {
        const evData = eventsRes.value?.data || eventsRes.value
        setEvents(Array.isArray(evData) ? evData : evData?.events || [])
      } else {
        console.warn('Events fetch failed or empty:', eventsRes.reason)
      }

      // Handle Device Alerts Result
      if (alertsRes.status === 'fulfilled') {
        const alData = alertsRes.value?.data || alertsRes.value
        setAlerts(Array.isArray(alData) ? alData : alData?.alerts || [])
      } else {
        console.warn('Alerts fetch failed or empty:', alertsRes.reason)
      }
    } catch (err) {
      console.error('Unexpected error fetching device details:', err)
      if (err.response?.status === 404) {
        setNotFound(true)
      } else {
        setGeneralError(err.message || 'An unexpected error occurred while loading device details')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const copyToClipboard = (text, fieldName) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Formatting helpers
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Recently'
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    if (diffInSeconds < 5) return 'Just now'
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  // Device Status Badge Styling (green trusted, gray unknown, yellow suspicious, red blocked)
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'trusted':
        return {
          wrapper: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
          dot: 'bg-emerald-400',
          label: 'Trusted',
        }
      case 'unknown':
        return {
          wrapper: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
          dot: 'bg-slate-400',
          label: 'Unknown',
        }
      case 'suspicious':
        return {
          wrapper: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
          dot: 'bg-amber-400 animate-pulse',
          label: 'Suspicious',
        }
      case 'blocked':
        return {
          wrapper: 'bg-red-500/15 text-red-400 border border-red-500/30',
          dot: 'bg-red-400 animate-ping',
          label: 'Blocked',
        }
      default:
        return {
          wrapper: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
          dot: 'bg-slate-400',
          label: status || 'Unknown',
        }
    }
  }

  // Severity Badge Styling (green low, yellow medium, red high)
  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'low':
        return {
          wrapper: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
          label: 'LOW',
        }
      case 'medium':
        return {
          wrapper: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
          label: 'MEDIUM',
        }
      case 'high':
        return {
          wrapper: 'bg-red-500/15 text-red-400 border border-red-500/30',
          label: 'HIGH',
        }
      default:
        return {
          wrapper: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
          label: (severity || 'INFO').toUpperCase(),
        }
    }
  }

  // Risk Score UI Mapping
  const getRiskScoreInfo = (score) => {
    const num = typeof score === 'number' ? score : 0
    if (num >= 70) {
      return {
        text: 'text-red-400',
        border: 'border-red-500/40',
        bg: 'bg-red-500/15',
        stroke: '#f87171',
        bar: 'bg-red-500',
        label: 'HIGH THREAT SEVERITY',
        level: 'Critical',
      }
    }
    if (num >= 40) {
      return {
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/15',
        stroke: '#fbbf24',
        bar: 'bg-amber-400',
        label: 'ELEVATED RISK LEVEL',
        level: 'Medium',
      }
    }
    return {
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-500/15',
      stroke: '#34d399',
      bar: 'bg-emerald-400',
      label: 'NORMAL / LOW EXPOSURE',
      level: 'Low',
    }
  }

  // Rule formatting helper
  const formatRuleItem = (item) => {
    if (typeof item === 'string') {
      const meta = RULE_METADATA[item] || {}
      return {
        key: item,
        name: meta.title || item.replace(/_/g, ' ').toUpperCase(),
        desc: meta.desc || 'Security heuristic rule triggered from event analysis.',
        points: meta.defaultPoints || 15,
      }
    }
    const key = item?.rule || item?.name || 'unknown_rule'
    const meta = RULE_METADATA[key] || {}
    return {
      key,
      name: meta.title || item?.title || key.replace(/_/g, ' ').toUpperCase(),
      desc: meta.desc || item?.reason || item?.description || 'Security heuristic rule triggered from event analysis.',
      points: item?.points !== undefined ? item.points : (item?.pointValue ?? meta.defaultPoints ?? 15),
    }
  }

  const currentRiskScore = riskData?.score !== undefined ? riskData.score : (device?.riskScore ?? 0)
  const riskInfo = getRiskScoreInfo(currentRiskScore)
  const statusInfo = getStatusBadge(device?.status)
  const triggeredRules = (riskData?.triggeredRules || []).map(formatRuleItem)

  // Filter events by selected category
  const filteredEvents = events.filter((ev) => {
    if (eventFilter === 'ALL') return true
    return ev.eventType?.toLowerCase().includes(eventFilter.toLowerCase())
  })

  // ===========================================================================
  // 3. CLEAN "DEVICE NOT FOUND" VIEW
  // ===========================================================================
  if (notFound) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 font-sans antialiased relative overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-300">
        <header className="sticky top-0 z-30 bg-[#0b1324]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3 text-white font-mono font-bold text-sm uppercase">
              <span className="text-cyan-400">&larr;</span> Device Security Platform
            </Link>
            <Link
              to="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 transition-colors font-mono text-xs"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-950/50">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-mono text-white tracking-tight">Device Not Found</h1>
            <p className="font-mono text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              The requested device ID <span className="text-cyan-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{id}</span> does not exist or has been removed from the platform inventory.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-md shadow-cyan-500/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Return to Dashboard</span>
            </Link>
            <button
              onClick={fetchAllData}
              className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-xs font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans antialiased relative overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-300 pb-16">
      {/* Background Matrix/Grid Pattern */}
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
              <p className="text-xs text-slate-400 font-mono">Endpoint Security &amp; Anomaly Investigation Console</p>
            </div>
          </div>

          {/* Controls */}
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
            </nav>

            {user && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200">{user.name || user.email}</span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                  Role: {user.role || 'Operator'}
                </span>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={fetchAllData}
              disabled={loading}
              title="Refresh device telemetry"
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

            {/* Logout */}
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

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6 relative z-10">
        {/* ========================================================================= */}
        {/* 8. "BACK TO DASHBOARD" BUTTON/LINK                                       */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-all font-mono text-xs w-fit shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
            <span>Device ID:</span>
            <span className="text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {id || 'N/A'}
            </span>
          </div>
        </div>

        {/* Error message banner if partial error occurred */}
        {generalError && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm font-medium">{generalError}</span>
            </div>
            <button
              onClick={fetchAllData}
              className="px-3 py-1 bg-red-900/60 hover:bg-red-800/80 rounded text-xs font-mono text-white transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. HEADER SECTION (REAL DATA)                                            */}
        {/* ========================================================================= */}
        <section className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-lg shadow-black/40">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-800 rounded w-1/3"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                <div className="h-16 bg-slate-800/60 rounded-lg"></div>
                <div className="h-16 bg-slate-800/60 rounded-lg"></div>
                <div className="h-16 bg-slate-800/60 rounded-lg"></div>
                <div className="h-16 bg-slate-800/60 rounded-lg"></div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                {/* Device Name & Status Badge */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-inner">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.73 4.8A1.5 1.5 0 016.9 4.2h10.2a1.5 1.5 0 011.17.6l2.08 3.75A4.5 4.5 0 0121 11.25"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold text-white font-mono tracking-tight">
                        {device?.name || 'Unnamed Device'}
                      </h2>
                      <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800 uppercase">
                        {device?.deviceType || 'DEVICE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      {/* Status Badge with correct color mapping */}
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono font-semibold uppercase tracking-wider ${statusInfo.wrapper}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`}></span>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={fetchAllData}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors font-mono text-xs cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh Telemetry</span>
                  </button>
                </div>
              </div>

              {/* Metadata Grid: ipAddress, macAddress, deviceType, lastSeen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                {/* IP Address */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 relative group">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">IP Address</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-cyan-400">
                      {device?.ipAddress || '—'}
                    </span>
                    {device?.ipAddress && (
                      <button
                        onClick={() => copyToClipboard(device.ipAddress, 'ip')}
                        className="text-slate-500 hover:text-cyan-300 transition-colors p-1"
                        title="Copy IP Address"
                      >
                        {copiedField === 'ip' ? (
                          <span className="text-[10px] font-mono text-emerald-400">Copied!</span>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* MAC Address */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 relative group">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">MAC Address</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-slate-200">
                      {device?.macAddress || '—'}
                    </span>
                    {device?.macAddress && (
                      <button
                        onClick={() => copyToClipboard(device.macAddress, 'mac')}
                        className="text-slate-500 hover:text-cyan-300 transition-colors p-1"
                        title="Copy MAC Address"
                      >
                        {copiedField === 'mac' ? (
                          <span className="text-[10px] font-mono text-emerald-400">Copied!</span>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Device Type */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Device Type</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-slate-200 capitalize">
                      {device?.deviceType || '—'}
                    </span>
                  </div>
                </div>

                {/* Last Seen */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Last Seen</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-mono text-sm text-slate-200 font-medium">
                        {formatRelativeTime(device?.lastSeen)}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {device?.lastSeen ? formatDateTime(device.lastSeen) : ''}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* 2-Column Asymmetric Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Risk Score Panel + Event History */}
          <div className="lg:col-span-7 space-y-6">
            {/* ========================================================================= */}
            {/* 5. RISK PANEL (REAL RISK SCORE & TRIGGERED RULES LIST)                    */}
            {/* ========================================================================= */}
            <section className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl p-6 shadow-lg shadow-black/40">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">Risk Score Assessment</h3>
                    <p className="text-xs text-slate-400 font-mono">24h Anomaly &amp; Rule Engine Breakdown</p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider ${riskInfo.bg} ${riskInfo.text} border ${riskInfo.border}`}
                >
                  {riskInfo.label}
                </span>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-mono text-slate-400">Evaluating risk breakdown...</span>
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {/* Gauge Display & Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center bg-slate-950/60 border border-slate-800/80 rounded-xl p-5">
                    {/* Circular Radial Gauge */}
                    <div className="sm:col-span-5 flex flex-col items-center justify-center text-center">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="48" fill="transparent" stroke="#1e293b" strokeWidth="10" />
                          <circle
                            cx="60"
                            cy="60"
                            r="48"
                            fill="transparent"
                            stroke={riskInfo.stroke}
                            strokeWidth="10"
                            strokeDasharray={301.6}
                            strokeDashoffset={301.6 - (301.6 * Math.min(100, currentRiskScore)) / 100}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-3xl font-mono font-bold ${riskInfo.text}`}>
                            {currentRiskScore}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold">
                            / 100 PTS
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-300 font-semibold mt-2">
                        Band: <span className={riskInfo.text}>{riskInfo.level} Severity</span>
                      </span>
                    </div>

                    {/* Progress Bar & Summary */}
                    <div className="sm:col-span-7 space-y-3">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                          Active Contributing Rules
                        </div>
                        <div className="text-lg font-mono font-bold text-white mt-0.5">
                          {triggeredRules.length}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            {triggeredRules.length === 1 ? 'rule active' : 'rules active'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>Exposure Index</span>
                          <span className={riskInfo.text}>{currentRiskScore}% Calculated Risk</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${riskInfo.bar}`}
                            style={{ width: `${Math.min(100, currentRiskScore)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Triggered Rules List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                        Contributing Risk Factors
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400">
                        {triggeredRules.length} Triggered
                      </span>
                    </div>

                    {triggeredRules.length === 0 ? (
                      <div className="p-5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-center">
                        <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-xs font-mono text-slate-300 font-semibold">
                          No Risk Rules Triggered
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Device behavior is within normal baseline parameters for the past 24 hours.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {triggeredRules.map((rule, idx) => (
                          <div
                            key={`${rule.key}-${idx}`}
                            className="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <span className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0 animate-pulse" />
                              <div>
                                <div className="text-xs font-mono font-bold text-white">
                                  {rule.name}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5 leading-relaxed">
                                  {rule.desc}
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <span className="px-2.5 py-1 rounded bg-red-950/70 border border-red-500/40 text-red-300 font-mono text-xs font-bold">
                                +{rule.points} pts
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ========================================================================= */}
            {/* 6. EVENT HISTORY SECTION (REAL EVENTS WITH FORMATTED TIMESTAMPS)          */}
            {/* ========================================================================= */}
            <section className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl p-6 shadow-lg shadow-black/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">Event History</h3>
                    <p className="text-xs text-slate-400 font-mono">Recent telemetry and security event log</p>
                  </div>
                </div>

                {/* Category filters */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['ALL', 'PORT_SCAN', 'AUTH', 'LOGIN', 'FIRMWARE'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setEventFilter(tag)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                        eventFilter === tag
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-mono text-slate-400">Streaming device events...</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <svg className="w-8 h-8 mx-auto mb-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="text-xs font-mono">No device events recorded yet.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredEvents.map((ev, idx) => {
                    const isAlertEvent =
                      ev.eventType === 'port_scan' ||
                      ev.eventType === 'failed_auth' ||
                      (ev.eventType === 'login_attempt' && ev.metadata?.success === false)

                    return (
                      <div
                        key={ev._id || idx}
                        className={`p-3 rounded-lg bg-slate-950/80 border transition-all ${
                          isAlertEvent
                            ? 'border-l-4 border-l-amber-400 border-slate-800 hover:border-amber-400/50'
                            : 'border-l-4 border-l-cyan-500 border-slate-800 hover:border-cyan-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                isAlertEvent
                                  ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                  : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                              }`}
                            >
                              {ev.eventType || 'EVENT'}
                            </span>
                            {/* Readable relative time & clean date string */}
                            <span className="text-[11px] font-mono text-slate-300 font-medium">
                              {formatRelativeTime(ev.timestamp || ev.createdAt)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {formatDateTime(ev.timestamp || ev.createdAt)}
                          </span>
                        </div>

                        {/* Metadata snippet if available */}
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <div className="mt-2 p-2 rounded bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                            <code>{JSON.stringify(ev.metadata)}</code>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN: Related Alerts Panel */}
          <div className="lg:col-span-5 space-y-6">
            {/* ========================================================================= */}
            {/* 7. RELATED ALERTS PANEL & 9. CLICKABLE TO /alerts/:alertId                */}
            {/* ========================================================================= */}
            <section className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl p-6 shadow-lg shadow-black/40">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-red-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">Related Alerts</h3>
                    <p className="text-xs text-slate-400 font-mono">Incidents tied to this device</p>
                  </div>
                </div>

                <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {alerts.length} Total
                </span>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-mono text-slate-400">Loading related alerts...</span>
                </div>
              ) : alerts.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <svg className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-mono font-semibold text-slate-300">No Open Alerts</p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    There are no security alerts recorded for this device.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {alerts.map((alert, idx) => {
                    const alertId = alert._id || alert.id || idx
                    const sev = getSeverityBadge(alert.severity)
                    const isOpen = alert.status === 'open'

                    return (
                      <Link
                        key={alertId}
                        to={`/alerts/${alertId}`}
                        className={`block p-4 rounded-lg bg-slate-950/90 border transition-all cursor-pointer group ${
                          alert.severity === 'high'
                            ? 'border-red-500/40 hover:border-red-500 hover:bg-slate-950'
                            : alert.severity === 'medium'
                            ? 'border-amber-500/40 hover:border-amber-500 hover:bg-slate-950'
                            : 'border-slate-800 hover:border-slate-600 hover:bg-slate-950'
                        }`}
                      >
                        {/* Header: Severity Badge + Relative Timestamp */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${sev.wrapper}`}
                          >
                            {sev.label} SEVERITY
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-300">
                            {formatRelativeTime(alert.createdAt || alert.timestamp)}
                          </span>
                        </div>

                        {/* Reason / Threat Text */}
                        <div className="text-xs font-mono font-semibold text-white mt-2.5 leading-relaxed group-hover:text-cyan-300 transition-colors">
                          {alert.reason || 'Security threat detected on endpoint'}
                        </div>

                        {/* Footer: Status Badge & Link Arrow */}
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] font-mono">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOpen ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'
                              }`}
                            />
                            <span
                              className={`font-semibold capitalize ${
                                isOpen ? 'text-red-400' : 'text-emerald-400'
                              }`}
                            >
                              Status: {alert.status || 'open'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-cyan-400 transition-colors">
                            <span>Details</span>
                            <span>&rarr;</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Link to all alerts */}
              <div className="mt-4 pt-3 border-t border-slate-800">
                <Link
                  to="/alerts"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 font-mono text-xs font-semibold transition-colors"
                >
                  <span>View Global Alerts Feed</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
