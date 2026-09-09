import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, PlayCircle, ExternalLink, Mic, RefreshCw
} from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useLeadsStore } from '../../store/leadsStore'
import { useAuthStore } from '../../store/authStore'
import { analyticsAPI } from '../../services/api'
import LeadConversionDashboard from './lead-conversion/LeadConversionDashboard'

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">
            {p.dataKey === 'revenue' ? `₹${(p.value / 100000).toFixed(1)}L` : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

const INSIGHT_ROUTES = {
  'Schedule Call':  '/communication',
  'Send Follow-up': '/communication',
  'View Profile':   '/customers',
  'Plan Campaign':  '/ai-engine',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { replaceLeads } = useLeadsStore()
  const { user } = useAuthStore()
  const [liveInsights, setLiveInsights] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [recentCallSnapshots, setRecentCallSnapshots] = useState([])
  const [dashboardWidgets, setDashboardWidgets] = useState({
    agingCounts: { fresh: 0, warning: 0, critical: 0 },
    slaSummary: { total: 0, unattendedCritical: 0, pending: 0, met: 0, breached: 0, avgResponseMinutes: null },
    employeePerformance: [],
    monthlyRevenue: [],
    funnelData: [],
    leadSources: [],
  })
  const [callSnapshotsLoading, setCallSnapshotsLoading] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [refreshingSection, setRefreshingSection] = useState('')
  const mountedRef = useRef(true)
  const loadSeqRef = useRef(0)
  const firstName = (user?.name || 'User').trim().split(/\s+/)[0]

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadDashboard = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent)
    const requestId = loadSeqRef.current + 1
    loadSeqRef.current = requestId

    if (!silent && mountedRef.current) {
      setDashboardLoading(true)
      setDashboardError('')
      setCallSnapshotsLoading(true)
    }

    try {
      const [overview, widgets] = await Promise.all([
        analyticsAPI.getDashboard(),
        analyticsAPI.getDashboardWidgets(),
      ])

      if (!mountedRef.current || loadSeqRef.current !== requestId) return

      replaceLeads(Array.isArray(overview?.leads) ? overview.leads : [])
      setLiveInsights(Array.isArray(overview?.insights) ? overview.insights : [])
      setRecentActivity(Array.isArray(overview?.recentActivity) ? overview.recentActivity : [])
      setRecentCallSnapshots(Array.isArray(overview?.recentCallSnapshots) ? overview.recentCallSnapshots : [])
      setDashboardWidgets({
        agingCounts: widgets?.agingCounts || { fresh: 0, warning: 0, critical: 0 },
        slaSummary: widgets?.slaSummary || { total: 0, unattendedCritical: 0, pending: 0, met: 0, breached: 0, avgResponseMinutes: null },
        employeePerformance: Array.isArray(widgets?.employeePerformance) ? widgets.employeePerformance : [],
        monthlyRevenue: Array.isArray(widgets?.monthlyRevenue) ? widgets.monthlyRevenue : [],
        funnelData: Array.isArray(widgets?.funnelData) ? widgets.funnelData : [],
        leadSources: Array.isArray(widgets?.leadSources) ? widgets.leadSources : [],
      })
      setCallSnapshotsLoading(false)

      setLastRefreshedAt(overview?.generatedAt || new Date().toISOString())
    } catch (err) {
      if (!mountedRef.current || loadSeqRef.current !== requestId) return
      setDashboardError(err?.message || 'Failed to load live dashboard data')
      setLiveInsights([])
      setRecentActivity([])
      setRecentCallSnapshots([])
      setDashboardWidgets({
        agingCounts: { fresh: 0, warning: 0, critical: 0 },
        slaSummary: { total: 0, unattendedCritical: 0, pending: 0, met: 0, breached: 0, avgResponseMinutes: null },
        employeePerformance: [],
        monthlyRevenue: [],
        funnelData: [],
        leadSources: [],
      })
      setCallSnapshotsLoading(false)
    } finally {
      if (mountedRef.current && loadSeqRef.current === requestId && !silent) {
        setDashboardLoading(false)
      }
      if (mountedRef.current && loadSeqRef.current === requestId) {
        setCallSnapshotsLoading(false)
      }
    }
  }, [replaceLeads])

  const refreshSection = useCallback(async (section = 'dashboard') => {
    setRefreshingSection(section)
    try {
      await loadDashboard({ silent: true })
    } finally {
      if (mountedRef.current) setRefreshingSection('')
    }
  }, [loadDashboard])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const id = window.setInterval(() => {
      loadDashboard({ silent: true })
    }, 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [loadDashboard])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Welcome back, {firstName} 👋 — Here&apos;s your overview</p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshedAt && (
            <span className="hidden sm:inline-flex text-[11px] text-slate-500 dark:text-slate-400">
              Updated {new Date(lastRefreshedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadDashboard()}
            disabled={dashboardLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
            title="Refresh live dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dashboardLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {(dashboardLoading || dashboardError) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${dashboardError ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200' : 'border-slate-200 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'}`}>
          {dashboardError || 'Refreshing live dashboard data…'}
        </div>
      )}

      {/* Lead Conversion Dashboard Module */}
      <LeadConversionDashboard />

      {/* Lead Aging + SLA Monitoring */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Lead Aging Monitor</h2>
              <button
                type="button"
                onClick={() => refreshSection('aging')}
                className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh this widget"
                aria-label="Refresh lead aging monitor"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingSection === 'aging' ? 'animate-spin text-slate-600' : ''}`} />
              </button>
            </div>
            <span className="text-xs text-slate-500">Live SLA bands</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Fresh (0-15 min)</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{dashboardWidgets.agingCounts.fresh}</p>
            </div>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Warning (15-60 min)</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{dashboardWidgets.agingCounts.warning}</p>
            </div>
            <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 p-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">Critical (60+ min)</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{dashboardWidgets.agingCounts.critical}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
              <p className="text-[11px] text-slate-500">Unattended 1+ hr</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{dashboardWidgets.slaSummary.unattendedCritical}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
              <p className="text-[11px] text-slate-500">Avg response</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {dashboardWidgets.slaSummary.avgResponseMinutes === null ? '--' : `${(dashboardWidgets.slaSummary.avgResponseMinutes / 60).toFixed(1)}h`}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
              <p className="text-[11px] text-slate-500">SLA met</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{dashboardWidgets.slaSummary.met}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
              <p className="text-[11px] text-slate-500">SLA breached</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{dashboardWidgets.slaSummary.breached}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Employee SLA Performance</h2>
            <button
              type="button"
              onClick={() => refreshSection('employee')}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh this widget"
              aria-label="Refresh employee SLA performance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingSection === 'employee' ? 'animate-spin text-slate-600' : ''}`} />
            </button>
          </div>
          <div className="space-y-2">
            {dashboardWidgets.employeePerformance.length === 0 && (
              <p className="text-xs text-slate-400">No employee data yet.</p>
            )}
            {dashboardWidgets.employeePerformance.map((row) => (
              <div key={row.owner} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{row.owner}</p>
                  <span className="text-[10px] text-slate-500">{row.total} leads</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-600 dark:text-emerald-400">Met {row.met}</span>
                  <span className="text-red-600 dark:text-red-400">Breached {row.breached}</span>
                  <span className="text-amber-600 dark:text-amber-400">Unattended {row.unattended}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Revenue & Deals</h2>
              <button
                type="button"
                onClick={() => refreshSection('revenue')}
                className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh this widget"
                aria-label="Refresh revenue widget"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingSection === 'revenue' ? 'animate-spin text-slate-600' : ''}`} />
              </button>
            </div>
            <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dashboardWidgets.monthlyRevenue} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDeals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="revenue" orientation="left" tickFormatter={(v) => `₹${v / 100000}L`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="deals" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Area yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#gradRevenue)" />
              <Area yAxisId="deals"   type="monotone" dataKey="deals"   name="Deals"   stroke="#10b981" strokeWidth={2.5} fill="url(#gradDeals)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Sources */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Lead Sources</h2>
            <button
              type="button"
              onClick={() => refreshSection('sources')}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh this widget"
              aria-label="Refresh lead sources widget"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingSection === 'sources' ? 'animate-spin text-slate-600' : ''}`} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={dashboardWidgets.leadSources} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {dashboardWidgets.leadSources.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`, 'Share']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-3">
            {dashboardWidgets.leadSources.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {s.name} <span className="text-slate-400">({s.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent call recordings */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Recent Call Recordings</h2>
              <button
                type="button"
                onClick={() => refreshSection('calls')}
                className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh this widget"
                aria-label="Refresh recent call recordings widget"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingSection === 'calls' ? 'animate-spin text-slate-600' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-slate-500">Pulled from live call intelligence</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Mic className="w-3.5 h-3.5" />
            Live call review
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {callSnapshotsLoading && recentCallSnapshots.length === 0 && (
            <div className="col-span-full text-sm text-slate-500">Loading call recordings…</div>
          )}
          {!callSnapshotsLoading && recentCallSnapshots.length === 0 && (
            <div className="col-span-full text-sm text-slate-500">No call recordings available yet.</div>
          )}

          {recentCallSnapshots.map((item) => (
            <div key={item.leadId} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.leadName}</p>
                  <p className="text-[11px] text-slate-500">{item.company || 'No company'} · {item.currentStatus}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  {item.verdict}
                </span>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">AI Review</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1 line-clamp-3">
                  {item.summary || 'No summary available yet.'}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  Confidence {item.confidence}%
                </span>
                {item.recordingUrl ? (
                  <a
                    href={item.recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Open recording
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-400">No recording URL yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Funnel */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Sales Funnel</h2>
            <button
              type="button"
              onClick={() => refreshSection('funnel')}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh this widget"
              aria-label="Refresh sales funnel widget"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingSection === 'funnel' ? 'animate-spin text-slate-600' : ''}`} />
            </button>
          </div>
          <div className="space-y-2">
            {dashboardWidgets.funnelData.map((stage, i) => {
              const pct = Math.round((stage.count / Math.max(1, dashboardWidgets.funnelData[0]?.count || 1)) * 100)
              return (
                <div key={stage.stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400">{stage.stage}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {stage.count.toLocaleString()}
                      <span className="text-slate-400 font-medium ml-1">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-6 rounded-lg bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-lg"
                      style={{ background: stage.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* AI Insights */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">AI Insights</h2>
            <button
              type="button"
              onClick={() => refreshSection('insights')}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh this widget"
              aria-label="Refresh AI insights widget"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingSection === 'insights' ? 'animate-spin text-slate-600' : ''}`} />
            </button>
          </div>
          <div className="space-y-3">
            {liveInsights.map((insight) => (
              <div key={insight.id} className={`rounded-xl p-3 border text-xs space-y-1.5
                ${insight.type === 'prediction' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40' :
                  insight.type === 'warning'    ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800/40' :
                  insight.type === 'opportunity'? 'bg-brand-50 border-brand-200 dark:bg-brand-950/20 dark:border-brand-800/40' :
                  'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-800/40'}`}>
                <p className="font-semibold text-slate-700 dark:text-slate-300">{insight.title}</p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{insight.body}</p>
                <button
                  onClick={() => navigate(INSIGHT_ROUTES[insight.action] ?? '/dashboard')}
                  className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                  {insight.action} →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Recent Activity</h2>
            <button
              type="button"
              onClick={() => refreshSection('activity')}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh this widget"
              aria-label="Refresh recent activity widget"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingSection === 'activity' ? 'animate-spin text-slate-600' : ''}`} />
            </button>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-64 custom-scrollbar pr-1">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm flex-shrink-0 font-medium">
                  {item.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{item.text}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.time} · {item.user}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
