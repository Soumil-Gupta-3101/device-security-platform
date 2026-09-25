import { Link, useParams } from 'react-router-dom'

export default function AlertDetailPage() {
  const { alertId, id } = useParams()
  const currentId = alertId || id

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 transition-colors font-mono text-xs"
        >
          &larr; Back to Dashboard
        </Link>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold font-mono text-white">Alert Details</h1>
          <p className="font-mono text-xs text-slate-400">
            Alert ID: <span className="text-cyan-400">{currentId || 'N/A'}</span>
          </p>
          <p className="text-sm text-slate-500">
            Detailed investigation view for this alert is currently under development.
          </p>
        </div>
      </div>
    </div>
  )
}
