import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDashboardSummary } from '../services/dashboardService'
import { getDevices } from '../services/deviceService'
import { getAlerts } from '../services/alertService'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [loadingAlerts, setLoadingAlerts] = useState(true)

  // Error states per section
  const [summaryError, setSummaryError] = useState(null)
  const [devicesError, setDevicesError] = useState(null)
  const [alertsError, setAlertsError] = useState(null)

  // Data states
  const [summary, setSummary] = useState({
    totalDevices: 0,
    devicesByStatus: { trusted: 0, unknown: 0, suspicious: 0, blocked: 0 },
    openAlerts: 0,
    alertsBySeverity: { low: 0, medium: 0, high: 0 },
    avgRiskScore: 0,
  })
  const [devices, setDevices] = useState([])
  const [alerts, setAlerts] = useState([])

  // Filtering & search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchSummary = async () => {
    setLoadingSummary(true)
    setSummaryError(null)
    try {
      const data = await getDashboardSummary()
      if (data) {
        setSummary({
          totalDevices: data.totalDevices ?? 0,
          devicesByStatus: {
            trusted: data.devicesByStatus?.trusted ?? 0,
            unknown: data.devicesByStatus?.unknown ?? 0,
            suspicious: data.devicesByStatus?.suspicious ?? 0,
            blocked: data.devicesByStatus?.blocked ?? 0,
          },
          openAlerts: data.openAlerts ?? 0,
          alertsBySeverity: {
            low: data.alertsBySeverity?.low ?? 0,
            medium: data.alertsBySeverity?.medium ?? 0,
            high: data.alertsBySeverity?.high ?? 0,
          },
          avgRiskScore: data.avgRiskScore ?? 0,
        })
      }
    } catch (err) {
      console.error('Failed to load dashboard summary:', err)
      setSummaryError(err.response?.data?.message || err.message || 'Failed to load summary statistics')
    } finally {
      setLoadingSummary(false)
    }
  }

  const fetchDevicesData = async () => {
    setLoadingDevices(true)
    setDevicesError(null)
    try {
      const data = await getDevices()
      const deviceList = Array.isArray(data) ? data : data?.data || data?.devices || []
      setDevices(deviceList)
    } catch (err) {
      console.error('Failed to load devices:', err)
      setDevicesError(err.response?.data?.message || err.message || 'Failed to load devices list')
    } finally {
      setLoadingDevices(false)
    }
  }

  const fetchAlertsData = async () => {
    setLoadingAlerts(true)
    setAlertsError(null)
    try {
      const data = await getAlerts({ status: 'open', limit: 10 })
      const alertList = Array.isArray(data) ? data : data?.data || data?.alerts || []
      setAlerts(alertList)
    } catch (err) {
      console.error('Failed to load alerts:', err)
      setAlertsError(err.response?.data?.message || err.message || 'Failed to load open alerts')
    } finally {
      setLoadingAlerts(false)
    }
  }

  const fetchAllData = () => {
    fetchSummary()
    fetchDevicesData()
    fetchAlertsData()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleDeviceClick = (deviceId) => {
    if (deviceId) {
      navigate(`/devices/${deviceId}`)
    }
  }

  // Format relative timestamp
  const formatTime = (dateString) => {
    if (!dateString) return 'Just now'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Recently'
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  // Device status badge styling (green trusted, gray unknown, yellow suspicious, red blocked)
  const getStatusBadge = (status) => {
    switch (status) {
      case 'trusted':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      case 'unknown':
        return 'bg-slate-500/15 text-slate-300 border border-slate-500/30'
      case 'suspicious':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
      case 'blocked':
        return 'bg-red-500/15 text-red-400 border border-red-500/30'
      default:
        return 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
    }
  }

  // Severity badge styling (green low, yellow medium, red high)
  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'low':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      case 'medium':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
      case 'high':
        return 'bg-red-500/15 text-red-400 border border-red-500/30'
      default:
        return 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
    }
  }

  // Risk score styling
  const getRiskScoreColor = (score) => {
    if (score >= 70) return { text: 'text-red-400', bar: 'bg-red-500', label: 'High' }
    if (score >= 30) return { text: 'text-amber-400', bar: 'bg-amber-400', label: 'Medium' }
    return { text: 'text-emerald-400', bar: 'bg-emerald-400', label: 'Low' }
  }

  // Filtered devices list
  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      !searchTerm.trim() ||
      (device.name && device.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (device.ipAddress && device.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (device.macAddress && device.macAddress.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || device.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Status breakdown percentages
  const totalDevCount = summary.totalDevices > 0 ? summary.totalDevices : 1
  const trustedPct = Math.round(((summary.devicesByStatus.trusted || 0) / totalDevCount) * 100)
  const unknownPct = Math.round(((summary.devicesByStatus.unknown || 0) / totalDevCount) * 100)
  const suspiciousPct = Math.round(((summary.devicesByStatus.suspicious || 0) / totalDevCount) * 100)
  const blockedPct = Math.round(((summary.devicesByStatus.blocked || 0) / totalDevCount) * 100)

  const isAnyLoading = loadingSummary || loadingDevices || loadingAlerts

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans antialiased relative overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Subtle Security Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#0b1324]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand & Platform Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center shadow-inner shadow-cyan-500/20 text-cyan-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
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
                    Live Active
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-mono">Security Operations Center • Defense Mesh</p>
            </div>
          </div>

          {/* Navigation & Operator Session Controls */}
          <div className="flex items-center gap-4">
            <nav className="hidden lg:flex items-center gap-1 border-r border-slate-800 pr-4">
              <Link
                to="/dashboard"
                className="px-3 py-1.5 rounded text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/30"
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

            {/* Operator Info */}
            {user && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200">{user.name || user.email}</span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                  Role: {user.role || 'Operator'}
                </span>
              </div>
            )}

            {/* Refresh Data Button */}
            <button
              onClick={fetchAllData}
              disabled={isAnyLoading}
              title="Refresh live telemetry"
              className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${isAnyLoading ? 'animate-spin text-cyan-400' : ''}`}
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

            {/* Preserved Logout Button */}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 hover:text-white rounded text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-red-950/30"
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
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 relative z-10">
        {/* ========================================================================= */}
        {/* 1. TOP SUMMARY STAT CARDS (4 COLUMNS)                                     */}
        {/* ========================================================================= */}
        {summaryError ? (
          <div className="p-4 bg-red-950/30 border border-red-800/60 rounded-lg text-red-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Error loading summary statistics: {summaryError}</span>
            </div>
            <button
              onClick={fetchSummary}
              className="text-cyan-400 hover:underline uppercase tracking-wider font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Total Devices */}
            <div className="bg-[#0b1324] border border-slate-800 rounded-lg p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Devices</span>
                <span className="p-1.5 rounded bg-slate-800/80 text-cyan-400 border border-slate-700/60">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3"
                    />
                  </svg>
                </span>
              </div>
              <div className="my-3">
                {loadingSummary ? (
                  <div className="h-9 w-24 bg-slate-800/70 animate-pulse rounded my-1" />
                ) : (
                  <div className="text-3xl font-bold text-white font-mono tracking-tight">
                    {summary.totalDevices.toLocaleString()}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                    Active Mesh
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Endpoints registered</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Telemetry: Online</span>
                <span className="text-cyan-400">100% Monitored</span>
              </div>
            </div>

            {/* Card 2: Open Alerts */}
            <div className="bg-[#0b1324] border border-slate-800 rounded-lg p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Open Alerts</span>
                <span className="p-1.5 rounded bg-red-950/60 text-red-400 border border-red-800/50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </span>
              </div>
              <div className="my-3">
                {loadingSummary ? (
                  <div className="h-9 w-20 bg-slate-800/70 animate-pulse rounded my-1" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-red-400 font-mono tracking-tight">
                      {summary.openAlerts}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">requiring action</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono bg-red-950/60 border border-red-800/60 text-red-300 px-1.5 py-0.5 rounded font-medium">
                    {summary.alertsBySeverity.high} High
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {summary.alertsBySeverity.medium} Med • {summary.alertsBySeverity.low} Low
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Incident Queue</span>
                <Link to="/alerts" className="text-cyan-400 hover:underline">
                  View all &rarr;
                </Link>
              </div>
            </div>

            {/* Card 3: Average Risk Score */}
            <div className="bg-[#0b1324] border border-slate-800 rounded-lg p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Average Risk Score</span>
                <span className="p-1.5 rounded bg-slate-800/80 text-cyan-400 border border-slate-700/60">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                    />
                  </svg>
                </span>
              </div>
              <div className="my-3">
                {loadingSummary ? (
                  <div className="h-9 w-24 bg-slate-800/70 animate-pulse rounded my-1" />
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-bold font-mono tracking-tight ${
                        getRiskScoreColor(summary.avgRiskScore).text
                      }`}
                    >
                      {summary.avgRiskScore}
                      <span className="text-sm text-slate-500 font-normal">/100</span>
                    </span>
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                        summary.avgRiskScore >= 70
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : summary.avgRiskScore >= 30
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      } font-medium`}
                    >
                      {summary.avgRiskScore >= 70
                        ? 'Elevated'
                        : summary.avgRiskScore >= 30
                        ? 'Moderate'
                        : 'Healthy'}
                    </span>
                  </div>
                )}
                {/* Visual risk meter bar */}
                <div className="w-full bg-slate-900 h-2 rounded-full mt-2.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      getRiskScoreColor(summary.avgRiskScore).bar
                    }`}
                    style={{ width: `${Math.min(100, Math.max(4, summary.avgRiskScore))}%` }}
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Baseline Target: &lt; 30</span>
                <span className={getRiskScoreColor(summary.avgRiskScore).text}>
                  {summary.avgRiskScore <= 30 ? 'In Policy' : 'Policy Drift'}
                </span>
              </div>
            </div>

            {/* Card 4: Device Status Breakdown */}
            <div className="bg-[#0b1324] border border-slate-800 rounded-lg p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Status Breakdown</span>
                <span className="text-[11px] font-mono text-slate-400">Total: {summary.totalDevices}</span>
              </div>

              <div className="my-3 space-y-2.5">
                {/* Segmented Visual Progress Bar */}
                <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 flex overflow-hidden gap-0.5">
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{ width: `${summary.totalDevices > 0 ? trustedPct : 0}%` }}
                    title={`Trusted: ${summary.devicesByStatus.trusted} (${trustedPct}%)`}
                  />
                  <div
                    className="bg-slate-500 transition-all duration-500"
                    style={{ width: `${summary.totalDevices > 0 ? unknownPct : 0}%` }}
                    title={`Unknown: ${summary.devicesByStatus.unknown} (${unknownPct}%)`}
                  />
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{ width: `${summary.totalDevices > 0 ? suspiciousPct : 0}%` }}
                    title={`Suspicious: ${summary.devicesByStatus.suspicious} (${suspiciousPct}%)`}
                  />
                  <div
                    className="bg-red-500 transition-all duration-500"
                    style={{ width: `${summary.totalDevices > 0 ? blockedPct : 0}%` }}
                    title={`Blocked: ${summary.devicesByStatus.blocked} (${blockedPct}%)`}
                  />
                </div>

                {/* 4 Colored Counts */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-xs font-mono">
                  <div className="flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="text-slate-400 text-[11px]">Trusted:</span>
                    </div>
                    <span className="font-bold text-emerald-400">{summary.devicesByStatus.trusted}</span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0"></span>
                      <span className="text-slate-400 text-[11px]">Unknown:</span>
                    </div>
                    <span className="font-bold text-slate-300">{summary.devicesByStatus.unknown}</span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span className="text-slate-400 text-[11px]">Suspicious:</span>
                    </div>
                    <span className="font-bold text-amber-400">{summary.devicesByStatus.suspicious}</span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                      <span className="text-slate-400 text-[11px]">Blocked:</span>
                    </div>
                    <span className="font-bold text-red-400">{summary.devicesByStatus.blocked}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Classification</span>
                <span className="text-slate-300 font-mono">4-State Matrix</span>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* 2 & 3. DUAL-COLUMN LAYOUT: DEVICE TABLE & ALERTS FEED                     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* ======================================================================= */}
          {/* MAIN DEVICE LIST SECTION (TABLE) — col-span-8                          */}
          {/* ======================================================================= */}
          <section className="xl:col-span-8 bg-[#0b1324] border border-slate-800 rounded-lg overflow-hidden shadow-xl flex flex-col">
            {/* Header & Controls Toolbar */}
            <div className="p-5 border-b border-slate-800 bg-[#0e172a] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white font-mono uppercase tracking-tight">
                    Monitored Endpoints
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-semibold">
                    {filteredDevices.length} Live
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 hidden sm:inline">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[#020617] border border-slate-700 text-slate-200 text-xs font-mono rounded px-2.5 py-1.5 focus:border-cyan-500 outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="trusted">Trusted</option>
                    <option value="unknown">Unknown</option>
                    <option value="suspicious">Suspicious</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <svg
                  className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search device by hostname, IP address, MAC..."
                  className="w-full bg-[#020617] border border-slate-800 text-slate-200 text-xs font-mono rounded-md pl-9 pr-4 py-2 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Error in Devices Section */}
            {devicesError ? (
              <div className="p-8 text-center text-red-400 font-mono text-xs">
                <p>Failed to load devices: {devicesError}</p>
                <button
                  onClick={fetchDevicesData}
                  className="mt-3 px-3 py-1.5 bg-red-950/60 border border-red-800/80 text-red-200 rounded hover:bg-red-900/80 transition-colors uppercase tracking-wider"
                >
                  Retry Loading Devices
                </button>
              </div>
            ) : (
              /* Devices Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#070e1c] text-slate-400 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Device Name &amp; Network IP</th>
                      <th className="py-3 px-3 font-semibold">Status</th>
                      <th className="py-3 px-3 font-semibold">Risk Score</th>
                      <th className="py-3 px-3 font-semibold">Last Seen</th>
                      <th className="py-3 px-4 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                    {loadingDevices ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500 font-mono">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <svg className="w-6 h-6 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            <span>Loading monitored endpoints...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          <p className="text-slate-400">No matching devices found.</p>
                          <p className="text-[11px] text-slate-600 mt-1">
                            {searchTerm || statusFilter !== 'all'
                              ? 'Try adjusting search query or status filter.'
                              : 'No devices have been registered yet.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((device) => {
                        const deviceId = device._id || device.id
                        const score = typeof device.riskScore === 'number' ? device.riskScore : 0
                        const riskStyle = getRiskScoreColor(score)

                        return (
                          <tr
                            key={deviceId || Math.random()}
                            onClick={() => handleDeviceClick(deviceId)}
                            className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                          >
                            {/* Name & IP */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-cyan-400 shrink-0 group-hover:border-cyan-500/40">
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.75 5.1a1.5 1.5 0 011.2-.6h10.1a1.5 1.5 0 011.2.6l1.85 3.45a4.5 4.5 0 01.9 2.7"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <span className="font-bold text-slate-100 group-hover:text-cyan-400 transition-colors block">
                                    {device.name || 'Unnamed Device'}
                                  </span>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                    <span>{device.ipAddress || '0.0.0.0'}</span>
                                    {device.deviceType && (
                                      <>
                                        <span>•</span>
                                        <span className="uppercase text-slate-500">{device.deviceType}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Status Badge */}
                            <td className="py-3.5 px-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${getStatusBadge(
                                  device.status
                                )}`}
                              >
                                {device.status || 'unknown'}
                              </span>
                            </td>

                            {/* Risk Score */}
                            <td className="py-3.5 px-3">
                              <div className="space-y-1 w-28">
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className={`font-bold ${riskStyle.text}`}>{score}/100</span>
                                  <span className="text-slate-400">{riskStyle.label}</span>
                                </div>
                                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                                  <div
                                    className={`h-full rounded-full ${riskStyle.bar}`}
                                    style={{ width: `${Math.min(100, Math.max(4, score))}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Last Seen */}
                            <td className="py-3.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                              {formatTime(device.lastSeen || device.createdAt)}
                            </td>

                            {/* Action Button */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeviceClick(deviceId)
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 border border-slate-700 text-[11px] transition-colors cursor-pointer"
                              >
                                <span>Inspect</span>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer */}
            <div className="p-3.5 bg-[#070e1c] border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>
                Showing <strong className="text-slate-200">{filteredDevices.length}</strong> of{' '}
                <strong className="text-slate-200">{devices.length}</strong> loaded endpoints
              </span>
              <span className="text-slate-500">Live Telemetry</span>
            </div>
          </section>

          {/* ======================================================================= */}
          {/* 3. RECENT ALERTS FEED PANEL (~30% -> col-span-4)                         */}
          {/* ======================================================================= */}
          <section className="xl:col-span-4 bg-[#0b1324] border border-slate-800 rounded-lg overflow-hidden shadow-xl flex flex-col">
            {/* Alerts Panel Header */}
            <div className="p-4 border-b border-slate-800 bg-[#0e172a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded bg-red-950/60 text-red-400 border border-red-800/50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                    />
                  </svg>
                </span>
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-tight">
                  Recent Alerts Feed
                </h3>
              </div>
              <Link
                to="/alerts"
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline"
              >
                All Alerts &rarr;
              </Link>
            </div>

            {/* Error in Alerts Section */}
            {alertsError ? (
              <div className="p-6 text-center text-red-400 font-mono text-xs">
                <p>Failed to load alerts: {alertsError}</p>
                <button
                  onClick={fetchAlertsData}
                  className="mt-3 px-3 py-1.5 bg-red-950/60 border border-red-800/80 text-red-200 rounded hover:bg-red-900/80 transition-colors uppercase tracking-wider"
                >
                  Retry Loading Alerts
                </button>
              </div>
            ) : (
              /* Alerts Feed List */
              <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-[580px]">
                {loadingAlerts ? (
                  <div className="p-8 text-center text-slate-500 font-mono text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Loading active alerts...</span>
                    </div>
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-mono text-xs">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-slate-400 font-medium">All clear — No open alerts</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">Threat detection is standing by.</p>
                  </div>
                ) : (
                  alerts.map((alert) => {
                    const alertId = alert._id || alert.id
                    const targetDevice = alert.device
                    const targetDeviceId = typeof targetDevice === 'object' ? targetDevice?._id || targetDevice?.id : targetDevice
                    const targetDeviceName = typeof targetDevice === 'object' ? targetDevice?.name : 'Monitored Endpoint'

                    return (
                      <article
                        key={alertId || Math.random()}
                        className="p-4 hover:bg-slate-800/30 transition-colors space-y-2 font-mono"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getSeverityBadge(
                              alert.severity
                            )}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                alert.severity === 'high'
                                  ? 'bg-red-400 animate-pulse'
                                  : alert.severity === 'medium'
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                            />
                            {alert.severity || 'low'} Severity
                          </span>
                          <span className="text-[11px] text-slate-500">{formatTime(alert.createdAt)}</span>
                        </div>

                        <div>
                          <p className="text-xs font-sans font-medium text-slate-200 line-clamp-2">
                            {alert.reason || 'Anomalous activity detected'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-400">
                            <span>Target:</span>
                            {targetDeviceId ? (
                              <button
                                onClick={() => handleDeviceClick(targetDeviceId)}
                                className="text-cyan-400 hover:underline font-semibold text-left"
                              >
                                {targetDeviceName}
                              </button>
                            ) : (
                              <span className="text-cyan-400 font-semibold">{targetDeviceName}</span>
                            )}
                            {alert.status && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 uppercase">{alert.status}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="pt-1 flex items-center gap-2">
                          <Link
                            to="/alerts"
                            className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950/80 hover:text-cyan-300 text-slate-300 text-[11px] font-mono rounded border border-slate-700/80 transition-colors"
                          >
                            Triage Alert &rarr;
                          </Link>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>
            )}

            {/* Alerts Feed Footer */}
            <div className="p-3 bg-[#070e1c] border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span>Rule Engine: Active</span>
              </div>
              <span className="text-cyan-400">{summary.openAlerts} Pending</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
