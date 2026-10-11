import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAlertById, updateAlertStatus, addAlertNote } from '../services/alertService'

// Helper to format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Just now'

  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)

  if (diffInSeconds < 10) return 'Just now'
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes === 1) return '1 minute ago'
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
  const diffInHours = Math.floor(diffInSeconds / 60)
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
        label: 'LOW SEVERITY',
      }
    case 'medium':
      return {
        wrapper: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        dot: 'bg-amber-400',
        label: 'MEDIUM SEVERITY',
      }
    case 'high':
      return {
        wrapper: 'bg-red-500/15 text-red-400 border border-red-500/30',
        dot: 'bg-red-400 animate-pulse',
        label: 'HIGH SEVERITY',
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

export default function AlertDetailPage() {
  const { id, alertId } = useParams()
  const currentId = id || alertId
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Alert State
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  // Status update state
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  // Note creation state
  const [noteText, setNoteText] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [noteError, setNoteError] = useState(null)

  // Fetch alert details
  const fetchAlert = useCallback(async () => {
    if (!currentId) return
    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const data = await getAlertById(currentId)
      if (!data) {
        setNotFound(true)
      } else {
        setAlert(data)
      }
    } catch (err) {
      console.error('Error fetching alert details:', err)
      if (err.response?.status === 404) {
        setNotFound(true)
      } else {
        setError(
          err.response?.data?.message ||
          err.message ||
          'Failed to load alert details'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [currentId])

  useEffect(() => {
    fetchAlert()
  }, [fetchAlert])

  // Handle status update
  const handleStatusChange = async (newStatus) => {
    if (!alert || alert.status === newStatus || statusUpdating) return
    setStatusUpdating(true)
    setStatusMessage(null)

    try {
      const updated = await updateAlertStatus(currentId, newStatus)
      setAlert((prev) => ({
        ...prev,
        status: updated?.status || newStatus,
      }))
      setStatusMessage(`Status updated to ${newStatus}`)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error('Failed to update status:', err)
      setStatusMessage(`Failed to update status: ${err.response?.data?.message || err.message}`)
    } finally {
      setStatusUpdating(false)
    }
  }

  // Handle adding a new note
  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!noteText.trim() || submittingNote) return
    setSubmittingNote(true)
    setNoteError(null)

    try {
      await addAlertNote(currentId, noteText.trim())
      setNoteText('')

      // Refetch alert to ensure newly created note with populated author is displayed
      const refreshed = await getAlertById(currentId)
      if (refreshed) {
        setAlert(refreshed)
      }
    } catch (err) {
      console.error('Failed to add note:', err)
      setNoteError(
        err.response?.data?.message ||
        err.message ||
        'Could not post incident note'
      )
    } finally {
      setSubmittingNote(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center font-mono text-xs">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400">Loading incident telemetry dossier...</p>
        </div>
      </div>
    )
  }

  // Not found state (404)
  if (notFound) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0b1324] border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-mono text-white">Alert Not Found</h2>
          <p className="text-xs text-slate-400 font-mono">
            No incident was found matching identifier: <span className="text-cyan-400">{currentId}</span>
          </p>
          <div className="pt-2">
            <Link
              to="/alerts"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-mono font-semibold text-xs hover:bg-cyan-400 transition-colors"
            >
              &larr; Back to Alerts
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // General error state
  if (error || !alert) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0b1324] border border-red-900/40 rounded-2xl p-8 text-center space-y-4">
          <h2 className="text-lg font-bold font-mono text-red-400">Failed to Load Alert</h2>
          <p className="text-xs text-slate-400 font-mono">{error || 'An unexpected error occurred'}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={fetchAlert}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200"
            >
              Retry
            </button>
            <Link
              to="/alerts"
              className="px-4 py-2 rounded-lg bg-cyan-950 border border-cyan-500/40 text-xs font-mono text-cyan-400"
            >
              Back to Alerts
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const sev = getSeverityBadge(alert.severity)
  const stat = getStatusBadge(alert.status)
  const deviceId = alert.device?._id || alert.device
  const deviceName = alert.device?.name || alert.device || 'Unassigned Device'

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
                    Incident Dossier
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-mono">Security Operations Center • Threat Investigation</p>
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
              onClick={logout}
              className="px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 border border-red-900/40 text-red-400 text-xs font-mono transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 pt-8 space-y-6">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/alerts"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0b1324] border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition-colors font-mono text-xs"
          >
            &larr; Back to Alerts
          </Link>

          <span className="text-xs font-mono text-slate-500">
            Detected: {formatRelativeTime(alert.createdAt)} ({new Date(alert.createdAt).toLocaleTimeString()})
          </span>
        </div>

        {/* Status update notification banner */}
        {statusMessage && (
          <div className="px-4 py-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono animate-fade-in flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-cyan-400 hover:text-cyan-200">
              &times;
            </button>
          </div>
        )}

        {/* Primary Alert Overview Card */}
        <div className="bg-[#0b1324]/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          {/* Header Row: Title, Badges, ID */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold tracking-wider ${sev.wrapper}`}>
                  <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
                  {sev.label}
                </span>

                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium ${stat.wrapper}`}>
                  <span className={`w-2 h-2 rounded-full ${stat.dot}`} />
                  {stat.label}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight pt-1">
                {alert.reason}
              </h2>

              <p className="text-xs font-mono text-slate-400">
                Incident Identifier: <span className="text-cyan-400 font-bold">{alert._id}</span>
              </p>
            </div>

            {/* Status Change Control */}
            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Update Status
                </p>
                {statusUpdating && (
                  <span className="text-[10px] font-mono text-cyan-400 animate-pulse">
                    Saving...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {['open', 'investigating', 'resolved'].map((s) => {
                  const isCurrent = alert.status?.toLowerCase() === s
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={isCurrent || statusUpdating}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium capitalize transition-all ${
                        isCurrent
                          ? s === 'open'
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                            : s === 'investigating'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/30'
                            : 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50'
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Alert Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Associated Device Link Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Target Endpoint / Device
              </span>
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-1">
                  {deviceId ? (
                    <Link
                      to={`/devices/${deviceId}`}
                      className="flex items-center gap-2 font-mono text-sm font-semibold text-white hover:text-cyan-400 transition-colors group"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                      <span className="group-hover:underline">{deviceName}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 font-mono text-sm font-semibold text-white">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                      <span>{deviceName}</span>
                    </div>
                  )}

                  {deviceId && (
                    <p className="text-xs font-mono text-slate-500">ID: {deviceId}</p>
                  )}
                </div>

                {deviceId && (
                  <Link
                    to={`/devices/${deviceId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-colors font-mono text-xs font-medium"
                  >
                    <span>View Device</span>
                    <span>&rarr;</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Detection Timestamp Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Detection Telemetry
              </span>
              <div className="space-y-1 pt-1">
                <p className="text-sm font-mono font-semibold text-slate-200">
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
                <p className="text-xs font-mono text-slate-500">
                  Relative: {formatRelativeTime(alert.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Reason & Description Breakdown */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Full Security Event Context &amp; Reason
            </h3>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 text-sm leading-relaxed font-mono">
              {alert.reason}
            </div>
          </div>
        </div>

        {/* Incident Notes & Investigation Collaboration Section */}
        <div className="bg-[#0b1324]/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold font-mono text-white tracking-tight uppercase">
                Investigation Notes &amp; Activity Log
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] font-mono text-cyan-400">
                {alert.notes?.length || 0}
              </span>
            </div>
          </div>

          {/* Notes list */}
          <div className="space-y-3">
            {!alert.notes || alert.notes.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                <p className="text-xs font-mono text-slate-400">No analytical notes recorded for this incident yet.</p>
                <p className="text-[11px] text-slate-500">
                  Use the field below to document triage findings, mitigation steps, or forensic updates.
                </p>
              </div>
            ) : (
              alert.notes.map((note, idx) => {
                const authorName = note.author?.name || note.author || 'Operator'
                const noteTime = note.createdAt ? formatRelativeTime(note.createdAt) : 'Recently'
                const fullTime = note.createdAt ? new Date(note.createdAt).toLocaleString() : ''

                return (
                  <div
                    key={note._id || idx}
                    className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                          {authorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-200">{authorName}</span>
                      </div>
                      <span className="text-slate-500 text-[11px]" title={fullTime}>
                        {noteTime}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans pl-7">
                      {note.text}
                    </p>
                  </div>
                )
              })
            )}
          </div>

          {/* Note Input Form */}
          <form onSubmit={handleAddNote} className="space-y-3 pt-4 border-t border-slate-800/80">
            <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Add Incident Note
            </label>
            <div className="space-y-2">
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter investigation observations, forensic analysis, or containment instructions..."
                className="w-full p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-sans text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors resize-none"
              />

              {noteError && (
                <p className="text-xs font-mono text-red-400">{noteError}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!noteText.trim() || submittingNote}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-mono font-bold text-xs transition-colors flex items-center gap-2"
                >
                  {submittingNote ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Add Note</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
