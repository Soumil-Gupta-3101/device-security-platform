import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Authentication failed. Please verify your credentials.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Subtle Security Grid & Radial Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <main className="w-full max-w-md relative z-10">
        <div className="bg-[#0b1324] border border-slate-800 rounded-lg p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-sm">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 mb-4 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center shadow-inner shadow-cyan-500/10">
              <svg
                className="w-8 h-8 text-cyan-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
              Device Security &amp;
              <span className="block text-cyan-400 text-sm font-semibold tracking-normal mt-0.5">
                Threat Monitoring Platform
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">
              Operator Authentication
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-950/50 border border-red-800/80 rounded text-red-300 text-xs flex items-center gap-2 font-mono">
              <svg className="w-4 h-4 shrink-0 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@security.local"
                  className="w-full bg-[#030914] border border-slate-700/80 rounded px-3 py-2.5 pl-10 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#030914] border border-slate-700/80 rounded px-3 py-2.5 pl-10 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm py-2.5 px-4 rounded transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 uppercase tracking-wide cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              Register
            </Link>
          </div>

          {/* Security Badge */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono uppercase tracking-wider">
            <svg className="w-3.5 h-3.5 text-cyan-500/60" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
                clipRule="evenodd"
              />
            </svg>
            <span>Encrypted Session</span>
          </div>
        </div>
      </main>
    </div>
  )
}
