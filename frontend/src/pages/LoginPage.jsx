import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, setPersistenceMode } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authAPI.login({ email, password })
      const user = data?.user ?? null
      const accessToken = data?.accessToken ?? data?.token ?? null
      const refreshToken = data?.refreshToken ?? null

      if (!user || !accessToken) {
        throw new Error('Login succeeded but the session payload was incomplete.')
      }

      setPersistenceMode(rememberMe ? 'local' : 'session')
      login(user, accessToken, refreshToken)
      toast.success(`Welcome back, ${user?.name ?? 'User'}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err?.message || 'Login failed. Check backend connection and credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Mobile logo */}
      <div className="lg:hidden flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">NexaCRM AI</p>
          <p className="text-brand-400 text-xs">Sales Intelligence Platform</p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white">Sign In</h2>
        <p className="text-slate-400 text-sm mt-1">Access your sales command center</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1.5">Email Address</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email"
            className="w-full rounded-xl border border-slate-600/50 bg-slate-800/50 text-white placeholder:text-slate-500 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/70 transition-all"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password"
              className="w-full rounded-xl border border-slate-600/50 bg-slate-800/50 text-white placeholder:text-slate-500 px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/70 transition-all"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-slate-600"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => toast('Password resets are handled by your admin or identity provider.')}
            className="text-brand-400 hover:text-brand-300"
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" disabled={loading}
          className="w-full btn-primary py-3 text-base gap-2 disabled:opacity-70">
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <LogIn className="w-5 h-5" />
          )}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="text-center text-xs text-slate-500">
        <p>Use your assigned workspace credentials to sign in.</p>
        <p className="mt-2">
          Need access? <Link to="/register" className="text-brand-400 hover:text-brand-300 font-semibold">Request an invite</Link>
        </p>
      </div>
    </motion.div>
  )
}
